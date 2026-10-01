export function assertDemoMode() {
  if (process.env.APP_MODE && process.env.APP_MODE !== 'demo')
    throw new Error('Only demo mode is supported');
}
