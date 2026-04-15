-- Schema e seed inicial para PostgreSQL local do BahBoard

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  description_template TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  position INT NOT NULL DEFAULT 0,
  wip_limit INT,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES ticket_types(id),
  status_id UUID REFERENCES statuses(id),
  service_id UUID REFERENCES services(id),
  category_id UUID REFERENCES categories(id),
  assignee_id UUID REFERENCES members(id),
  reporter_id UUID REFERENCES members(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  sequence_number INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT false
);

INSERT INTO workspaces (name, slug, prefix, description)
VALUES ('Bah!Company', 'bahcompany', 'BAH', 'Workspace principal da Bah!Company');

INSERT INTO ticket_types (workspace_id, name, icon, color, description_template, position)
SELECT id, 'História', '📘', '#3b82f6', '**História de usuário:**\n\n**Critério de aceitação:**\n\n**Observação:**', 0
FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO ticket_types (workspace_id, name, icon, color, description_template, position)
SELECT id, 'Tarefa', '✅', '#22c55e', '**Descrição da tarefa:**\n\n**Passo a passo:**', 1
FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO ticket_types (workspace_id, name, icon, color, description_template, position)
SELECT id, 'Bug', '🐛', '#ef4444', '**Passos para reproduzir:**\n\n**Comportamento esperado:**\n\n**Comportamento atual:**', 2
FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO ticket_types (workspace_id, name, icon, color, description_template, position)
SELECT id, 'Epic', '⚡', '#a855f7', '**Objetivo:**\n\n**Escopo:**\n\n**Critério de sucesso:**', 3
FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO statuses (workspace_id, name, color, position, wip_limit, is_done)
SELECT id, 'NÃO INICIADO', '#6b7280', 0, NULL, false FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO statuses (workspace_id, name, color, position, wip_limit, is_done)
SELECT id, 'AGUARDANDO RESPOSTA', '#f59e0b', 1, 6, false FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO statuses (workspace_id, name, color, position, wip_limit, is_done)
SELECT id, 'EM PROGRESSO', '#3b82f6', 2, NULL, false FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO statuses (workspace_id, name, color, position, wip_limit, is_done)
SELECT id, 'CONCLUÍDO', '#22c55e', 3, NULL, true FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO services (workspace_id, name, color)
SELECT id, 'BAHVITRINE', '#22c55e' FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO services (workspace_id, name, color)
SELECT id, 'BAHTECH', '#3b82f6' FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO services (workspace_id, name, color)
SELECT id, 'EQUINOX', '#eab308' FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO members (workspace_id, user_id, display_name, email, role)
SELECT id, gen_random_uuid(), 'Ana Costa', 'ana@bahcompany.com', 'admin' FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO members (workspace_id, user_id, display_name, email, role)
SELECT id, gen_random_uuid(), 'Lucas Pereira', 'lucas@bahcompany.com', 'member' FROM workspaces WHERE slug = 'bahcompany';

INSERT INTO tickets (workspace_id, ticket_type_id, status_id, service_id, assignee_id, reporter_id, title, description, priority, due_date, sequence_number)
SELECT
  w.id,
  (SELECT id FROM ticket_types WHERE workspace_id = w.id AND name = 'História'),
  (SELECT id FROM statuses WHERE workspace_id = w.id AND name = 'NÃO INICIADO'),
  (SELECT id FROM services WHERE workspace_id = w.id AND name = 'BAHTECH'),
  (SELECT id FROM members WHERE workspace_id = w.id AND email = 'lucas@bahcompany.com'),
  (SELECT id FROM members WHERE workspace_id = w.id AND email = 'ana@bahcompany.com'),
  'Revisar protótipo de dashboard',
  'Validar protótipo com o time de design.',
  'medium',
  NOW() + INTERVAL '3 days',
  1
FROM workspaces w WHERE w.slug = 'bahcompany';

INSERT INTO tickets (workspace_id, ticket_type_id, status_id, service_id, assignee_id, reporter_id, title, description, priority, due_date, sequence_number)
SELECT
  w.id,
  (SELECT id FROM ticket_types WHERE workspace_id = w.id AND name = 'Tarefa'),
  (SELECT id FROM statuses WHERE workspace_id = w.id AND name = 'AGUARDANDO RESPOSTA'),
  (SELECT id FROM services WHERE workspace_id = w.id AND name = 'BAHVITRINE'),
  (SELECT id FROM members WHERE workspace_id = w.id AND email = 'ana@bahcompany.com'),
  (SELECT id FROM members WHERE workspace_id = w.id AND email = 'ana@bahcompany.com'),
  'Ajustar componente de ticket',
  'Ajustar a interface do cartão para exibir prioridade e data limite.',
  'high',
  NOW() + INTERVAL '2 days',
  2
