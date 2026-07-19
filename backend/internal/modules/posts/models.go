package posts

import (
	"time"
)


type Post struct {
	ID                string    `json:"id"`
	CommunityID       string    `json:"community_id"`
	AuthorID          string    `json:"author_id"`
	Title             string    `json:"title"`
	Content           string    `json:"content"`
	PostType          string    `json:"post_type"` 
	IsSolved          bool      `json:"is_solved"`
	AcceptedCommentID *string   `json:"accepted_comment_id,omitempty"`
	ModerationStatus  string    `json:"moderation_status,omitempty"`
	ModerationReason  *string   `json:"moderation_reason,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	AuthorUsername    string `json:"author_username,omitempty"`
	AuthorDisplayName string `json:"author_display_name,omitempty"`
	AuthorAvatarURL   string `json:"author_avatar_url,omitempty"`
	CommunityName     string `json:"community_name,omitempty"`
	CommunitySlug     string `json:"community_slug,omitempty"`

	UpvotesCount    int `json:"upvotes_count"`
	HelpfulCount    int `json:"helpful_count"`
	FunnyCount      int `json:"funny_count"`
	InsightfulCount int `json:"insightful_count"`
	UserVoteType    string `json:"user_vote_type,omitempty"` 
}

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

	AuthorUsername    string `json:"author_username,omitempty"`
	AuthorDisplayName string `json:"author_display_name,omitempty"`
	AuthorAvatarURL   string `json:"author_avatar_url,omitempty"`

	UpvotesCount    int `json:"upvotes_count"`
	HelpfulCount    int `json:"helpful_count"`
	FunnyCount      int `json:"funny_count"`
	InsightfulCount int `json:"insightful_count"`
	UserVoteType    string `json:"user_vote_type,omitempty"`
}

type CreatePostRequest struct {
	CommunityID string `json:"community_id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	PostType    string `json:"post_type"`
}

type CreateCommentRequest struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parent_id,omitempty"`
}


type VoteRequest struct {
	VoteType string `json:"vote_type"`
}


type SolveQuestionRequest struct {
	AcceptedCommentID string `json:"accepted_comment_id"`
}



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


var ValidPostTypes = map[string]bool{
	"discussion": true,
	"question":   true,
	"project":    true,
	"event":      true,
	"job":        true,
}

var ValidVoteTypes = map[string]bool{
	"upvote":     true,
	"helpful":    true,
	"funny":      true,
	"insightful": true,
}
