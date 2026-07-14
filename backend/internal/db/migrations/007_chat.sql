-- Haven Migration 007: Chat & Live Presence
-- Phase 7: Chat & Live Presence

-- ── Channels Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name         VARCHAR(50) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_community ON channels (community_id);

-- ── Messages Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id        UUID REFERENCES channels(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content           TEXT NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_message_target CHECK (
        (channel_id IS NOT NULL AND recipient_user_id IS NULL) OR 
        (channel_id IS NULL AND recipient_user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient  ON messages (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at ASC);
