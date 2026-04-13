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
