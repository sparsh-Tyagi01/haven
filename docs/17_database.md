# Haven Database & Schema Design

To support millions of users, real-time activity, microservices, and knowledge curation, Haven uses a multi-database approach: serverless PostgreSQL (hosted on **Neon**) as the source of truth, Redis for caching/real-time indices, pgvector/Pinecone for semantic RAG indices, and OpenSearch for robust full-text search.

---

## 1. PostgreSQL Schema (Relational Source of Truth)

Below is the conceptual relational schema design.

```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    reputation INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Communities Table
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT true,
    is_proposal BOOLEAN DEFAULT true,
    upvotes_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Memberships Table
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, moderator, expert, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

-- Posts Table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Supports Rich text / Markdown
    post_type VARCHAR(50) DEFAULT 'discussion', -- discussion, question, job, project, event
    is_solved BOOLEAN DEFAULT false,
    accepted_comment_id UUID, -- For QA posts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments Table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- Self-referencing nested tree
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Votes Table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL, -- helpful, funny, insightful, upvote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    UNIQUE(user_id, post_id, comment_id)
);

-- Wiki Pages (Knowledge Base)
CREATE TABLE wiki_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, slug)
);
```

---

## 2. Redis Data Models (Cache & Real-time States)

Redis is deployed for low-latency writes and transient data caching:

* **Session Management**: `session:{userId} -> {tokenData}` (TTL: 7 Days)
* **Timeline Feed Caching**: Stores a list of recent post IDs per user.
  * Key: `feed:{userId}` -> Redis Sorted Set (ZSET)
  * Score: `post.created_at` (timestamp)
  * Value: `post_id`
* **Real-time Presence**: Tracks online users.
  * Key: `community:{communityId}:online` -> Set of `userId`s (updated via WebSockets heartbeat with 1-minute TTL).
* **Rate Limiting**: IP and Token-based sliding window rate limits.
  * Key: `rate:{ip}:route` -> Integer counter.

---

## 3. Vector Database (AI Search & RAG)

For semantic community search and RAG summaries:
* **Storage**: PostgreSQL with `pgvector` extension (or Pinecone at scale).
* **Documents Chunking**:
  * Posts, comments, and wiki pages are chunked into 500-token segments.
  * Model: `text-embedding-3-small` or `text-multilingual-embedding-002` (1536/768 dimensions).
  * Index: HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search.

---

## 4. OpenSearch/ElasticSearch (Full-Text Search)

Allows complex filters (by date range, tags, community IDs) and fuzzy search.
* **Index: `haven_posts`**:
  ```json
  {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "community_id": { "type": "keyword" },
        "author": { "type": "text" },
        "title": { "type": "text", "analyzer": "english" },
        "content": { "type": "text", "analyzer": "english" },
        "post_type": { "type": "keyword" },
        "tags": { "type": "keyword" },
        "created_at": { "type": "date" }
      }
    }
  }
  ```
