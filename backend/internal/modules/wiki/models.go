package wiki

import (
	"regexp"
	"strings"
	"time"
)

type WikiPage struct {
	ID          string    `json:"id"`
	CommunityID string    `json:"community_id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Content     string    `json:"content"`
	CreatedBy   string    `json:"created_by"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	CreatorUsername    string `json:"creator_username,omitempty"`
	CreatorDisplayName string `json:"creator_display_name,omitempty"`
	CreatorAvatarURL   string `json:"creator_avatar_url,omitempty"`
}


type CreateWikiRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type UpdateWikiRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}


func (r *CreateWikiRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Title) < 3 || len(r.Title) > 100 {
		errors["title"] = "title must be between 3 and 100 characters"
	}
	if len(r.Content) < 10 {
		errors["content"] = "content must be at least 10 characters"
	}

	return errors
}

func GenerateSlug(title string) string {
	slug := strings.ToLower(title)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 100 {
		slug = slug[:100]
	}
	return slug
}
