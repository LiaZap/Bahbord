-- ============================================================================
-- Migration 046: Ticket Relations (blocks / blocked_by / relates_to)
-- ----------------------------------------------------------------------------
-- Permite linkar tickets uns aos outros pra rastrear dependências.
--
-- Convenção de espelho:
--   Quando criamos (A blocks B) tambem inserimos (B blocked_by A)
--   pra cada relação simétrica ficar consultável em qualquer direção sem
--   UNION na query. relates_to é simétrico nele mesmo (cria espelho idem).
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('blocks','blocked_by','relates_to')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES members(id) ON DELETE SET NULL,
  UNIQUE(source_ticket_id, target_ticket_id, relation_type),
  CHECK (source_ticket_id != target_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_rel_source ON ticket_relations(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_rel_target ON ticket_relations(target_ticket_id);
