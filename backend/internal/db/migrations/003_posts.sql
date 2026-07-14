-- Haven Migration 003: Posts, Comments & Votes
-- Phase 3: Post & Comment Systems, and Feed Generation

-- ── Posts Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id        UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    content             TEXT NOT NULL,
    post_type           VARCHAR(50) DEFAULT 'discussion',  -- discussion | question | project | event | job
    is_solved           BOOLEAN DEFAULT false,
    accepted_comment_id UUID,  -- Will link to the accepted comment for question types (no foreign key check for clean deletion & circular refs)
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_community   ON posts (community_id);
CREATE INDEX IF NOT EXISTS idx_posts_author      ON posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_type        ON posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_created_at  ON posts (created_at DESC);

-- ── Comments Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE,  -- Self-referencing threaded replies
    author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    content      TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post       ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent     ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at ASC);

-- ── Votes/Reactions Table ────────────────────────
CREATE TABLE IF NOT EXISTS votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id      UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
    vote_type    VARCHAR(20) NOT NULL,  -- upvote | helpful | funny | insightful
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure exactly one target is set
    CONSTRAINT chk_vote_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    
    -- Ensure a user can only vote once per post or comment
    UNIQUE(user_id, post_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_post    ON votes (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_votes_comment ON votes (comment_id) WHERE comment_id IS NOT NULL;
