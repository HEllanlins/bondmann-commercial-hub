import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { currency, date } from '@/lib/platform/data';
import { Empty } from './shell';

/** Painel financeiro da Área Restrita — somente dados reais (RLS: administrador). */
export function FinancePanel() {
  const q = useQuery({ queryKey: ['admin-finance'], queryFn: async () => {
    const [s, p, f, pl, pr] = await Promise.all([
      supabase.from('platform_subscriptions').select('id,user_id,organization_id,plan_id,status,valid_until,custom_price_cents,discount_percent,payment_method,stripe_subscription_id,updated_at'),
      supabase.from('subscription_payments').select('*').order('paid_at', { ascending: false }).limit(200),
      supabase.from('user_notifications').select('id,user_id,kind,title,body,created_at').in('kind', ['payment_failed', 'subscription_cancelled']).order('created_at', { ascending: false }).limit(100),
      supabase.from('platform_plans').select('id,name,price_cents,discount_percent'),
      supabase.from('profiles').select('id,full_name,email'),
    ]);
    if (s.error || p.error) throw s.error ?? p.error;
    return { subs: s.data ?? [], pays: p.data ?? [], events: f.data ?? [], plans: pl.data ?? [], profiles: pr.data ?? [] };
  } });
  if (q.isPending) return <p className="mt-8 text-steel">Carregando financeiro…</p>;
  if (q.isError) return <Empty title="Financeiro indisponível" text="Não foi possível consultar os dados financeiros." />;
  const { subs, pays, events, plans, profiles } = q.data;
  const now = Date.now(); const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const active = subs.filter(s => s.status === 'active' && (!s.valid_until || new Date(s.valid_until).getTime() > now));
  const price = (s: (typeof subs)[number]) => { const pl = plans.find(p => p.id === s.plan_id); const base = s.custom_price_cents ?? pl?.price_cents ?? 0; const disc = Number(s.discount_percent ?? pl?.discount_percent ?? 0); return Math.round(base * (1 - disc / 100)); };
  const mrr = active.reduce((t, s) => t + price(s), 0);
  const paid = pays.filter(p => p.status === 'paid');
  const monthRevenue = paid.filter(p => new Date(p.paid_at) >= month).reduce((t, p) => t + p.amount_cents, 0);
  const failures = events.filter(e => e.kind === 'payment_failed');
  const cancelled = subs.filter(s => s.status === 'cancelled');
  const who = (id: string | null) => { const p = profiles.find(x => x.id === id); return p?.full_name || p?.email || 'Conta'; };
  const subOwner = (id: string) => who(subs.find(s => s.id === id)?.user_id ?? null);
  const cards: [string, string][] = [['Assinaturas ativas', String(active.length)], ['Receita recorrente mensal', currency(mrr)], ['Recebido neste mês', currency(monthRevenue)], ['Falhas de pagamento', String(failures.length)], ['Cancelamentos', String(cancelled.length)], ['Aguardando pagamento', String(subs.filter(s => s.status === 'awaiting_payment').length)]];
  return <div className="mt-8">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([l, v]) => <div key={l} className="rounded-md border border-border bg-card p-5"><p className="text-sm text-steel">{l}</p><p className="mt-2 text-2xl font-bold">{v}</p></div>)}</div>
    <p className="mt-2 text-xs text-steel">Receita recorrente = soma do valor mensal das assinaturas ativas (com descontos e preços personalizados).</p>
    <h2 className="mt-9 text-xl font-bold">Receita por plano</h2>
    <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card">{plans.map(pl => { const a = active.filter(s => s.plan_id === pl.id); return a.length ? <div key={pl.id} className="flex justify-between p-4 text-sm"><span className="font-semibold">{pl.name}</span><span>{a.length} ativa(s) · {currency(a.reduce((t, s) => t + price(s), 0))}/mês</span></div> : null; })}{active.length === 0 ? <p className="p-4 text-sm text-steel">Nenhuma assinatura ativa.</p> : null}</div>
    <h2 className="mt-9 text-xl font-bold">Pagamentos</h2>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-border text-steel">{['Data', 'Conta', 'Valor', 'Forma', 'Situação'].map(t => <th key={t} className="py-3 pr-4">{t}</th>)}</tr></thead><tbody>{pays.map(p => <tr key={p.id} className="border-b border-border"><td className="py-3">{date(p.paid_at)}</td><td>{subOwner(p.subscription_id)}</td><td>{currency(p.amount_cents)}</td><td>{p.method ?? '—'}</td><td>{p.status === 'paid' ? 'Pago' : p.status}</td></tr>)}</tbody></table>{pays.length === 0 ? <Empty title="Nenhum pagamento registrado" text="Pagamentos confirmados pela Stripe ou registrados manualmente aparecerão aqui." /> : null}</div>
    <h2 className="mt-9 text-xl font-bold">Falhas e cancelamentos</h2>
    <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card">{events.map(e => <div key={e.id} className="p-4 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{e.title} · {who(e.user_id)}</span><span className="text-steel">{date(e.created_at)}</span></div><p className="mt-1 text-steel">{e.body}</p></div>)}{events.length === 0 ? <p className="p-4 text-sm text-steel">Nenhuma falha ou cancelamento registrado.</p> : null}</div>
  </div>;
}
