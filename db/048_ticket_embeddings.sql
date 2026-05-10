-- 048: Ticket embeddings — armazena vetores semânticos para detecção de duplicatas via IA.
-- Usa text-embedding-3-small (1536 floats) armazenado como JSONB para evitar dependência de pgvector.
-- Cosine similarity é calculada em JS no endpoint (workspace pequeno típico < 5k tickets).

CREATE TABLE IF NOT EXISTS ticket_embeddings (
  ticket_id UUID PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  -- text-embedding-3-small produz 1536 floats; armazenamos como JSONB pra simplicidade
  embedding JSONB NOT NULL,
  source_text TEXT NOT NULL, -- title + truncated description usado pra gerar (rastreabilidade)
  model TEXT DEFAULT 'text-embedding-3-small',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_embed_generated ON ticket_embeddings(generated_at);
