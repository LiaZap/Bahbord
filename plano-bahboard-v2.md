# BahBoard — Plano de Ação para Claude Code (v2)
## Sistema Interno de Gestão de Projetos (Referência: Jira Bah!Company)

---

## 📋 VISÃO GERAL DO PROJETO

**Nome:** BahBoard  
**Objetivo:** Recriar internamente um sistema de gestão de projetos inspirado no Jira, personalizado para a operação da Bah!Company.  
**Tech Stack:** Next.js 14 (App Router) + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS  
**Por que esse stack:** Angelo já usa Supabase em outros projetos (Bah!Vitrine, n8n), reduzindo curva de aprendizado e custos.

---

## 🏗️ ARQUITETURA DO SISTEMA

```
┌──────────────────────────────────────────────────┐
│               FRONTEND (Next.js 14)              │
│  ┌─────────┬──────────┬──────────┬─────────────┐ │
│  │ Kanban  │ Lista    │Timeline  │ Dashboard   │ │
│  │ Board   │ View     │ View     │ + Relatórios│ │
│  └─────────┴──────────┴──────────┴─────────────┘ │
│  ┌─────────┬──────────┬──────────┬─────────────┐ │
│  │ Sprints │ Backlog  │Cronogram │ Timesheet   │ │
│  └─────────┴──────────┴──────────┴─────────────┘ │
│         Tailwind CSS + Framer Motion              │
├──────────────────────────────────────────────────┤
│            SUPABASE (Backend)                     │
│  ┌──────────┬──────────┬──────────────────┐      │
│  │   Auth   │ Realtime │   Storage        │      │
│  │  (login) │ (ws)     │  (anexos)        │      │
│  └──────────┴──────────┴──────────────────┘      │
│         PostgreSQL + Row Level Security           │
├──────────────────────────────────────────────────┤
│            INTEGRAÇÕES                            │
│  ┌──────────┬──────────┬──────────┬────────────┐ │
│  │   n8n    │ WhatsApp │ Webhooks │ Clockify   │ │
│  │(automação)│(UazAPI) │(notific.)│(timetrack) │ │
│  └──────────┴──────────┴──────────┴────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 📸 MAPEAMENTO DAS TELAS DE REFERÊNCIA

### Tela 1 — Kanban Board
- 4 colunas: NÃO INICIADO (13) | AGUARDANDO RESPOSTA (6, MAX:6) | EM PROGRESSO (8) | CONCLUÍDO (12)
- Cards com: ticket_key (BAH-815), título, badges de projeto, badge de tipo (MANUTENÇÃO), avatar, data
- Prefixo no título: [BAHFLASH], [BAHVITRINE], [BAHTECH], [EQUINOX]
- Labels de projeto: BAHVITRINE (verde), BAHTECH (azul), EQUINOX (amarelo), LOVATTOFIT (laranja)
- Botão "Concluir sprint"

### Tela 2 — Detalhe do Ticket (BAH-778)
- Breadcrumb hierárquico: BAH-781 / BAH-778 (pai → filho)
- Status badge: "Concluído" (verde) + "Itens concluídos" ✓
- Visualizadores: ícone olho com "2"
- Descrição com template: "História de usuário:", "Critério de aceitação:"
- **Subtarefas** (adicionar subtarefa)
- **Tickets vinculados** (adicionar ticket vinculado)
- Atividade com abas: Tudo | Comentários | Histórico | Registro de atividades | Time in Status
- **Reações rápidas**: "Ficou bom!", "Precisa de ajuda?", "Este item está bloqueado...", "Você po..."
- Sidebar direita — Informações:
  - Data limite
  - Responsável (com avatar)
  - BAH! Serviço/Produto (campo customizado obrigatório)
  - Pai (link ao ticket pai)
  - Categorias
  - Sprint (Sprint 23 +1)
  - Relator (diferente do Responsável)
- Sidebar direita — Seções extras:
  - Desenvolvimento
  - Automação (execuções de regras)
  - Clockify (Start/Stop)
  - Timesheet (Time spent)
- Footer: "Criado 11 de março de 2026 às 10:07"

### Tela 3 — Criar Ticket (Modal)
- Campo: Espaço → Bah!Company (BAH)
- Campo: Tipo do ticket → dropdown: **História**, **Tarefa**, **Bug**, **Epic**
- Campo: Status (status inicial)
- Campo: Resumo (obrigatório)
- Campo: Descrição (rich text com toolbar: bold, italic, listas, tabela, imagem, link, código, etc.)
- Template na descrição por tipo: "História de usuário:", "Critério de aceitação:", "Observação:"
- Campo: Data limite (date picker)
- Checkbox: "Criar outro"

### Tela 4 — Criar Ticket (continuação scroll)
- Campo: Responsável → "Automático" ou selecionar + "Atribuir a mim"
- Campo: BAH! Serviço/Produto → obrigatório, validação em vermelho
- Campo: Pai → Selecionar pai (busca com autocomplete)
- Checkbox: "Mostrar tudo marcado como concluído"
- Campo: Categoria → Selecionar categoria
- Campo: Sprint → Sprint 23 (com warning: "A criação desse ticket vai afetar o escopo do sprint ativo")
- Campo: Relator

---

## 📊 MODELAGEM DO BANCO DE DADOS (Supabase/PostgreSQL)

### Tabelas Principais

```sql
-- ============================================
-- 1. WORKSPACES (Espaços de trabalho)
-- ============================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- "Bah!Company"
  slug TEXT UNIQUE NOT NULL,        -- "bahcompany"
  prefix TEXT NOT NULL,             -- "BAH" (para BAH-001, BAH-002...)
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. MEMBROS (Usuários do workspace)
-- ============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) DEFAULT 'member',
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================
-- 3. TIPOS DE TICKET (História, Tarefa, Bug, Epic)
-- ============================================
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- "História", "Tarefa", "Bug", "Epic"
  icon TEXT,                        -- emoji ou ícone: "📘", "✅", "🐛", "⚡"
  color TEXT DEFAULT '#3b82f6',
  description_template TEXT,        -- Template padrão da descrição
  position INT NOT NULL DEFAULT 0,
  is_subtask BOOLEAN DEFAULT false, -- Se é tipo de subtarefa
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. STATUS (Colunas do Kanban)
-- ============================================
CREATE TABLE statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- "NÃO INICIADO", "AGUARDANDO RESPOSTA", etc.
  color TEXT DEFAULT '#6b7280',
  position INT NOT NULL DEFAULT 0,
  wip_limit INT,                    -- Limite WIP (ex: MAX: 6)
  is_done BOOLEAN DEFAULT false,    -- Se é coluna de "concluído"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. SERVIÇOS/PRODUTOS (Campo obrigatório customizado)
