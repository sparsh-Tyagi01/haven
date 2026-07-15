-- Haven Migration 009: AI Assistant Chat History
-- Phase 9: AI Assistant & Community RAG Chatbot

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender       VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
    content      TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_comm ON ai_chat_messages(user_id, community_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages(created_at ASC);
