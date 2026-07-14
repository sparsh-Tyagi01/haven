package chat

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// Client represents an active WebSocket connection.
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	UserID string
	Send   chan []byte
	Rooms  map[string]bool
	mu     sync.Mutex
}

// Hub coordinates all WebSocket client registrations and room broadcasts.
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan WSFrame
	rdb        *redis.Client
	mu         sync.RWMutex
}

// NewHub constructs a websocket Hub coordinating local connections.
func NewHub(rdb *redis.Client) *Hub {
	h := &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan WSFrame),
		rdb:        rdb,
	}
	go h.startRedisSubscription()
	return h
}

// Run executes registration loops and room broadcasts.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()

		case frame := <-h.broadcast:
			// Publish to Redis so all instances receive the broadcast
			if h.rdb != nil {
				payloadBytes, err := json.Marshal(frame)
				if err == nil {
					h.rdb.Publish(context.Background(), "haven:chat", payloadBytes)
				}
			} else {
				// Fallback to local-only broadcast if Redis is nil
				h.LocalBroadcast(frame)
			}
		}
	}
}

// LocalBroadcast delivers a WSFrame to all clients joined to the frame's topic.
func (h *Hub) LocalBroadcast(frame WSFrame) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	frameBytes, err := json.Marshal(frame)
	if err != nil {
		return
	}

	for client := range h.clients {
		client.mu.Lock()
		subscribed := client.Rooms[frame.Topic]
		client.mu.Unlock()

		if subscribed {
			select {
			case client.Send <- frameBytes:
			default:
				// If send channel is blocked, unregister client
				go func(c *Client) {
					h.unregister <- c
				}(client)
			}
		}
	}
}

// startRedisSubscription listens to Redis channels and triggers local broadcasts.
func (h *Hub) startRedisSubscription() {
	if h.rdb == nil {
		return
	}

	pubsub := h.rdb.Subscribe(context.Background(), "haven:chat")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var frame WSFrame
		if err := json.Unmarshal([]byte(msg.Payload), &frame); err == nil {
			h.LocalBroadcast(frame)
		}
	}
}
