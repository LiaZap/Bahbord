import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health — liveness + readiness probe.
 *
 * - 200 OK quando o app sobe e o ping no Postgres retorna `1`.
 * - 503 quando o ping no DB falha (erro logado server-side, não exposto ao cliente).
 *
 * Usado pelo HEALTHCHECK do Dockerfile e por probes externos (Render, k8s,
 * uptime monitors). É barato de propósito — apenas `SELECT 1`.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  let dbOk = false;
  let dbLatency = -1;

  try {
    const t = Date.now();
    await query('SELECT 1 AS ok');
    dbOk = true;
    dbLatency = Date.now() - t;
  } catch (err) {
    console.error('[health] db check failed:', err);
  }

  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      db: { ok: dbOk, latency_ms: dbLatency },
      uptime_ms: Date.now() - startedAt,
      version: process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