-- Corresponde a "BAH! Serviço/Produto" no Jira
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- "BAHPROJECT", "BAHVITRINE", "BAHTECH", "EQUINOX", "LOVATTOFIT"
  color TEXT DEFAULT '#6366f1',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CATEGORIAS (separadas de serviço/produto)
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- "MANUTENÇÃO", "PROJETO-NOVO"
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. SPRINTS
-- ============================================
CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- "Sprint 23"
  goal TEXT,                        -- Objetivo do sprint
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,  -- Apenas 1 ativo por vez
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 8. TICKETS (Work Items — Coração do sistema)
-- ============================================
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Tipo e classificação
  ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,    -- BAH! Serviço/Produto (obrigatório no form)
  status_id UUID REFERENCES statuses(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  
  -- Hierarquia pai/filho
  parent_id UUID REFERENCES tickets(id) ON DELETE SET NULL,      -- Ticket pai (ex: BAH-781 é pai de BAH-778)
  
  -- Pessoas
  assignee_id UUID REFERENCES members(id) ON DELETE SET NULL,    -- Responsável
  reporter_id UUID REFERENCES members(id) ON DELETE SET NULL,    -- Relator (quem criou/reportou)
  
  -- Identificador sequencial
  sequence_number INT NOT NULL,
  -- ticket_key gerado como: workspace.prefix + '-' + sequence_number (BAH-815)
  
  -- Conteúdo
  title TEXT NOT NULL,              -- "Resumo" no Jira
  description JSONB,                -- Rich text em formato JSON (TipTap/ProseMirror)
  priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low')) DEFAULT 'medium',
  
  -- Datas
  due_date DATE,                    -- Data limite
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Posição no kanban
  position INT NOT NULL DEFAULT 0,
  
  -- Flags
  is_archived BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. SUBTAREFAS (checklist dentro do ticket)
-- ============================================
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assignee_id UUID REFERENCES members(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 10. TICKETS VINCULADOS (linked issues)
-- ============================================
CREATE TABLE ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  link_type TEXT CHECK (link_type IN (
    'blocks',          -- "bloqueia"
    'is_blocked_by',   -- "é bloqueado por"
    'relates_to',      -- "relaciona-se com"
    'duplicates',      -- "duplica"
    'is_duplicated_by' -- "é duplicado por"
  )) DEFAULT 'relates_to',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_ticket_id, target_ticket_id)
);

-- ============================================
-- 11. COMENTÁRIOS
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES members(id) ON DELETE SET NULL,
  content JSONB NOT NULL,           -- Rich text em formato JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. REAÇÕES EM COMENTÁRIOS
-- ============================================
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,              -- "👍", "👏", "🚫", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, member_id, emoji)
);

-- ============================================
-- 13. REAÇÕES RÁPIDAS (templates de comentário rápido)
-- ============================================
CREATE TABLE quick_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,              -- "🎉", "👋", "🚫", "💬"
  label TEXT NOT NULL,              -- "Ficou bom!", "Precisa de ajuda?", "Este item está bloqueado...", "Você pode..."
  position INT NOT NULL DEFAULT 0
);

