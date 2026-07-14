package events

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
)

// Handler holds dependencies for event HTTP handlers.
type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

// NewHandler creates a new event Handler.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

// ── Create Event ─────────────────────────────────

// CreateEvent handles scheduling events. Requires staff role.
// POST /api/v1/communities/{id}/events
func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
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

	// Verify permissions (owner, admin, moderator only)
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions — only community leaders can schedule events"})
		return
	}

	var req CreateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	var e Event
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO events (community_id, title, description, location, start_time, end_time, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, community_id, title, description, location, start_time, end_time, created_by, created_at, updated_at`,
		communityID, req.Title, req.Description, req.Location, req.StartTime, req.EndTime, userID,
	).Scan(&e.ID, &e.CommunityID, &e.Title, &e.Description, &e.Location, &e.StartTime, &e.EndTime, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		log.Printf("error creating event: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, e)
}

// ── Update Event ─────────────────────────────────

// UpdateEvent edits event details.
// PUT /api/v1/events/{id}
func (h *Handler) UpdateEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	eventID := chi.URLParam(r, "id")
	if eventID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "event id is required"})
		return
	}

	// Retrieve community ID of event to verify role
	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT community_id FROM events WHERE id = $1`, eventID,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "event not found"})
		return
	}

	// Verify permissions
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions"})
		return
	}

	var req UpdateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Title) < 3 || len(req.Title) > 100 || req.StartTime.IsZero() {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid title or start_time"})
		return
	}

	var e Event
	err = h.db.QueryRowContext(r.Context(),
		`UPDATE events
		 SET title = $1, description = $2, location = $3, start_time = $4, end_time = $5, updated_at = NOW()
		 WHERE id = $6
		 RETURNING id, community_id, title, description, location, start_time, end_time, created_by, created_at, updated_at`,
		req.Title, req.Description, req.Location, req.StartTime, req.EndTime, eventID,
	).Scan(&e.ID, &e.CommunityID, &e.Title, &e.Description, &e.Location, &e.StartTime, &e.EndTime, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		log.Printf("error updating event: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, e)
}

// ── List Events ──────────────────────────────────

// ListEvents returns all events for a community.
// GET /api/v1/communities/{slug}/events
func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	communitySlug := chi.URLParam(r, "slug")
	if communitySlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	// Fetch community meta
	var communityID string
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, visibility FROM communities WHERE slug = $1`, communitySlug,
	).Scan(&communityID, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}

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
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to view events"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, community_id, title, description, location, start_time, end_time, created_by, created_at, updated_at
		 FROM events
		 WHERE community_id = $1
		 ORDER BY start_time ASC`,
		communityID,
	)
	if err != nil {
		log.Printf("error listing events: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	eventsList := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.CommunityID, &e.Title, &e.Description, &e.Location, &e.StartTime, &e.EndTime, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			log.Printf("error scanning event row: %v", err)
			continue
		}

		// Count RSVPs
		h.db.QueryRowContext(r.Context(),
			`SELECT 
			   COUNT(CASE WHEN status = 'going' THEN 1 END),
			   COUNT(CASE WHEN status = 'interested' THEN 1 END),
			   COUNT(CASE WHEN status = 'declined' THEN 1 END)
			 FROM rsvps WHERE event_id = $1`,
			e.ID,
		).Scan(&e.GoingCount, &e.InterestedCount, &e.DeclinedCount)

		// Fetch current user's RSVP status if logged in
		if userID != "" {
			var rsvpStatus string
			err = h.db.QueryRowContext(r.Context(),
				`SELECT status FROM rsvps WHERE event_id = $1 AND user_id = $2`,
				e.ID, userID,
			).Scan(&rsvpStatus)
			if err == nil {
				e.UserRSVPStatus = rsvpStatus
			}
		}

		eventsList = append(eventsList, e)
	}

	writeJSON(w, http.StatusOK, eventsList)
}

// ── RSVP Event ───────────────────────────────────

// RSVPEvent registers or updates user response.
// POST /api/v1/events/{id}/rsvp
func (h *Handler) RSVPEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	eventID := chi.URLParam(r, "id")
	if eventID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "event id is required"})
		return
	}

	// Verify event exists and retrieve community ID
	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT community_id FROM events WHERE id = $1`, eventID,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "event not found"})
		return
	}

	// Verify membership (must be a member of community to RSVP)
	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to RSVP"})
		return
	}

	var req RSVPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Status == "" {
		// Revoke RSVP
		_, err := h.db.ExecContext(r.Context(),
			`DELETE FROM rsvps WHERE event_id = $1 AND user_id = $2`,
			eventID, userID,
		)
		if err != nil {
			log.Printf("error deleting rsvp: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"message": "rsvp revoked"})
		return
	}

	if !ValidRSVPStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status — must be going, interested, or declined"})
		return
	}

	// Upsert RSVP
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO rsvps (event_id, user_id, status, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (event_id, user_id)
		 DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
		eventID, userID, req.Status,
	)
	if err != nil {
		log.Printf("error upserting rsvp: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "rsvp updated", "status": req.Status})
}

// ── Helpers ──────────────────────────────────────

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
