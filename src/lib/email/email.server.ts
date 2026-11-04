/** Envio de e-mail via Resend. Só envia quando RESEND_API_KEY e EMAIL_FROM estão configurados; caso contrário não faz nada. */
type Db = any; // cliente administrativo do servidor

export function emailConfigured() {
  return Boolean(process.env['RESEND_API_KEY'] && process.env['EMAIL_FROM']);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function siteUrl() {
  return (process.env['SITE_URL'] || process.env['VITE_SITE_URL'] || 'https://bondmann-company.vercel.app').replace(/\/$/, '');
}

export async function sendEmail(to: string, subject: string, text: string, link?: string | null): Promise<boolean> {
  const key = process.env['RESEND_API_KEY']; const from = process.env['EMAIL_FROM'];
  if (!key || !from) return false;
  const url = link ? `${siteUrl()}${link.startsWith('/') ? link : `/${link}`}` : null;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111"><h2 style="color:#0e5a66">Bondmann Commercial Hub</h2><h3>${esc(subject)}</h3><p style="line-height:1.5">${esc(text)}</p>${url ? `<p><a href="${esc(url)}" style="background:#1aa6b7;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Abrir no Bondmann</a></p>` : ''}</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text: url ? `${text}\n\n${url}` : text }),
  });
  if (!res.ok) { console.error(`email [${res.status}]: ${await res.text()}`); return false; }
  return true;
}

const EMAIL_KINDS = ['due_soon', 'trial_ending', 'trial_ended', 'blocked', 'payment_confirmed', 'charge_created', 'payment_failed', 'subscription_cancelled'];

/** Envia por e-mail avisos ainda não enviados (pagamento e vencimento) e convites pendentes. */
export async function deliverPendingEmails(db: Db, opts: { organizationId?: string } = {}) {
  if (!emailConfigured()) return { sent: 0, configured: false };
  let sent = 0;
  if (!opts.organizationId) {
    const { data: ns } = await db.from('user_notifications').select('id,user_id,title,body,link').is('email_sent_at', null).in('kind', EMAIL_KINDS).limit(100);
    for (const n of ns ?? []) {
      const { data: p } = await db.from('profiles').select('email').eq('id', n.user_id).maybeSingle();
      if (p?.email && (await sendEmail(p.email, n.title, n.body, n.link))) { sent++; await db.from('user_notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', n.id); }
    }
  }
  let q = db.from('organization_invites').select('id,email,role,organization_id,organizations(name)').eq('status', 'pending').is('email_sent_at', null).limit(50);
  if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
  const { data: inv } = await q;
  for (const i of inv ?? []) {
    const org = (i.organizations as { name?: string } | null)?.name ?? 'uma empresa';
    const ok = await sendEmail(i.email, `Convite para ${org}`, `Você foi convidado(a) para participar de ${org} no Bondmann Commercial Hub como ${i.role === 'admin' ? 'administrador' : 'funcionário'}. Entre ou crie sua conta com este e-mail para aceitar o convite.`, '/auth');
    if (ok) { sent++; await db.from('organization_invites').update({ email_sent_at: new Date().toISOString() }).eq('id', i.id); }
  }
  return { sent, configured: true };
}
