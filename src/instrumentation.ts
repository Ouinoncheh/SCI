export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.DESIGN_GENERATION_ENABLED === 'true' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startDesignWorker } = await import('./server/design-worker');
    startDesignWorker();
  }
}
