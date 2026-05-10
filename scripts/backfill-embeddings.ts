/**
 * scripts/backfill-embeddings.ts
 *
 * Percorre tickets que ainda não possuem entrada em `ticket_embeddings`
 * e gera o vetor semântico via OpenAI (text-embedding-3-small).
 *
 * Rate-limit: ~3 req/segundo (≈ 333ms entre chamadas) para ficar bem abaixo
 * dos limites padrão da OpenAI (3000 RPM no tier 1) e evitar custos espontâneos.
 *
 * Uso:
 *   # 1. Garanta que OPENAI_API_KEY e DATABASE_URL estão setadas no ambiente
 *   # 2. Rode com tsx ou ts-node:
 *   npx tsx scripts/backfill-embeddings.ts
 *   # ou limitando a quantidade:
 *   npx tsx scripts/backfill-embeddings.ts --limit 200
 *
 * Custo estimado: text-embedding-3-small custa $0.02 por 1M tokens.
 * Um ticket típico (titulo + 500 chars descrição) ≈ 150 tokens → ~$0.000003 por ticket.
 * 5000 tickets ≈ $0.015. Praticamente gratuito.
 *
 * Idempotente: pula tickets que já têm embedding (LEFT JOIN ... IS NULL).
 */

import { query } from '../lib/db';
import { upsertTicketEmbedding, isEmbeddingAvailable } from '../lib/embeddings';

const RATE_DELAY_MS = 350; // ~3 req/s

interface PendingTicket {
  id: string;
  title: string;
  description: string | null;
}

function parseArgs(): { limit: number } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--limit');
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10);
    if (Number.isFinite(n) && n > 0) return { limit: n };
  }
  return { limit: 100000 };
}

async function main(): Promise<void> {
  if (!isEmbeddingAvailable()) {
    console.error('OPENAI_API_KEY não configurada — abortando.');
    process.exit(1);
  }

  const { limit } = parseArgs();
  console.log(`[backfill] Buscando até ${limit} tickets sem embedding...`);

  const res = await query<PendingTicket>(
    `SELECT t.id, t.title, t.description
     FROM tickets t
     LEFT JOIN ticket_embeddings te ON te.ticket_id = t.id
     WHERE te.ticket_id IS NULL
       AND t.is_archived = false
       AND COALESCE(t.title, '') <> ''
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );

  const total = res.rows.length;
  console.log(`[backfill] ${total} tickets pendentes.`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < total; i++) {
    const t = res.rows[i];
    try {
      await upsertTicketEmbedding(t.id, t.title, t.description);
      ok++;
      if ((i + 1) % 25 === 0 || i === total - 1) {
        console.log(`[backfill] ${i + 1}/${total} (ok=${ok}, fail=${fail})`);
      }
    } catch (err) {
      fail++;
      console.error(`[backfill] Falha no ticket ${t.id}:`, err instanceof Error ? err.message : err);
    }
    if (i < total - 1) await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
  }

  console.log(`[backfill] Concluído. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[backfill] Erro fatal:', err);
  process.exit(1);
});
