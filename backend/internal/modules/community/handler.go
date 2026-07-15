package community

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
)

// Handler holds dependencies for community-related HTTP handlers.
type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

// NewHandler creates a new community Handler.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

// ── Create Proposal ──────────────────────────────

// CreateProposal submits a new community proposal.
// POST /api/v1/proposals
func (h *Handler) CreateProposal(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req CreateProposalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	// Generate slug from name
	slug := generateSlug(req.Name)

	// Check slug uniqueness and append suffix if needed
	slug, err := h.ensureUniqueSlug(r, slug)
	if err != nil {
		log.Printf("error ensuring unique slug: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Default category if empty
	category := req.Category
	if category == "" {
		category = "general"
	}

	// Insert the proposal
	var community Community
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO communities (name, slug, description, category, tags, logo_url, banner_url, owner_id, visibility, is_proposal, upvotes_count, member_count)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'public', true, 1, 0)
		 RETURNING id, name, slug, description, category, tags, logo_url, banner_url, owner_id, visibility, is_proposal, upvotes_count, member_count, created_at, updated_at`,
		req.Name, slug, req.Description, category, pq.Array(req.Tags),
		req.LogoURL, req.BannerURL, userID,
	).Scan(
		&community.ID, &community.Name, &community.Slug, &community.Description,
		&community.Category, pq.Array(&community.Tags), &community.LogoURL, &community.BannerURL,
		&community.OwnerID, &community.Visibility, &community.IsProposal,
		&community.UpvotesCount, &community.MemberCount,
		&community.CreatedAt, &community.UpdatedAt,
	)
	if err != nil {
		log.Printf("error creating proposal: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// The creator auto-votes for their own proposal
	h.db.ExecContext(r.Context(),
		`INSERT INTO community_votes (user_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, community.ID,
	)

	writeJSON(w, http.StatusCreated, community)
}

// ── List Proposals ───────────────────────────────

// ListProposals returns all pending community proposals.
// GET /api/v1/proposals
func (h *Handler) ListProposals(w http.ResponseWriter, r *http.Request) {
	page, perPage := parsePagination(r)
	offset := (page - 1) * perPage

	// Count total proposals
	var total int
	h.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM communities WHERE is_proposal = true`,
	).Scan(&total)

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, name, slug, description, category, tags, logo_url, banner_url, owner_id,
		        visibility, is_proposal, upvotes_count, member_count, created_at, updated_at
		 FROM communities
		 WHERE is_proposal = true
		 ORDER BY upvotes_count DESC, created_at DESC
		 LIMIT $1 OFFSET $2`,
		perPage, offset,
	)
	if err != nil {
		log.Printf("error listing proposals: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	communities := []Community{}
	for rows.Next() {
		var c Community
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.Description, &c.Category, pq.Array(&c.Tags),
			&c.LogoURL, &c.BannerURL, &c.OwnerID, &c.Visibility,
			&c.IsProposal, &c.UpvotesCount, &c.MemberCount,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			log.Printf("error scanning proposal: %v", err)
			continue
		}
		communities = append(communities, c)
	}

	writeJSON(w, http.StatusOK, CommunityListResponse{
		Communities: communities,
		Total:       total,
		Page:        page,
		PerPage:     perPage,
	})
}

// ── Vote on Proposal ─────────────────────────────

// VoteProposal registers an upvote on a community proposal.
// If the upvote count reaches the threshold, the community is auto-provisioned.
// POST /api/v1/proposals/:id/vote
func (h *Handler) VoteProposal(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Verify this is still a proposal
	var isProposal bool
	err := h.db.QueryRowContext(r.Context(),
		`SELECT is_proposal FROM communities WHERE id = $1`, communityID,
	).Scan(&isProposal)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "proposal not found"})
		return
	}
	if err != nil {
		log.Printf("error checking proposal: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if !isProposal {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "this community is already active, not a proposal"})
		return
	}

	// Insert vote (unique constraint prevents duplicates)
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO community_votes (user_id, community_id) VALUES ($1, $2)`,
		userID, communityID,
	)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "you have already voted on this proposal"})
			return
		}
		log.Printf("error inserting vote: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Increment upvotes_count
	var newCount int
	h.db.QueryRowContext(r.Context(),
		`UPDATE communities SET upvotes_count = upvotes_count + 1, updated_at = NOW()
		 WHERE id = $1 RETURNING upvotes_count`,
		communityID,
	).Scan(&newCount)

	// Check if threshold is reached — auto-provision
	provisioned := false
	if newCount >= h.cfg.CommunityProposalThreshold {
		provisioned = h.provisionCommunity(r, communityID)
	}

	writeJSON(w, http.StatusOK, VoteResponse{
		Voted:        true,
		UpvotesCount: newCount,
		Provisioned:  provisioned,
	})
}

// provisionCommunity converts a proposal into an active community.
func (h *Handler) provisionCommunity(r *http.Request, communityID string) bool {
	// Get the owner ID
	var ownerID string
	err := h.db.QueryRowContext(r.Context(),
		`UPDATE communities SET is_proposal = false, member_count = 1, updated_at = NOW()
		 WHERE id = $1 RETURNING owner_id`,
		communityID,
	).Scan(&ownerID)
	if err != nil {
		log.Printf("error provisioning community %s: %v", communityID, err)
		return false
	}

	// Create owner membership
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO memberships (user_id, community_id, role) VALUES ($1, $2, 'owner')
		 ON CONFLICT (user_id, community_id) DO UPDATE SET role = 'owner'`,
		ownerID, communityID,
	)
	if err != nil {
		log.Printf("error creating owner membership: %v", err)
	}

	log.Printf("✓ Community %s auto-provisioned (owner: %s)", communityID, ownerID)
	return true
}

