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

export default nextConfig;
