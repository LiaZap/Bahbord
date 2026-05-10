-- ============================================================================
-- Migration 055: Initiatives (camada acima de projeto / Roadmap)
-- ----------------------------------------------------------------------------
-- Initiative = agrupamento de N projects sob uma meta de negócio. Tem health
-- (on_track | at_risk | off_track | completed | archived) que é definido
-- manualmente pelo admin. O sistema apenas SUGERE health a partir de progresso
-- + target_date — nunca altera automaticamente.
--
-- initiative_projects: M:N entre initiatives e projects, com weight pra
-- agregação ponderada de progresso (default 1 = pesos iguais).
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,                                       -- meta textual (ex: "Reduzir churn 20%")
  health TEXT NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track','at_risk','off_track','completed','archived')),
  health_set_at TIMESTAMPTZ DEFAULT NOW(),
  health_set_by UUID REFERENCES members(id),
  health_note TEXT,                                -- justificativa última atualização de health
  start_date DATE,
  target_date DATE,                                -- prazo meta
  color TEXT DEFAULT '#3b6cf5',
  icon TEXT,                                       -- emoji ou nome lucide
  owner_id UUID REFERENCES members(id),            -- responsável pela initiative
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES members(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS initiative_projects (
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  weight INT DEFAULT 1,                            -- peso relativo do projeto
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES members(id),
  PRIMARY KEY (initiative_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_initiatives_workspace ON initiatives(workspace_id, health);
CREATE INDEX IF NOT EXISTS idx_initiative_projects_project ON initiative_projects(project_id);