// ── List Communities ─────────────────────────────

// ListCommunities returns all active (non-proposal) public communities.
// GET /api/v1/communities
func (h *Handler) ListCommunities(w http.ResponseWriter, r *http.Request) {
	page, perPage := parsePagination(r)
	offset := (page - 1) * perPage

	// Optional search query
	search := r.URL.Query().Get("q")
	categoryFilter := r.URL.Query().Get("category")

	// Build dynamic query
	query := `SELECT id, name, slug, description, category, tags, logo_url, banner_url, owner_id,
	                  visibility, is_proposal, upvotes_count, member_count, created_at, updated_at
	           FROM communities
	           WHERE is_proposal = false AND visibility = 'public'`
	countQuery := `SELECT COUNT(*) FROM communities WHERE is_proposal = false AND visibility = 'public'`
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(` AND (name ILIKE $%d OR description ILIKE $%d)`, argIdx, argIdx)
		countQuery += fmt.Sprintf(` AND (name ILIKE $%d OR description ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if categoryFilter != "" {
		query += fmt.Sprintf(` AND category = $%d`, argIdx)
		countQuery += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, categoryFilter)
		argIdx++
	}

	// Count total
	var total int
	h.db.QueryRowContext(r.Context(), countQuery, args...).Scan(&total)

	// Paginate
	query += fmt.Sprintf(` ORDER BY member_count DESC, created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("error listing communities: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	communities := []Community{}
	for rows.Next() {
		var c Community
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.Description, &c.Category, pq.Array(&c.Tags),
			&c.LogoURL, &c.BannerURL, &c.OwnerID, &c.Visibility,
			&c.IsProposal, &c.UpvotesCount, &c.MemberCount,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			log.Printf("error scanning community: %v", err)
			continue
		}
		communities = append(communities, c)
	}

	writeJSON(w, http.StatusOK, CommunityListResponse{
		Communities: communities,
		Total:       total,
		Page:        page,
		PerPage:     perPage,
	})
}

// ── Get Community ────────────────────────────────

// GetCommunity retrieves a single community by slug.
// GET /api/v1/communities/:slug
func (h *Handler) GetCommunity(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug is required"})
		return
	}

	var c Community
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, name, slug, description, category, tags, logo_url, banner_url, owner_id,
		        visibility, is_proposal, upvotes_count, member_count, created_at, updated_at
		 FROM communities WHERE slug = $1`,
		slug,
	).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Description, &c.Category, pq.Array(&c.Tags),
		&c.LogoURL, &c.BannerURL, &c.OwnerID, &c.Visibility,
		&c.IsProposal, &c.UpvotesCount, &c.MemberCount,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching community: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Enforce visibility: private/invite_only requires membership
	if c.Visibility != "public" {
		userID, _ := r.Context().Value("userID").(string)
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		if !h.isMember(r, userID, c.ID) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must be a member to view this community"})
			return
		}
	}

	writeJSON(w, http.StatusOK, c)
}

// ── Join Community ───────────────────────────────

// JoinCommunity adds the authenticated user as a member.
// POST /api/v1/communities/:id/join
func (h *Handler) JoinCommunity(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Verify community exists and is active
	var isProposal bool
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT is_proposal, visibility FROM communities WHERE id = $1`, communityID,
	).Scan(&isProposal, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}
	if err != nil {
		log.Printf("error checking community: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if isProposal {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot join a proposal — vote for it instead"})
		return
	}
	if visibility == "invite_only" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is invite-only"})
		return
	}

	// Insert membership
	var membership Membership
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO memberships (user_id, community_id, role)
		 VALUES ($1, $2, 'member')
		 RETURNING id, user_id, community_id, role, joined_at`,
		userID, communityID,
	).Scan(&membership.ID, &membership.UserID, &membership.CommunityID, &membership.Role, &membership.JoinedAt)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "you are already a member of this community"})
			return
		}
		log.Printf("error joining community: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Increment member count
	h.db.ExecContext(r.Context(),
		`UPDATE communities SET member_count = member_count + 1, updated_at = NOW() WHERE id = $1`,
		communityID,
	)

	writeJSON(w, http.StatusOK, membership)
}

// ── Leave Community ──────────────────────────────

// LeaveCommunity removes the authenticated user from a community.
// POST /api/v1/communities/:id/leave
func (h *Handler) LeaveCommunity(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Check if user is the owner (owners can't leave)
	var role string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	).Scan(&role)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "you are not a member of this community"})
		return
	}
	if err != nil {
		log.Printf("error checking membership: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if role == "owner" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "owners cannot leave their own community — transfer ownership first"})
		return
	}

	// Delete membership
	_, err = h.db.ExecContext(r.Context(),
		`DELETE FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	)
	if err != nil {
		log.Printf("error leaving community: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Decrement member count
	h.db.ExecContext(r.Context(),
		`UPDATE communities SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW() WHERE id = $1`,
		communityID,
	)

	writeJSON(w, http.StatusOK, map[string]string{"message": "left community"})
}

// ── List Members ─────────────────────────────────

// ListMembers returns the members of a community.
// GET /api/v1/communities/:id/members
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Verify community exists
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT visibility FROM communities WHERE id = $1`, communityID,
	).Scan(&visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}

	// For private communities, require membership
	if visibility != "public" {
		userID, _ := r.Context().Value("userID").(string)
		if userID == "" || !h.isMember(r, userID, communityID) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "members list is restricted"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT m.id, m.user_id, m.community_id, m.role, m.joined_at, COALESCE(m.reputation, 0),
		        u.username, u.display_name, u.avatar_url
		 FROM memberships m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.community_id = $1
		 ORDER BY
		   CASE m.role
		     WHEN 'owner' THEN 1
		     WHEN 'admin' THEN 2
		     WHEN 'moderator' THEN 3
		     WHEN 'expert' THEN 4
		     WHEN 'member' THEN 5
		     ELSE 6
		   END,
		   m.joined_at ASC`,
		communityID,
	)
	if err != nil {
		log.Printf("error listing members: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	members := []Membership{}
	for rows.Next() {
		var m Membership
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.CommunityID, &m.Role, &m.JoinedAt, &m.Reputation,
			&m.Username, &m.DisplayName, &m.AvatarURL,
		); err != nil {
			log.Printf("error scanning member: %v", err)
			continue
		}
		members = append(members, m)
	}

	writeJSON(w, http.StatusOK, MemberListResponse{
		Members: members,
		Total:   len(members),
	})
}

