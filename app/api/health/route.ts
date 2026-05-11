import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness probe minimal — sempre 200 OK sem importar nenhum lib (DB, rate-limit,
 * audit). Diagnóstico: container está crashando depois de ~6 chamadas em
 * /api/health, então isolamos a rota pra eliminar suspeita de import top-level.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
