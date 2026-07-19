package projects

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
)

type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
}

func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, cfg: cfg}
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions — only community staff can create projects"})
		return
	}

	var req CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	var p Project
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO projects (community_id, name, description, created_by)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, community_id, name, description, created_by, created_at, updated_at`,
		communityID, req.Name, req.Description, userID,
	).Scan(&p.ID, &p.CommunityID, &p.Name, &p.Description, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		log.Printf("error creating project: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, p)
}


func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	communitySlug := chi.URLParam(r, "slug")
	if communitySlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	var communityID string
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, visibility FROM communities WHERE slug = $1`, communitySlug,
	).Scan(&communityID, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}

	if visibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, communityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to list projects"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, community_id, name, description, created_by, created_at, updated_at
		 FROM projects
		 WHERE community_id = $1
		 ORDER BY created_at DESC`,
		communityID,
	)
	if err != nil {
		log.Printf("error listing projects: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.CommunityID, &p.Name, &p.Description, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			log.Printf("error scanning project row: %v", err)
			continue
		}
		projects = append(projects, p)
	}

	writeJSON(w, http.StatusOK, projects)
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "project id is required"})
		return
	}

	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT community_id FROM projects WHERE id = $1`, projectID,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
		return
	}

	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join the community to create tasks"})
		return
	}

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	status := req.Status
	if status == "" {
		status = "todo"
	}
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	if req.AssigneeID != nil && *req.AssigneeID != "" {
		var isAssigneeMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			*req.AssigneeID, communityID,
		).Scan(&isAssigneeMember)
		if !isAssigneeMember {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assigned user is not a member of this community"})
			return
		}
	}

	var t Task
	err = h.db.QueryRowContext(r.Context(),
		`INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, created_by, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, project_id, title, description, status, priority, assignee_id, created_by, due_date, created_at, updated_at`,
		projectID, req.Title, req.Description, status, priority, req.AssigneeID, userID, req.DueDate,
	).Scan(
		&t.ID, &t.ProjectID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssigneeID, &t.CreatedBy, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		log.Printf("error inserting task card: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, t)
}


func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "project id is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	var communityID string
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT p.community_id, c.visibility
		 FROM projects p
		 JOIN communities c ON c.id = p.community_id
		 WHERE p.id = $1`,
		projectID,
	).Scan(&communityID, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
		return
	}

	if visibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, communityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to view tasks"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority, t.assignee_id, t.created_by, t.due_date, t.created_at, t.updated_at,
		        u.username, u.display_name, u.avatar_url
		 FROM tasks t
		 LEFT JOIN users u ON u.id = t.assignee_id
		 WHERE t.project_id = $1
		 ORDER BY t.created_at ASC`,
		projectID,
	)
	if err != nil {
		log.Printf("error listing project tasks: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	tasks := []Task{}
	for rows.Next() {
		var t Task
		var assigneeUsername sql.NullString
		var assigneeDisplayName sql.NullString
		var assigneeAvatarURL sql.NullString

		if err := rows.Scan(
			&t.ID, &t.ProjectID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssigneeID, &t.CreatedBy, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
			&assigneeUsername, &assigneeDisplayName, &assigneeAvatarURL,
		); err != nil {
			log.Printf("error scanning task: %v", err)
			continue
		}

		if assigneeUsername.Valid {
			t.AssigneeUsername = assigneeUsername.String
		}
		if assigneeDisplayName.Valid {
			t.AssigneeDisplayName = assigneeDisplayName.String
		}
		if assigneeAvatarURL.Valid {
			t.AssigneeAvatarURL = assigneeAvatarURL.String
		}

		tasks = append(tasks, t)
	}

	writeJSON(w, http.StatusOK, tasks)
}


func (h *Handler) UpdateTaskStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	taskId := chi.URLParam(r, "taskId")
	if taskId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "task id is required"})
		return
	}

	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT p.community_id FROM tasks t
		 JOIN projects p ON p.id = t.project_id
		 WHERE t.id = $1`,
		taskId,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}

	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to move task states"})
		return
	}

	var req UpdateTaskStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if !ValidTaskStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		`UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
		req.Status, taskId,
	)
	if err != nil {
		log.Printf("error updating task status: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "status updated", "status": req.Status})
}


func (h *Handler) UpdateTaskDetails(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	taskId := chi.URLParam(r, "taskId")
	if taskId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "task id is required"})
		return
	}

	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT p.community_id FROM tasks t
		 JOIN projects p ON p.id = t.project_id
		 WHERE t.id = $1`,
		taskId,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}

	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to update tasks"})
		return
	}

	var req UpdateTaskDetailsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if len(req.Title) < 3 || len(req.Title) > 255 || !ValidTaskStatuses[req.Status] || !ValidTaskPriorities[req.Priority] {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid validation constraints"})
		return
	}

	if req.AssigneeID != nil && *req.AssigneeID != "" {
		var isAssigneeMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			*req.AssigneeID, communityID,
		).Scan(&isAssigneeMember)
		if !isAssigneeMember {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assigned user is not a member of this community"})
			return
		}
	}

	_, err = h.db.ExecContext(r.Context(),
		`UPDATE tasks
		 SET title = $1, description = $2, status = $3, priority = $4, assignee_id = $5, due_date = $6, updated_at = NOW()
		 WHERE id = $7`,
		req.Title, req.Description, req.Status, req.Priority, req.AssigneeID, req.DueDate, taskId,
	)
	if err != nil {
		log.Printf("error updating task: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "task details updated"})
}


func (h *Handler) getUserRole(r *http.Request, userID, communityID string) string {
	var role string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	).Scan(&role)
	if err != nil {
		return ""
	}
	return role
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
