import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Bell, CreditCard, Landmark, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { createCheckout, openBillingPortal, type PayMethod } from '@/lib/billing/billing.functions';
import { catalogOptions, currency, date } from '@/lib/platform/data';

const METHODS: { id: PayMethod; label: string; note: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Cartão de crédito', note: 'Renova sozinho todo mês.', icon: CreditCard },
  { id: 'boleto', label: 'Boleto', note: 'Uma cobrança por mês. Libera após a compensação.', icon: Landmark },
  { id: 'pix', label: 'Pix', note: 'Uma cobrança por mês. Libera após a confirmação.', icon: QrCode },
];

/** Pagamento online. O acesso só é liberado quando a Stripe confirma o pagamento. */
export function PayOnline() {
  const { user, role } = useAuth();
  const catalog = useQuery(catalogOptions);
  const checkout = useServerFn(createCheckout); const portal = useServerFn(openBillingPortal);
  const [plan, setPlan] = useState(''); const [busy, setBusy] = useState(false);
  if (!user || role === 'admin') return null;
  const plans = (catalog.data?.plans ?? []).filter(p => p.active && p.offer_active !== false && p.price_cents !== null);
  const go = async (method: PayMethod) => {
    if (!plan) { toast.error('Escolha um plano.'); return; }
    setBusy(true);
    try { const r = await checkout({ data: { planId: plan, method } }); if ('url' in r && r.url) window.location.href = r.url; else toast.error(('error' in r && r.error) || 'Não foi possível abrir o pagamento.'); }
    catch { toast.error('Não foi possível abrir o pagamento.'); } finally { setBusy(false); }
  };
  return <section className="mt-9 rounded-md border border-border bg-card p-6">
    <h2 className="text-xl font-bold">Pagar online</h2>
    <p className="mt-2 text-sm text-steel">Seu acesso é liberado assim que o pagamento for confirmado. Voltar da tela de pagamento não libera o acesso sozinho.</p>
    <select className="mt-5 w-full rounded-md border border-input bg-background p-2 text-sm" value={plan} onChange={e => setPlan(e.target.value)}>
      <option value="">Escolha o plano</option>
      {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {currency(Math.round((p.price_cents ?? 0) * (1 - Number(p.discount_percent) / 100)))}/mês</option>)}
    </select>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {METHODS.map(m => <button key={m.id} disabled={busy} onClick={() => void go(m.id)} className="rounded-md border border-border p-4 text-left transition-colors hover:border-aqua disabled:opacity-50">
        <m.icon className="size-5 text-aqua" /><p className="mt-2 font-semibold">{m.label}</p><p className="mt-1 text-xs text-steel">{m.note}</p></button>)}
    </div>
    <Button variant="outline" className="mt-4" disabled={busy} onClick={async () => { const r = await portal(); if ('url' in r && r.url) window.location.href = r.url; else toast.error(('error' in r && r.error) || 'Indisponível.'); }}>Trocar cartão, ver faturas ou cancelar</Button>
  </section>;
}

export function NotificationsList() {
  const { user } = useAuth(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', user?.id], enabled: Boolean(user), queryFn: async () => (await supabase.from('user_notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(20)).data ?? [] });
  if (!q.data?.length) return null;
  return <section className="mt-9"><h2 className="flex items-center gap-2 text-xl font-bold"><Bell className="size-5" />Avisos</h2>
    <div className="mt-4 divide-y divide-border rounded-md border border-border bg-card">{q.data.map(n => <div key={n.id} className={`p-4 text-sm ${n.read_at ? 'opacity-60' : ''}`}>
      <div className="flex justify-between gap-3"><p className="font-semibold">{n.title}</p><span className="text-xs text-steel">{date(n.created_at)}</span></div>
      <p className="mt-1 text-steel">{n.body}</p>
      {!n.read_at ? <button className="mt-2 text-xs text-aqua" onClick={async () => { await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id); void qc.invalidateQueries({ queryKey: ['notifications'] }); }}>Marcar como lido</button> : null}
    </div>)}</div></section>;
}
