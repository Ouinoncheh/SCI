import { properties } from '@/data/demo';
import { analyze } from '@/financial-engine';
import { assertDemoMode } from '@/api/demo';
export async function GET() {
  assertDemoMode();
  return Response.json(
    {
      mode: 'demo',
      synthetic: true,
      engineVersion: '0.1.0',
      properties: properties.map((p) => ({ ...p, analysis: analyze(p.investment) })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
