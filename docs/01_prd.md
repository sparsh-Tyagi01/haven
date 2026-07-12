# Haven Product Requirements Document (PRD)

This document specifies the core features and functional requirements of the Haven platform modules for the initial versions (MVP to Phase 2).

## 1. Module 1: Authentication & User System
* **Registration & Login**: Support Email/Password sign-up/login, along with OAuth2 providers (Google, GitHub). Passkeys and Magic Links will be supported in Phase 2.
* **Profiles**: Users maintain a profile consisting of an Avatar, Banner, Display Name, unique `@username`, Bio, Website/Portfolio Links, list of verified Skills, and global/community Reputation badges.
* **Privacy Settings**: User profiles can be set to Public, Members-Only, or Hidden.

## 2. Module 2: Community (Server) Management
* **Community Creation**: Any user can submit a **Server Proposal** detailing the community's purpose, rules, tags, and category. Once the proposal gathers 100 upvotes/interested users, the server is automatically provisioned.
* **Roles & Permissions**: Fine-grained RBAC including: Owner, Admin, Moderator, Verified Expert, Member, Guest, and custom roles.
* **Visibility Levels**:
  * **Public**: Searchable and readable by anyone.
  * **Private**: Searchable, but requires joining to view posts.
  * **Invite-Only**: Invisible to search; requires an invite token to join.

## 3. Module 3: Post & Comment Systems
* **Rich Text Editor**: Rich editor supporting Markdown, inline code blocks with syntax highlighting, LaTeX math, embeds, media attachments, and user/role mentions.
* **Post Types**:
  * Standard Discussion (threaded post)
  * Questions (with "Mark as Solved" and accepted answers)
  * Projects / Roadmap updates
  * Event details
  * Job opportunities
* **Threaded Comments**: Nested comment trees allowing deep discussions. Sort options: Newest, Oldest, and Most Helpful.

## 4. Module 4: Feed Generation
* **Timeline Model**: A user's timeline is generated dynamically and strictly from the servers they have joined. No unjoined trending content appears on the home feed.
* **Feed Sorts**:
  * **Chronological**: Latest posts first.
  * **Hot/Recommended**: Algorithmic ranking based on recent activity, likes, and comment velocity within joined servers.

## 5. Module 5: Knowledge Base
* **AI Summary Engine**: Runs periodically over high-engagement threads. Synthesizes discussions into a structured summary.
* **Community Review**: Summarized wikis go through a quick community validation phase before graduating to the **Server Wiki**.
* **Server Wiki**: A collaborative space (similar to a read-only GitBook or edit-controlled Notion space) containing categorized FAQs, guides, and community documentation.

## 6. Module 6: Projects (Linear-Lite)
* **Kanban Boards**: Every server can spin up lightweight projects featuring Kanban boards (Todo, In Progress, Review, Done).
* **Task Management**: Tasks can be assigned to community members, linked to threads, or tied to GitHub issues via webhooks.

## 7. Module 7: Events & Meetups
* **Event Creation**: Schedule AMAs, hackathons, podcasts, or virtual meetups with built-in RSVP tracking (Going, Interested, Declined).
* **Live integration**: Integration with voice rooms or external streaming platforms.

## 8. Module 8: Chat & Live Presence
* **Channels**: Server-wide text rooms (WebSockets) for casual chat, split by topics.
* **Direct Messaging**: Private one-on-one and group messaging outside of community scopes.
* **Presence Status**: Online, Idle, Do Not Disturb, Offline.

## 9. Module 9: AI Assistant & Moderation
* **Community Assistant**: A RAG-powered chatbot trained on the server's post history, wiki, and resources that can answer member queries instantly.
* **AI Moderator**: Automated scanning of posts/comments to flag or auto-moderate toxicity, spam, duplicate threads, and dangerous links.
