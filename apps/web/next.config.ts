import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser never calls the Express API directly; requests go through the
  // server-side proxy in `src/app/api/[...path]/route.ts`. That keeps every
  // request same-origin (so the httpOnly session cookie just works and there is
  // no CORS surface) and keeps API_BASE_URL out of the client bundle.
  env: {},
};

export default nextConfig;
