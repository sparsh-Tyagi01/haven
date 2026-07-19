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
	"github.com/sparsh-Tyagi01/haven/backend/internal/modules/ai"
)

func NewRouter(cfg *config.Config, db *sql.DB, rdb *redis.Client) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(CORSMiddleware(cfg.FrontendURL))
	r.Use(RateLimitMiddleware(rdb, 100, 1*time.Minute))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"haven-api"}`))
	})

	authHandler := auth.NewHandler(db, rdb, cfg)
	communityHandler := community.NewHandler(db, rdb, cfg)
	postHandler := posts.NewHandler(db, rdb, cfg)
	feedHandler := feed.NewHandler(db, rdb, cfg)
	wikiHandler := wiki.NewHandler(db, rdb, cfg)
	projectHandler := projects.NewHandler(db, rdb, cfg)
	eventHandler := events.NewHandler(db, rdb, cfg)
	chatHandler := chat.NewHandler(db, rdb, cfg)
	aiHandler := ai.NewHandler(db, rdb, cfg)

	r.Get("/ws", chatHandler.UpgradeWS)
	r.Get("/api/v1/ws", chatHandler.UpgradeWS)

	r.Route("/api/v1", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(chimw.Timeout(30 * time.Second))

			r.Route("/auth", func(r chi.Router) {
				r.Post("/register", authHandler.Register)
				r.Post("/login", authHandler.Login)
				r.Post("/refresh", authHandler.RefreshToken)
				r.Post("/logout", authHandler.Logout)
			})

			r.Group(func(r chi.Router) {
				r.Use(OptionalJWTMiddleware(cfg.JWTSecret))

				r.Get("/communities", communityHandler.ListCommunities)
				r.Get("/communities/{slug}", communityHandler.GetCommunity)
				r.Get("/proposals", communityHandler.ListProposals)

				r.Get("/posts/{id}", postHandler.GetPost)
				r.Get("/posts/{id}/comments", postHandler.GetPostComments)
				r.Get("/feed/community/{slug}", feedHandler.GetCommunityFeed)

				r.Get("/communities/{slug}/wiki", wikiHandler.ListWikiPages)
				r.Get("/communities/{slug}/wiki/{pageSlug}", wikiHandler.GetWikiPage)

				r.Get("/communities/{slug}/projects", projectHandler.ListProjects)
				r.Get("/projects/{projectId}/tasks", projectHandler.ListTasks)

				r.Get("/communities/{slug}/events", eventHandler.ListEvents)

				r.Get("/communities/{slug}/channels", chatHandler.ListChannels)
			})

			r.Group(func(r chi.Router) {
				r.Use(JWTMiddleware(cfg.JWTSecret))

				r.Get("/users/profile/{username}", authHandler.GetProfile)
				r.Put("/users/profile", authHandler.UpdateProfile)

				r.Get("/users/communities", communityHandler.MyCommunitiesHandler)

				r.Post("/proposals", communityHandler.CreateProposal)
				r.Post("/proposals/{id}/vote", communityHandler.VoteProposal)

				r.Post("/communities/{id}/join", communityHandler.JoinCommunity)
				r.Post("/communities/{id}/leave", communityHandler.LeaveCommunity)
				r.Get("/communities/{id}/members", communityHandler.ListMembers)
				r.Put("/communities/{id}", communityHandler.UpdateCommunity)
				r.Put("/communities/{id}/members/{userId}/role", communityHandler.UpdateMemberRole)

				r.Post("/posts", postHandler.CreatePost)
				r.Put("/posts/{id}/solve", postHandler.SolveQuestion)
				r.Post("/posts/{id}/vote", postHandler.VotePost)
				r.Post("/posts/{id}/comments", postHandler.CreateComment)
				r.Post("/comments/{id}/vote", postHandler.VoteComment)

				r.Get("/feed/home", feedHandler.GetHomeFeed)

				r.Post("/communities/{id}/wiki", wikiHandler.CreateWikiPage)
				r.Put("/communities/{id}/wiki/{pageId}", wikiHandler.UpdateWikiPage)

				r.Post("/communities/{id}/projects", projectHandler.CreateProject)
				r.Post("/projects/{projectId}/tasks", projectHandler.CreateTask)
				r.Put("/tasks/{taskId}/status", projectHandler.UpdateTaskStatus)
				r.Put("/tasks/{taskId}", projectHandler.UpdateTaskDetails)

				r.Post("/communities/{id}/events", eventHandler.CreateEvent)
				r.Put("/events/{id}", eventHandler.UpdateEvent)
				r.Post("/events/{id}/rsvp", eventHandler.RSVPEvent)

				r.Post("/communities/{id}/channels", chatHandler.CreateChannel)
				r.Get("/channels/{channelId}/messages", chatHandler.ListChannelMessages)
				r.Get("/direct/messages/{userId}", chatHandler.ListDirectMessages)

				r.Post("/posts/{id}/summarize", aiHandler.SummarizePost)
				r.Post("/posts/{id}/wiki-draft", aiHandler.GenerateWikiDraft)
				r.Get("/communities/{slug}/ai-assistant/history", aiHandler.GetChatHistory)
				r.Post("/communities/{slug}/ai-assistant/chat", aiHandler.ChatWithAssistant)
			})
		})
	})

	return r
}
