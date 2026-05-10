-- ============================================================================
-- Migration 047: Multiple Assignees
-- ----------------------------------------------------------------------------
-- Tickets passam a aceitar N assignees. Mantemos tickets.assignee_id como
-- "principal" pra compatibilidade com toda query/listing existente. A nova
-- tabela ticket_assignees é a fonte de verdade quando precisamos da lista.
--
-- Sincronização:
--   - Backfill inicial copia assignee_id atual como is_primary=true
--   - APIs que mexem em assignees devem manter os dois lados consistentes:
--     * promover novo primary -> UPDATE tickets.assignee_id
--     * remover primary -> escolher outro assignee ou NULL
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_assignees (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES members(id) ON DELETE SET NULL,
  PRIMARY KEY (ticket_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_member ON ticket_assignees(member_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignees_primary
  ON ticket_assignees(ticket_id)
  WHERE is_primary = true;

-- Backfill: assignee_id existente vira primary em ticket_assignees.
-- ON CONFLICT DO NOTHING permite re-rodar sem duplicar.
INSERT INTO ticket_assignees (ticket_id, member_id, is_primary)
SELECT id, assignee_id, true
FROM tickets
WHERE assignee_id IS NOT NULL
ON CONFLICT (ticket_id, member_id) DO NOTHING;
