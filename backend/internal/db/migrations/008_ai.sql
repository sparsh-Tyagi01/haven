-- Haven Migration 008: AI Curation & Auto-Moderation
-- Phase 8: AI Assistant & Moderation

-- Add moderation status mapping columns to posts and comments
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- Create cached AI summaries table
CREATE TABLE IF NOT EXISTS ai_summaries (
    post_id    UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    summary    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_moderation    ON posts (moderation_status);
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON comments (moderation_status);
