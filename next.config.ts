import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ['pdf-parse', 'mammoth', 'tesseract.js'],
  // Verification/reset URLs contain tokens; never echo them in development request logs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//, /\/reinitialiser/] } },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
