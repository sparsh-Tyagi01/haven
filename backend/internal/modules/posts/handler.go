package posts

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	"github.com/sparsh-Tyagi01/haven/backend/internal/pkg/ai"
)

type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	var isProposal bool
	err := h.db.QueryRowContext(r.Context(),
		`SELECT is_proposal FROM communities WHERE id = $1`, req.CommunityID,
	).Scan(&isProposal)
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot post in a community proposal"})
		return
	}

	var isMember bool
	err = h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, req.CommunityID,
	).Scan(&isMember)
	if err != nil {
		log.Printf("error checking membership: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to publish posts"})
		return
	}

	aiClient := ai.NewClient()
	isToxic, reason := aiClient.ScanToxicity(req.Title + " " + req.Content)
	var modStatus string = "approved"
	var modReason sql.NullString
	if isToxic {
		modStatus = "flagged"
		modReason = sql.NullString{String: reason, Valid: true}
	}

	var post Post
	var dbModReason sql.NullString
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO posts (community_id, author_id, title, content, post_type, moderation_status, moderation_reason)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, community_id, author_id, title, content, post_type, is_solved, moderation_status, moderation_reason, created_at, updated_at`,
		req.CommunityID, userID, req.Title, req.Content, req.PostType, modStatus, modReason,
	).Scan(
		&post.ID, &post.CommunityID, &post.AuthorID, &post.Title, &post.Content,
		&post.PostType, &post.IsSolved, &post.ModerationStatus, &dbModReason, &post.CreatedAt, &post.UpdatedAt,
	)
	if dbModReason.Valid {
		post.ModerationReason = &dbModReason.String
	}
	if err != nil {
		log.Printf("error inserting post: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, post)
}

func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	var p Post
	var acceptedComment sql.NullString
	var dbModReason sql.NullString
	err := h.db.QueryRowContext(r.Context(),
		`SELECT p.id, p.community_id, p.author_id, p.title, p.content, p.post_type, p.is_solved, p.accepted_comment_id, p.created_at, p.updated_at,
		        u.username, u.display_name, u.avatar_url,
		        c.name, c.slug, c.visibility, p.moderation_status, p.moderation_reason
		 FROM posts p
		 JOIN users u ON u.id = p.author_id
		 JOIN communities c ON c.id = p.community_id
		 WHERE p.id = $1`,
		postID,
	).Scan(
		&p.ID, &p.CommunityID, &p.AuthorID, &p.Title, &p.Content, &p.PostType, &p.IsSolved, &acceptedComment, &p.CreatedAt, &p.UpdatedAt,
		&p.AuthorUsername, &p.AuthorDisplayName, &p.AuthorAvatarURL,
		&p.CommunityName, &p.CommunitySlug, &p.UserVoteType, &p.ModerationStatus, &dbModReason,
	)
	if dbModReason.Valid {
		p.ModerationReason = &dbModReason.String
	}
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching post: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if acceptedComment.Valid {
		val := acceptedComment.String
		p.AcceptedCommentID = &val
	}
	communityVisibility := p.UserVoteType
	p.UserVoteType = ""                    

	if communityVisibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, p.CommunityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must be a member to view this post"})
			return
		}
	}

	h.db.QueryRowContext(r.Context(),
		`SELECT 
		   COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END),
		   COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END),
		   COUNT(CASE WHEN vote_type = 'funny' THEN 1 END),
		   COUNT(CASE WHEN vote_type = 'insightful' THEN 1 END)
		 FROM votes WHERE post_id = $1`,
		postID,
	).Scan(&p.UpvotesCount, &p.HelpfulCount, &p.FunnyCount, &p.InsightfulCount)

	if userID != "" {
		var voteType string
		err = h.db.QueryRowContext(r.Context(),
			`SELECT vote_type FROM votes WHERE post_id = $1 AND user_id = $2`,
			postID, userID,
		).Scan(&voteType)
		if err == nil {
			p.UserVoteType = voteType
		}
	}

	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Content) < 2 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "comment content must be at least 2 characters"})
		return
	}

	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT community_id FROM posts WHERE id = $1`, postID,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching post context: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to write comments"})
		return
	}

	if req.ParentID != nil && *req.ParentID != "" {
		var parentPostID string
		err = h.db.QueryRowContext(r.Context(),
			`SELECT post_id FROM comments WHERE id = $1`, *req.ParentID,
		).Scan(&parentPostID)
		if err == sql.ErrNoRows || parentPostID != postID {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid parent comment id"})
			return
		}
	}

	aiClient := ai.NewClient()
	isToxic, reason := aiClient.ScanToxicity(req.Content)
	var modStatus string = "approved"
	var modReason sql.NullString
	if isToxic {
		modStatus = "flagged"
		modReason = sql.NullString{String: reason, Valid: true}
	}

	var comment Comment
	var dbModReason sql.NullString
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO comments (post_id, parent_id, author_id, content, moderation_status, moderation_reason)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, post_id, parent_id, author_id, content, moderation_status, moderation_reason, created_at, updated_at`,
		postID, req.ParentID, userID, req.Content, modStatus, modReason,
	).Scan(
		&comment.ID, &comment.PostID, &comment.ParentID, &comment.AuthorID, &comment.Content, &comment.ModerationStatus, &dbModReason, &comment.CreatedAt, &comment.UpdatedAt,
	)
	if dbModReason.Valid {
		comment.ModerationReason = &dbModReason.String
	}
	if err != nil {
		log.Printf("error inserting comment: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *Handler) GetPostComments(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	var communityID string
	var communityVisibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT p.community_id, c.visibility
		 FROM posts p
		 JOIN communities c ON c.id = p.community_id
		 WHERE p.id = $1`,
		postID,
	).Scan(&communityID, &communityVisibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	}

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
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to view comments"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT c.id, c.post_id, c.parent_id, c.author_id, c.content, c.created_at, c.updated_at,
		        u.username, u.display_name, u.avatar_url, c.moderation_status, c.moderation_reason
		 FROM comments c
		 JOIN users u ON u.id = c.author_id
		 WHERE c.post_id = $1
		 ORDER BY c.created_at ASC`,
		postID,
	)
	if err != nil {
		log.Printf("error fetching comments: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	comments := []Comment{}
	for rows.Next() {
		var c Comment
		var dbModReason sql.NullString
		if err := rows.Scan(
			&c.ID, &c.PostID, &c.ParentID, &c.AuthorID, &c.Content, &c.CreatedAt, &c.UpdatedAt,
			&c.AuthorUsername, &c.AuthorDisplayName, &c.AuthorAvatarURL, &c.ModerationStatus, &dbModReason,
		); err != nil {
			log.Printf("error scanning comment: %v", err)
			continue
		}
		if dbModReason.Valid {
			c.ModerationReason = &dbModReason.String
		}

		h.db.QueryRowContext(r.Context(),
			`SELECT 
			   COUNT(CASE WHEN vote_type = 'upvote' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'funny' THEN 1 END),
			   COUNT(CASE WHEN vote_type = 'insightful' THEN 1 END)
			 FROM votes WHERE comment_id = $1`,
			c.ID,
		).Scan(&c.UpvotesCount, &c.HelpfulCount, &c.FunnyCount, &c.InsightfulCount)

		if userID != "" {
			var voteType string
			err = h.db.QueryRowContext(r.Context(),
				`SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2`,
				c.ID, userID,
			).Scan(&voteType)
			if err == nil {
				c.UserVoteType = voteType
			}
		}

		comments = append(comments, c)
	}

	writeJSON(w, http.StatusOK, comments)
}

func (h *Handler) VotePost(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	var req VoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var exists bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM posts WHERE id = $1)`, postID,
	).Scan(&exists)
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	}

	var authorID, communityID string
	var err error
	err = h.db.QueryRowContext(r.Context(),
		`SELECT author_id, community_id FROM posts WHERE id = $1`, postID,
	).Scan(&authorID, &communityID)
	if err != nil {
		log.Printf("error fetching post author: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	var oldVoteType string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT vote_type FROM votes WHERE post_id = $1 AND user_id = $2 AND comment_id IS NULL`,
		postID, userID,
	).Scan(&oldVoteType)
	hasVotedBefore := err == nil

	if req.VoteType == "" {
		if hasVotedBefore {
			_, err := h.db.ExecContext(r.Context(),
				`DELETE FROM votes WHERE post_id = $1 AND user_id = $2 AND comment_id IS NULL`,
				postID, userID,
			)
			if err != nil {
				log.Printf("error deleting post vote: %v", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
				return
			}
			h.updateMemberReputation(r.Context(), authorID, communityID, -5)
		}
		writeJSON(w, http.StatusOK, map[string]string{"message": "vote revoked"})
		return
	}

	if !ValidVoteTypes[req.VoteType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid vote_type — must be upvote, helpful, funny, or insightful"})
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO votes (user_id, post_id, vote_type)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, post_id, comment_id)
		 DO UPDATE SET vote_type = EXCLUDED.vote_type`,
		userID, postID, req.VoteType,
	)
	if err != nil {
		log.Printf("error upserting post vote: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if !hasVotedBefore {
		h.updateMemberReputation(r.Context(), authorID, communityID, 5)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "vote recorded", "vote_type": req.VoteType})
}

func (h *Handler) VoteComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	commentID := chi.URLParam(r, "id")
	if commentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "comment id is required"})
		return
	}

	var req VoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var exists bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM comments WHERE id = $1)`, commentID,
	).Scan(&exists)
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "comment not found"})
		return
	}

	var authorID, communityID string
	var err error
	err = h.db.QueryRowContext(r.Context(),
		`SELECT c.author_id, p.community_id FROM comments c
		 JOIN posts p ON c.post_id = p.id
		 WHERE c.id = $1`, commentID,
	).Scan(&authorID, &communityID)
	if err != nil {
		log.Printf("error fetching comment author: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	var oldVoteType string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT vote_type FROM votes WHERE comment_id = $1 AND user_id = $2 AND post_id IS NULL`,
		commentID, userID,
	).Scan(&oldVoteType)
	hasVotedBefore := err == nil

	if req.VoteType == "" {
		if hasVotedBefore {
			_, err := h.db.ExecContext(r.Context(),
				`DELETE FROM votes WHERE comment_id = $1 AND user_id = $2 AND post_id IS NULL`,
				commentID, userID,
			)
			if err != nil {
				log.Printf("error deleting comment vote: %v", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
				return
			}
			h.updateMemberReputation(r.Context(), authorID, communityID, -2)
		}
		writeJSON(w, http.StatusOK, map[string]string{"message": "vote revoked"})
		return
	}

	if !ValidVoteTypes[req.VoteType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid vote_type"})
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO votes (user_id, comment_id, vote_type)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, post_id, comment_id)
		 DO UPDATE SET vote_type = EXCLUDED.vote_type`,
		userID, commentID, req.VoteType,
	)
	if err != nil {
		log.Printf("error upserting comment vote: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if !hasVotedBefore {
		h.updateMemberReputation(r.Context(), authorID, communityID, 2)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "vote recorded", "vote_type": req.VoteType})
}

func (h *Handler) SolveQuestion(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	postID := chi.URLParam(r, "id")
	if postID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "post id is required"})
		return
	}

	var req SolveQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var authorID string
	var communityID string
	var postType string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT author_id, community_id, post_type FROM posts WHERE id = $1`, postID,
	).Scan(&authorID, &communityID, &postType)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "post not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching post metadata: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if postType != "question" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "only question type posts can be marked as solved"})
		return
	}

	if authorID != userID {
		var role string
		err = h.db.QueryRowContext(r.Context(),
			`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
			userID, communityID,
		).Scan(&role)
		if err != nil || (role != "owner" && role != "admin") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only the post author or community admin/owner can mark it solved"})
			return
		}
	}

	var commentPostID string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT post_id FROM comments WHERE id = $1`, req.AcceptedCommentID,
	).Scan(&commentPostID)
	if err == sql.ErrNoRows || commentPostID != postID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "the accepted comment does not belong to this post"})
		return
	}

	var wasSolved bool
	var oldAcceptedCommentID sql.NullString
	h.db.QueryRowContext(r.Context(),
		`SELECT is_solved, accepted_comment_id FROM posts WHERE id = $1`, postID,
	).Scan(&wasSolved, &oldAcceptedCommentID)

	var newCommentAuthorID string
	err = h.db.QueryRowContext(r.Context(),
		`SELECT author_id FROM comments WHERE id = $1`, req.AcceptedCommentID,
	).Scan(&newCommentAuthorID)
	if err != nil {
		log.Printf("error fetching new comment author: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		`UPDATE posts SET is_solved = true, accepted_comment_id = $1, updated_at = NOW() WHERE id = $2`,
		req.AcceptedCommentID, postID,
	)
	if err != nil {
		log.Printf("error resolving question: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if wasSolved && oldAcceptedCommentID.Valid && oldAcceptedCommentID.String != req.AcceptedCommentID {
		var oldCommentAuthorID string
		h.db.QueryRowContext(r.Context(),
			`SELECT author_id FROM comments WHERE id = $1`, oldAcceptedCommentID.String,
		).Scan(&oldCommentAuthorID)
		if oldCommentAuthorID != "" {
			h.updateMemberReputation(r.Context(), oldCommentAuthorID, communityID, -15)
		}
	}

	if !wasSolved || (oldAcceptedCommentID.Valid && oldAcceptedCommentID.String != req.AcceptedCommentID) {
		h.updateMemberReputation(r.Context(), newCommentAuthorID, communityID, 15)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "question resolved", "accepted_comment_id": req.AcceptedCommentID})
}