// ── Update Community ─────────────────────────────

// UpdateCommunity updates community details. Requires owner or admin role.
// PUT /api/v1/communities/:id
func (h *Handler) UpdateCommunity(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Check role — must be owner or admin
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions — requires owner or admin role"})
		return
	}

	var req UpdateCommunityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// Validate visibility if provided
	if req.Visibility != nil && !ValidVisibilities[*req.Visibility] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid visibility — must be public, private, or invite_only"})
		return
	}

	// Build dynamic UPDATE query
	query := "UPDATE communities SET updated_at = NOW()"
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Category != nil {
		query += fmt.Sprintf(", category = $%d", argIdx)
		args = append(args, *req.Category)
		argIdx++
	}
	if req.Tags != nil {
		query += fmt.Sprintf(", tags = $%d", argIdx)
		args = append(args, pq.Array(*req.Tags))
		argIdx++
	}
	if req.LogoURL != nil {
		query += fmt.Sprintf(", logo_url = $%d", argIdx)
		args = append(args, *req.LogoURL)
		argIdx++
	}
	if req.BannerURL != nil {
		query += fmt.Sprintf(", banner_url = $%d", argIdx)
		args = append(args, *req.BannerURL)
		argIdx++
	}
	if req.Visibility != nil {
		query += fmt.Sprintf(", visibility = $%d", argIdx)
		args = append(args, *req.Visibility)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, communityID)
	query += ` RETURNING id, name, slug, description, category, tags, logo_url, banner_url, owner_id,
	                     visibility, is_proposal, upvotes_count, member_count, created_at, updated_at`

	var c Community
	err := h.db.QueryRowContext(r.Context(), query, args...).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Description, &c.Category, pq.Array(&c.Tags),
		&c.LogoURL, &c.BannerURL, &c.OwnerID, &c.Visibility,
		&c.IsProposal, &c.UpvotesCount, &c.MemberCount,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		log.Printf("error updating community: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// ── Update Member Role ───────────────────────────

// UpdateMemberRole changes a member's role within a community.
// PUT /api/v1/communities/:id/members/:userId/role
func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	actorID, ok := r.Context().Value("userID").(string)
	if !ok || actorID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userId")

	// Only owners can change roles
	actorRole := h.getUserRole(r, actorID, communityID)
	if actorRole != "owner" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only the community owner can change member roles"})
		return
	}

	var req UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if !ValidRoles[req.Role] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}

	// Cannot change the owner's own role
	if targetUserID == actorID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot change your own role"})
		return
	}

	// Update role
	result, err := h.db.ExecContext(r.Context(),
		`UPDATE memberships SET role = $1 WHERE user_id = $2 AND community_id = $3`,
		req.Role, targetUserID, communityID,
	)
	if err != nil {
		log.Printf("error updating member role: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "member not found in this community"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "role updated", "role": req.Role})
}

// ── My Communities ───────────────────────────────

// MyCommunitiesHandler returns the authenticated user's joined communities.
// GET /api/v1/users/communities
func (h *Handler) MyCommunitiesHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT c.id, c.name, c.slug, c.description, c.category, c.tags, c.logo_url, c.banner_url,
		        c.owner_id, c.visibility, c.is_proposal, c.upvotes_count, c.member_count,
		        c.created_at, c.updated_at
		 FROM communities c
		 JOIN memberships m ON m.community_id = c.id
		 WHERE m.user_id = $1 AND c.is_proposal = false
		 ORDER BY m.joined_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("error listing user communities: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	communities := []Community{}
	for rows.Next() {
		var c Community
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.Description, &c.Category, pq.Array(&c.Tags),
			&c.LogoURL, &c.BannerURL, &c.OwnerID, &c.Visibility,
			&c.IsProposal, &c.UpvotesCount, &c.MemberCount,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			log.Printf("error scanning user community: %v", err)
			continue
		}
		communities = append(communities, c)
	}

	writeJSON(w, http.StatusOK, CommunityListResponse{
		Communities: communities,
		Total:       len(communities),
		Page:        1,
		PerPage:     len(communities),
	})
}

