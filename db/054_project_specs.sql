-- ============================================================================
-- Migration 054: Project Specs (documento inline por projeto)
-- ----------------------------------------------------------------------------
-- Cada projeto tem 1 spec (rich-text via TipTap). Armazenamos:
--   - content_html: HTML serializado pelo editor (renderizado ao reabrir)
--   - content_text: versão plain extraída no client (busca futura + previews)
--   - version: contador pra detecção de conflito otimista (PUT compara antes de
--              salvar; se diverge → 409 e o cliente recarrega).
--
-- project_spec_backlinks armazena toda menção a `<PREFIX>-<NUM>` detectada no
-- HTML após cada save. UNIQUE(source_project_id, target_ticket_id) garante
-- idempotência — sincronização é DELETE old → INSERT new dentro do PUT.
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_specs (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES members(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_project_specs_workspace
  ON project_specs(workspace_id);

CREATE TABLE IF NOT EXISTS project_spec_backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_project_id, target_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_spec_backlinks_target
  ON project_spec_backlinks(target_ticket_id);

CREATE INDEX IF NOT EXISTS idx_spec_backlinks_source
  ON project_spec_backlinks(source_project_id);
