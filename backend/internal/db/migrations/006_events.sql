-- Haven Migration 006: Events & RSVP Tracking
-- Phase 6: Events & Meetups

-- ── Events Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    location     VARCHAR(255), -- Stream url, voice channel path, or physical address
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_community  ON events (community_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time ASC);

-- ── RSVPs Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS rsvps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL, -- going | interested | declined
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps (event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user  ON rsvps (user_id);
