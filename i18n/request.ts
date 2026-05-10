/**
 * Server-side request config pra next-intl.
 *
 * Lê o locale do cookie `NEXT_LOCALE`, com fallback pro defaultLocale.
 * Carrega o catalog correspondente lazy (só o JSON do locale ativo vai pro
 * bundle do server component).
 */
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE } from './routing';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: 'America/Sao_Paulo',
    now: new Date(),
  };
});
