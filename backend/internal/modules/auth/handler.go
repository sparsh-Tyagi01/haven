package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	var user UserProfile
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO users (username, email, password_hash, display_name)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, username, email, display_name, bio, avatar_url, banner_url, website, skills, reputation, privacy, created_at`,
		req.Username, req.Email, string(hash), req.Username,
	).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Bio, &user.AvatarURL, &user.BannerURL, &user.Website,
		pq.Array(&user.Skills), &user.Reputation, &user.Privacy, &user.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "username or email already taken"})
			return
		}
		log.Printf("error inserting user: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	resp, err := h.generateTokenPair(r, &user)
	if err != nil {
		log.Printf("error generating tokens: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	var user UserProfile
	var passwordHash string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, username, email, password_hash, display_name, bio, avatar_url, banner_url, website, skills, reputation, privacy, created_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(
		&user.ID, &user.Username, &user.Email, &passwordHash,
		&user.DisplayName, &user.Bio, &user.AvatarURL, &user.BannerURL,
		&user.Website, pq.Array(&user.Skills), &user.Reputation, &user.Privacy, &user.CreatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}
	if err != nil {
		log.Printf("error fetching user: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	resp, err := h.generateTokenPair(r, &user)
	if err != nil {
		log.Printf("error generating tokens: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	sessionKey := fmt.Sprintf("session:%s", user.ID)
	h.rdb.Set(r.Context(), sessionKey, resp.AccessToken, h.cfg.JWTRefreshTokenExpiry)

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.RefreshToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
		return
	}

	tokenHash := hashToken(req.RefreshToken)
	var userID string
	var expiresAt time.Time
	err := h.db.QueryRowContext(r.Context(),
		`SELECT user_id, expires_at FROM refresh_tokens
		 WHERE token_hash = $1 AND revoked = FALSE`,
		tokenHash,
	).Scan(&userID, &expiresAt)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid refresh token"})
		return
	}
	if err != nil {
		log.Printf("error looking up refresh token: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if time.Now().After(expiresAt) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "refresh token expired"})
		return
	}

	h.db.ExecContext(r.Context(),
		`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, tokenHash)

	var user UserProfile
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, username, email, display_name, bio, avatar_url, banner_url, website, skills, reputation, privacy, created_at
		 FROM users WHERE id = $1`, userID,
	).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Bio, &user.AvatarURL, &user.BannerURL, &user.Website,
		pq.Array(&user.Skills), &user.Reputation, &user.Privacy, &user.CreatedAt,
	)
	if err != nil {
		log.Printf("error fetching user for refresh: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	resp, err := h.generateTokenPair(r, &user)
	if err != nil {
		log.Printf("error generating tokens: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
		return
	}

	tokenString := authHeader
	if len(authHeader) > 7 {
		tokenString = authHeader[7:]
	}

	token, _ := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.cfg.JWTSecret), nil
	})

	if token != nil {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if userID, ok := claims["user_id"].(string); ok {
				sessionKey := fmt.Sprintf("session:%s", userID)
				h.rdb.Del(r.Context(), sessionKey)

				h.db.ExecContext(r.Context(),
					`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, userID)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username is required"})
		return
	}

	var user UserProfile
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, username, display_name, bio, avatar_url, banner_url, website, skills, reputation, privacy, created_at
		 FROM users WHERE username = $1`,
		username,
	).Scan(
		&user.ID, &user.Username, &user.DisplayName,
		&user.Bio, &user.AvatarURL, &user.BannerURL, &user.Website,
		pq.Array(&user.Skills), &user.Reputation, &user.Privacy, &user.CreatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		log.Printf("error fetching profile: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if user.Privacy == "hidden" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	query := "UPDATE users SET updated_at = NOW()"
	args := []interface{}{}
	argIdx := 1

	if req.DisplayName != nil {
		query += fmt.Sprintf(", display_name = $%d", argIdx)
		args = append(args, *req.DisplayName)
		argIdx++
	}
	if req.Bio != nil {
		query += fmt.Sprintf(", bio = $%d", argIdx)
		args = append(args, *req.Bio)
		argIdx++
	}
	if req.AvatarURL != nil {
		query += fmt.Sprintf(", avatar_url = $%d", argIdx)
		args = append(args, *req.AvatarURL)
		argIdx++
	}
	if req.BannerURL != nil {
		query += fmt.Sprintf(", banner_url = $%d", argIdx)
		args = append(args, *req.BannerURL)
		argIdx++
	}
	if req.Website != nil {
		query += fmt.Sprintf(", website = $%d", argIdx)
		args = append(args, *req.Website)
		argIdx++
	}
	if req.Skills != nil {
		query += fmt.Sprintf(", skills = $%d", argIdx)
		args = append(args, pq.Array(*req.Skills))
		argIdx++
	}
	if req.Privacy != nil {
		query += fmt.Sprintf(", privacy = $%d", argIdx)
		args = append(args, *req.Privacy)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, userID)
	query += ` RETURNING id, username, email, display_name, bio, avatar_url, banner_url, website, skills, reputation, privacy, created_at`

	var user UserProfile
	err := h.db.QueryRowContext(r.Context(), query, args...).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.Bio, &user.AvatarURL, &user.BannerURL, &user.Website,
		pq.Array(&user.Skills), &user.Reputation, &user.Privacy, &user.CreatedAt,
	)
	if err != nil {
		log.Printf("error updating profile: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) generateTokenPair(r *http.Request, user *UserProfile) (*AuthResponse, error) {
	accessClaims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"exp":      time.Now().Add(h.cfg.JWTAccessTokenExpiry).Unix(),
		"iat":      time.Now().Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshBytes := make([]byte, 32)
	if _, err := rand.Read(refreshBytes); err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}
	refreshTokenString := hex.EncodeToString(refreshBytes)
	refreshTokenHash := hashToken(refreshTokenString)
	expiresAt := time.Now().Add(h.cfg.JWTRefreshTokenExpiry)

	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		user.ID, refreshTokenHash, expiresAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int64(h.cfg.JWTAccessTokenExpiry.Seconds()),
		User:         user,
	}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func isUniqueViolation(err error) bool {
	if pqErr, ok := err.(*pq.Error); ok {
		return pqErr.Code == "23505"
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
