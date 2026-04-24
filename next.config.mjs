const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // TODO: remover `ignoreDuringBuilds` após corrigir pendências de lint reveladas pelo CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TODO: remover `ignoreBuildErrors` após sanear erros de tipo do codebase (rodar `npm run typecheck`).
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
