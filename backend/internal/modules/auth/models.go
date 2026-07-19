package auth

import (
	"time"
)

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	User         *UserProfile `json:"user"`
}

type UserProfile struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email,omitempty"`
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

type UpdateProfileRequest struct {
	DisplayName *string   `json:"display_name,omitempty"`
	Bio         *string   `json:"bio,omitempty"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	BannerURL   *string   `json:"banner_url,omitempty"`
	Website     *string   `json:"website,omitempty"`
	Skills      *[]string `json:"skills,omitempty"`
	Privacy     *string   `json:"privacy,omitempty"`
}

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
