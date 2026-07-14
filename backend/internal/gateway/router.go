package gateway

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/auth"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/community"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/feed"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/posts"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/wiki"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/projects"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/events"
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/chat"
)

// NewRouter creates and configures the main Chi router with all middleware
// and route registrations.
func NewRouter(cfg *config.Config, db *sql.DB, rdb *redis.Client) http.Handler {
	r := chi.NewRouter()

	// ── Global Middleware ─────────────────────────
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(CORSMiddleware(cfg.FrontendURL))
	r.Use(RateLimitMiddleware(rdb, 100, 1*time.Minute)) // 100 requests per minute per IP

	// ── Health Check ─────────────────────────────
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"haven-api"}`))
	})

	// ── Handlers ─────────────────────────────────
	authHandler := auth.NewHandler(db, rdb, cfg)
	communityHandler := community.NewHandler(db, rdb, cfg)
	postHandler := posts.NewHandler(db, rdb, cfg)
	feedHandler := feed.NewHandler(db, rdb, cfg)
	wikiHandler := wiki.NewHandler(db, rdb, cfg)
	projectHandler := projects.NewHandler(db, rdb, cfg)
	eventHandler := events.NewHandler(db, rdb, cfg)
	chatHandler := chat.NewHandler(db, rdb, cfg)

	// ── API v1 Routes ────────────────────────────
	r.Route("/api/v1", func(r chi.Router) {
		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.RefreshToken)
			r.Post("/logout", authHandler.Logout)
		})

		// Public/Optional-Auth read routes
		// (JWTMiddleware is not globally active here, but handlers can read userID if passed)
		r.Group(func(r chi.Router) {
			r.Use(OptionalJWTMiddleware(cfg.JWTSecret))

			r.Get("/communities", communityHandler.ListCommunities)
			r.Get("/communities/{slug}", communityHandler.GetCommunity)
			r.Get("/proposals", communityHandler.ListProposals)

			r.Get("/posts/{id}", postHandler.GetPost)
			r.Get("/posts/{id}/comments", postHandler.GetPostComments)
			r.Get("/feed/community/{slug}", feedHandler.GetCommunityFeed)

			// Wiki public routes
			r.Get("/communities/{slug}/wiki", wikiHandler.ListWikiPages)
			r.Get("/communities/{slug}/wiki/{pageSlug}", wikiHandler.GetWikiPage)

			// Projects public routes
			r.Get("/communities/{slug}/projects", projectHandler.ListProjects)
			r.Get("/projects/{projectId}/tasks", projectHandler.ListTasks)

			// Events public routes
			r.Get("/communities/{slug}/events", eventHandler.ListEvents)

			// Chat public routes
			r.Get("/communities/{slug}/channels", chatHandler.ListChannels)
		})

		// Protected routes (authenticated)
		r.Group(func(r chi.Router) {
			r.Use(JWTMiddleware(cfg.JWTSecret))

			// User profile routes
			r.Get("/users/profile/{username}", authHandler.GetProfile)
			r.Put("/users/profile", authHandler.UpdateProfile)

			// User's joined communities
			r.Get("/users/communities", communityHandler.MyCommunitiesHandler)

			// Proposal routes (authenticated)
			r.Post("/proposals", communityHandler.CreateProposal)
			r.Post("/proposals/{id}/vote", communityHandler.VoteProposal)

			// Community management routes (authenticated)
			r.Post("/communities/{id}/join", communityHandler.JoinCommunity)
			r.Post("/communities/{id}/leave", communityHandler.LeaveCommunity)
			r.Get("/communities/{id}/members", communityHandler.ListMembers)
			r.Put("/communities/{id}", communityHandler.UpdateCommunity)
			r.Put("/communities/{id}/members/{userId}/role", communityHandler.UpdateMemberRole)

			// Posts routes (authenticated)
			r.Post("/posts", postHandler.CreatePost)
			r.Put("/posts/{id}/solve", postHandler.SolveQuestion)
			r.Post("/posts/{id}/vote", postHandler.VotePost)
			r.Post("/posts/{id}/comments", postHandler.CreateComment)
			r.Post("/comments/{id}/vote", postHandler.VoteComment)

			// Feeds routes (authenticated)
			r.Get("/feed/home", feedHandler.GetHomeFeed)

			// Wiki writing routes (authenticated)
			r.Post("/communities/{id}/wiki", wikiHandler.CreateWikiPage)
			r.Put("/communities/{id}/wiki/{pageId}", wikiHandler.UpdateWikiPage)

			// Projects writing routes (authenticated)
			r.Post("/communities/{id}/projects", projectHandler.CreateProject)
			r.Post("/projects/{projectId}/tasks", projectHandler.CreateTask)
			r.Put("/tasks/{taskId}/status", projectHandler.UpdateTaskStatus)
			r.Put("/tasks/{taskId}", projectHandler.UpdateTaskDetails)

			// Events writing routes (authenticated)
			r.Post("/communities/{id}/events", eventHandler.CreateEvent)
			r.Put("/events/{id}", eventHandler.UpdateEvent)
			r.Post("/events/{id}/rsvp", eventHandler.RSVPEvent)

			// Chat writing routes (authenticated)
			r.Post("/communities/{id}/channels", chatHandler.CreateChannel)
			r.Get("/channels/{channelId}/messages", chatHandler.ListChannelMessages)
			r.Get("/direct/messages/{userId}", chatHandler.ListDirectMessages)
		})

		// WebSocket Route
		r.Get("/ws", chatHandler.UpgradeWS)
	})

	return r
}
