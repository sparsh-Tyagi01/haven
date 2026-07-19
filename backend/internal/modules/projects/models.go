package projects

import (
	"time"
)

type Project struct {
	ID          string    `json:"id"`
	CommunityID string    `json:"community_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Task struct {
	ID          string     `json:"id"`
	ProjectID   string     `json:"project_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`  
	Priority    string     `json:"priority"` 
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	CreatedBy   string     `json:"created_by"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	AssigneeUsername    string `json:"assignee_username,omitempty"`
	AssigneeDisplayName string `json:"assignee_display_name,omitempty"`
	AssigneeAvatarURL   string `json:"assignee_avatar_url,omitempty"`
}



type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateTaskRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"` 
	Priority    string     `json:"priority"`
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}

type UpdateTaskDetailsRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	AssigneeID  *string    `json:"assignee_id,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

func (r *CreateProjectRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Name) < 3 || len(r.Name) > 100 {
		errors["name"] = "name must be between 3 and 100 characters"
	}

	return errors
}


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


var ValidTaskStatuses = map[string]bool{
	"todo":        true,
	"in_progress": true,
	"review":      true,
	"done":        true,
}

var ValidTaskPriorities = map[string]bool{
	"low":    true,
	"medium": true,
	"high":   true,
	"urgent": true,
}
