export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? data.error ?? data.message ?? 'La requête a échoué.');
  return data;
}
