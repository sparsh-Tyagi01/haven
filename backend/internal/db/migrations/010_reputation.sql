-- Haven Migration 010: Community Reputation & Expert Status
-- Phase 10: Community-Specific Reputation & Verified Expert System

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS reputation INT DEFAULT 0;
