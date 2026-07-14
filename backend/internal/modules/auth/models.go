package auth

import (
	"time"
)

// ── Request/Response Models ──────────────────────

// RegisterRequest represents the payload for user registration.
type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest represents the payload for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RefreshRequest represents the payload for token refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// AuthResponse is returned after successful login or registration.
type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // seconds until access token expires
	User         *UserProfile `json:"user"`
}

// UserProfile represents the public-facing user profile.
type UserProfile struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email,omitempty"` // omitted in public views
	DisplayName string    `json:"display_name"`
	Bio         string    `json:"bio"`
	AvatarURL   string    `json:"avatar_url"`
	BannerURL   string    `json:"banner_url"`
	Website     string    `json:"website"`
	Skills      []string  `json:"skills"`
	Reputation  int       `json:"reputation"`
	Privacy     string    `json:"privacy"`
	CreatedAt   time.Time `json:"created_at"`
}

// UpdateProfileRequest represents a profile update payload.
type UpdateProfileRequest struct {
	DisplayName *string   `json:"display_name,omitempty"`
	Bio         *string   `json:"bio,omitempty"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	BannerURL   *string   `json:"banner_url,omitempty"`
	Website     *string   `json:"website,omitempty"`
	Skills      *[]string `json:"skills,omitempty"`
	Privacy     *string   `json:"privacy,omitempty"`
}

// ── Validation ───────────────────────────────────

// Validate checks the RegisterRequest for required fields and constraints.
func (r *RegisterRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Username) < 3 || len(r.Username) > 30 {
		errors["username"] = "username must be between 3 and 30 characters"
	}
	if r.Email == "" {
		errors["email"] = "email is required"
	}
	if len(r.Password) < 8 {
		errors["password"] = "password must be at least 8 characters"
	}

	return errors
}

// Validate checks the LoginRequest for required fields.
func (r *LoginRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if r.Email == "" {
		errors["email"] = "email is required"
	}
	if r.Password == "" {
		errors["password"] = "password is required"
	}

	return errors
}
