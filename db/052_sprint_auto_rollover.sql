-- ============================================================================
-- Migration 052: Sprint auto-rollover (cycles automáticos)
-- ----------------------------------------------------------------------------
-- Adiciona suporte a cycles automáticos em sprints:
--   - auto_rollover (BOOLEAN): se true, o cron faz rollover quando end_date passa
--   - cadence_days (INT): intervalo da cadência (7=semanal, 14=quinzenal). NULL=sem cadência
--   - rollover_strategy (TEXT): o que fazer com tickets incompletos
--       * 'move_incomplete' (default): move para a nova sprint
--       * 'keep_in_place': deixa onde está (nada faz)
--       * 'archive_incomplete': arquiva os incompletos
--   - parent_sprint_id (UUID): aponta para a sprint que originou esta (cadeia)
--   - rolled_over_at (TIMESTAMPTZ): timestamp do rollover (na sprint antiga)
--
-- Decisão: cadence_days NULL + auto_rollover=true é tratado pelo helper como
-- "default 7 dias" para evitar quebra. O endpoint manual também aceita esse
-- fallback. Se quiser exigir cadence_days, validar no app.
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN auto_rollover BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN END $$;

DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN cadence_days INT;
EXCEPTION WHEN duplicate_column THEN END $$;

DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN rollover_strategy TEXT DEFAULT 'move_incomplete';
EXCEPTION WHEN duplicate_column THEN END $$;

DO $$ BEGIN
  ALTER TABLE sprints
    ADD CONSTRAINT sprints_rollover_strategy_check
    CHECK (rollover_strategy IN ('move_incomplete','keep_in_place','archive_incomplete'));
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN parent_sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN END $$;

DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN rolled_over_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN END $$;

CREATE INDEX IF NOT EXISTS idx_sprints_auto_rollover
  ON sprints(end_date) WHERE auto_rollover = true;

CREATE INDEX IF NOT EXISTS idx_sprints_parent
  ON sprints(parent_sprint_id) WHERE parent_sprint_id IS NOT NULL;
