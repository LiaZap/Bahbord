-- ============================================================================
-- Migration 049: Triage Inbox
-- ----------------------------------------------------------------------------
-- Centraliza items de várias fontes (Slack, share-link público, Sentry, e-mail
-- forward, GitHub issue, manual) em um inbox de triagem. Cada item recebe
-- sugestão de IA (priority/labels/assignee/duplicate) e pode virar ticket
-- real (accept), ser marcado como duplicate, ou ser rejeitado.
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS triage_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('slack','sentry','share_link','email','manual','github')),
  source_external_id TEXT,                    -- ID externo (ex: ts da mensagem Slack) pra dedup
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,  -- payload completo recebido
  title TEXT NOT NULL,                        -- extraído ou enviado direto
  description TEXT,
  reporter_name TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','duplicate')),
  ai_suggestion JSONB,                        -- {priority, labels[], assignee_id?, duplicate_ticket_id?, summary}
  resulting_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  duplicate_of_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  triaged_at TIMESTAMPTZ,
  triaged_by UUID REFERENCES members(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, source, source_external_id)
);

CREATE INDEX IF NOT EXISTS idx_triage_inbox_workspace_status
  ON triage_inbox(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_triage_inbox_created
  ON triage_inbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_inbox_pending
  ON triage_inbox(workspace_id, created_at DESC)
  WHERE status = 'pending';
