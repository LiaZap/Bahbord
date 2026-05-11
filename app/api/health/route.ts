import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractRequestMeta } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health — liveness probe.
 *
 * Retorna 200 sempre que o processo Node está vivo, INDEPENDENTE do DB.
 * Why: healthcheck Docker mistura liveness (mata o pod) com readiness
 * (tira de roteamento). DB intermitente travava o container em crash loop
 * (sobe → 503 → kill → restart → 503 → kill...). Liveness deve só checar
 * "o processo responde HTTP?". Status do DB vai num campo separado pra
 * observability — quem precisa de readiness usa GET /api/health?check=db.
 *
 * Rate limit: 120 req/min por IP — margem pra monitoring tools agressivos.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { ipAddress } = extractRequestMeta(request);
  const ipKey = ipAddress || 'unknown';
  const rl = checkRateLimit(`health:${ipKey}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { status: 'rate_limited', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  const url = new URL(request.url);
  const checkDb = url.searchParams.get('check') === 'db';

  const startedAt = Date.now();
  let dbOk: boolean | null = null;
  let dbLatency = -1;

  if (checkDb) {
    try {
      const t = Date.now();
      await query('SELECT 1 AS ok');
      dbOk = true;
      dbLatency = Date.now() - t;
    } catch (err) {
      console.error('[health] db check failed:', err);
      dbOk = false;
    }
  }

  // Liveness: sempre 200 se chegou aqui. Readiness (?check=db) usa 503 se DB falha.
  const status = checkDb && dbOk === false ? 503 : 200;
  return NextResponse.json(
    {
      status: status === 200 ? 'ok' : 'degraded',
      db: checkDb ? { ok: dbOk, latency_ms: dbLatency } : { ok: null, checked: false },
      uptime_ms: Date.now() - startedAt,
      version: process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
