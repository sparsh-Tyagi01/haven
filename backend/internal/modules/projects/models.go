package projects

import (
	"time"
)

// ── Domain Models ────────────────────────────────

// Project represents a workspace project within a community containing a Kanban board.
type Project struct {
	ID          string    `json:"id"`
	CommunityID string    `json:"community_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Task represents a ticket or task on a project's Kanban board.
type Task struct {
	ID          string     `json:"id"`
	ProjectID   string     `json:"project_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`   // todo | in_progress | review | done
	Priority    string     `json:"priority"` // low | medium | high | urgent
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	CreatedBy   string     `json:"created_by"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	// Enriched fields
	AssigneeUsername    string `json:"assignee_username,omitempty"`
	AssigneeDisplayName string `json:"assignee_display_name,omitempty"`
	AssigneeAvatarURL   string `json:"assignee_avatar_url,omitempty"`
}

// ── Request Models ───────────────────────────────

// CreateProjectRequest is the payload for starting a new community project.
type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// CreateTaskRequest is the payload for adding a task card.
type CreateTaskRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"` // todo | in_progress | review | done (defaults to todo)
	Priority    string     `json:"priority"`
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

// UpdateTaskStatusRequest handles fast-path drag-and-drop state updates.
type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}

// UpdateTaskDetailsRequest holds full task detail modifications.
type UpdateTaskDetailsRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

// ── Validation ───────────────────────────────────

// Validate checks CreateProjectRequest validation constraints.
func (r *CreateProjectRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Name) < 3 || len(r.Name) > 100 {
		errors["name"] = "name must be between 3 and 100 characters"
	}

	return errors
}

// Validate checks CreateTaskRequest validation constraints.
func (r *CreateTaskRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Title) < 3 || len(r.Title) > 255 {
		errors["title"] = "title must be between 3 and 255 characters"
	}
	if r.Status != "" && !ValidTaskStatuses[r.Status] {
		errors["status"] = "invalid status — must be todo, in_progress, review, or done"
	}
	if r.Priority != "" && !ValidTaskPriorities[r.Priority] {
		errors["priority"] = "invalid priority — must be low, medium, high, or urgent"
	}

	return errors
}

// ValidTaskStatuses maps allowed columns.
var ValidTaskStatuses = map[string]bool{
	"todo":        true,
	"in_progress": true,
	"review":      true,
	"done":        true,
}

// ValidTaskPriorities maps allowed priority labels.
var ValidTaskPriorities = map[string]bool{
	"low":    true,
	"medium": true,
	"high":   true,
	"urgent": true,
}
