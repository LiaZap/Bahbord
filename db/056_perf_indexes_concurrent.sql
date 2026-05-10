-- ============================================================================
-- Migration 056 (CONCURRENTLY variant) — RODAR EM PRODUÇÃO
-- ----------------------------------------------------------------------------
-- Versão de produção dos índices da migration 056. Usa CREATE INDEX
-- CONCURRENTLY pra não bloquear escritas em tabelas grandes (tickets,
-- audit_log, time_entries).
--
-- IMPORTANTE:
--   - CONCURRENTLY NÃO PODE RODAR DENTRO DE TRANSAÇÃO. Rode cada statement
--     separadamente OU use psql sem -1/--single-transaction.
--   - Se um CREATE INDEX CONCURRENTLY falhar, ele deixa um índice INVALID
--     que precisa ser DROPPED manualmente antes de retentar.
--   - Em dev/CI, use 056_perf_indexes.sql (versão sem CONCURRENTLY que cabe
--     em migration runner padrão).
--
-- Como rodar em produção:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/056_perf_indexes_concurrent.sql
--
-- Tempo estimado em workspaces com >100k tickets: 5-15min total.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assignee_active
  ON tickets(assignee_id) WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_project_status
  ON tickets(project_id, status_id) WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_at_desc
  ON tickets(created_at DESC) WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_updated_at_desc
  ON tickets(updated_at DESC) WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_due_date
  ON tickets(due_date) WHERE due_date IS NOT NULL AND is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_sla_due_at
  ON tickets(sla_due_at) WHERE sla_due_at IS NOT NULL AND is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_board_active
  ON tickets(board_id) WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_snoozed_until
  ON tickets(snoozed_until) WHERE snoozed_until IS NOT NULL AND is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_workspace_action
  ON audit_log(workspace_id, action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_requests_unresolved
  ON customer_requests(workspace_id, created_at DESC) WHERE resolved_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id, created_at DESC) WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_ticket_recent
  ON comments(ticket_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_member_started
  ON time_entries(member_id, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_running
  ON time_entries(member_id) WHERE is_running = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_roles_member
  ON project_roles(member_id, project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_board_roles_member
  ON board_roles(member_id, board_id);
