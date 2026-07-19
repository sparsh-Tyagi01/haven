package chat

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	UserID string
	Send   chan []byte
	Rooms  map[string]bool
	mu     sync.Mutex
}

type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan WSFrame
	rdb        *redis.Client
	mu         sync.RWMutex
}

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
			if h.rdb != nil {
				payloadBytes, err := json.Marshal(frame)
				if err == nil {
					h.rdb.Publish(context.Background(), "haven:chat", payloadBytes)
				}
			} else {
				h.LocalBroadcast(frame)
			}
		}
	}
}

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
				go func(c *Client) {
					h.unregister <- c
				}(client)
			}
		}
	}
}

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
