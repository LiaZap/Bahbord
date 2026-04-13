-- ============================================
-- RLS Policies para BahBoard
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_viewers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Função helper: buscar workspace_ids do usuário
-- ============================================
CREATE OR REPLACE FUNCTION user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT workspace_id FROM members WHERE user_id = auth.uid()
$$;

-- Função helper: buscar member_id do usuário no workspace
CREATE OR REPLACE FUNCTION user_member_id(ws_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM members WHERE user_id = auth.uid() AND workspace_id = ws_id LIMIT 1
$$;

-- ============================================
-- WORKSPACES: membros podem ver seus workspaces
-- ============================================
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT user_workspace_ids()));

CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE
  USING (id IN (
    SELECT workspace_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================
-- MEMBERS: membros podem ver colegas do workspace
-- ============================================
CREATE POLICY "Members can view workspace members"
  ON members FOR SELECT
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Admins can manage members"
  ON members FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================
-- Tabelas de configuração (ticket_types, statuses, services, categories, quick_reactions)
-- Membros podem ler, admins podem editar
-- ============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ticket_types', 'statuses', 'services', 'categories', 'quick_reactions']
  LOOP
    EXECUTE format(
      'CREATE POLICY "Members can view %1$s" ON %1$s FOR SELECT USING (workspace_id IN (SELECT user_workspace_ids()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Admins can manage %1$s" ON %1$s FOR ALL USING (workspace_id IN (SELECT workspace_id FROM members WHERE user_id = auth.uid() AND role IN (''owner'', ''admin'')))',
      tbl
    );
  END LOOP;
END $$;

-- ============================================
-- SPRINTS: membros podem ler, admins podem gerenciar
-- ============================================
CREATE POLICY "Members can view sprints"
  ON sprints FOR SELECT
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Admins can manage sprints"
  ON sprints FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================
-- TICKETS: membros podem ler e criar, atualizar os seus
-- ============================================
CREATE POLICY "Members can view tickets"
  ON tickets FOR SELECT
  USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Members can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY "Members can update tickets"
  ON tickets FOR UPDATE
  USING (workspace_id IN (SELECT user_workspace_ids()));

-- ============================================
-- SUBTASKS: acesso via ticket
-- ============================================
CREATE POLICY "Members can manage subtasks"
  ON subtasks FOR ALL
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- TICKET_LINKS: acesso via ticket
-- ============================================
CREATE POLICY "Members can manage ticket_links"
  ON ticket_links FOR ALL
  USING (source_ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- COMMENTS: acesso via ticket, editar/deletar só os próprios
-- ============================================
CREATE POLICY "Members can view comments"
  ON comments FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

CREATE POLICY "Members can create comments"
  ON comments FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

CREATE POLICY "Authors can update own comments"
  ON comments FOR UPDATE
  USING (author_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Authors can delete own comments"
  ON comments FOR DELETE
  USING (author_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

-- ============================================
-- COMMENT_REACTIONS: acesso via comentário
-- ============================================
CREATE POLICY "Members can manage reactions"
  ON comment_reactions FOR ALL
  USING (comment_id IN (
    SELECT c.id FROM comments c
    JOIN tickets t ON t.id = c.ticket_id
    WHERE t.workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- ACTIVITY_LOG: leitura via ticket
-- ============================================
CREATE POLICY "Members can view activity_log"
  ON activity_log FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- TIME_ENTRIES: acesso via ticket
-- ============================================
CREATE POLICY "Members can manage time_entries"
  ON time_entries FOR ALL
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- ATTACHMENTS: acesso via ticket
-- ============================================
CREATE POLICY "Members can manage attachments"
  ON attachments FOR ALL
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- NOTIFICATIONS: cada um vê as suas
-- ============================================
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (recipient_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

-- ============================================
-- TICKET_VIEWERS: acesso via ticket
-- ============================================
CREATE POLICY "Members can manage ticket_viewers"
  ON ticket_viewers FOR ALL
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE workspace_id IN (SELECT user_workspace_ids())
  ));

-- ============================================
-- Storage: bucket attachments
-- ============================================
-- Executar separadamente se necessário:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);
--
-- CREATE POLICY "Authenticated users can upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Anyone can view attachments"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'attachments');
