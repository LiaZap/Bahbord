-- Tabela de integrações externas (Clockify, GitHub, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'clockify', 'github', etc.
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, provider)
);

-- Add external_id to time_entries for sync tracking
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS external_id TEXT;
