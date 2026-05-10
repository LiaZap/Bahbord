-- ============================================================================
-- Migration 059: Tabela schema_migrations pra runner real (scripts/migrate.ts)
-- ----------------------------------------------------------------------------
-- Substitui o loop manual `for f in db/0*.sql; do psql ...; done`. O runner
-- so aplica migrations cuja entrada AINDA NAO existe nesta tabela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,             -- sha256 do conteudo do arquivo
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INT,
  applied_by TEXT                     -- runner identifier (ex: 'scripts/migrate.ts@v1', 'manual')
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied
  ON schema_migrations(applied_at DESC);

-- Backfill: marca todas as migrations 002-058 como aplicadas (assumindo
-- que rodaram via script manual). Usa checksum 'manual-backfill' como sentinel.
-- Se voce esta num banco fresh, esses INSERTs nao impactam — o runner
-- detecta a sentinel e NAO marca como drift quando os arquivos mudarem.
INSERT INTO schema_migrations (filename, checksum, applied_at, applied_by)
SELECT filename, 'manual-backfill', NOW(), 'pre-migrate-script'
FROM (VALUES
  ('schema.sql'),
  ('002_complete_schema.sql'),
  ('003_fix_schema_mismatches.sql'),
  ('004_indexes_and_performance.sql'),
  ('005_dev_links.sql'),
  ('006_webhook_settings.sql'),
  ('007_integrations.sql'),
  ('008_whatsapp.sql'),
  ('009_access_links.sql'),
  ('010_clients.sql'),
  ('011_billable_hours.sql'),
  ('012_multi_tenant_rbac.sql'),
  ('013_client_orgs.sql'),
  ('014_saved_filters.sql'),
  ('015_teams.sql'),
  ('016_permissions.sql'),
  ('017_fix_hierarchy.sql'),
  ('018_docs_wiki.sql'),
  ('019_approval_flow.sql'),
  ('020_doc_access.sql'),
  ('021_clerk_auth.sql'),
  ('022_categories_color.sql'),
  ('023_time_entries_fix.sql'),
  ('024_member_avatar.sql'),
  ('025_view_avatar.sql'),
  ('026_subtasks_fix.sql'),
  ('027_security_and_indexes.sql'),
  ('028_sprint_project.sql'),
  ('029_sprint_dates_nullable.sql'),
  ('030_notifications.sql'),
  ('031_is_client_flag.sql'),
  ('032_automations.sql'),
  ('033_client_share_links.sql'),
  ('034_github_integration.sql'),
  ('035_project_board_sprint_convention.sql'),
  ('036_view_project_color.sql'),
  ('037_notifications_relax.sql'),
  ('038_members_time_tracking.sql'),
  ('039_fix_zero_duration.sql'),
  ('040_audit_log.sql'),
  ('041_ticket_templates.sql'),
  ('042_recurring_tickets.sql'),
  ('043_workspace_onboarded.sql'),
  ('044_saved_views.sql'),
  ('045_snooze.sql'),
  ('046_ticket_relations.sql'),
  ('047_multi_assignees.sql'),
  ('048_ticket_embeddings.sql'),
  ('049_triage_inbox.sql'),
  ('050_sla.sql'),
  ('051_project_updates.sql'),
  ('052_sprint_auto_rollover.sql'),
  ('053_customer_requests.sql'),
  ('054_project_specs.sql'),
  ('055_initiatives.sql'),
  ('056_perf_indexes.sql'),
  ('057_drop_duplicate_indexes.sql'),
  ('058_tickets_full_consolidate.sql')
) AS m(filename)
ON CONFLICT (filename) DO NOTHING;
