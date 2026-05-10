import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// Aponta pro arquivo de config do request (server-side message loading).
// Detecção do locale é via cookie `NEXT_LOCALE` — sem prefixo de URL.
// Ver `i18n/routing.ts` pra detalhes da estratégia.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // Lint não bloqueia build (rodar manual com `npm run lint`)
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true
  }
};

// Sentry build options. Source map upload only happens when SENTRY_AUTH_TOKEN
// + SENTRY_ORG + SENTRY_PROJECT are set, so the wrapper is safe in dev / when
// no Sentry project exists yet.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Disable source map upload entirely if token is missing — prevents the build
  // from failing when env vars aren't configured (e.g. local builds, PR previews).
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  // Tunnel/replays not used — minimal setup.
  widenClientFileUpload: true,
  hideSourceMaps: true,
};

export default withSentryConfig(withNextIntl(nextConfig), sentryBuildOptions);
