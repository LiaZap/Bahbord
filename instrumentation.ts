/**
 * Next.js instrumentation hook — necessário pelo experimental.instrumentationHook
 * que o withSentryConfig liga automaticamente. Sem este arquivo, container saía
 * silencioso após "Ready in Xms".
 *
 * Sentry SDK desabilitado temporariamente em runtime pra eliminar suspeita de
 * crash em boot. Sentry build options continuam (source maps), mas init não
 * roda em runtime. Reabilitar via SENTRY_RUNTIME_ENABLED=1.
 */
export async function register() {
  if (process.env.SENTRY_RUNTIME_ENABLED !== '1') return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
