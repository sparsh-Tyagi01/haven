package gateway

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RequireRole(db *sql.DB, allowedRoles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		roleSet[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := GetUserID(r)
			if !ok || userID == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			communityID := chi.URLParam(r, "id")
			if communityID == "" {
				next.ServeHTTP(w, r)
				return
			}

			var role string
			err := db.QueryRowContext(r.Context(),
				`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
				userID, communityID,
			).Scan(&role)

			if err != nil {
				http.Error(w, `{"error":"not a member of this community"}`, http.StatusForbidden)
				return
			}

			if !roleSet[role] {
				http.Error(w, `{"error":"insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