FROM workspaces w WHERE w.slug = 'bahcompany';
-- 002: Tabelas faltantes, triggers e view tickets_full

-- ========== SPRINTS ==========
CREATE TABLE IF NOT EXISTS sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar FK de sprint na tabela tickets (se não existir)
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN sprint_id UUID REFERENCES sprints(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Adicionar parent_id na tabela tickets (se não existir)
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN parent_id UUID REFERENCES tickets(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Adicionar completed_at na tabela tickets
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN completed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ========== SUBTASKS ==========
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== TICKET LINKS ==========
CREATE TABLE IF NOT EXISTS ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'relates', 'duplicates')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, link_type)
);

-- ========== COMMENTS ==========
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== QUICK REACTIONS ==========
CREATE TABLE IF NOT EXISTS quick_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  label TEXT NOT NULL
);

-- ========== COMMENT REACTIONS ==========
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, member_id, emoji)
);

-- ========== ACTIVITY LOG ==========
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== TIME ENTRIES ==========
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  minutes INT NOT NULL,
  description TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== ATTACHMENTS ==========
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES members(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== TICKET VIEWERS ==========
CREATE TABLE IF NOT EXISTS ticket_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, member_id)
);

-- ========== TRIGGERS ==========

-- Auto-incrementar sequence_number
CREATE OR REPLACE FUNCTION fn_ticket_sequence() RETURNS TRIGGER AS $$
BEGIN
  NEW.sequence_number := COALESCE(
    (SELECT MAX(sequence_number) FROM tickets WHERE workspace_id = NEW.workspace_id), 0
  ) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_sequence ON tickets;
CREATE TRIGGER trg_ticket_sequence
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_ticket_sequence();

-- Auto-atualizar updated_at
CREATE OR REPLACE FUNCTION fn_tickets_updated() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_updated ON tickets;
CREATE TRIGGER trg_tickets_updated
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_tickets_updated();

-- Logar mudanças de status e assignee no activity_log
CREATE OR REPLACE FUNCTION fn_log_ticket_changes() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    INSERT INTO activity_log (ticket_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, 'changed', 'status',
      (SELECT name FROM statuses WHERE id = OLD.status_id),
      (SELECT name FROM statuses WHERE id = NEW.status_id));

    -- Marcar completed_at quando vai para status is_done=true
    IF EXISTS (SELECT 1 FROM statuses WHERE id = NEW.status_id AND is_done = true) THEN
      NEW.completed_at := NOW();
    ELSE
      NEW.completed_at := NULL;
    END IF;
  END IF;

  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO activity_log (ticket_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, 'changed', 'assignee',
      (SELECT display_name FROM members WHERE id = OLD.assignee_id),
      (SELECT display_name FROM members WHERE id = NEW.assignee_id));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_ticket_changes ON tickets;
CREATE TRIGGER trg_log_ticket_changes
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_ticket_changes();

-- ========== VIEW tickets_full ==========
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

-- ========== SEED Quick Reactions ==========
INSERT INTO quick_reactions (workspace_id, emoji, label)
SELECT w.id, '👍', 'Curtir' FROM workspaces w WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO quick_reactions (workspace_id, emoji, label)
SELECT w.id, '🎉', 'Celebrar' FROM workspaces w WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO quick_reactions (workspace_id, emoji, label)
SELECT w.id, '👀', 'Olhando' FROM workspaces w WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO quick_reactions (workspace_id, emoji, label)
SELECT w.id, '🚀', 'Bora!' FROM workspaces w WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;

-- Mais serviços
INSERT INTO services (workspace_id, name, color)
SELECT id, 'BAHSAUDE', '#10b981' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO services (workspace_id, name, color)
SELECT id, 'BAHFLASH', '#f43f5e' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO services (workspace_id, name, color)
SELECT id, 'LOVATTOFIT', '#8b5cf6' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO services (workspace_id, name, color)
SELECT id, 'BAHPROJECT', '#0ea5e9' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;

