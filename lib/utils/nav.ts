/**
 * Helpers de rota tipados pra centralizar deep-links e eliminar `as never`/`as any`
 * em `router.push(...)` quando o Next.js typed routes ainda não reconhece a
 * combinação de path + querystring dinâmica.
 *
 * - `routes.*(id)` retorna um `Route` tipado (compatível com `router.push`/`Link.href`).
 * - `ticketDeepLink(...)` retorna `string` absoluta — usar em emails/Slack/webhooks
 *   onde o Next typed-routes não se aplica.
 */

import type { Route } from 'next';

export const routes = {
  ticket: (id: string): Route => `/ticket/${id}` as Route,
  board: (id: string): Route => `/board/${id}` as Route,
  project: (id: string): Route => `/projects/${id}` as Route,
  projectUpdates: (id: string): Route => `/projects/${id}/updates` as Route,
  projectSpec: (id: string): Route => `/projects/${id}/spec` as Route,
  initiative: (id: string): Route => `/roadmap/${id}` as Route,
  customerRequest: (_id: string): Route => `/customer-requests` as Route, // sem deep-link, lista
};

/**
 * URL absoluta pro ticket — uso em e-mails, mensagens externas, etc.
 * Lê NEXT_PUBLIC_APP_URL como base; cai pra string vazia em ambientes sem env
 * (ex.: testes), de forma que o link relativo resultante ainda funciona quando
 * renderizado dentro do app.
 */
export function ticketDeepLink(ticketKey: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base}/ticket/${ticketKey}`;
}
