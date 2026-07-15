package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	pkgai "github.com/sparsh-Tyagi01/haven/backend/internal/pkg/ai"
)

// Handler holds dependencies for the AI synthesis handlers.
type Handler struct {
	db       *sql.DB
	rdb      *redis.Client
	cfg      *config.Config
	aiClient *pkgai.GeminiClient
}

// NewHandler constructs an AI handler coordinating summaries and page extractions.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{
		db:       db,
		rdb:      rdb,
		cfg:      cfg,
		aiClient: pkgai.NewClient(),
	}
}

// ── Summarize Post ────────────────────────────────

// SummarizePost generates and caches a thread summary.
// POST /api/v1/posts/{id}/summarize
func (h *Handler) SummarizePost(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	// 1. Check Cache
	var cachedSummary string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT summary FROM ai_summaries WHERE post_id = $1`, postID,
	).Scan(&cachedSummary)
	if err == nil {
		writeJSON(w, http.StatusOK, map[string]string{"post_id": postID, "summary": cachedSummary})
		return
	}

	// 2. Fetch Post Details
	var title, content string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT title, content FROM posts WHERE id = $1`, postID,
	).Scan(&title, &content)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	} else if err != nil {
		log.Printf("error fetching post details: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// 3. Fetch Comments
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT content FROM comments WHERE post_id = $1 ORDER BY created_at ASC`, postID,
	)
	if err != nil {
		log.Printf("error fetching comments: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	comments := []string{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err == nil {
			comments = append(comments, c)
		}
	}

	// 4. Summarize via Gemini
	summary, err := h.aiClient.SummarizeThread(title, content, comments)
	if err != nil {
		log.Printf("ai summary client failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI service failed to generate summary"})
		return
	}

	// 5. Cache summary
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO ai_summaries (post_id, summary, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (post_id) DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()`,
		postID, summary,
	)
	if err != nil {
		log.Printf("failed to cache summary: %v", err)
	}

	writeJSON(w, http.StatusOK, map[string]string{"post_id": postID, "summary": summary})
}

// ── Generate Wiki Draft ───────────────────────────

// GenerateWikiDraft synthesizes post discussions into an article template.
// POST /api/v1/posts/{id}/wiki-draft
func (h *Handler) GenerateWikiDraft(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	var title, content string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT title, content FROM posts WHERE id = $1`, postID,
	).Scan(&title, &content)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	} else if err != nil {
		log.Printf("error fetching post details: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT content FROM comments WHERE post_id = $1 ORDER BY created_at ASC`, postID,
	)
	if err != nil {
		log.Printf("error fetching comments: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	comments := []string{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err == nil {
			comments = append(comments, c)
		}
	}

	draft, err := h.aiClient.DraftWikiPage(title, content, comments)
	if err != nil {
		log.Printf("ai wiki draft generation failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI service failed to generate wiki page draft"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"title":   "AI Draft: " + title,
		"content": draft,
	})
}

// ── AI Assistant (RAG Chatbot) ────────────────────

type AIMessage struct {
	ID        string    `json:"id"`
	Sender    string    `json:"sender"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// GetChatHistory fetches chat history for the authenticated user and community.
// GET /api/v1/communities/{slug}/ai-assistant/history
func (h *Handler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	// 1. Get Community ID
	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id FROM communities WHERE slug = $1`, slug,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	} else if err != nil {
		log.Printf("error fetching community ID: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// 2. Fetch Messages
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, sender, content, created_at FROM ai_chat_messages
		 WHERE community_id = $1 AND user_id = $2
		 ORDER BY created_at ASC`, communityID, userID,
	)
	if err != nil {
		log.Printf("error fetching chat messages: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	messages := []AIMessage{}
	for rows.Next() {
		var msg AIMessage
		if err := rows.Scan(&msg.ID, &msg.Sender, &msg.Content, &msg.CreatedAt); err == nil {
			messages = append(messages, msg)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"messages": messages})
}

// ChatWithAssistant processes an incoming message, scans community context (RAG), and calls Gemini.
// POST /api/v1/communities/{slug}/ai-assistant/chat
func (h *Handler) ChatWithAssistant(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid message"})
		return
	}

	// 1. Get Community Details
	var communityID, communityName string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, name FROM communities WHERE slug = $1`, slug,
	).Scan(&communityID, &communityName)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	} else if err != nil {
		log.Printf("error fetching community details: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// 2. Perform RAG Document Retrieval (SQL keyword matching)
	words := strings.Fields(req.Message)
	var matchExprs []string
	var args []interface{}
	args = append(args, communityID) // $1
	argIndex := 2

	for _, word := range words {
		word = strings.Trim(word, ".,?!;()\"'")
		if len(word) < 3 {
			continue
		}
		matchExprs = append(matchExprs, fmt.Sprintf("(title ILIKE $%d OR content ILIKE $%d)", argIndex, argIndex+1))
		args = append(args, "%"+word+"%", "%"+word+"%")
		argIndex += 2
	}

	var contextDocs []string

	// Only query if we have keywords to search with
	if len(matchExprs) > 0 {
		keywordFilter := "(" + strings.Join(matchExprs, " OR ") + ")"
		
		// Query wiki pages
		wikiQuery := fmt.Sprintf(
			`SELECT title, content FROM wiki_pages WHERE community_id = $1 AND %s LIMIT 3`,
			keywordFilter,
		)
		wikiRows, err := h.db.QueryContext(r.Context(), wikiQuery, args...)
		if err == nil {
			defer wikiRows.Close()
			for wikiRows.Next() {
				var t, c string
				if err := wikiRows.Scan(&t, &c); err == nil {
					contextDocs = append(contextDocs, fmt.Sprintf("Document: Wiki Page - %s\nContent: %s", t, c))
				}
			}
		}

		// Query posts (only approved ones)
		postQuery := fmt.Sprintf(
			`SELECT title, content FROM posts WHERE community_id = $1 AND moderation_status = 'approved' AND %s LIMIT 3`,
			keywordFilter,
		)
		postRows, err := h.db.QueryContext(r.Context(), postQuery, args...)
		if err == nil {
			defer postRows.Close()
			for postRows.Next() {
				var t, c string
				if err := postRows.Scan(&t, &c); err == nil {
					contextDocs = append(contextDocs, fmt.Sprintf("Document: Post - %s\nContent: %s", t, c))
				}
			}
		}
	}

	// 3. Save User Message
	var userMsg AIMessage
	userMsg.Sender = "user"
	userMsg.Content = req.Message
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO ai_chat_messages (community_id, user_id, sender, content)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, created_at`,
		communityID, userID, userMsg.Sender, userMsg.Content,
	).Scan(&userMsg.ID, &userMsg.CreatedAt)
	if err != nil {
		log.Printf("error saving user chat message: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// 4. Generate AI Answer
	aiAnswer, err := h.aiClient.AnswerWithContext(req.Message, contextDocs)
	if err != nil {
		log.Printf("error generating AI response: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI assistant generation failed"})
		return
	}

	// 5. Save Assistant Message
	var assistantMsg AIMessage
	assistantMsg.Sender = "assistant"
	assistantMsg.Content = aiAnswer
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO ai_chat_messages (community_id, user_id, sender, content)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, created_at`,
		communityID, userID, assistantMsg.Sender, assistantMsg.Content,
	).Scan(&assistantMsg.ID, &assistantMsg.CreatedAt)
	if err != nil {
		log.Printf("error saving assistant chat message: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_message":      userMsg,
		"assistant_message": assistantMsg,
	})
}

// ── Helper ────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
