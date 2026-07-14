-- Haven Migration 004: Wiki Pages
-- Phase 4: Knowledge Base & Server Wiki

CREATE TABLE IF NOT EXISTS wiki_pages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    slug         VARCHAR(255) NOT NULL,
    content      TEXT NOT NULL,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    version      INT DEFAULT 1,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_community ON wiki_pages (community_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug      ON wiki_pages (slug);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_creator   ON wiki_pages (created_by);
