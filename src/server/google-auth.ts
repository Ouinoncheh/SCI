/** Server-only credentials; never pass them to a client component. */
export function googleCredentials(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}
