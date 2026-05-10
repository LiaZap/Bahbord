-- ============================================================================
-- Migration 051: Project Updates (status updates semanais)
-- ----------------------------------------------------------------------------
-- Tabela armazena snapshots semanais de status por projeto. Cada update tem:
--   - ai_summary (JSONB): resumo gerado por IA com counts/blockers/risks
--   - pm_notes (TEXT): campo livre que o PM completa depois (revisão humana)
--   - generated_by_cron (BOOLEAN): true=criado pelo cron semanal, false=manual
--
-- Constraint UNIQUE(project_id, period_from, period_to) garante idempotência:
-- se o cron rodar 2x na mesma janela, o segundo INSERT é silenciosamente
-- ignorado via ON CONFLICT DO NOTHING (lógica no helper).
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  ai_summary JSONB NOT NULL,
  pm_notes TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_cron BOOLEAN DEFAULT true,
  pm_completed_at TIMESTAMPTZ,
  pm_completed_by UUID REFERENCES members(id) ON DELETE SET NULL,
  UNIQUE(project_id, period_from, period_to)
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_period
  ON project_updates(project_id, period_to DESC);

CREATE INDEX IF NOT EXISTS idx_project_updates_workspace
  ON project_updates(workspace_id, period_to DESC);
