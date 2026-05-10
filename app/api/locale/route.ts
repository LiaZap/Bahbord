/**
 * POST /api/locale — persiste o locale escolhido em cookie HTTP-only-friendly.
 *
 * Body: { locale: 'pt' | 'en' }
 * Sucesso: 200 { locale }
 * Inválido: 400 { error }
 *
 * O cookie é lido server-side em `i18n/request.ts` no próximo request.
 * O cliente é responsável por dar `window.location.reload()` após receber 200.
 */
import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/routing';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractRequestMeta } from '@/lib/audit';

export async function POST(request: Request) {
  // Rate limit por IP — endpoint trivial mas público (sem auth). 60/min é
  // generoso o bastante pra usuário acidentalmente clicar várias vezes,
  // bloqueia loop malicioso.
  const { ipAddress } = extractRequestMeta(request);
  const ipKey = ipAddress || 'unknown';
  const rl = checkRateLimit(`locale:${ipKey}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit excedido', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const locale = (body as { locale?: unknown })?.locale;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // legível pelo cliente — útil pra debugging e UI
  });
  return response;
}
