-- ========== NOTIFICATIONS: schema extensions for mentions & assignments ==========
-- Objetivo: suportar notificações de @mention em comentários e atribuições de tickets.
-- Mantém compatibilidade com o schema legado (member_id, ticket_id) e estende com
-- recipient_id, actor_id, workspace_id, title, entity_type, entity_id e link.

-- Garantir colunas introduzidas pela API (idempotente)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- Novas colunas para entidade alvo e link de navegação
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type TEXT; -- 'ticket', 'comment', etc.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Migrar registros legados: member_id -> recipient_id
UPDATE notifications
SET recipient_id = COALESCE(recipient_id, member_id)
WHERE recipient_id IS NULL AND member_id IS NOT NULL;

-- Tornar member_id opcional para novos registros (recipient_id é a fonte da verdade agora)
-- Mantém a coluna para compatibilidade com código legado que ainda lê member_id.
ALTER TABLE notifications ALTER COLUMN member_id DROP NOT NULL;

-- Índices para a UI do centro de notificações
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace
  ON notifications(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications(entity_type, entity_id);
