import OpenAI from 'openai';
import { query } from './db';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const MAX_DESC_CHARS = 500;
const MAX_INPUT_CHARS = 8000; // ~8KB sane cap antes de mandar pra OpenAI

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export function isEmbeddingAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Gera embedding semântico para um texto.
 * Faz 1 retry simples em caso de falha de rede / rate limit.
 * Lança erro se ambas as tentativas falharem.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!isEmbeddingAvailable()) {
    throw new Error('OPENAI_API_KEY não configurada');
  }
  const input = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!input) throw new Error('Texto vazio para embedding');

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.embeddings.create(
        { model: EMBEDDING_MODEL, input },
        { signal: AbortSignal.timeout(8000) }
      );
      const vec = res.data[0]?.embedding;
      if (!vec || vec.length !== EMBEDDING_DIMS) {
        throw new Error(`Resposta inválida do embedding (dims=${vec?.length})`);
      }
      return vec;
    } catch (err) {
      lastErr = err;
      // Backoff curto antes do retry
      if (attempt === 0) await new Promise((r) => setTimeout(r, 350));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Falha ao gerar embedding');
}

/**
 * Cosine similarity entre dois vetores. Retorna valor entre -1 e 1.
 * Retorna 0 quando algum vetor é zero ou quando dimensões não batem.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Gera embedding do ticket (title + description truncada) e faz UPSERT em ticket_embeddings.
 * Idempotente: ON CONFLICT atualiza vetor + source_text + generated_at.
 * Silencia erro se OPENAI_API_KEY não estiver setada (apenas loga).
 */
export async function upsertTicketEmbedding(
  ticketId: string,
  title: string,
  description?: string | null
): Promise<void> {
  if (!isEmbeddingAvailable()) {
    console.warn('[embeddings] OPENAI_API_KEY ausente — pulando upsert do ticket', ticketId);
    return;
  }
  const sourceText = `${title || ''} ${(description || '').slice(0, MAX_DESC_CHARS)}`.trim();
  if (!sourceText) return;

  const vec = await generateEmbedding(sourceText);
  await query(
    `INSERT INTO ticket_embeddings (ticket_id, embedding, source_text, model, generated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (ticket_id) DO UPDATE
       SET embedding = EXCLUDED.embedding,
           source_text = EXCLUDED.source_text,
           model = EXCLUDED.model,
           generated_at = NOW()`,
    [ticketId, JSON.stringify(vec), sourceText, EMBEDDING_MODEL]
  );
}

export interface SimilarTicketMatch {
  ticket_id: string;
  ticket_key: string;
  title: string;
  score: number;
}

interface SimilarRow {
  id: string;
  ticket_key: string;
  title: string;
  embedding: number[] | string | null;
}

/**
 * Busca tickets semanticamente similares ao texto de entrada dentro do mesmo projeto.
 * Algoritmo: gera embedding do texto, carrega tickets do projeto (cap 500),
 * calcula cosine similarity em JS, filtra por minScore, ordena desc, limita.
 */
export async function findSimilarTickets(
  text: string,
  projectId: string,
  opts: { limit?: number; minScore?: number } = {}
): Promise<SimilarTicketMatch[]> {
  const limit = Math.max(1, Math.min(20, opts.limit ?? 5));
  const minScore = typeof opts.minScore === 'number' ? opts.minScore : 0.75;

  const queryVec = await generateEmbedding(text);

  const result = await query<SimilarRow>(
    `SELECT t.id, t.ticket_key, t.title, te.embedding
     FROM tickets_full t
     INNER JOIN ticket_embeddings te ON te.ticket_id = t.id
     WHERE t.project_id = $1 AND t.is_archived = false
     ORDER BY t.created_at DESC
     LIMIT 500`,
    [projectId]
  );

  const matches: SimilarTicketMatch[] = [];
  for (const row of result.rows) {
    const emb = parseEmbedding(row.embedding);
    if (!emb) continue;
    const score = cosineSimilarity(queryVec, emb);
    if (score >= minScore) {
      matches.push({
        ticket_id: row.id,
        ticket_key: row.ticket_key,
        title: row.title,
        score,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}
