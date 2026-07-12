# Haven API & Communication Architecture

Haven uses a microservices-based API architecture. An **API Gateway** acts as the single entry point, routing requests to individual services via REST for synchronous CRUD and **WebSockets** for real-time channels.

---

## 1. API Gateway (Go / Chi)
* **Path Routing**: Routes requests to services (e.g., `/api/v1/auth/*` -> Auth Service, `/api/v1/posts/*` -> Post Service).
* **Cross-Cutting Concerns**: Handles TLS termination, JWT token validation, CORS configuration, global rate limiting, and request logging/tracing (OpenTelemetry headers propagation).

---

## 2. Core REST Endpoints

### Auth Service
* `POST /api/v1/auth/register` - Registers a new user.
* `POST /api/v1/auth/login` - Authenticates credentials, returns JWT & Refresh tokens, registers session in Redis.
* `POST /api/v1/auth/refresh` - Generates a new JWT token using a valid Refresh token.
* `POST /api/v1/auth/logout` - Revokes session.

### Community (Server) Service
* `POST /api/v1/proposals` - Creates a new community proposal.
* `POST /api/v1/proposals/:id/vote` - Upvotes/registers interest in a proposal.
* `GET /api/v1/communities` - Lists public/active communities.
* `GET /api/v1/communities/:slug` - Retrieves details of a specific community.
* `POST /api/v1/communities/:id/join` - Joins a user to a community.

### Post Service
* `POST /api/v1/posts` - Creates a post (supports markdown content).
* `GET /api/v1/posts/:id` - Retrieves a specific post and nested comments.
* `PUT /api/v1/posts/:id/solve` - Marks a question post as solved and binds the accepted comment.
* `POST /api/v1/posts/:id/vote` - Registers user reaction (helpful, insightful, etc.).

### Feed Service
* `GET /api/v1/feed/home` - Returns the authenticated user's curated feed (retrieved from cache or generated from joined communities).
* `GET /api/v1/feed/community/:slug` - Returns the chronological feed of a specific community.

---

## 3. WebSockets Architecture (Real-time Service)

WebSockets are handled by a dedicated scaling service built with Go and Redis Pub/Sub to coordinate updates across multiple server instances.

### Connection Handshake
* **Endpoint**: `wss://api.haven.social/ws`
* **Authentication**: Token passed via Query String or Handshake headers (`Sec-WebSocket-Protocol`). Handshake is verified against JWT and session cache.

### Event Protocol (JSON Payload)
```json
{
  "event": "room:join",
  "topic": "community:uuid:chat",
  "payload": {}
}
```

### Supported Client-to-Server (C2S) Events
* `room:join` - Subscribes the socket connection to a specific community chat or post comment thread.
* `room:leave` - Unsubscribes from the channel.
* `chat:typing` - Broadcasts that the user is typing in a room.
* `chat:message` - Sends a chat message.

### Supported Server-to-Client (S2C) Events
* `chat:message` - Incoming chat message broadcast to room members.
* `chat:typing` - Broadcast user typing status.
* `notification:new` - Real-time push notification (reply, mention, project update).
* `presence:update` - Broadcast online status update of members in the community.
