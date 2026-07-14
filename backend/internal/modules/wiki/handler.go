package wiki

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
)

// Handler holds dependencies for wiki-related HTTP handlers.
type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

// NewHandler creates a new wiki Handler.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

// ── Create Wiki Page ─────────────────────────────

// CreateWikiPage handles writing a new wiki article.
// POST /api/v1/communities/{id}/wiki
func (h *Handler) CreateWikiPage(w http.ResponseWriter, r *http.Request) {
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

	// Verify user role is allowed to edit wiki (owner, admin, moderator, expert)
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" && role != "expert" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions — only community leaders and experts can modify the wiki"})
		return
	}

	var req CreateWikiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	slug := GenerateSlug(req.Title)
	slug, err := h.ensureUniqueSlug(r, communityID, slug)
	if err != nil {
		log.Printf("error ensuring unique slug: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	var wp WikiPage
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO wiki_pages (community_id, title, slug, content, created_by, version)
		 VALUES ($1, $2, $3, $4, $5, 1)
		 RETURNING id, community_id, title, slug, content, created_by, version, created_at, updated_at`,
		communityID, req.Title, slug, req.Content, userID,
	).Scan(
		&wp.ID, &wp.CommunityID, &wp.Title, &wp.Slug, &wp.Content, &wp.CreatedBy, &wp.Version, &wp.CreatedAt, &wp.UpdatedAt,
	)
	if err != nil {
		log.Printf("error inserting wiki page: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, wp)
}

// ── Update Wiki Page ─────────────────────────────

// UpdateWikiPage increments the version and updates the content of a wiki page.
// PUT /api/v1/communities/{id}/wiki/{pageId}
func (h *Handler) UpdateWikiPage(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	pageID := chi.URLParam(r, "pageId")

	if communityID == "" || pageID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id and page id are required"})
		return
	}

	// Verify permissions
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" && role != "expert" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions"})
		return
	}

	var req UpdateWikiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Title) < 3 || len(req.Title) > 100 || len(req.Content) < 10 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid title or content content constraints"})
		return
	}

	var wp WikiPage
	err := h.db.QueryRowContext(r.Context(),
		`UPDATE wiki_pages
		 SET title = $1, content = $2, created_by = $3, version = version + 1, updated_at = NOW()
		 WHERE id = $4 AND community_id = $5
		 RETURNING id, community_id, title, slug, content, created_by, version, created_at, updated_at`,
		req.Title, req.Content, userID, pageID, communityID,
	).Scan(
		&wp.ID, &wp.CommunityID, &wp.Title, &wp.Slug, &wp.Content, &wp.CreatedBy, &wp.Version, &wp.CreatedAt, &wp.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "wiki page not found"})
		return
	}
	if err != nil {
		log.Printf("error updating wiki page: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, wp)
}

// ── Get Wiki Page ────────────────────────────────

// GetWikiPage retrieves details of a specific wiki page.
// GET /api/v1/communities/{slug}/wiki/{pageSlug}
func (h *Handler) GetWikiPage(w http.ResponseWriter, r *http.Request) {
	communitySlug := chi.URLParam(r, "slug")
	pageSlug := chi.URLParam(r, "pageSlug")

	if communitySlug == "" || pageSlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug and page slug are required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	var wp WikiPage
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT w.id, w.community_id, w.title, w.slug, w.content, w.created_by, w.version, w.created_at, w.updated_at,
		        u.username, u.display_name, u.avatar_url,
		        c.visibility
		 FROM wiki_pages w
		 JOIN communities c ON c.id = w.community_id
		 JOIN users u ON u.id = w.created_by
		 WHERE c.slug = $1 AND w.slug = $2`,
		communitySlug, pageSlug,
	).Scan(
		&wp.ID, &wp.CommunityID, &wp.Title, &wp.Slug, &wp.Content, &wp.CreatedBy, &wp.Version, &wp.CreatedAt, &wp.UpdatedAt,
		&wp.CreatorUsername, &wp.CreatorDisplayName, &wp.CreatorAvatarURL,
		&visibility,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "wiki page not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching wiki page: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Visibility Guard
	if visibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, wp.CommunityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join the community to view this wiki page"})
			return
		}
	}

	writeJSON(w, http.StatusOK, wp)
}

// ── List Wiki Pages ──────────────────────────────

// ListWikiPages returns all wiki pages in a community.
// GET /api/v1/communities/{slug}/wiki
func (h *Handler) ListWikiPages(w http.ResponseWriter, r *http.Request) {
	communitySlug := chi.URLParam(r, "slug")
	if communitySlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	// Fetch community metadata
	var communityID string
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, visibility FROM communities WHERE slug = $1`, communitySlug,
	).Scan(&communityID, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}

	// Enforce membership for private servers
	if visibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, communityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join the community to access the wiki index"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT w.id, w.community_id, w.title, w.slug, w.created_by, w.version, w.created_at, w.updated_at,
		        u.username, u.display_name, u.avatar_url
		 FROM wiki_pages w
		 JOIN users u ON u.id = w.created_by
		 WHERE w.community_id = $1
		 ORDER BY w.updated_at DESC`,
		communityID,
	)
	if err != nil {
		log.Printf("error listing wiki pages: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	pages := []WikiPage{}
	for rows.Next() {
		var wp WikiPage
		if err := rows.Scan(
			&wp.ID, &wp.CommunityID, &wp.Title, &wp.Slug, &wp.CreatedBy, &wp.Version, &wp.CreatedAt, &wp.UpdatedAt,
			&wp.CreatorUsername, &wp.CreatorDisplayName, &wp.CreatorAvatarURL,
		); err != nil {
			log.Printf("error scanning wiki page row: %v", err)
			continue
		}
		pages = append(pages, wp)
	}

	writeJSON(w, http.StatusOK, pages)
}

// ── Helpers ──────────────────────────────────────

func (h *Handler) ensureUniqueSlug(r *http.Request, communityID, slug string) (string, error) {
	var exists bool
	err := h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM wiki_pages WHERE community_id = $1 AND slug = $2)`,
		communityID, slug,
	).Scan(&exists)
	if err != nil {
		return "", err
	}
	if !exists {
		return slug, nil
	}

	for i := 2; i < 1000; i++ {
		candidate := fmt.Sprintf("%s-%d", slug, i)
		err := h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM wiki_pages WHERE community_id = $1 AND slug = $2)`,
			communityID, candidate,
		).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("could not generate unique wiki slug for: %s", slug)
}

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

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
