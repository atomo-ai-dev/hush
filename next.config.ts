import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep the repository's hand-written AGENTS.md; don't let `next dev` upsert it.
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ['pg'],
};

export default nextConfig;
