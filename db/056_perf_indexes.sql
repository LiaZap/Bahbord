-- ============================================================================
-- Migration 056: Índices de performance (Sprint 5B / perf-eng-5b)
-- ----------------------------------------------------------------------------
-- Índices identificados na auditoria de gargalos do board, list, dashboard
-- e fluxos personal. Todos idempotentes (CREATE INDEX IF NOT EXISTS) e usam
-- partial indexes onde aplicável pra reduzir tamanho/escrita.
--
-- Convenção: nomes começam com idx_<tabela>_<colunas|caso>.
-- ============================================================================

-- 1) Board / list filtrado por assignee + ativos
--    Acelera: /api/personal/* (my-tasks, this-week), /api/tickets?assignee=...
--    Query padrão: WHERE assignee_id = $1 AND is_archived = false
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_active
  ON tickets(assignee_id)
  WHERE is_archived = false;

-- 2) Coluna de board (project + status)
--    Acelera: app/board/page.tsx (filtro por project) + filtros do dashboard
--    Query padrão: WHERE project_id = $1 AND status_id = $2 AND is_archived = false
CREATE INDEX IF NOT EXISTS idx_tickets_project_status
  ON tickets(project_id, status_id)
  WHERE is_archived = false;

-- 3) Ordenação por created_at desc (usada em list/, backlog/, /api/tickets)
--    Acelera: ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc
  ON tickets(created_at DESC)
  WHERE is_archived = false;

-- 4) Ordenação por updated_at desc (usada no board principal)
--    Acelera: app/board/page.tsx ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at_desc
  ON tickets(updated_at DESC)
  WHERE is_archived = false;

-- 5) Filtro de due_date (calendar, this-week, alerts SLA)
CREATE INDEX IF NOT EXISTS idx_tickets_due_date
  ON tickets(due_date)
  WHERE due_date IS NOT NULL AND is_archived = false;

-- 6) Tickets com SLA próximo/vencido (warning/overdue)
--    Acelera: GET /api/tickets?sla_status=...
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due_at
  ON tickets(sla_due_at)
  WHERE sla_due_at IS NOT NULL AND is_archived = false;

-- 7) Filtro por board (vários endpoints/pages)
CREATE INDEX IF NOT EXISTS idx_tickets_board_active
  ON tickets(board_id)
  WHERE is_archived = false;

-- 8) Snooze: tickets com janela ativa (escondidos por padrão)
--    Acelera: filtro AND (snoozed_until IS NULL OR snoozed_until <= NOW())
CREATE INDEX IF NOT EXISTS idx_tickets_snoozed_until
  ON tickets(snoozed_until)
  WHERE snoozed_until IS NOT NULL AND is_archived = false;

-- 9) Audit log por workspace + action (settings/audit page, integrations)
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_action
  ON audit_log(workspace_id, action, created_at DESC);

-- 10) Customer requests pendentes (triagem inbox + customer-requests page)
CREATE INDEX IF NOT EXISTS idx_customer_requests_unresolved
  ON customer_requests(workspace_id, created_at DESC)
  WHERE resolved_at IS NULL;

-- 11) Notificações não lidas do usuário (NotificationCenter dropdown)
--     Schema usa is_read boolean + recipient_id (member_id é legacy).
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id, created_at DESC)
  WHERE is_read = false;

-- 12) Comentários por ticket (TicketDetailView -> ActivityTimeline)
CREATE INDEX IF NOT EXISTS idx_comments_ticket_recent
  ON comments(ticket_id, created_at DESC);

-- 13) Time entries por membro (timesheet, dashboards de tempo)
--     Coluna started_at vem da migration 003 (ALTER ADD IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_time_entries_member_started
  ON time_entries(member_id, started_at DESC);

-- 14) Time entries em curso (TimeTracker badge)
CREATE INDEX IF NOT EXISTS idx_time_entries_running
  ON time_entries(member_id)
  WHERE is_running = true;

-- 15) Project roles lookup (acesso check em quase toda query autorizada)
CREATE INDEX IF NOT EXISTS idx_project_roles_member
  ON project_roles(member_id, project_id);

-- 16) Board roles lookup (mesmo motivo do anterior)
CREATE INDEX IF NOT EXISTS idx_board_roles_member
  ON board_roles(member_id, board_id);
