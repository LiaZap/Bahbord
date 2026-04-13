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