-- Categorias
INSERT INTO categories (workspace_id, name)
SELECT id, 'MANUTENÇÃO' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;
INSERT INTO categories (workspace_id, name)
SELECT id, 'PROJETO-NOVO' FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;

-- Sprint ativa
INSERT INTO sprints (workspace_id, name, goal, start_date, end_date, is_active)
SELECT id, 'Sprint 23', 'Finalizar módulo de autenticação e dashboard', NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days', true
FROM workspaces WHERE slug = 'bahcompany';
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
-- 004: Indexes para performance em queries frequentes

-- ========== TICKETS ==========
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sprint_id ON tickets(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tickets_service_id ON tickets(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_workspace_id ON tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_is_archived ON tickets(is_archived);

-- ========== SUBTASKS ==========
CREATE INDEX IF NOT EXISTS idx_subtasks_ticket_id ON subtasks(ticket_id);

-- ========== COMMENTS ==========
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);

-- ========== TIME ENTRIES ==========
CREATE INDEX IF NOT EXISTS idx_time_entries_ticket_id ON time_entries(ticket_id);

-- ========== ACTIVITY LOG ==========
CREATE INDEX IF NOT EXISTS idx_activity_log_ticket_id ON activity_log(ticket_id);

-- ========== ATTACHMENTS ==========
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);

-- ========== TICKET LINKS ==========
CREATE INDEX IF NOT EXISTS idx_ticket_links_source_ticket_id ON ticket_links(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_target_ticket_id ON ticket_links(target_ticket_id);

-- ========== NOTIFICATIONS ==========
CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ========== SPRINTS ==========
CREATE INDEX IF NOT EXISTS idx_sprints_workspace_id ON sprints(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sprints_is_active ON sprints(is_active);
CREATE TABLE IF NOT EXISTS dev_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('branch', 'pull_request', 'commit')),
  title TEXT NOT NULL,
  url TEXT,
  status TEXT, -- e.g. 'open', 'merged', 'closed'
  provider TEXT DEFAULT 'github', -- github, gitlab, bitbucket
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_links_ticket_id ON dev_links(ticket_id);
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'ticket.created', 'ticket.updated', 'comment.created'}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
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
-- Add phone to members for WhatsApp notifications
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT;

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('app', 'email', 'whatsapp')),
  event TEXT NOT NULL, -- 'ticket.assigned', 'ticket.mentioned', 'comment.created', etc.
  is_enabled BOOLEAN DEFAULT true,
  UNIQUE(member_id, channel, event)
);
CREATE TABLE IF NOT EXISTS access_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'link' CHECK (type IN ('link', 'staging', 'production', 'admin', 'docs', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_links_ticket_id ON access_links(ticket_id);
-- 010: Tabela de clientes + client_id em tickets

-- ========== CLIENTS ==========
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add client_id to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id);

-- Seed some clients
INSERT INTO clients (workspace_id, name, color)
SELECT id, 'Bah!Company', '#3b82f6' FROM workspaces WHERE slug = 'bahcompany';
INSERT INTO clients (workspace_id, name, color)
SELECT id, 'Lovatto Fit', '#8b5cf6' FROM workspaces WHERE slug = 'bahcompany';
INSERT INTO clients (workspace_id, name, color)
SELECT id, 'Equinox', '#eab308' FROM workspaces WHERE slug = 'bahcompany';

-- ========== UPDATE VIEW tickets_full ==========
DROP VIEW IF EXISTS tickets_full CASCADE;
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
  -- Servico
  sv.id AS service_id,
  sv.name AS service_name,
  sv.color AS service_color,
  -- Categoria
  cat.id AS category_id,
  cat.name AS category_name,
  -- Cliente
  cl.id AS client_id,
  cl.name AS client_name,
  cl.color AS client_color,
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
LEFT JOIN clients cl ON cl.id = t.client_id
LEFT JOIN members ma ON ma.id = t.assignee_id
LEFT JOIN members mr ON mr.id = t.reporter_id
LEFT JOIN sprints sp ON sp.id = t.sprint_id;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true;
-- ========== PROJECTS ==========
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);

-- ========== BOARDS ==========
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'kanban' CHECK (type IN ('kanban', 'scrum', 'simple')),
  filter_query TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_project_id ON boards(project_id);

-- ========== RBAC ROLES ==========
CREATE TABLE IF NOT EXISTS org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, member_id)
);

CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, member_id)
);

CREATE TABLE IF NOT EXISTS board_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, member_id)
);

-- ========== LINK TICKETS TO PROJECTS ==========
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id);

CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_board_id ON tickets(board_id);

-- ========== PROJECT TEMPLATES ==========
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO project_templates (name, description, config, is_system) VALUES
('Kanban Simples', 'Board kanban com colunas básicas', '{"statuses":["Não Iniciado","Em Progresso","Concluído"],"types":["Tarefa","Bug"]}', true),
('Scrum', 'Sprints, histórias e bugs', '{"statuses":["Não Iniciado","Aguardando","Em Progresso","Em Revisão","Concluído"],"types":["História","Tarefa","Bug","Epic"]}', true),
('Suporte', 'Atendimento ao cliente', '{"statuses":["Aberto","Em Atendimento","Aguardando Cliente","Resolvido"],"types":["Chamado","Bug","Melhoria"]}', true);

-- ========== CHANGELOG / AUDIT LOG ==========
CREATE TABLE IF NOT EXISTS changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  commit_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_workspace_id ON changelog(workspace_id);
CREATE INDEX IF NOT EXISTS idx_changelog_project_id ON changelog(project_id);
CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON changelog(created_at DESC);

-- Seed: create default project from existing workspace data
INSERT INTO projects (workspace_id, name, prefix, description, color)
SELECT id, name, prefix, description, '#3b82f6' FROM workspaces LIMIT 1
ON CONFLICT DO NOTHING;

-- Create default board for existing project
INSERT INTO boards (project_id, name, type, is_default)
SELECT p.id, 'Board Principal', 'kanban', true
FROM projects p
LIMIT 1
ON CONFLICT DO NOTHING;
-- 013: Organizações, Produtos e vínculo com Clientes

-- ========== ORGANIZATIONS ==========
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link clients to organizations
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ========== PRODUCTS ==========
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link clients to products (many-to-many)
CREATE TABLE IF NOT EXISTS client_products (
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_workspace_id ON organizations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_workspace_id ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id);
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  name TEXT NOT NULL,
  filter_config JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_filters_workspace ON saved_filters(workspace_id);
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  PRIMARY KEY (team_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_workspace ON teams(workspace_id);
-- Permission groups/categories
CREATE TABLE IF NOT EXISTS permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- Permission catalog
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL, -- e.g. 'fetch:customers', 'write:tickets', 'delete:subscriptions'
  display_name TEXT NOT NULL, -- e.g. 'Exibir Clientes', 'Criar Tickets'
  group_id UUID REFERENCES permission_groups(id),
  scope TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('users', 'api_keys', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, key)
);

-- Role-permission assignments (which roles have which permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL, -- 'owner', 'admin', 'member', 'viewer', or custom role name
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_name, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_workspace ON permissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);

-- Seed default permission groups
INSERT INTO permission_groups (workspace_id, name)
SELECT w.id, g FROM workspaces w,
  unnest(ARRAY['Admin', 'Clientes', 'Configurações', 'Dashboard', 'Tickets', 'Integrações', 'Webhooks', 'Timesheet']) AS g
WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;

-- Seed default permissions
INSERT INTO permissions (workspace_id, key, display_name, group_id, scope)
SELECT w.id, p.key, p.display_name, pg.id, p.scope
FROM workspaces w
CROSS JOIN LATERAL (VALUES
    ('admin:all', 'Acesso Total (Superadmin)', 'Admin', 'both'),
    ('read:customers', 'Exibir Clientes', 'Clientes', 'users'),
    ('read:customers_analytics', 'Análise de Clientes', 'Clientes', 'users'),
    ('write:customers', 'Criar/Editar Clientes', 'Clientes', 'users'),
    ('read:tickets', 'Visualizar Tickets', 'Tickets', 'both'),
    ('write:tickets', 'Criar/Editar Tickets', 'Tickets', 'both'),
    ('delete:tickets', 'Remover Tickets', 'Tickets', 'users'),
    ('read:dashboard', 'Visualizar Dashboard', 'Dashboard', 'users'),
    ('read:settings', 'Visualizar Configurações', 'Configurações', 'users'),
    ('write:settings', 'Editar Configurações', 'Configurações', 'users'),
    ('read:timesheet', 'Visualizar Timesheet', 'Timesheet', 'both'),
    ('write:timesheet', 'Registrar Tempo', 'Timesheet', 'both'),
    ('manage:webhooks', 'Gerenciar Webhooks', 'Webhooks', 'both'),
    ('manage:integrations', 'Gerenciar Integrações', 'Integrações', 'users'),
    ('manage:api_keys', 'Gerenciar API Keys', 'Configurações', 'users')
) AS p(key, display_name, group_name, scope)
JOIN permission_groups pg ON pg.workspace_id = w.id AND pg.name = p.group_name
WHERE w.slug = 'bahcompany'
ON CONFLICT DO NOTHING;

