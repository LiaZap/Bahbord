-- ============================================================================
-- Migration 060: Credenciais criptografadas por página de documentação
-- ----------------------------------------------------------------------------
-- Vault de senhas/acessos atrelados a doc_pages. Cifragem AES-256-GCM em camada
-- de aplicação (lib/doc-secrets.ts) usando DOC_SECRETS_KEY do env — banco
-- só guarda ciphertext + iv + auth_tag em base64. Reveal grava audit_log.
-- ============================================================================

CREATE TABLE IF NOT EXISTS doc_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES doc_pages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                    -- ex: "Admin Somma", "FTP", "Painel Cliente"
  username TEXT,                          -- pode ser email/login — visível sem reveal
  url TEXT,                               -- opcional, login URL
  notes TEXT,                             -- nota visível (não sensível)
  -- Segredo: cifrado em camada de aplicação. Nunca decifrado em SELECT.
  secret_ciphertext TEXT NOT NULL,        -- base64
  secret_iv TEXT NOT NULL,                -- base64
  secret_auth_tag TEXT NOT NULL,          -- base64 (GCM)
  -- Auditoria de criação
  created_by UUID REFERENCES members(id),
  updated_by UUID REFERENCES members(id),
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_credentials_page ON doc_credentials(page_id, position);
