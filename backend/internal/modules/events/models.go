package events

import (
	"time"
)

type Event struct {
	ID          string     `json:"id"`
	CommunityID string     `json:"community_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	CreatedBy   string     `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	GoingCount      int `json:"going_count"`
	InterestedCount int `json:"interested_count"`
	DeclinedCount   int `json:"declined_count"`
	UserRSVPStatus  string `json:"user_rsvp_status,omitempty"` 
}

type RSVP struct {
	ID        string    `json:"id"`
	EventID   string    `json:"event_id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
type CreateEventRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
}

type UpdateEventRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
}

type RSVPRequest struct {
	Status string `json:"status"`
}

func (r *CreateEventRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Title) < 3 || len(r.Title) > 100 {
		errors["title"] = "title must be between 3 and 100 characters"
	}
	if r.StartTime.IsZero() {
		errors["start_time"] = "start_time is required"
	}
	if r.EndTime != nil && r.EndTime.Before(r.StartTime) {
		errors["end_time"] = "end_time cannot be before start_time"
	}

	return errors
}

var ValidRSVPStatuses = map[string]bool{
	"going":      true,
	"interested": true,
	"declined":   true,
}
