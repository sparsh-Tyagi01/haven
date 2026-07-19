# 🌌 Haven — Collaborative Server & Community Platform

Haven is a modern, self-hostable collaborative community platform combining the real-time interaction of **Discord/Slack**, the knowledge-sharing capabilities of **Notion/Wiki**, the issue tracking of **Linear/Kanban**, and **automated AI moderation**.

Designed as a modern monolith, Haven empowers communities to vote on proposals, automatically scale server infra, and moderate discussions with built-in AI safeguards.

---

## ✨ Features

- **🗳️ Proposal-Driven Communities**: Propose new servers/communities. The system automatically provisions active community workspaces when user upvote thresholds are met.
- **🛡️ Custom RBAC Guard**: Strict role-based permissions (`owner`, `admin`, `moderator`, `expert`, `member`, `guest`) securing all workspace modules.
- **💬 Real-time WebSocket Chat**: Channel-based chat backed by a high-concurrency Go WebSocket Hub.
- **📋 Kanban Boards (Linear-Lite)**: Manage server-specific projects with task priority, assignees, custom status columns, and audit logs.
- **📖 Version-Controlled Wiki**: Collaborative documentation workspace with structured page slugs and revision history.
- **🏷️ Discussion Forums**: Nested comments (tree view), mark questions as solved, and react with custom types (`upvote`, `helpful`, `funny`, `insightful`).
- **🤖 Automated AI Moderation**: Toxicity detection on posts and comments with reputation scoring, plus smart AI community assistants powered by Gemini.
- **📦 Distributed Asset Storage**: Built-in MinIO/S3 bucket integration for all media uploads.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Next.js 15 (App Router), TypeScript, Tailwind CSS / Custom Modules |
| **Backend** | Go 1.21+, Gin/Chi framework, Go WebSockets (`gorilla/websocket`) |
| **Databases** | PostgreSQL 16 (Relational storage, migrations), Redis 7 (Caching, presence, real-time events) |
| **Services** | OpenSearch 2.17 (Semantic search), MinIO (S3-compatible object storage) |
| **Containerization** | Docker, Docker Compose |

---

## 📁 Repository Structure

```text
haven/
├── backend/                  # Go Monolith Backend
│   ├── cmd/api/              # Application entrypoint
│   ├── internal/             # Private application packages
│   │   ├── config/           # Config loaders (environment variables)
│   │   ├── db/               # PostgreSQL & Redis connections & database migrations
│   │   ├── gateway/          # Router definitions & RBAC middleware
│   │   └── modules/          # Domain-specific backend logic (auth, chat, posts, projects, wiki, etc.)
│   └── go.mod                # Go module specifications
│
├── frontend/                 # Next.js Client Web App
│   ├── src/
│   │   ├── app/              # Next.js App Router (Pages, layouts)
│   │   ├── context/          # React Auth and State providers
│   │   ├── hooks/            # Modular state-management hooks
│   │   └── lib/              # Client API integrations
│   ├── tsconfig.json         # TypeScript configuration
│   └── package.json          # Node dependencies and build scripts
│
└── docker-compose.yml        # Local infrastructure services orchestration
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
- [Go 1.21+](https://go.dev/doc/install)
- [Node.js 18+](https://nodejs.org/)

---

### 1. Spin up Local Infrastructure
Use Docker Compose to launch PostgreSQL, Redis, OpenSearch, and MinIO:
```bash
docker compose up -d
```
Verify all containers are healthy:
```bash
docker compose ps
```

---

### 2. Configure Environment Variables
Copy the environment template file:
```bash
# In the root directory:
cp .env.example backend/.env
cp .env.example frontend/.env.local
```
*Note: For local development, the defaults inside `.env.example` will work out of the box.*

---

### 3. Start the Backend Monolith
Navigate to the `backend` directory, install dependencies, and run the server. Migrations are executed automatically upon startup!
```bash
cd backend
go run cmd/api/main.go
```
The API server will launch at `http://localhost:8080`.

---

### 4. Start the Frontend Dev Server
Navigate to the `frontend` directory, install Node modules, and start the Next.js development server:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the Haven application dashboard.

---

## 🔒 License
This project is licensed under the MIT License - see the LICENSE file for details.