-- Assign all permissions to 'admin' role
INSERT INTO role_permissions (role_name, permission_id, workspace_id)
SELECT 'admin', p.id, p.workspace_id
FROM permissions p
ON CONFLICT DO NOTHING;
-- Update tickets_full to include project and board info
DROP VIEW IF EXISTS tickets_full;
CREATE VIEW tickets_full AS
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
  t.project_id,
  t.board_id,
  t.client_id,
  -- Ticket key
  w.prefix || '-' || LPAD(t.sequence_number::text, 3, '0') AS ticket_key,
  -- Type
  tt.id AS type_id, tt.name AS type_name, tt.icon AS type_icon, tt.color AS type_color,
  -- Status
  s.id AS status_id, s.name AS status_name, s.color AS status_color, s.position AS status_position, s.is_done,
  -- Service
  sv.id AS service_id, sv.name AS service_name, sv.color AS service_color,
  -- Category
  cat.id AS category_id, cat.name AS category_name,
  -- Assignee
  ma.id AS assignee_id, ma.display_name AS assignee_name, ma.email AS assignee_email,
  -- Reporter
  mr.id AS reporter_id, mr.display_name AS reporter_name,
  -- Sprint
  sp.id AS sprint_id_ref, sp.name AS sprint_name,
  -- Client
  cl.id AS client_id_ref, cl.name AS client_name, cl.color AS client_color,
  -- Project
  p.name AS project_name, p.prefix AS project_prefix,
  -- Board
  b.name AS board_name,
  -- Counts
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
-- Documentation spaces (like Confluence spaces)
CREATE TABLE IF NOT EXISTS doc_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📚',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders and subfolders (tree structure)
CREATE TABLE IF NOT EXISTS doc_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES doc_spaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES doc_folders(id) ON DELETE CASCADE, -- null = root
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pages/documents (the actual content)
CREATE TABLE IF NOT EXISTS doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES doc_spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES doc_folders(id) ON DELETE SET NULL, -- null = space root
  title TEXT NOT NULL,
  content TEXT DEFAULT '', -- HTML content from rich text editor
  created_by UUID REFERENCES members(id),
  updated_by UUID REFERENCES members(id),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_spaces_workspace ON doc_spaces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_space ON doc_folders(space_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent ON doc_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_space ON doc_pages(space_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_folder ON doc_pages(folder_id);

-- Seed a default space
INSERT INTO doc_spaces (workspace_id, name, description, icon)
SELECT id, 'Base de Conhecimento', 'Documentação geral da organização', '📚'
FROM workspaces WHERE slug = 'bahcompany'
ON CONFLICT DO NOTHING;
-- Fila de aprovação para criação de projetos e acesso
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('project_creation', 'project_access', 'board_access', 'org_access')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Dados do pedido (JSON flexível)
  request_data JSONB NOT NULL DEFAULT '{}',
  -- Aprovação/rejeição
  reviewer_id UUID REFERENCES members(id),
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workspace ON approval_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requester ON approval_requests(requester_id);

-- Adicionar campo de status de aprovação aos membros
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Membros existentes são aprovados automaticamente
UPDATE members SET is_approved = true WHERE is_approved IS NULL OR is_approved = false;
-- Access control for documentation spaces
CREATE TABLE IF NOT EXISTS doc_space_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES doc_spaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_space_roles_space ON doc_space_roles(space_id);
CREATE INDEX IF NOT EXISTS idx_doc_space_roles_member ON doc_space_roles(member_id);
-- Clerk authentication integration
ALTER TABLE members ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_clerk_user_id ON members(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

-- =====================================================
-- SETUP INICIAL: Workspace BahTech
-- =====================================================
UPDATE workspaces SET name = 'BahTech', slug = 'bahtech' WHERE slug = 'bahcompany';

