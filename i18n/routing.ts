/**
 * i18n routing config — Bah!Flow
 * ----------------------------------------------------------------------------
 * Estratégia: detecção de locale por COOKIE (`NEXT_LOCALE`), sem prefixo de
 * URL. Decisão deliberada — o app é existente, com 80+ componentes e rotas já
 * em produção. Ligar prefixo (`/pt`, `/en`) quebraria todos os links salvos,
 * bookmarks e share links. Fica como evolução futura quando cobertura i18n
 * estiver completa.
 *
 * COMO ADICIONAR UM NOVO IDIOMA
 * ----------------------------------------------------------------------------
 * 1. Adiciona o código BCP 47 em `locales` abaixo (ex.: `'es'`).
 * 2. Cria `messages/<locale>.json` com a MESMA estrutura de `pt.json`
 *    (todos os namespaces e chaves). Use `pt.json` como referência canônica.
 * 3. Adiciona a opção no `<select>` em
 *    `components/settings/GeneralSettings.tsx` (section "Idioma").
 * 4. (Opcional) Adiciona o nome amigável em `localeLabels` abaixo se quiser
 *    expor em outras superfícies de UI.
 *
 * COMO EXTRAIR NOVAS STRINGS PRA i18n
 * ----------------------------------------------------------------------------
 * Em client component:
 *   import { useTranslations } from 'next-intl';
 *   const t = useTranslations('namespace');
 *   return <button>{t('save')}</button>;
 *
 * Em server component / route handler:
 *   import { getTranslations } from 'next-intl/server';
 *   const t = await getTranslations('namespace');
 *
 * Sempre adicione a chave em `messages/pt.json` E `messages/en.json` (em
 * qualquer ordem). Se faltar em `en.json`, o fallback cai pra `pt.json`.
 *
 * COMO ADICIONAR UM NOVO NAMESPACE
 * ----------------------------------------------------------------------------
 * 1. Adiciona um novo objeto top-level nos dois catalogs (`pt.json`, `en.json`).
 *    Ex.: `"reports": { "title": "Relatórios", ... }`.
 * 2. Usa `useTranslations('reports')` no componente.
 * 3. Mantém namespaces granulares — preferência por `nav`, `tickets`,
 *    `filters`, `auth`, `settings` etc, em vez de um único `app`.
 */

export const locales = ['pt', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

/** Nome do cookie usado pra persistir o locale escolhido pelo usuário. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Quanto tempo (em segundos) o cookie de locale dura — 1 ano. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const localeLabels: Record<Locale, string> = {
  pt: 'Português (Brasil)',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
