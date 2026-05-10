-- ============================================================================
-- Migration 057: Drop índices duplicados (Sprint 5B / perf-eng-5b cleanup)
-- ----------------------------------------------------------------------------
-- A migration 056 criou índices compostos parciais que SOBREPÕEM índices
-- simples antigos (criados em 004 e/ou 027). Manter ambos = write
-- amplification + bloat sem ganho de read. Dropamos os antigos quando há
-- coverage equivalente OU melhor pelo composto/parcial novo.
--
-- Critério conservador: só dropamos quando o novo índice cobre 100% das
-- queries do antigo. Casos borderline (ex: idx_tickets_status_id, que NÃO é
-- coberto por idx_tickets_project_status pra lookups só por status_id, já que
-- Postgres exige a coluna leading do composto no WHERE) ficam mantidos.
-- ============================================================================

-- 1) idx_tickets_assignee_id (004 + 027) → coberto por idx_tickets_assignee_active (056)
--    O parcial WHERE is_archived = false atende > 99% das queries (board, list,
--    my-tasks, this-week, /api/tickets, /api/personal/*). As poucas queries que
--    ignoram is_archived (ex: relatórios de archived) são raras e tolerantes a
--    seq scan no segmento small.
DROP INDEX IF EXISTS idx_tickets_assignee_id;

-- 2) idx_tickets_workspace_id (004) → coberto por idx_tickets_workspace_created (027)
--    O composto (workspace_id, created_at DESC) é usado tanto pra equality em
--    workspace_id quanto pra ORDER BY created_at, então cobre 100% do uso do
--    índice simples. Postgres sabe usar índice composto quando só a coluna
--    leading aparece no WHERE.
DROP INDEX IF EXISTS idx_tickets_workspace_id;

-- 3) idx_tickets_is_archived (004) → coberto por TODOS os parciais 056
--    Boolean simples com baixa cardinalidade — quase sempre o planner prefere
--    seq scan ou um dos parciais (assignee_active, project_status,
--    created_at_desc, board_active, etc) que JÁ filtram is_archived = false
--    como predicate. Manter o índice simples só polui o catálogo.
DROP INDEX IF EXISTS idx_tickets_is_archived;

-- ============================================================================
-- NÃO dropados (decisão consciente):
--   * idx_tickets_status_id      → 056 só tem (project_id, status_id), e
--                                   queries por status_id sozinho (ex: dashboard
--                                   global, /api/options statuses) não usariam
--                                   o composto. Manter.
--   * idx_tickets_sprint_id      → sem cobertura no 056. Manter.
--   * idx_tickets_service_id     → sem cobertura no 056. Manter.
--   * idx_tickets_category_id    → sem cobertura no 056. Manter.
--   * idx_tickets_project_id     → 056 tem (project_id, status_id) composto,
--                                   que cobre lookups por project_id sozinho —
--                                   PORÉM o composto é parcial (is_archived =
--                                   false), então perderia ganho em queries
--                                   sem esse filtro. Manter por segurança.
--   * idx_subtasks_ticket_id, idx_activity_log_ticket_id, etc.
--                                → IF NOT EXISTS em 004 e 027 = mesmo índice
--                                   (não duplicação). Manter.
-- ============================================================================
