/** Cliente mínimo da Stripe via fetch (compatível com o runtime do servidor). Nunca importar no navegador. */
type Params = Record<string, string | number | boolean | undefined | null>;

export async function stripe<T = Record<string, unknown>>(path: string, params?: Params, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error('stripe_not_configured');
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null) body.append(k, String(v));
  const url = `https://api.stripe.com/v1/${path}${method === 'GET' && params ? `?${body}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? body : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) { console.error('stripe error', path, json.error?.message); throw new Error(json.error?.message ?? 'stripe_error'); }
  return json;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

/** Valida o cabeçalho Stripe-Signature (HMAC-SHA256, tolerância de 5 min). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const t = parts['t']; if (!t) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some(s => s.length === expected.length && [...s].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
