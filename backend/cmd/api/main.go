package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	"github.com/sparsh-Tyagi01/haven/backend/internal/db"
	"github.com/sparsh-Tyagi01/haven/backend/internal/gateway"
)

func main() {
	// Load .env if present (ignore error if file is missing in production)
	_ = godotenv.Load()

	// Load configuration
	cfg := config.Load()

	log.Printf("Starting Haven API Monolith in %s mode...", cfg.Env)

	// Connect to Postgres
	pgDB, err := db.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Critical error: failed to initialize Postgres: %v", err)
	}
	defer pgDB.Close()

	// Run DB migrations
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "internal/db/migrations"
	}
	log.Printf("Running database migrations from: %s", migrationsDir)
	if err := db.RunMigrations(pgDB, migrationsDir); err != nil {
		log.Fatalf("Critical error: database migration failed: %v", err)
	}

	// Connect to Redis
	redisClient, err := db.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Critical error: failed to initialize Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize Gateway Router
	router := gateway.NewRouter(cfg, pgDB, redisClient)

	// Start Server
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("✓ Haven API listening on %s", serverAddr)
	if err := http.ListenAndServe(serverAddr, router); err != nil {
		log.Fatalf("Critical error: server failed: %v", err)
	}
}
