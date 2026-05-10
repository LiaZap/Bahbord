-- ============================================================================
-- Migration 050: SLA Policies + sla_due_at em tickets
-- ----------------------------------------------------------------------------
-- Define políticas de SLA por workspace+priority. Cada ticket recebe
-- sla_due_at = created_at + hours_to_resolve da policy correspondente.
--
-- Decisão: cálculo é feito por TRIGGER PL/pgSQL (BEFORE INSERT + BEFORE UPDATE
-- de priority/created_at) ao invés de no app code. Razões:
--   - Garante consistência mesmo quando ticket é criado via webhook, automation
--     ou inserção direta (recurring tickets, templates).
--   - Backfill e mudanças de priority recalculam automaticamente sem precisar
--     reescrever cada caller.
--   - Policy desligada (enabled=false) pula o cálculo.
--
-- O cron de alertas (devops-eng-3a) lê sla_due_at + sla_alert_sent_at e
-- dispara Slack quando hours_to_resolve - alert_hours_before chega.
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('urgent','high','medium','low')),
  hours_to_resolve INT NOT NULL CHECK (hours_to_resolve > 0),
  alert_hours_before INT DEFAULT 24,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, priority)
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_workspace
  ON sla_policies(workspace_id);

-- Defaults sensatos por workspace existente
INSERT INTO sla_policies (workspace_id, priority, hours_to_resolve, alert_hours_before)
SELECT w.id, 'urgent', 24, 4 FROM workspaces w
ON CONFLICT (workspace_id, priority) DO NOTHING;

INSERT INTO sla_policies (workspace_id, priority, hours_to_resolve, alert_hours_before)
SELECT w.id, 'high', 168, 24 FROM workspaces w  -- 1 semana
ON CONFLICT (workspace_id, priority) DO NOTHING;

INSERT INTO sla_policies (workspace_id, priority, hours_to_resolve, alert_hours_before)
SELECT w.id, 'medium', 336, 48 FROM workspaces w  -- 2 semanas
ON CONFLICT (workspace_id, priority) DO NOTHING;

INSERT INTO sla_policies (workspace_id, priority, hours_to_resolve, alert_hours_before)
SELECT w.id, 'low', 720, 72 FROM workspaces w  -- 30 dias
ON CONFLICT (workspace_id, priority) DO NOTHING;

-- Colunas em tickets
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN sla_due_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN END $$;

DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN sla_alert_sent_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_due
  ON tickets(sla_due_at)
  WHERE sla_due_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Trigger: calcula sla_due_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_ticket_sla_due_at()
RETURNS TRIGGER AS $$
DECLARE
  hours INT;
BEGIN
  -- Só calcula se priority + workspace estão setados
  IF NEW.priority IS NULL OR NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT hours_to_resolve INTO hours
  FROM sla_policies
  WHERE workspace_id = NEW.workspace_id
    AND priority = NEW.priority
    AND enabled = true;

  IF hours IS NULL THEN
    -- Sem policy ativa pra essa priority — limpa sla_due_at
    NEW.sla_due_at := NULL;
    RETURN NEW;
  END IF;

  -- Em INSERT: usa created_at (que pode estar NULL, fallback NOW())
  -- Em UPDATE: recalcula a partir do created_at original do ticket
  NEW.sla_due_at := COALESCE(NEW.created_at, NOW()) + (hours * INTERVAL '1 hour');
  -- Reset alerta quando recalculamos (mudança de priority ou nova criação)
  NEW.sla_alert_sent_at := NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_sla_due_insert ON tickets;
CREATE TRIGGER trg_tickets_sla_due_insert
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION compute_ticket_sla_due_at();

DROP TRIGGER IF EXISTS trg_tickets_sla_due_update ON tickets;
CREATE TRIGGER trg_tickets_sla_due_update
  BEFORE UPDATE OF priority ON tickets
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION compute_ticket_sla_due_at();

-- Backfill SLA pra tickets existentes não-concluídos / não-arquivados.
-- "concluído" = ticket cujo status.is_done = true (não há coluna is_done em tickets).
UPDATE tickets t
SET sla_due_at = t.created_at + (sp.hours_to_resolve * INTERVAL '1 hour')
FROM sla_policies sp
WHERE sp.workspace_id = t.workspace_id
  AND sp.priority = t.priority
  AND sp.enabled = true
  AND t.sla_due_at IS NULL
  AND t.is_archived = false
  AND NOT EXISTS (
    SELECT 1 FROM statuses s WHERE s.id = t.status_id AND s.is_done = true
  );

-- ----------------------------------------------------------------------------
-- Recriar view tickets_full incluindo sla_due_at + sla_alert_sent_at
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS tickets_full;
CREATE VIEW tickets_full AS
SELECT
  t.id,
  t.workspace_id,
  t.title,
  t.description,
  t.priority,
  t.due_date,
  t.snoozed_until,
  t.sla_due_at,
  t.sla_alert_sent_at,
  t.sequence_number,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.is_archived,
  t.parent_id,
  t.sprint_id,
  t.project_id,
  t.board_id,
  t.client_id,
  t.ticket_type_id,
  t.status_id,
  t.service_id,
  t.category_id,
  t.assignee_id,
  t.reporter_id,
  w.prefix || '-' || LPAD(t.sequence_number::text, 3, '0') AS ticket_key,
  tt.name AS type_name, tt.icon AS type_icon, tt.color AS type_color,
  s.name AS status_name, s.color AS status_color, s.position AS status_position, s.is_done,
  sv.name AS service_name, sv.color AS service_color,
  cat.name AS category_name,
  ma.display_name AS assignee_name, ma.email AS assignee_email, ma.avatar_url AS assignee_avatar,
  mr.display_name AS reporter_name,
  sp.name AS sprint_name,
  cl.name AS client_name, cl.color AS client_color,
  p.name AS project_name,
  p.prefix AS project_prefix,
  p.color AS project_color,
  b.name AS board_name,
  (SELECT COUNT(*) FROM subtasks st WHERE st.ticket_id = t.id) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks st WHERE st.ticket_id = t.id AND st.is_done = true) AS subtask_done_count,
  (SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id) AS comment_count,
  (SELECT COUNT(*) FROM attachments a WHERE a.ticket_id = t.id) AS attachment_count
FROM tickets t
JOIN workspaces w ON w.id = t.workspace_id
LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
LEFT JOIN statuses s ON s.id = t.status_id
LEFT JOIN services sv ON sv.id = t.service_id
LEFT JOIN categories cat ON cat.id = t.category_id
LEFT JOIN members ma ON ma.id = t.assignee_id
LEFT JOIN members mr ON mr.id = t.reporter_id
LEFT JOIN sprints sp ON sp.id = t.sprint_id
LEFT JOIN clients cl ON cl.id = t.client_id
LEFT JOIN projects p ON p.id = t.project_id
LEFT JOIN boards b ON b.id = t.board_id;