func (h *Handler) updateMemberReputation(ctx context.Context, userID, communityID string, diff int) {
	if userID == "" || communityID == "" || diff == 0 {
		return
	}

	var currentRep int
	var currentRole string
	err := h.db.QueryRowContext(ctx,
		`SELECT COALESCE(reputation, 0), role FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	).Scan(&currentRep, &currentRole)
	if err == sql.ErrNoRows {
		return
	} else if err != nil {
		log.Printf("error checking member reputation: %v", err)
		return
	}

	newRep := currentRep + diff
	if newRep < 0 {
		newRep = 0
	}

	_, err = h.db.ExecContext(ctx,
		`UPDATE memberships SET reputation = $1, joined_at = joined_at WHERE user_id = $2 AND community_id = $3`,
		newRep, userID, communityID,
	)
	if err != nil {
		log.Printf("error updating membership reputation: %v", err)
		return
	}

	log.Printf("[Reputation] Updated user %s in community %s: %d -> %d", userID, communityID, currentRep, newRep)

	if currentRole != "owner" && currentRole != "admin" && currentRole != "moderator" {
		const ExpertThreshold = 50
		if newRep >= ExpertThreshold && currentRole != "expert" {
			_, err = h.db.ExecContext(ctx,
				`UPDATE memberships SET role = 'expert' WHERE user_id = $1 AND community_id = $2`,
				userID, communityID,
			)
			if err == nil {
				log.Printf("[Role Promotion] User %s promoted to 'expert' in community %s (Rep: %d)", userID, communityID, newRep)
			}
		} else if newRep < ExpertThreshold && currentRole == "expert" {
			_, err = h.db.ExecContext(ctx,
				`UPDATE memberships SET role = 'member' WHERE user_id = $1 AND community_id = $2`,
				userID, communityID,
			)
			if err == nil {
				log.Printf("[Role Demotion] User %s demoted to 'member' in community %s (Rep: %d)", userID, communityID, newRep)
			}
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
