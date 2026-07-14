-- Haven Migration 002: Communities, Memberships & Proposal Votes
-- Phase 2: Community Proposals & Server Management

-- ── Communities Table ────────────────────────────
-- Represents both active communities and pending proposals.
-- When is_proposal = true, the community is still gathering upvotes.
-- Once upvotes_count reaches the threshold, is_proposal flips to false.
CREATE TABLE IF NOT EXISTS communities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    description     TEXT DEFAULT '',
    category        VARCHAR(50) DEFAULT 'general',
    tags            TEXT[] DEFAULT '{}',
    logo_url        TEXT DEFAULT '',
    banner_url      TEXT DEFAULT '',
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    visibility      VARCHAR(20) DEFAULT 'public',   -- public | private | invite_only
    is_proposal     BOOLEAN DEFAULT true,
    upvotes_count   INT DEFAULT 0,
    member_count    INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communities_slug       ON communities (slug);
CREATE INDEX IF NOT EXISTS idx_communities_owner      ON communities (owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_proposal   ON communities (is_proposal);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON communities (visibility);

-- ── Memberships Table ────────────────────────────
-- Tracks which users belong to which communities and their roles.
CREATE TABLE IF NOT EXISTS memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    role            VARCHAR(50) DEFAULT 'member',  -- owner | admin | moderator | expert | member | guest
    joined_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user      ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_community ON memberships (community_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role      ON memberships (role);

-- ── Community Votes Table ────────────────────────
-- Tracks unique upvotes on community proposals.
-- Each user can only vote once per proposal.
CREATE TABLE IF NOT EXISTS community_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_community ON community_votes (community_id);
