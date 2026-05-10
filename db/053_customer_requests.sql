-- ============================================================================
-- Migration 053: Customer Requests
-- ----------------------------------------------------------------------------
-- Registra pedidos/solicitações de clientes que podem (ou não) estar ligados
-- a um ticket. Serve pra:
--   - mostrar badge "X clientes pediram" no ticket
--   - capturar voz do cliente vinda de share-link público, formulário externo,
--     email forward ou registro manual de um membro
--   - decidir prioridade com base em demanda agregada
--
-- source values:
--   manual      -> membro digitou no app
--   share_link  -> veio do read-only share link (cliente final)
--   email       -> parsed de inbox
--   form        -> webhook /api/webhooks/customer-form
--
-- Idempotente: pode ser rodada múltiplas vezes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  request_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','share_link','email','form')),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES members(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_requests_ticket
  ON customer_requests(ticket_id);

CREATE INDEX IF NOT EXISTS idx_customer_requests_workspace
  ON customer_requests(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_requests_email
  ON customer_requests(workspace_id, customer_email)
  WHERE customer_email IS NOT NULL;
