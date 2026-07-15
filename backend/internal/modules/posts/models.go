package posts

import (
	"time"
)

// ── Domain Models ────────────────────────────────

// Post represents a discussion, question, project update, event, or job in a community.
type Post struct {
	ID                string    `json:"id"`
	CommunityID       string    `json:"community_id"`
	AuthorID          string    `json:"author_id"`
	Title             string    `json:"title"`
	Content           string    `json:"content"`
	PostType          string    `json:"post_type"` // discussion | question | project | event | job
	IsSolved          bool      `json:"is_solved"`
	AcceptedCommentID *string   `json:"accepted_comment_id,omitempty"`
	ModerationStatus  string    `json:"moderation_status,omitempty"`
	ModerationReason  *string   `json:"moderation_reason,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	// Enriched fields
	AuthorUsername    string `json:"author_username,omitempty"`
	AuthorDisplayName string `json:"author_display_name,omitempty"`
	AuthorAvatarURL   string `json:"author_avatar_url,omitempty"`
	CommunityName     string `json:"community_name,omitempty"`
	CommunitySlug     string `json:"community_slug,omitempty"`

	// Vote metrics
	UpvotesCount    int `json:"upvotes_count"`
	HelpfulCount    int `json:"helpful_count"`
	FunnyCount      int `json:"funny_count"`
	InsightfulCount int `json:"insightful_count"`
	UserVoteType    string `json:"user_vote_type,omitempty"` // The vote type registered by the requesting user
}

// Comment represents a threaded reply to a post.
type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	ParentID  *string   `json:"parent_id,omitempty"`
	AuthorID  string    `json:"author_id"`
	Content           string    `json:"content"`
	ModerationStatus  string    `json:"moderation_status,omitempty"`
	ModerationReason  *string   `json:"moderation_reason,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	// Enriched fields
	AuthorUsername    string `json:"author_username,omitempty"`
	AuthorDisplayName string `json:"author_display_name,omitempty"`
	AuthorAvatarURL   string `json:"author_avatar_url,omitempty"`

	// Vote metrics
	UpvotesCount    int `json:"upvotes_count"`
	HelpfulCount    int `json:"helpful_count"`
	FunnyCount      int `json:"funny_count"`
	InsightfulCount int `json:"insightful_count"`
	UserVoteType    string `json:"user_vote_type,omitempty"`
}

// ── Request Models ───────────────────────────────

// CreatePostRequest is the payload for creating a new post.
type CreatePostRequest struct {
	CommunityID string `json:"community_id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	PostType    string `json:"post_type"` // discussion | question | project | event | job
}

// CreateCommentRequest is the payload for creating a comment/reply.
type CreateCommentRequest struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parent_id,omitempty"`
}

// VoteRequest represents the payload for registering/updating a vote.
type VoteRequest struct {
	VoteType string `json:"vote_type"` // upvote | helpful | funny | insightful (empty to revoke/remove)
}

// SolveQuestionRequest is the payload for marking a question solved.
type SolveQuestionRequest struct {
	AcceptedCommentID string `json:"accepted_comment_id"`
}

// ── Validation ───────────────────────────────────

// Validate checks the CreatePostRequest for constraints.
func (r *CreatePostRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if r.CommunityID == "" {
		errors["community_id"] = "community_id is required"
	}
	if len(r.Title) < 3 || len(r.Title) > 255 {
		errors["title"] = "title must be between 3 and 255 characters"
	}
	if len(r.Content) < 5 {
		errors["content"] = "content must be at least 5 characters"
	}
	if !ValidPostTypes[r.PostType] {
		errors["post_type"] = "invalid post_type — must be discussion, question, project, event, or job"
	}

	return errors
}

// ValidPostTypes holds the set of allowed post types.
var ValidPostTypes = map[string]bool{
	"discussion": true,
	"question":   true,
	"project":    true,
	"event":      true,
	"job":        true,
}

// ValidVoteTypes holds the set of allowed vote types.
var ValidVoteTypes = map[string]bool{
	"upvote":     true,
	"helpful":    true,
	"funny":      true,
	"insightful": true,
}
