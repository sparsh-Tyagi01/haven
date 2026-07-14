package feed

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/posts"
)

// Handler holds dependencies for feed-related HTTP handlers.
type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

// NewHandler creates a new feed Handler.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

// ── Get Community Feed ───────────────────────────

// GetCommunityFeed returns chronological posts from a community.
// GET /api/v1/feed/community/{slug}
func (h *Handler) GetCommunityFeed(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	page, perPage := parsePagination(r)
	offset := (page - 1) * perPage
	postType := r.URL.Query().Get("type") // Optional post type filter (discussion, question, etc.)

	// Check if community exists and get visibility
	var communityID string
	var communityVisibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, visibility FROM communities WHERE slug = $1`, slug,
	).Scan(&communityID, &communityVisibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}
	if err != nil {
		log.Printf("error checking community visibility: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Retrieve user ID from context if authenticated
	userID, _ := r.Context().Value("userID").(string)

	// Verify read access to private/invite-only community
	if communityVisibility != "public" {
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
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must be a member of this community to access the feed"})
			return
		}
	}

	// Build query
	query := `SELECT p.id, p.community_id, p.author_id, p.title, p.content, p.post_type, p.is_solved, p.created_at, p.updated_at,
	                 u.username, u.display_name, u.avatar_url,
	                 c.name, c.slug
	          FROM posts p
	          JOIN users u ON u.id = p.author_id
	          JOIN communities c ON c.id = p.community_id
	          WHERE p.community_id = $1`
	countQuery := `SELECT COUNT(*) FROM posts WHERE community_id = $1`
	args := []interface{}{communityID}
	argIdx := 2

	if postType != "" {
		query += ` AND p.post_type = $2`
		countQuery += ` AND post_type = $2`
		args = append(args, postType)
		argIdx++
	}

	// Count total posts
	var total int
	h.db.QueryRowContext(r.Context(), countQuery, args...).Scan(&total)

	// Order and Paginate
	query += ` ORDER BY p.created_at DESC LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("error listing community feed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	feedItems := []posts.Post{}
	for rows.Next() {
		var p posts.Post
		if err := rows.Scan(
			&p.ID, &p.CommunityID, &p.AuthorID, &p.Title, &p.Content, &p.PostType, &p.IsSolved, &p.CreatedAt, &p.UpdatedAt,
			&p.AuthorUsername, &p.AuthorDisplayName, &p.AuthorAvatarURL,
			&p.CommunityName, &p.CommunitySlug,
		); err != nil {
			log.Printf("error scanning post: %v", err)
			continue
		}

		// Retrieve vote aggregates for each post
		h.db.QueryRowContext(r.Context(),
			`SELECT 
			   COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'funny' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'insightful' THEN 1 END)
			 FROM votes WHERE post_id = $1`,
			p.ID,
		).Scan(&p.UpvotesCount, &p.HelpfulCount, &p.FunnyCount, &p.InsightfulCount)

		// Fetch current user's vote if authenticated
		if userID != "" {
			var voteType string
			err = h.db.QueryRowContext(r.Context(),
				`SELECT vote_type FROM votes WHERE post_id = $1 AND user_id = $2`,
				p.ID, userID,
			).Scan(&voteType)
			if err == nil {
				p.UserVoteType = voteType
			}
		}

		feedItems = append(feedItems, p)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"posts":    feedItems,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// ── Get Home Feed ────────────────────────────────

// GetHomeFeed aggregates posts from communities the user has joined.
// GET /api/v1/feed/home
func (h *Handler) GetHomeFeed(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	page, perPage := parsePagination(r)
	offset := (page - 1) * perPage

	// Query chronological feed of posts from communities the user is a member of
	query := `SELECT p.id, p.community_id, p.author_id, p.title, p.content, p.post_type, p.is_solved, p.created_at, p.updated_at,
	                 u.username, u.display_name, u.avatar_url,
	                 c.name, c.slug
	          FROM posts p
	          JOIN users u ON u.id = p.author_id
	          JOIN communities c ON c.id = p.community_id
	          JOIN memberships m ON m.community_id = p.community_id
	          WHERE m.user_id = $1
	          ORDER BY p.created_at DESC
	          LIMIT $2 OFFSET $3`

	rows, err := h.db.QueryContext(r.Context(), query, userID, perPage, offset)
	if err != nil {
		log.Printf("error loading home feed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	// Count total home feed posts
	var total int
	h.db.QueryRowContext(r.Context(),
		`SELECT COUNT(p.id)
		 FROM posts p
		 JOIN memberships m ON m.community_id = p.community_id
		 WHERE m.user_id = $1`,
		userID,
	).Scan(&total)

	feedItems := []posts.Post{}
	for rows.Next() {
		var p posts.Post
		if err := rows.Scan(
			&p.ID, &p.CommunityID, &p.AuthorID, &p.Title, &p.Content, &p.PostType, &p.IsSolved, &p.CreatedAt, &p.UpdatedAt,
			&p.AuthorUsername, &p.AuthorDisplayName, &p.AuthorAvatarURL,
			&p.CommunityName, &p.CommunitySlug,
		); err != nil {
			log.Printf("error scanning post: %v", err)
			continue
		}

		// Retrieve vote aggregates for each post
		h.db.QueryRowContext(r.Context(),
			`SELECT 
			   COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'funny' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'insightful' THEN 1 END)
			 FROM votes WHERE post_id = $1`,
			p.ID,
		).Scan(&p.UpvotesCount, &p.HelpfulCount, &p.FunnyCount, &p.InsightfulCount)

		// Fetch current user's vote
		var voteType string
		err = h.db.QueryRowContext(r.Context(),
			`SELECT vote_type FROM votes WHERE post_id = $1 AND user_id = $2`,
			p.ID, userID,
		).Scan(&voteType)
		if err == nil {
			p.UserVoteType = voteType
		}

		feedItems = append(feedItems, p)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"posts":    feedItems,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// ── Helpers ──────────────────────────────────────

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

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