-- ============================================
-- 14. HISTÓRICO DE ATIVIDADES (Audit Log)
-- ============================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES members(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  -- Ações possíveis:
  -- 'created', 'status_changed', 'assigned', 'priority_changed',
  -- 'comment_added', 'comment_edited', 'comment_deleted',
  -- 'sprint_changed', 'service_changed', 'category_changed',
  -- 'parent_changed', 'subtask_added', 'subtask_completed',
  -- 'link_added', 'link_removed', 'description_updated',
  -- 'due_date_changed', 'archived'
  field_name TEXT,                  -- Campo alterado: "status", "assignee", "sprint"...
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. TIME TRACKING (Timesheet)
-- ============================================
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,             -- Duração em minutos (calculada ou manual)
  is_running BOOLEAN DEFAULT false, -- Se o timer está ativo (Clockify style)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. ANEXOS (arquivos)
-- ============================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES members(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,           -- URL do Supabase Storage
  file_size INT,                    -- em bytes
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. NOTIFICAÇÕES
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES members(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES members(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- 'assigned', 'mentioned', 'comment', 'status_changed'
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. VISUALIZADORES DO TICKET (quem viu)
-- ============================================
CREATE TABLE ticket_viewers (
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticket_id, member_id)
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_tickets_workspace ON tickets(workspace_id);
CREATE INDEX idx_tickets_status ON tickets(status_id);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_service ON tickets(service_id);
CREATE INDEX idx_tickets_sprint ON tickets(sprint_id);
CREATE INDEX idx_tickets_parent ON tickets(parent_id);
CREATE INDEX idx_tickets_sequence ON tickets(workspace_id, sequence_number);
CREATE INDEX idx_activity_ticket ON activity_log(ticket_id);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);
CREATE INDEX idx_subtasks_ticket ON subtasks(ticket_id);
CREATE INDEX idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX idx_ticket_links_target ON ticket_links(target_ticket_id);

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Auto-incrementar sequence_number por workspace
CREATE OR REPLACE FUNCTION generate_ticket_sequence()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO NEW.sequence_number
  FROM tickets
  WHERE workspace_id = NEW.workspace_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_sequence
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_sequence();

-- Auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_comments_updated
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Registrar mudança de status automaticamente no activity_log
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    INSERT INTO activity_log (ticket_id, actor_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      NEW.assignee_id, -- será sobrescrito pela aplicação via RPC
      'status_changed',
      'status',
      (SELECT name FROM statuses WHERE id = OLD.status_id),
      (SELECT name FROM statuses WHERE id = NEW.status_id)
    );
  END IF;
  
  -- Registrar mudança de responsável
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO activity_log (ticket_id, action, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      'assigned',
      'assignee',
      (SELECT display_name FROM members WHERE id = OLD.assignee_id),
      (SELECT display_name FROM members WHERE id = NEW.assignee_id)
    );
  END IF;

  -- Marcar completed_at quando mover para coluna "done"
  IF NEW.status_id IS NOT NULL AND 
     (SELECT is_done FROM statuses WHERE id = NEW.status_id) = true AND
     OLD.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;

  -- Limpar completed_at se sair de coluna "done"
  IF NEW.status_id IS NOT NULL AND 
     (SELECT is_done FROM statuses WHERE id = NEW.status_id) = false THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_ticket_changes
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_status_change();

-- Função helper: gerar ticket_key
CREATE OR REPLACE FUNCTION get_ticket_key(t tickets)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT prefix FROM workspaces WHERE id = t.workspace_id) || '-' || t.sequence_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- View útil: tickets com todas as informações JOIN
CREATE OR REPLACE VIEW tickets_full AS
SELECT 
  t.*,
  w.prefix || '-' || t.sequence_number AS ticket_key,
  w.name AS workspace_name,
  tt.name AS type_name,
  tt.icon AS type_icon,
  tt.color AS type_color,
  s.name AS status_name,
  s.color AS status_color,
  s.is_done AS status_is_done,
  sv.name AS service_name,
  sv.color AS service_color,
  c.name AS category_name,
  c.color AS category_color,
  sp.name AS sprint_name,
  sp.is_active AS sprint_is_active,
  a.display_name AS assignee_name,
  a.avatar_url AS assignee_avatar,
  r.display_name AS reporter_name,
  r.avatar_url AS reporter_avatar,
  pt.sequence_number AS parent_sequence,
  w.prefix || '-' || pt.sequence_number AS parent_key,
  pt.title AS parent_title,
  (SELECT COUNT(*) FROM subtasks st WHERE st.ticket_id = t.id) AS subtask_count,
  (SELECT COUNT(*) FROM subtasks st WHERE st.ticket_id = t.id AND st.is_completed = true) AS subtask_done_count,
  (SELECT COUNT(*) FROM comments cm WHERE cm.ticket_id = t.id) AS comment_count,
  (SELECT COUNT(*) FROM ticket_viewers tv WHERE tv.ticket_id = t.id) AS viewer_count,
  (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_entries te WHERE te.ticket_id = t.id) AS total_time_minutes
FROM tickets t
LEFT JOIN workspaces w ON w.id = t.workspace_id
LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
LEFT JOIN statuses s ON s.id = t.status_id
LEFT JOIN services sv ON sv.id = t.service_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN sprints sp ON sp.id = t.sprint_id
LEFT JOIN members a ON a.id = t.assignee_id
LEFT JOIN members r ON r.id = t.reporter_id
LEFT JOIN tickets pt ON pt.id = t.parent_id
WHERE t.is_archived = false;
```

---

## 🚀 FASES DE DESENVOLVIMENTO

---

### FASE 1 — FUNDAÇÃO (3-4 dias)
**Prompt para Claude Code:**

```
Crie o projeto BahBoard: Next.js 14 App Router + Supabase + Tailwind CSS 
+ TypeScript. Um sistema de gestão de projetos estilo Jira dark mode.

SETUP:
1. Next.js 14 com App Router, TypeScript strict
2. Supabase client (client-side e server-side) + middleware auth
3. Tailwind CSS com tema dark (#1d1f21 fundo, #282a2e cards, #3b82f6 accent)
4. Dependências: @dnd-kit/core, @dnd-kit/sortable, recharts, lucide-react, 
   date-fns, @tiptap/react (rich text editor)

BANCO DE DADOS:
Aplique a migração SQL completa (arquivo supabase/migrations/001_initial_schema.sql)
com todas as 18 tabelas, índices, triggers e views conforme o CLAUDE.md.

LAYOUT PRINCIPAL (tema escuro estilo Jira):
- Sidebar esquerda com:
  - Logo "BahBoard"
  - Navegação: Resumo, Cronograma, Backlog, Quadro, Lista, Sprints
  - Seção "Filtros"
  - Seção "Configurações"
- Header com:
  - Barra de busca
  - Avatares dos membros filtráveis
  - Botão "+ Criar" (azul)
  - Sino de notificações
  - Menu do usuário

AUTENTICAÇÃO:
- Login com email/senha via Supabase Auth
- Middleware protegendo todas as rotas exceto /login
- Redirect automático após login

Estrutura de pastas:
/app
  /(auth)/login/page.tsx
  /(dashboard)/layout.tsx          → Sidebar + Header
  /(dashboard)/page.tsx            → Dashboard
  /(dashboard)/board/page.tsx      → Kanban
  /(dashboard)/list/page.tsx       → Lista
  /(dashboard)/backlog/page.tsx    → Backlog
  /(dashboard)/sprints/page.tsx    → Sprints
  /(dashboard)/ticket/[key]/page.tsx → Detalhe
  /(dashboard)/settings/...        → Configurações
  /api/webhooks/...                → Webhooks
/components/board/                 → KanbanBoard, KanbanColumn, TicketCard
/components/tickets/               → Modais, forms, comentários
/components/layout/                → Sidebar, Header
/components/ui/                    → Componentes base
/lib/supabase/                     → Clients
/lib/hooks/                        → Custom hooks
/lib/types/                        → database.types.ts
/lib/utils/                        → Helpers

Textos da UI em português (pt-BR).
```

**Checklist:**
- [ ] Projeto criado e rodando em localhost
- [ ] Supabase configurado com todas as tabelas
- [ ] Auth funcionando (login/logout/redirect)
- [ ] Layout com sidebar e header completos
- [ ] Tipos TypeScript gerados do Supabase
- [ ] Middleware protegendo rotas

---

### FASE 2 — KANBAN BOARD + DRAG & DROP (3-4 dias)
**Prompt para Claude Code:**

```
Crie o Kanban Board principal em /board. Referência: Jira dark mode.

COLUNAS:
- Buscar da tabela 'statuses' ordenadas por position
- Cada coluna mostra: nome, contagem de tickets, badge WIP limit (se houver)
- WIP limit visual: quando atingido, borda da coluna fica amarela/vermelha
- Header da coluna com "..." menu (editar, mover, deletar)
- Colunas padrão: NÃO INICIADO, AGUARDANDO RESPOSTA (WIP:6), EM PROGRESSO, CONCLUÍDO

CARDS DE TICKET:
Cada card exibe:
- ticket_key (BAH-815) em cinza claro, clicável
- Título (negrito, branco)
- Badge do Serviço/Produto (cor do service, ex: BAHVITRINE em verde)
- Badge da Categoria (ex: MANUTENÇÃO em cinza)
- Ícone do tipo de ticket (História 📘, Tarefa ✅, Bug 🐛, Epic ⚡)
- Avatar do responsável (canto inferior direito)
- Data limite (se houver, com ícone calendário)
- Indicador de prioridade (borda esquerda colorida: vermelho=urgent, laranja=high, azul=medium)
- Contador de subtarefas (ex: "2/5" se 2 de 5 completas)

DRAG AND DROP (@dnd-kit):
- Arrastar cards entre colunas
- Reordenar dentro da coluna
- Ao soltar: atualizar status_id e position no Supabase
- Registrar no activity_log via trigger
- Feedback visual: sombra elevada, opacidade 0.5 no placeholder
- Respeitar WIP limit: avisar se coluna atingiu limite

FILTROS (barra acima do board):
- Por Serviço/Produto (badges clicáveis)
- Por Responsável (avatares clicáveis)
- Por Categoria
- Por Tipo de ticket
- Por Sprint
- Busca por texto (título ou ticket_key)
- Botão "Limpar filtros"

REALTIME (Supabase Realtime):
- Subscriptions nas tabelas tickets e statuses
- Quando outro usuário move card, atualizar board em tempo real

SPRINT:
- No header: mostrar nome do sprint ativo
- Botão "Concluir sprint" (abre modal de confirmação)
```

**Checklist:**
- [ ] Board renderizando colunas e cards do banco
- [ ] Cards com todas as informações visuais
- [ ] Drag-and-drop entre colunas + reordenação
- [ ] Persistência no banco + activity_log
- [ ] Filtros funcionando (todos)
- [ ] WIP limit visual
- [ ] Realtime sincronizando
- [ ] Sprint ativo no header

---

### FASE 3 — CRIAÇÃO DE TICKETS (2-3 dias)
**Prompt para Claude Code:**

```
Crie o modal de criação de ticket (botão "+ Criar").
Referência exata: modal "Criar História" do Jira.

MODAL DE CRIAÇÃO:
Layout em coluna única, scrollável, com os campos na ordem:

1. Espaço: Seletor do workspace (pré-selecionado, readonly se só tem 1)
2. Tipo do ticket: Dropdown → História, Tarefa, Bug, Epic
   - Ao mudar tipo, alterar template da descrição
3. Status: Dropdown dos statuses (padrão: primeiro status / NÃO INICIADO)
4. Resumo: Input de texto (obrigatório, placeholder destacado)
5. Descrição: Editor rich text (TipTap) com toolbar:
   - Bold, Italic, Underline, Strikethrough
   - Listas (bullet e numerada)
   - Tabela, Imagem, Link, Código, Divider
   - Template pré-preenchido por tipo:
     * História: "História de usuário:\nCritério de aceitação:\nObservação:"
     * Tarefa: "Descrição da tarefa:\nPasso a passo:"
     * Bug: "Passos para reproduzir:\nComportamento esperado:\nComportamento atual:"
     * Epic: "Objetivo:\nEscopo:\nCritério de sucesso:"
6. Data limite: Date picker
7. Responsável: Dropdown dos membros com avatar + opção "Atribuir a mim"
8. BAH! Serviço/Produto: Dropdown (OBRIGATÓRIO, validação em vermelho)
9. Pai: Autocomplete search de tickets existentes (mostra ticket_key + título)
10. Categoria: Dropdown das categorias
11. Sprint: Dropdown dos sprints + warning se sprint ativo
12. Relator: Auto-preenchido com usuário logado, editável
13. Prioridade: Seletor visual (urgent/high/medium/low com cores)

FOOTER DO MODAL:
- Checkbox "Criar outro" (mantém modal aberto após criar)
- Botão "Cancelar"
- Botão "Criar" (azul, submit)

VALIDAÇÕES:
- Resumo obrigatório
- Serviço/Produto obrigatório (mensagem vermelha se vazio)
- Gerar ticket_key automaticamente (BAH-XXX via trigger)

Ao criar: inserir no banco, fechar modal (ou manter se "criar outro"), 
atualizar board em tempo real.
```

**Checklist:**
- [ ] Modal abrindo com todos os campos
- [ ] Templates de descrição por tipo de ticket
- [ ] Rich text editor funcional (TipTap)
- [ ] Validações visuais (campo obrigatório vermelho)
- [ ] Autocomplete de ticket pai
- [ ] "Criar outro" funcionando
- [ ] Ticket criado aparece no board em tempo real

---

### FASE 4 — DETALHE DO TICKET (3-4 dias)
**Prompt para Claude Code:**

```
Crie o modal/página de detalhes do ticket (ao clicar no card).
Referência exata: tela de detalhes do Jira BAH-778.

LAYOUT SPLIT:
┌──────────────────────────────────────────────┐
│ BAH-781 / BAH-778          👁 2  🔗 ••• ✕  │
├────────────────────────┬─────────────────────┤
│                        │                     │
│  TÍTULO (editável)     │  ▼ Informações      │
│                        │  Data limite         │
│  ▼ Descrição           │  Responsável         │
│  (rich text editável)  │  Serviço/Produto     │
│                        │  Pai                 │
│  Subtarefas            │  Categorias          │
│  + Adicionar subtarefa │  Sprint              │
│                        │  Relator             │
│  Tickets vinculados    │  Prioridade          │
│  + Adicionar vínculo   │  Tipo                │
│                        │                     │
│  ▼ Atividade           │  ▶ Desenvolvimento   │
│  [Tudo] [Comentários]  │  ▶ Time Tracking     │
│  [Histórico] [Reg.Ativ]│  ▶ Timesheet         │
│  [Time in Status]      │                     │
│                        │  Criado: 11/03/2026  │
│  Campo de comentário   │                     │
│  Reações rápidas       │                     │
└────────────────────────┴─────────────────────┘

COLUNA ESQUERDA:

1. BREADCRUMB: Se tem pai, mostra "BAH-781 / BAH-778" como links
2. TÍTULO: Editável inline (clica e vira input)
3. STATUS: Badge colorido + dropdown para mudar (Concluído=verde)
4. DESCRIÇÃO: Editor rich text (TipTap), editável inline
5. SUBTAREFAS:
   - Lista de subtarefas com checkbox, título, responsável
   - Barra de progresso (X/Y concluídas)
   - Botão "+ Adicionar subtarefa"
   - Drag-and-drop para reordenar
6. TICKETS VINCULADOS:
   - Lista de tickets vinculados com tipo de vínculo
   - Cada item mostra: ticket_key, título, status badge
   - Botão "+ Adicionar ticket vinculado" (abre search)
7. ATIVIDADE (tabs):
   - Tudo: comentários + histórico intercalados por data
   - Comentários: apenas comentários
   - Histórico: mudanças de campo (activity_log)
   - Registro de atividades: log detalhado
   - Time in Status: quanto tempo ficou em cada status
8. COMENTÁRIOS:
   - Editor de texto com avatar do autor
   - Reações rápidas: botões "🎉 Ficou bom!", "👋 Precisa de ajuda?",
     "🚫 Este item está bloqueado...", "💬 Você pode..."
   - Cada comentário: avatar, nome, timestamp, conteúdo, editar/deletar
9. VIEWERS: Ícone olho + número de visualizadores

COLUNA DIREITA (Sidebar de informações):
Todos os campos editáveis inline via dropdown/datepicker:
- Data limite
- Responsável (avatar + nome)
- Serviço/Produto
- Pai (link clicável ao ticket pai)
- Categorias
- Sprint
- Relator
- Prioridade
- Seção "Time Tracking": botão Start/Stop timer
- Seção "Timesheet": total de horas gastas
- Footer: "Criado em DD/MM/YYYY às HH:MM"
```

**Checklist:**
- [ ] Layout split com sidebar de informações
- [ ] Breadcrumb hierárquico funcional
- [ ] Todos os campos editáveis inline
- [ ] Subtarefas CRUD + progresso
- [ ] Tickets vinculados CRUD
- [ ] Abas de atividade todas funcionando
- [ ] Comentários com reações rápidas
- [ ] Time tracking Start/Stop
- [ ] Contador de viewers
- [ ] Activity log registrando todas as mudanças

---

### FASE 5 — SPRINT MANAGEMENT (2-3 dias)
**Prompt para Claude Code:**

```
Implemente o gerenciamento de Sprints no BahBoard.

PÁGINA /sprints:
- Lista de sprints (ativo em destaque, concluídos em cinza)
- Criar novo sprint: nome, datas, objetivo
- Iniciar sprint (apenas 1 ativo por vez)
- Concluir sprint:
  - Modal mostrando tickets não concluídos
  - Opção: mover para próximo sprint ou voltar para backlog
  - Resumo: X concluídos, Y não concluídos

BACKLOG (/backlog):
- Tickets sem sprint atribuído
- Drag-and-drop para mover tickets para o sprint ativo
- Agrupamento por Serviço/Produto
- Botão "Criar sprint" com seleção de tickets

BOARD INTEGRATION:
- Filtro de sprint no board (mostrar apenas tickets do sprint ativo)
- Badge do sprint nos cards
- Header mostra: "Sprint 23 | 01/04 - 14/04 | 5 dias restantes"
- Warning ao criar ticket no sprint: "vai afetar o escopo do sprint ativo"

MÉTRICAS DO SPRINT:
- Burndown chart (recharts)
- Velocidade por sprint
- Tickets concluídos vs não concluídos
```

**Checklist:**
- [ ] CRUD de sprints
- [ ] Iniciar/concluir sprint com fluxo completo
- [ ] Backlog com drag para sprint
- [ ] Burndown chart
- [ ] Integração com board e criação de tickets

---

### FASE 6 — VISÕES ALTERNATIVAS + DASHBOARD (3-4 dias)
**Prompt para Claude Code:**

```
Adicione visões alternativas e dashboard ao BahBoard.

VISÃO LISTA (/list):
- Tabela com colunas: Key, Tipo, Título, Status, Serviço, Categoria,
  Prioridade, Responsável, Sprint, Data Limite, Criado
- Ordenação clicando no cabeçalho de cada coluna
- Filtros iguais ao board
- Edição rápida inline: status e responsável
- Checkbox para seleção múltipla + ações em lote:
  - Mover para status
  - Atribuir responsável
  - Mover para sprint
  - Arquivar
- Paginação (50 por página)

DASHBOARD (/):
- Cards de resumo:
  - Total de tickets ativos
  - Em progresso
  - Vencidos (data limite < hoje)
  - Concluídos este sprint
- Gráfico de barras: tickets por status (recharts)
- Gráfico de pizza: distribuição por Serviço/Produto
- Gráfico de linha: tickets criados vs concluídos por semana
- Lista: últimas 10 atividades do workspace
- Lista: tickets vencendo nos próximos 7 dias
- Cards: carga por membro (quantos tickets cada um tem)

CRONOGRAMA (/cronograma):
- Timeline horizontal estilo Gantt simplificado
- Barras por ticket com data início → data limite
- Agrupado por Serviço/Produto
- Zoom: semana, mês, trimestre
```

**Checklist:**
- [ ] Visão lista com tabela completa
- [ ] Ações em lote funcionando
- [ ] Dashboard com todos os gráficos
- [ ] Cronograma/timeline funcional

---

### FASE 7 — CONFIGURAÇÕES + RLS (2-3 dias)
**Prompt para Claude Code:**

```
Crie a área de configurações do BahBoard em /settings.

/settings (Geral):
- Editar nome, descrição, avatar do workspace
- Prefixo do ticket (BAH)

/settings/members:
- Lista de membros com avatar, nome, email, role
- Convidar por email (Supabase invite)
- Alterar role (owner, admin, member, viewer)
- Remover membro (com confirmação)

/settings/statuses:
- CRUD de colunas do kanban
- Drag-and-drop para reordenar
- Definir WIP limit
- Definir cor
- Marcar como "done"
- Preview visual do board

/settings/services:
- CRUD de Serviços/Produtos
- Definir cor do badge
- Ativar/desativar

/settings/categories:
- CRUD de categorias
- Definir cor

/settings/ticket-types:
- CRUD de tipos de ticket
- Definir ícone, cor
- Editar template de descrição

/settings/quick-reactions:
- CRUD de reações rápidas para comentários
- Definir emoji + label

ROW LEVEL SECURITY (Supabase):
Aplicar RLS em TODAS as tabelas:
- Viewers: SELECT em tudo
- Members: SELECT + INSERT/UPDATE em tickets próprios e comentários
- Admins: SELECT + INSERT/UPDATE/DELETE em tudo exceto workspace
- Owners: controle total
Filtrar sempre por workspace_id do membro logado.
```

---

### FASE 8 — INTEGRAÇÕES (3-4 dias)
**Prompt para Claude Code:**

```
Adicione integrações ao BahBoard:

1. WEBHOOKS / API REST:
- POST /api/tickets → criar ticket via API
- GET /api/tickets?status=X → listar tickets
- PATCH /api/tickets/:id → atualizar ticket
- POST /api/webhooks/outgoing → configurar webhook de saída
  - Eventos: ticket.created, ticket.status_changed, ticket.assigned, 
    ticket.commented, sprint.completed
  - Payload JSON padronizado

2. N8N:
- Webhook de saída disparado por trigger do Supabase
- Documentação de endpoints para o n8n consumir
- Exemplo de workflow n8n: 
  "Quando ticket muda para CONCLUÍDO → notificar grupo WhatsApp"

3. WHATSAPP (UazAPI):
- Notificar responsável quando ticket é atribuído
- Notificar quando ticket muda de status
- Resumo diário de tickets vencidos (via n8n scheduled)
- Endpoint: /send/text, header: token, body: { number, text }

4. NOTIFICAÇÕES IN-APP:
- Sino no header com badge de contagem
- Dropdown com lista de notificações
- Tipos: atribuição, comentário, mudança de status, menção
- Marcar como lida (individual e "marcar todas")
- Realtime: nova notificação aparece instantaneamente

5. TIME TRACKING:
- Botão Start/Stop no ticket (estilo Clockify)
- Timer rodando em tempo real no header
- Timesheet: tabela de horas por membro por semana
- Relatório de horas por Serviço/Produto
```

---

## 🎨 DESIGN SYSTEM COMPLETO

### Cores (Dark Theme)
```css
:root {
  /* Fundos */
  --bg-page: #1d1f21;           /* Fundo da página */
  --bg-sidebar: #1a1c1e;        /* Sidebar */
  --bg-card: #282a2e;           /* Cards e modais */
  --bg-column: #22242a;         /* Colunas do kanban */
  --bg-input: #373b41;          /* Inputs e hovers */
  --bg-hover: #2d3036;          /* Hover de items */
  --bg-selected: #1e3a5f;       /* Item selecionado */
  
  /* Textos */
  --text-primary: #c5c8c6;      /* Texto principal */
  --text-secondary: #969896;    /* Texto secundário */
  --text-bright: #ffffff;       /* Títulos */
  --text-muted: #5c6370;        /* Placeholder */
  
  /* Acentos */
  --accent-blue: #3b82f6;       /* Ações primárias */
  --accent-green: #22c55e;      /* Sucesso / Concluído */
  --accent-yellow: #f59e0b;     /* Warning / Em Progresso */
  --accent-red: #ef4444;        /* Urgente / Erro */
  --accent-purple: #a855f7;     /* Labels especiais */
  --accent-orange: #f97316;     /* LOVATTOFIT */
  --accent-cyan: #06b6d4;       /* Links */
  
  /* Bordas */
  --border-default: #373b41;
  --border-subtle: #2d3036;
  --border-focus: #3b82f6;
}
```

### Badges por Serviço/Produto
```
BAHPROJECT   → #6366f1 (indigo)     ícone: 🏢
BAHVITRINE   → #22c55e (verde)      ícone: 🛍️
BAHTECH      → #3b82f6 (azul)       ícone: 💻
EQUINOX      → #eab308 (amarelo)    ícone: ⚡
LOVATTOFIT   → #f97316 (laranja)    ícone: 💪
```

### Ícones por Tipo de Ticket
```
📘 História (azul)     → Bookmark icon
✅ Tarefa (verde)      → Checkbox icon
🐛 Bug (vermelho)      → Bug icon
⚡ Epic (roxo)         → Lightning icon
```

### Prioridades
```
🔴 Urgent  → borda esquerda #ef4444 + ícone ChevronDoubleUp
🟠 High    → borda esquerda #f97316 + ícone ChevronUp
🔵 Medium  → borda esquerda #3b82f6 + ícone Equal
⚪ Low     → borda esquerda #6b7280 + ícone ChevronDown
```

---

## 📁 ESTRUTURA FINAL DE PASTAS

```
bahboard/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 ← Dashboard
│   │   ├── board/page.tsx           ← Kanban Board
│   │   ├── list/page.tsx            ← Visão Lista
│   │   ├── backlog/page.tsx         ← Backlog
│   │   ├── sprints/page.tsx         ← Sprint Management
│   │   ├── cronograma/page.tsx      ← Timeline/Gantt
│   │   ├── ticket/[key]/page.tsx    ← Detalhe do Ticket
│   │   └── settings/
│   │       ├── page.tsx             ← Geral
│   │       ├── members/page.tsx
│   │       ├── statuses/page.tsx
│   │       ├── services/page.tsx
│   │       ├── categories/page.tsx
│   │       ├── ticket-types/page.tsx
│   │       └── quick-reactions/page.tsx
│   ├── api/
│   │   ├── tickets/route.ts
│   │   └── webhooks/
│   │       ├── ticket-created/route.ts
│   │       ├── status-changed/route.ts
│   │       └── outgoing/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── board/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── TicketCard.tsx
│   │   ├── BoardFilters.tsx
│   │   ├── SprintHeader.tsx
│   │   └── WipLimitBadge.tsx
│   ├── tickets/
│   │   ├── CreateTicketModal.tsx
│   │   ├── TicketDetailModal.tsx
│   │   ├── TicketForm.tsx
│   │   ├── CommentSection.tsx
│   │   ├── QuickReactions.tsx
│   │   ├── SubtaskList.tsx
│   │   ├── LinkedTickets.tsx
│   │   ├── ActivityTimeline.tsx
│   │   ├── TimeInStatus.tsx
│   │   └── TimeTracker.tsx
│   ├── sprints/
│   │   ├── SprintList.tsx
│   │   ├── SprintBoard.tsx
│   │   ├── CompleteSprint.tsx
│   │   └── BurndownChart.tsx
│   ├── dashboard/
│   │   ├── StatsCards.tsx
│   │   ├── StatusChart.tsx
│   │   ├── ServiceChart.tsx
│   │   ├── TrendChart.tsx
│   │   ├── RecentActivity.tsx
│   │   ├── UpcomingDeadlines.tsx
│   │   └── TeamWorkload.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── UserMenu.tsx
│   │   ├── NotificationBell.tsx
│   │   └── ActiveTimer.tsx
│   ├── editor/
│   │   ├── RichTextEditor.tsx       ← TipTap editor
│   │   ├── EditorToolbar.tsx
│   │   └── EditorContent.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Avatar.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       ├── Input.tsx
│       ├── DatePicker.tsx
│       ├── Dropdown.tsx
│       ├── Tabs.tsx
│       ├── Table.tsx
│       ├── Checkbox.tsx
│       ├── Progress.tsx
│       ├── Tooltip.tsx
│       ├── SearchInput.tsx
│       └── ConfirmDialog.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── hooks/
│   │   ├── useTickets.ts
│   │   ├── useBoard.ts
│   │   ├── useRealtime.ts
│   │   ├── useServices.ts
│   │   ├── useMembers.ts
│   │   ├── useSprints.ts
│   │   ├── useComments.ts
│   │   ├── useSubtasks.ts
│   │   ├── useTimeTracking.ts
│   │   ├── useNotifications.ts
│   │   └── useActivityLog.ts
│   ├── types/
│   │   └── database.types.ts
│   └── utils/
│       ├── formatDate.ts
│       ├── cn.ts
│       ├── constants.ts
│       └── priorities.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_seed_data.sql
│   └── config.toml
├── public/
│   └── logo.svg
├── CLAUDE.md
├── .env.local
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 🔄 SEQUÊNCIA COMPLETA DE PROMPTS PARA CLAUDE CODE

| # | Prompt | Fase | Tempo |
|---|--------|------|-------|
| 1 | Setup projeto + Auth + Layout + Banco de dados | Fase 1 | 3-4 dias |
| 2 | Kanban Board + Cards + Drag-and-drop | Fase 2 | 2 dias |
| 3 | Filtros do board + Realtime + Sprint header | Fase 2 | 1-2 dias |
| 4 | Modal de criação de ticket (todos os campos) | Fase 3 | 2-3 dias |
| 5 | Modal de detalhes (layout split, edição inline) | Fase 4 | 2 dias |
| 6 | Comentários + Reações rápidas + Activity log | Fase 4 | 1-2 dias |
| 7 | Subtarefas + Tickets vinculados + Time tracking | Fase 4 | 1-2 dias |
| 8 | Sprint management (CRUD, iniciar, concluir) | Fase 5 | 2-3 dias |
| 9 | Visão Lista + Ações em lote | Fase 6 | 2 dias |
| 10 | Dashboard + Gráficos | Fase 6 | 2 dias |
| 11 | Configurações (todas as páginas) | Fase 7 | 2-3 dias |
| 12 | RLS + Segurança | Fase 7 | 1 dia |
| 13 | Webhooks + API REST | Fase 8 | 1-2 dias |
| 14 | Notificações in-app | Fase 8 | 1-2 dias |
| 15 | Integração WhatsApp/n8n | Fase 8 | 1-2 dias |

**Total estimado: ~4-6 semanas**

---

## ⚠️ DADOS INICIAIS (Seed)

```sql
-- Workspace
INSERT INTO workspaces (name, slug, prefix, description) 
VALUES ('Bah!Company', 'bahcompany', 'BAH', 'Workspace principal da Bah!Company');

-- Tipos de ticket
INSERT INTO ticket_types (workspace_id, name, icon, color, description_template, position) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'História', '📘', '#3b82f6', 
 '**História de usuário:**\n\n**Critério de aceitação:**\n\n**Observação:**', 0),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'Tarefa', '✅', '#22c55e',
 '**Descrição da tarefa:**\n\n**Passo a passo:**', 1),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'Bug', '🐛', '#ef4444',
 '**Passos para reproduzir:**\n\n**Comportamento esperado:**\n\n**Comportamento atual:**', 2),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'Epic', '⚡', '#a855f7',
 '**Objetivo:**\n\n**Escopo:**\n\n**Critério de sucesso:**', 3);

-- Status (colunas do kanban)
INSERT INTO statuses (workspace_id, name, color, position, wip_limit, is_done) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'NÃO INICIADO', '#6b7280', 0, NULL, false),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'AGUARDANDO RESPOSTA', '#f59e0b', 1, 6, false),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'EM PROGRESSO', '#3b82f6', 2, NULL, false),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'CONCLUÍDO', '#22c55e', 3, NULL, true);

-- Serviços/Produtos
INSERT INTO services (workspace_id, name, color) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'BAHPROJECT', '#6366f1'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'BAHVITRINE', '#22c55e'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'BAHTECH', '#3b82f6'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'EQUINOX', '#eab308'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'LOVATTOFIT', '#f97316'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'BAHFLASH', '#a855f7');

-- Categorias
INSERT INTO categories (workspace_id, name, color) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'MANUTENÇÃO', '#6b7280'),
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'PROJETO-NOVO', '#8b5cf6');

-- Reações rápidas
INSERT INTO quick_reactions (workspace_id, emoji, label, position) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), '🎉', 'Ficou bom!', 0),
((SELECT id FROM workspaces WHERE slug='bahcompany'), '👋', 'Precisa de ajuda?', 1),
((SELECT id FROM workspaces WHERE slug='bahcompany'), '🚫', 'Este item está bloqueado...', 2),
((SELECT id FROM workspaces WHERE slug='bahcompany'), '💬', 'Você pode...', 3);

-- Sprint inicial
INSERT INTO sprints (workspace_id, name, start_date, end_date, is_active) VALUES
((SELECT id FROM workspaces WHERE slug='bahcompany'), 'Sprint 23', '2026-04-01', '2026-04-14', true);
```

---

## ✅ FUNCIONALIDADES POR PRIORIDADE

### P0 — MVP Essencial
- [x] Auth + Login
- [ ] Kanban Board com drag-and-drop
- [ ] Cards completos (key, título, badges, avatar, data)
- [ ] Criar ticket com todos os campos obrigatórios
- [ ] Detalhe do ticket com edição inline
- [ ] 4 tipos de ticket (História, Tarefa, Bug, Epic)
- [ ] Serviço/Produto obrigatório
- [ ] Colunas customizáveis com WIP limit

### P1 — Importante
- [ ] Hierarquia pai/filho
- [ ] Subtarefas
- [ ] Comentários + reações rápidas
- [ ] Activity log automático
- [ ] Sprint management
- [ ] Filtros e busca
- [ ] Realtime sync
- [ ] Visão lista

### P2 — Desejável
- [ ] Dashboard com gráficos
- [ ] Tickets vinculados
- [ ] Time tracking (Start/Stop)
- [ ] Timesheet
- [ ] Notificações in-app
- [ ] Backlog management
- [ ] Cronograma/Timeline
- [ ] Ações em lote

### P3 — Futuro
- [ ] Integração n8n webhooks
- [ ] Notificações WhatsApp (UazAPI)
- [ ] API REST documentada
- [ ] Automações internas (regras)
- [ ] Relatórios avançados / exportação
- [ ] PWA / app mobile
- [ ] Campos customizáveis
- [ ] Templates de ticket

---

## 📌 DICAS PARA O CLAUDE CODE

1. **Sempre comece com:** "Leia o CLAUDE.md na raiz antes de qualquer alteração"
2. **Commits atômicos:** peça commit a cada funcionalidade completa
3. **Teste incremental:** após cada fase, teste antes de avançar
4. **Variáveis de ambiente:** `.env.local` com as keys do Supabase
5. **RLS:** configure antes de ir para produção
6. **TipTap:** use para o editor rich text (mais leve que Slate/Draft.js)
7. **@dnd-kit:** preferir sobre react-beautiful-dnd (mantido ativamente)
8. **Realtime:** usar channel subscriptions do Supabase, não polling
9. **Tickets:** sempre usar a view `tickets_full` para queries de leitura
10. **Timezone:** todas as datas em `America/Sao_Paulo`
