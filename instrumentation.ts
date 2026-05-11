/**
 * Next.js instrumentation hook (chamado pelo `instrumentationHook: true` em
 * next.config.mjs). Sem este arquivo, Next 14 com Sentry sai silenciosamente
 * após `Ready in Xms` — container fica em crash loop sem stack trace.
 *
 * O `register()` é invocado UMA vez no boot do server. Carregamos os configs
 * de Sentry só no runtime correspondente (Node ou Edge).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
