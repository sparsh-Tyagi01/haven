package community

import (
	"time"
)


type Community struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	Category     string    `json:"category"`
	Tags         []string  `json:"tags"`
	LogoURL      string    `json:"logo_url"`
	BannerURL    string    `json:"banner_url"`
	OwnerID      string    `json:"owner_id"`
	Visibility   string    `json:"visibility"`  
	IsProposal   bool      `json:"is_proposal"`
	UpvotesCount int       `json:"upvotes_count"`
	MemberCount  int       `json:"member_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Membership struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	CommunityID string    `json:"community_id"`
	Role        string    `json:"role"` 
	Reputation  int       `json:"reputation"`
	JoinedAt    time.Time `json:"joined_at"`
	Username    string `json:"username,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}
type CreateProposalRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	LogoURL     string   `json:"logo_url"`
	BannerURL   string   `json:"banner_url"`
}

type UpdateCommunityRequest struct {
	Name        *string   `json:"name,omitempty"`
	Description *string   `json:"description,omitempty"`
	Category    *string   `json:"category,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`
	LogoURL     *string   `json:"logo_url,omitempty"`
	BannerURL   *string   `json:"banner_url,omitempty"`
	Visibility  *string   `json:"visibility,omitempty"`
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}


type CommunityListResponse struct {
	Communities []Community `json:"communities"`
	Total       int         `json:"total"`
	Page        int         `json:"page"`
	PerPage     int         `json:"per_page"`
}

type MemberListResponse struct {
	Members []Membership `json:"members"`
	Total   int          `json:"total"`
}
type VoteResponse struct {
	Voted         bool `json:"voted"`
	UpvotesCount  int  `json:"upvotes_count"`
	Provisioned   bool `json:"provisioned"` 
}
func (r *CreateProposalRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Name) < 3 || len(r.Name) > 100 {
		errors["name"] = "name must be between 3 and 100 characters"
	}
	if len(r.Description) < 10 {
		errors["description"] = "description must be at least 10 characters"
	}

	return errors
}

var ValidRoles = map[string]bool{
	"owner":     true,
	"admin":     true,
	"moderator": true,
	"expert":    true,
	"member":    true,
	"guest":     true,
}

var ValidVisibilities = map[string]bool{
	"public":      true,
	"private":     true,
	"invite_only": true,
}
