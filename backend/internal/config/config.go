package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// App
	Env         string
	Port        string
	FrontendURL string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// OpenSearch
	OpenSearchURL      string
	OpenSearchUsername  string
	OpenSearchPassword string

	// JWT
	JWTSecret             string
	JWTAccessTokenExpiry  time.Duration
	JWTRefreshTokenExpiry time.Duration

	// OAuth — Google
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// OAuth — GitHub
	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURL  string

	// Community
	CommunityProposalThreshold int

	// S3 / MinIO
	S3BucketName       string
	S3Region           string
	S3Endpoint         string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
}

// Load reads environment variables and returns a populated Config.
// Defaults are provided for local development.
func Load() *Config {
	return &Config{
		Env:         getEnv("APP_ENV", "development"),
		Port:        getEnv("APP_PORT", "8080"),
		FrontendURL: getEnv("APP_FRONTEND_URL", "http://localhost:3000"),

		DatabaseURL: getEnv("DATABASE_URL", "postgres://haven:haven@localhost:5432/haven_dev?sslmode=disable"),

		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

		OpenSearchURL:      getEnv("OPENSEARCH_URL", "http://localhost:9200"),
		OpenSearchUsername:  getEnv("OPENSEARCH_USERNAME", "admin"),
		OpenSearchPassword: getEnv("OPENSEARCH_PASSWORD", "admin"),

		JWTSecret:             getEnv("JWT_SECRET", "dev-secret-change-me"),
		JWTAccessTokenExpiry:  parseDuration(getEnv("JWT_ACCESS_TOKEN_EXPIRY", "15m")),
		JWTRefreshTokenExpiry: parseDuration(getEnv("JWT_REFRESH_TOKEN_EXPIRY", "168h")), // 7 days

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),

		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GitHubRedirectURL:  getEnv("GITHUB_REDIRECT_URL", "http://localhost:8080/api/v1/auth/github/callback"),

		CommunityProposalThreshold: parseIntEnv(getEnv("COMMUNITY_PROPOSAL_THRESHOLD", "3")),

		S3BucketName:       getEnv("S3_BUCKET_NAME", "haven-uploads"),
		S3Region:           getEnv("S3_REGION", "us-east-1"),
		S3Endpoint:         getEnv("S3_ENDPOINT", "http://localhost:9000"),
		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", "minioadmin"),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
	}
}

// getEnv reads an environment variable or returns a fallback value.
func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

// parseDuration wraps time.ParseDuration with a safe fallback.
func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}

// parseIntEnv converts a string to int with a safe fallback.
func parseIntEnv(s string) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return 3
	}
	return v
}
