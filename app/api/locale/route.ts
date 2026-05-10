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

export async function POST(request: Request) {
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
