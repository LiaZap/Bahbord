-- 003: Alinhar schema do banco com as APIs existentes
-- Corrige mismatches entre colunas que o código espera e o que o schema define

-- ========== TIME_ENTRIES ==========
-- API espera: started_at, ended_at, duration_minutes, is_running
-- Schema tem: minutes, description, logged_at
-- Estratégia: adicionar colunas novas, manter minutes como fallback

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT false;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Migrar dados existentes (minutes -> duration_minutes, logged_at -> started_at)
UPDATE time_entries
SET
  duration_minutes = COALESCE(duration_minutes, minutes),
  started_at = COALESCE(started_at, logged_at),
  is_running = COALESCE(is_running, false)
WHERE duration_minutes IS NULL OR started_at IS NULL;

-- ========== NOTIFICATIONS ==========
-- API GET espera: title, actor_id
-- API webhook POST espera: workspace_id, recipient_id, title
-- Schema tem: member_id, type, message, is_read

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES members(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES members(id);

-- Migrar dados existentes: member_id -> recipient_id
UPDATE notifications
SET recipient_id = COALESCE(recipient_id, member_id)
WHERE recipient_id IS NULL AND member_id IS NOT NULL;

-- ========== ACTIVITY_LOG ==========
-- API espera: actor_id
-- Schema tem: member_id
-- Solução: adicionar actor_id como alias e migrar dados

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES members(id);

-- Migrar dados existentes: member_id -> actor_id
UPDATE activity_log
SET actor_id = COALESCE(actor_id, member_id)
WHERE actor_id IS NULL AND member_id IS NOT NULL;

-- ========== TICKET_LINKS ==========
-- API espera: source_ticket_id, target_ticket_id
-- Schema tem: source_id, target_id
-- Solução: renomear colunas

ALTER TABLE ticket_links RENAME COLUMN source_id TO source_ticket_id;
ALTER TABLE ticket_links RENAME COLUMN target_id TO target_ticket_id;

-- Atualizar constraint UNIQUE
ALTER TABLE ticket_links DROP CONSTRAINT IF EXISTS ticket_links_source_id_target_id_link_type_key;
ALTER TABLE ticket_links ADD CONSTRAINT ticket_links_source_target_link_type_key
  UNIQUE(source_ticket_id, target_ticket_id, link_type);

-- Expandir link_types permitidos (API valida: blocks, is_blocked_by, relates_to, duplicates, is_duplicated_by)
-- Schema original tinha CHECK apenas para: blocks, relates, duplicates
ALTER TABLE ticket_links DROP CONSTRAINT IF EXISTS ticket_links_link_type_check;
ALTER TABLE ticket_links ADD CONSTRAINT ticket_links_link_type_check
  CHECK (link_type IN ('blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'));

-- ========== SPRINTS ==========
-- API espera: is_completed, completed_at
-- Schema tem apenas: is_active
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ========== QUICK_REACTIONS ==========
-- API usa ORDER BY position, mas tabela não tem position
ALTER TABLE quick_reactions ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

-- ========== SERVICES ==========
-- Settings API filtra WHERE is_active = true
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ========== SUBTASKS ==========
-- Alguns fluxos esperam completed_at
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ========== Atualizar VIEW tickets_full ==========
-- Recriar view para garantir que reflete colunas atuais
CREATE OR REPLACE VIEW tickets_full AS
SELECT
  t.id,
  t.workspace_id,
  t.title,
  t.description,
  t.priority,
  t.due_date,
  t.sequence_number,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.is_archived,
  t.parent_id,
  t.sprint_id,
  -- Ticket key formatado
  w.prefix || '-' || LPAD(t.sequence_number::text, 3, '0') AS ticket_key,
  -- Tipo
  tt.id AS type_id,
  tt.name AS type_name,
  tt.icon AS type_icon,
  tt.color AS type_color,
  -- Status
  s.id AS status_id,
  s.name AS status_name,
  s.color AS status_color,
  s.position AS status_position,
  s.is_done,
  -- Serviço
  sv.id AS service_id,
  sv.name AS service_name,
  sv.color AS service_color,
  -- Categoria
  cat.id AS category_id,
  cat.name AS category_name,
  -- Assignee
  ma.id AS assignee_id,
  ma.display_name AS assignee_name,
  ma.email AS assignee_email,
  -- Reporter
  mr.id AS reporter_id,
  mr.display_name AS reporter_name,
  -- Sprint
  sp.id AS sprint_id_ref,
  sp.name AS sprint_name,
  -- Contadores
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
LEFT JOIN sprints sp ON sp.id = t.sprint_id;