// ── Helpers ──────────────────────────────────────

// generateSlug creates a URL-friendly slug from a community name.
func generateSlug(name string) string {
	slug := strings.ToLower(name)
	// Replace spaces and special characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 100 {
		slug = slug[:100]
	}
	return slug
}

// ensureUniqueSlug checks if a slug exists and appends a numeric suffix if needed.
func (h *Handler) ensureUniqueSlug(r *http.Request, slug string) (string, error) {
	var exists bool
	err := h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM communities WHERE slug = $1)`, slug,
	).Scan(&exists)
	if err != nil {
		return "", err
	}
	if !exists {
		return slug, nil
	}

	// Find the next available suffix
	for i := 2; i < 1000; i++ {
		candidate := fmt.Sprintf("%s-%d", slug, i)
		err := h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM communities WHERE slug = $1)`, candidate,
		).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("could not generate unique slug for: %s", slug)
}

// isMember checks if a user is a member of a community.
func (h *Handler) isMember(r *http.Request, userID, communityID string) bool {
	var exists bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&exists)
	return exists
}

// getUserRole returns the user's role in a community, or empty string if not a member.
func (h *Handler) getUserRole(r *http.Request, userID, communityID string) string {
	var role string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	).Scan(&role)
	if err != nil {
		return ""
	}
	return role
}

// parsePagination extracts page and per_page from query parameters.
func parsePagination(r *http.Request) (int, int) {
	page := 1
	perPage := 20

	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if v, err := strconv.Atoi(pp); err == nil && v > 0 && v <= 100 {
			perPage = v
		}
	}

	return page, perPage
}

// isUniqueViolation checks if a PostgreSQL error is a unique constraint violation.
func isUniqueViolation(err error) bool {
	if pqErr, ok := err.(*pq.Error); ok {
		return pqErr.Code == "23505"
	}
	return false
}

// writeJSON encodes the given payload as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
