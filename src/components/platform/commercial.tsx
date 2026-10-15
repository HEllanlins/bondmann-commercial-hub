import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Lock, MailPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/bond/field';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { catalogOptions, currency, date, type Plan } from '@/lib/platform/data';
import type { Json } from '@/integrations/supabase/types';

const ERR: Record<string, string> = {
  request_exists: 'Você já tem uma solicitação em análise.', invalid_plan: 'Plano indisponível.', company_required: 'Informe o nome da empresa.',
  name_required: 'Informe seu nome completo.', trial_already_used: 'Esta conta ou empresa já utilizou o teste grátis. Marque "exceção" para conceder outro.',
  member_limit: 'O limite de usuários do plano foi atingido.', active_subscription_required: 'A empresa precisa de uma assinatura ou teste ativo.',
  invalid_invite: 'Convite inválido ou feito para outro e-mail.', owner_only: 'Somente o proprietário pode gerenciar administradores.',
  cannot_change_self: 'Você não pode alterar o próprio vínculo.', forbidden: 'Você não tem permissão para esta ação.', invalid_email: 'Informe um e-mail válido.',
  invalid_validity: 'Defina uma data de término no futuro.',
};
export async function commercial(action: string, payload: Record<string, Json>) {
  const { data, error } = await supabase.rpc('commercial_action', { _action: action, _payload: payload });
  if (error) { const k = Object.keys(ERR).find(k => error.message.includes(k)); throw new Error(k ? ERR[k] : 'Não foi possível concluir. Confira os dados.'); }
  return data as { id?: string };
}
const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro');
export const SUB_STATUS: Record<string, string> = { pending: 'Solicitação pendente', trial: 'Teste grátis ativo', active: 'Ativa', awaiting_payment: 'Aguardando pagamento', expired: 'Expirada', suspended: 'Suspensa', cancelled: 'Cancelada', expiring: 'Vencendo em breve' };
type Sub = { status: string; valid_until: string | null };
export function effectiveStatus(s: Sub) {
  if ((s.status === 'active' || s.status === 'trial') && (!s.valid_until || new Date(s.valid_until) <= new Date())) return 'expired';
  if ((s.status === 'active' || s.status === 'trial') && s.valid_until && new Date(s.valid_until).getTime() - Date.now() < 7 * 864e5) return s.status === 'trial' ? 'trial' : 'expiring';
  return s.status;
}
const daysLeft = (v: string | null) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 864e5) : null);

export type HubContext = { staff: boolean; admin: boolean; hub: boolean; features: string[]; organization_id: string | null; org_role: 'owner' | 'admin' | 'member' | null; subscription: { id: string; plan_id: string; status: string; valid_until: string | null; trial_ends_at: string | null; renews_at: string | null } | null };
export function useHubContext() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['hub-context', user?.id], enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.rpc('hub_context'); if (error) throw error; return data as unknown as HubContext; } });
}

/** Aviso de teste/assinatura próxima do fim. */
export function SubscriptionBanner() {
  const { data } = useHubContext();
  const s = data?.subscription; if (!s || data?.staff) return null;
  const d = daysLeft(s.valid_until); if (d === null || d > 7) return null;
  const expired = d <= 0;
  return <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm ${expired ? 'border-destructive/40 bg-destructive/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
    <span className="flex items-center gap-2"><AlertTriangle className="size-4" />{expired ? 'Seu acesso terminou. Seus dados estão preservados; regularize a assinatura para continuar.' : `${s.status === 'trial' ? 'Seu teste grátis' : 'Sua assinatura'} termina em ${d} dia(s) (${date(s.valid_until)}).`}</span>
    <Button asChild size="sm" variant="outline"><Link to="/assinatura">Ver assinatura</Link></Button>
  </div>;
}

export function LockedFeature({ name }: { name: string }) {
  return <div className="mt-9 rounded-md border border-border bg-card p-10 text-center"><Lock className="mx-auto size-8 text-aqua" /><h2 className="mt-4 text-xl font-bold">{name} faz parte de outro pacote</h2><p className="mx-auto mt-2 max-w-md text-sm text-steel">Este recurso não está incluído no seu plano ou nas permissões da sua empresa. Consulte os planos ou fale com o responsável pela sua conta.</p><Button asChild className="mt-6"><Link to="/planos">Ver planos <ArrowUpRight /></Link></Button></div>;
}

export function SubscriptionRequestDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { user, fullName } = useAuth(); const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [done, setDone] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!plan) return; setBusy(true); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim();
    try { const r = await commercial('request_subscription', { plan_id: plan.id, full_name: v('full_name'), phone: v('phone'), company_name: v('company_name'), seats: v('seats'), notes: v('notes') }); setDone(r.id ?? ''); await qc.invalidateQueries(); }
    catch (err) { fail(err); } finally { setBusy(false); }
  }
  const empresa = plan?.audience === 'empresa';
  return <Dialog open={Boolean(plan)} onOpenChange={o => { if (!o) { setDone(null); onClose(); } }}><DialogContent className="max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{done !== null ? 'Solicitação enviada' : `Solicitar plano ${plan?.name}`}</DialogTitle></DialogHeader>
    {done !== null ? <div className="space-y-3 text-sm"><CheckCircle2 className="size-8 text-aqua" /><p>Recebemos seu pedido (protocolo <b>{done.slice(0, 8).toUpperCase()}</b>). Ele aguarda análise da administração.</p><p className="text-steel">Nenhum pagamento foi realizado. A ativação do teste ou da assinatura é feita após o contato comercial.</p><Button asChild><Link to="/assinatura">Acompanhar solicitação</Link></Button></div> :
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm text-steel">{currency(plan?.price_cents ?? null)}{plan?.price_cents !== null ? '/mês' : ''} · {empresa ? `até ${plan?.max_users} usuários` : 'acesso individual'} · tipo: {empresa ? 'empresarial' : 'individual'}</p>
        <Field label="Nome completo"><Input name="full_name" required defaultValue={fullName ?? ''} /></Field>
        <Field label="E-mail da conta"><Input value={user?.email ?? ''} disabled /></Field>
        <Field label="Telefone ou WhatsApp"><Input name="phone" required /></Field>
        {empresa ? <><Field label="Nome da empresa"><Input name="company_name" required /></Field><Field label="Quantidade de usuários desejada"><Input name="seats" type="number" min={1} defaultValue={plan?.max_users ?? 1} /></Field></> : null}
        <Field label="Observações (opcional)"><Textarea name="notes" /></Field>
        <Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitação'}</Button>
        <p className="text-xs text-steel">O aviso por e-mail à administração ainda não está configurado; a solicitação aparece na Área Restrita.</p>
      </form>}
  </DialogContent></Dialog>;
}

export function MyCommercialStatus() {
  const { user } = useAuth(); const ctx = useHubContext(); const catalog = useQuery(catalogOptions);
  const reqs = useQuery({ queryKey: ['my-sub-requests', user?.id], enabled: Boolean(user), queryFn: async () => (await supabase.from('subscription_requests').select('*').order('created_at', { ascending: false })).data ?? [] });
  const s = ctx.data?.subscription; const plan = (id: string) => catalog.data?.plans.find(p => p.id === id)?.name ?? id;
  return <div className="mt-8 grid gap-4 md:grid-cols-2">
    <div className="rounded-md border border-border bg-card p-6"><p className="text-xs uppercase text-aqua">Situação atual</p>{s ? <><h2 className="mt-3 text-xl font-bold">{plan(s.plan_id)}</h2><p className="mt-2 font-semibold">{SUB_STATUS[effectiveStatus(s)]}</p>{s.status === 'trial' ? <p className="mt-1 text-sm text-steel">Teste até {date(s.trial_ends_at)} ({Math.max(0, daysLeft(s.valid_until) ?? 0)} dia(s) restantes)</p> : null}{s.renews_at ? <p className="mt-1 text-sm text-steel">Renovação: {date(s.renews_at)}</p> : null}{effectiveStatus(s) === 'expired' ? <p className="mt-2 text-sm text-destructive">Acesso bloqueado por falta de assinatura vigente. Seus dados continuam guardados.</p> : null}{s.status === 'awaiting_payment' ? <p className="mt-2 text-sm text-steel">Aguardando a confirmação do pagamento pela administração.</p> : null}</> : ctx.data?.staff ? <p className="mt-3 text-sm">Equipe Bondmann: acesso sem assinatura.</p> : <p className="mt-3 text-sm text-steel">Nenhuma assinatura vigente.</p>}</div>
    <div className="rounded-md border border-border bg-card p-6"><p className="text-xs uppercase text-aqua">Minhas solicitações</p>{(reqs.data ?? []).length ? (reqs.data ?? []).map(r => <div key={r.id} className="mt-3 flex justify-between gap-2 text-sm"><span>{plan(r.plan_id)} · {date(r.created_at)}</span><span className="font-semibold">{r.status === 'pending_review' ? <><Clock3 className="inline size-3" /> Em análise</> : r.status === 'approved' ? 'Aprovada' : 'Recusada'}</span></div>) : <p className="mt-3 text-sm text-steel">Nenhuma solicitação enviada.</p>}</div>
  </div>;
}

/* ---------------- Área restrita ---------------- */
type Row = Record<string, unknown>;
export function AdminSubscriptionCenter() {
  const qc = useQueryClient(); const catalog = useQuery(catalogOptions);
  const data = useQuery({ queryKey: ['admin-commercial'], queryFn: async () => {
    const [r, s, p, pr, o, ev] = await Promise.all([
      supabase.from('subscription_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_subscriptions').select('*').order('updated_at', { ascending: false }),
      supabase.from('subscription_payments').select('*').order('paid_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,email'), supabase.from('organizations').select('id,name,owner_id'),
      supabase.from('platform_events').select('*').in('event', ['review_request', 'update_subscription', 'record_payment', 'request_subscription']).order('created_at', { ascending: false }).limit(60),
    ]);
    return { requests: r.data ?? [], subs: s.data ?? [], payments: p.data ?? [], profiles: pr.data ?? [], orgs: o.data ?? [], events: ev.data ?? [] };
  } });
  const [tab, setTab] = useState<'pedidos' | 'assinaturas' | 'vencimentos' | 'pagamentos' | 'planos'>('pedidos');
  const [q, setQ] = useState(''); const [status, setStatus] = useState('all');
  const [review, setReview] = useState<Row | null>(null); const [manage, setManage] = useState<Row | null>(null); const [pay, setPay] = useState<Row | null>(null); const [newPlan, setNewPlan] = useState(false);
  const refresh = () => qc.invalidateQueries();
  if (data.isPending || catalog.isPending) return <p className="mt-8 text-steel">Carregando…</p>;
  const d = data.data!; const plans = catalog.data?.plans ?? [];
  const who = (s: Row) => s['organization_id'] ? d.orgs.find(o => o.id === s['organization_id'])?.name ?? 'Empresa' : d.profiles.find(p => p.id === s['user_id'])?.full_name ?? d.profiles.find(p => p.id === s['user_id'])?.email ?? 'Conta';
  const pname = (id: unknown) => plans.find(p => p.id === id)?.name ?? String(id);
  const match = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  async function run(action: string, payload: Record<string, Json>, close: () => void) { try { await commercial(action, payload); toast.success('Alteração registrada no histórico.'); close(); await refresh(); } catch (e) { fail(e); } }
  const iso = (v: FormDataEntryValue | null) => (v ? new Date(`${String(v)}T23:59:00`).toISOString() : '');
  const dIn = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('en-CA') : '');
  const expiring = d.subs.filter(s => ['active', 'trial'].includes(s.status) && s.valid_until && new Date(s.valid_until).getTime() - Date.now() < 7 * 864e5).sort((a, b) => String(a.valid_until).localeCompare(String(b.valid_until)));
  return <div className="mt-8">
    <div className="flex flex-wrap gap-2">{([['pedidos', `Pedidos (${d.requests.filter(r => r.status === 'pending_review').length})`], ['assinaturas', 'Assinaturas'], ['vencimentos', `Vencimentos e testes (${expiring.length})`], ['pagamentos', 'Pagamentos'], ['planos', 'Configuração dos planos']] as const).map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? 'secondary' : 'outline'} onClick={() => setTab(k)}>{l}</Button>)}</div>
    <div className="mt-4 flex flex-wrap gap-2"><Input placeholder="Pesquisar nome, e-mail ou empresa" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />{tab === 'assinaturas' ? <select className="h-12 rounded-2xl border border-border bg-card px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(SUB_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select> : null}</div>

    {tab === 'pedidos' ? <div className="mt-5 divide-y divide-border">{d.requests.filter(r => match(`${r.full_name} ${r.email} ${r.company_name ?? ''}`)).map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><p className="font-semibold">{r.full_name} <span className="font-normal text-steel">· {r.email} · {r.phone ?? 'sem telefone'}</span></p><p className="text-steel">{pname(r.plan_id)} ({currency(r.price_cents_snapshot)}) · {r.contract_type}{r.company_name ? ` · ${r.company_name}` : ''}{r.seats ? ` · ${r.seats} usuário(s)` : ''} · {date(r.created_at)}</p>{r.notes ? <p className="text-steel">“{r.notes}”</p> : null}</div>{r.status === 'pending_review' ? <Button size="sm" onClick={() => setReview(r)}>Analisar</Button> : <span className="text-steel">{r.status === 'approved' ? 'Aprovada' : 'Recusada'} · {date(r.reviewed_at)}</span>}</div>)}{!d.requests.length ? <p className="py-6 text-sm text-steel">Nenhuma solicitação recebida.</p> : null}</div> : null}

    {tab === 'assinaturas' ? <><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-border text-steel">{['Contratante', 'Plano', 'Estado', 'Início', 'Teste até', 'Renovação', 'Desconto', ''].map(h => <th key={h} className="py-3 pr-3">{h}</th>)}</tr></thead><tbody>{d.subs.filter(s => match(who(s)) && (status === 'all' || effectiveStatus(s) === status)).map(s => <tr key={s.id} className="border-b border-border"><td className="py-3 font-semibold">{who(s)}<span className="block text-xs font-normal text-steel">{s.organization_id ? 'Empresa' : 'Individual'}</span></td><td>{pname(s.plan_id)}</td><td>{SUB_STATUS[effectiveStatus(s)]}</td><td>{date(s.started_at)}</td><td>{date(s.trial_ends_at)}</td><td>{date(s.renews_at ?? s.valid_until)}</td><td>{s.discount_percent}%</td><td className="space-x-1 text-right"><Button size="sm" variant="outline" onClick={() => setManage(s)}>Gerenciar</Button><Button size="sm" variant="ghost" onClick={() => setPay(s)}>Pagamento</Button></td></tr>)}</tbody></table></div>
      <h3 className="mt-8 font-bold">Histórico de alterações</h3><div className="mt-2 divide-y divide-border text-sm">{d.events.map(e => <p key={e.id} className="py-2"><b>{({ review_request: 'Solicitação analisada', update_subscription: 'Assinatura alterada', record_payment: 'Pagamento registrado', request_subscription: 'Plano solicitado' } as Record<string, string>)[e.event]}</b> · por {d.profiles.find(p => p.id === e.actor_id)?.full_name ?? d.profiles.find(p => p.id === e.actor_id)?.email ?? '—'} · {new Date(e.created_at).toLocaleString('pt-BR')}</p>)}</div></> : null}

    {tab === 'vencimentos' ? <div className="mt-5 divide-y divide-border">{expiring.filter(s => match(who(s))).map(s => { const n = daysLeft(s.valid_until) ?? 0; return <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><span className="font-semibold">{who(s)} · {pname(s.plan_id)}</span><span className={n <= 1 ? 'text-destructive' : 'text-amber-600 dark:text-amber-300'}>{s.status === 'trial' ? 'Teste' : 'Assinatura'} vence em {Math.max(n, 0)} dia(s) · {date(s.valid_until)}</span><Button size="sm" variant="outline" onClick={() => setManage(s)}>Estender / renovar</Button></div>; })}{!expiring.length ? <p className="py-6 text-sm text-steel">Nada vencendo nos próximos 7 dias.</p> : null}<p className="py-4 text-xs text-steel">Avisos automáticos por e-mail/WhatsApp ainda não estão configurados; registre o contato de renovação nas observações.</p></div> : null}

    {tab === 'pagamentos' ? <div className="mt-5 divide-y divide-border">{d.payments.map(p => { const s = d.subs.find(x => x.id === p.subscription_id); return <div key={p.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="font-semibold">{s ? who(s) : '—'}</span><span>{currency(p.amount_cents)} · {p.method ?? 'manual'}</span><span className="text-steel">{new Date(`${p.paid_at}T12:00`).toLocaleDateString('pt-BR')}{p.notes ? ` · ${p.notes}` : ''}</span></div>; })}{!d.payments.length ? <p className="py-6 text-sm text-steel">Nenhum pagamento registrado. Pagamentos online ainda não estão integrados.</p> : null}</div> : null}

    {tab === 'planos' ? <PlanCommercialConfig plans={plans} onNew={() => setNewPlan(true)} /> : null}

    <Dialog open={Boolean(review)} onOpenChange={o => !o && setReview(null)}><DialogContent><DialogHeader><DialogTitle>Analisar solicitação</DialogTitle></DialogHeader>{review ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run('review_request', { id: String(review['id']), decision: String(f.get('decision')), mode: String(f.get('mode')), plan_id: String(f.get('plan_id')), renews_at: iso(f.get('renews_at')), discount_percent: String(f.get('discount') ?? ''), notes: String(f.get('notes') ?? ''), force: f.get('force') === 'on' }, () => setReview(null)); }}>
      <p className="text-sm">{String(review['full_name'])} · {pname(review['plan_id'])}</p>
      <Field label="Decisão"><select name="decision" className="h-12 rounded-2xl border border-border bg-card px-3"><option value="approve">Aprovar</option><option value="reject">Recusar</option></select></Field>
      <Field label="Liberação"><select name="mode" className="h-12 rounded-2xl border border-border bg-card px-3"><option value="trial">Iniciar teste grátis</option><option value="active">Ativar assinatura (pagamento confirmado)</option><option value="awaiting_payment">Aguardar pagamento</option></select></Field>
      <Field label="Plano concedido"><select name="plan_id" defaultValue={String(review['plan_id'])} className="h-12 rounded-2xl border border-border bg-card px-3">{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Renovação (se ativa)"><Input name="renews_at" type="date" /></Field><Field label="Desconto (%)"><Input name="discount" type="number" min={0} max={100} /></Field></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="force" /> Exceção: permitir novo teste</label>
      <Field label="Observações"><Textarea name="notes" /></Field><Button type="submit">Confirmar</Button></form> : null}</DialogContent></Dialog>

    <Dialog open={Boolean(manage)} onOpenChange={o => !o && setManage(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Gerenciar assinatura</DialogTitle></DialogHeader>{manage ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run('update_subscription', { id: String(manage['id']), status: String(f.get('status')), plan_id: String(f.get('plan_id')), started_at: iso(f.get('started_at')), renews_at: iso(f.get('renews_at')), trial_ends_at: iso(f.get('trial_ends_at')), discount_percent: String(f.get('discount') ?? '0'), custom_price_cents: f.get('price') ? String(Math.round(Number(String(f.get('price')).replace(',', '.')) * 100)) : '', admin_notes: String(f.get('notes') ?? '') }, () => setManage(null)); }}>
      <p className="text-sm">{who(manage)}</p>
      <div className="grid grid-cols-2 gap-3"><Field label="Estado"><select name="status" defaultValue={String(manage['status'])} className="h-12 rounded-2xl border border-border bg-card px-3">{['pending', 'trial', 'active', 'awaiting_payment', 'suspended', 'expired', 'cancelled'].map(k => <option key={k} value={k}>{SUB_STATUS[k]}</option>)}</select></Field><Field label="Plano"><select name="plan_id" defaultValue={String(manage['plan_id'])} className="h-12 rounded-2xl border border-border bg-card px-3">{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
      <div className="grid grid-cols-3 gap-3"><Field label="Início"><Input name="started_at" type="date" defaultValue={dIn(manage['started_at'])} /></Field><Field label="Fim do teste"><Input name="trial_ends_at" type="date" defaultValue={dIn(manage['trial_ends_at'])} /></Field><Field label="Renovação"><Input name="renews_at" type="date" defaultValue={dIn(manage['renews_at'])} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Desconto (%)"><Input name="discount" type="number" min={0} max={100} defaultValue={String(manage['discount_percent'] ?? 0)} /></Field><Field label="Preço especial (R$/mês)"><Input name="price" inputMode="decimal" defaultValue={manage['custom_price_cents'] != null ? String(Number(manage['custom_price_cents']) / 100) : ''} /></Field></div>
      <Field label="Observações administrativas"><Textarea name="notes" defaultValue={String(manage['admin_notes'] ?? '')} /></Field>
      <p className="text-xs text-steel">Teste e Ativa exigem data de término futura. Suspender ou expirar bloqueia o acesso sem apagar dados.</p><Button type="submit">Salvar</Button></form> : null}</DialogContent></Dialog>

    <Dialog open={Boolean(pay)} onOpenChange={o => !o && setPay(null)}><DialogContent><DialogHeader><DialogTitle>Registrar pagamento confirmado</DialogTitle></DialogHeader>{pay ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run('record_payment', { subscription_id: String(pay['id']), amount_cents: String(Math.round(Number(String(f.get('amount')).replace(',', '.')) * 100)), paid_at: String(f.get('paid_at')), method: String(f.get('method') ?? ''), notes: String(f.get('notes') ?? '') }, () => setPay(null)); }}>
      <p className="text-sm">{who(pay)}</p><div className="grid grid-cols-2 gap-3"><Field label="Valor (R$)"><Input name="amount" required inputMode="decimal" /></Field><Field label="Data"><Input name="paid_at" type="date" defaultValue={new Date().toLocaleDateString('en-CA')} /></Field></div><Field label="Forma"><Input name="method" placeholder="Pix, boleto, transferência…" /></Field><Field label="Observações"><Input name="notes" /></Field><Button type="submit">Registrar</Button></form> : null}</DialogContent></Dialog>

    <Dialog open={newPlan} onOpenChange={setNewPlan}><DialogContent><DialogHeader><DialogTitle>Novo plano</DialogTitle></DialogHeader><form className="grid gap-3" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const id = String(f.get('id')).toLowerCase().replace(/[^a-z0-9-]/g, ''); const price = String(f.get('price') ?? '').replace(',', '.'); const { error } = await supabase.from('platform_plans').insert({ id, name: String(f.get('name')), audience: String(f.get('audience')), description: String(f.get('description') ?? ''), price_cents: price ? Math.round(Number(price) * 100) : null, max_users: Number(f.get('max_users')) || 1, benefits: [], active: false, trial_days: Number(f.get('trial')) || 7 }); if (error) return void toast.error(error.message.includes('duplicate') ? 'Já existe um plano com este identificador.' : error.message); toast.success('Plano criado (inativo). Configure os recursos na aba Planos.'); setNewPlan(false); await refresh(); }}>
      <div className="grid grid-cols-2 gap-3"><Field label="Identificador"><Input name="id" required placeholder="ex.: equipe-20" /></Field><Field label="Nome"><Input name="name" required /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Público"><select name="audience" className="h-12 rounded-2xl border border-border bg-card px-3"><option value="representante">Representante</option><option value="empresa">Empresa</option></select></Field><Field label="Usuários"><Input name="max_users" type="number" min={1} defaultValue={1} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Preço (R$/mês, vazio = sob consulta)"><Input name="price" inputMode="decimal" /></Field><Field label="Dias de teste"><Input name="trial" type="number" min={0} defaultValue={7} /></Field></div>
      <Field label="Descrição"><Textarea name="description" /></Field><Button type="submit">Criar plano</Button></form></DialogContent></Dialog>
  </div>;
}

function PlanCommercialConfig({ plans, onNew }: { plans: Plan[]; onNew: () => void }) {
  const qc = useQueryClient();
  async function upd(id: string, patch: Record<string, unknown>) { const { error } = await supabase.from('platform_plans').update(patch as never).eq('id', id); if (error) toast.error(error.message); else { toast.success('Plano atualizado.'); await qc.invalidateQueries(); } }
  return <div className="mt-5"><div className="flex justify-between gap-2"><p className="text-sm text-steel">Preço, recursos e limites são editados na aba "Planos" da administração. Aqui ficam teste, oferta e desconto.</p><Button size="sm" onClick={onNew}><Plus /> Novo plano</Button></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-border text-steel">{['Plano', 'Público', 'Preço', 'Dias de teste', 'Desconto (%)', 'Oferta ativa'].map(h => <th key={h} className="py-3 pr-3">{h}</th>)}</tr></thead><tbody>{plans.map(p => { const x = p as Plan & { trial_days: number; offer_active: boolean; discount_percent: number }; return <tr key={p.id} className="border-b border-border"><td className="py-3 font-semibold">{p.name}</td><td>{p.audience}</td><td>{currency(p.price_cents)}</td><td><Input type="number" min={0} defaultValue={x.trial_days} className="h-9 w-20" onBlur={e => void upd(p.id, { trial_days: Number(e.target.value) || 0 })} /></td><td><Input type="number" min={0} max={100} defaultValue={x.discount_percent} className="h-9 w-20" onBlur={e => void upd(p.id, { discount_percent: Number(e.target.value) || 0 })} /></td><td><input type="checkbox" defaultChecked={x.offer_active} onChange={e => void upd(p.id, { offer_active: e.target.checked })} aria-label="Oferta ativa" /></td></tr>; })}</tbody></table></div></div>;
}

/* ---------------- Equipe da empresa ---------------- */
export const MEMBER_PERMISSIONS: [string, string][] = [['prospeccao', 'Prospecção e pesquisa de empresas'], ['clientes', 'Criar e editar empresas'], ['rotas', 'Gerenciar rotas'], ['visitas', 'Registrar visitas'], ['crm', 'Gerenciar CRM'], ['followups', 'Criar follow-ups'], ['relatorios', 'Visualizar relatórios'], ['produtos', 'Gerenciar produtos'], ['ia', 'Usar assistente de IA'], ['mapas', 'Mapas avançados'], ['dashboard', 'Dashboard'], ['indicadores_equipe', 'Ver indicadores e registros da equipe']];

export function TeamManager({ organizationId, maxUsers, isOwner }: { organizationId: string; maxUsers: number | null; isOwner: boolean }) {
  const qc = useQueryClient(); const { user } = useAuth();
  const team = useQuery({ queryKey: ['team', organizationId], queryFn: async () => {
    const [m, i] = await Promise.all([supabase.from('organization_members').select('*').eq('organization_id', organizationId), supabase.from('organization_invites').select('*').eq('organization_id', organizationId).eq('status', 'pending')]);
    const ids = (m.data ?? []).map(x => x.user_id); const p = ids.length ? (await supabase.from('profiles').select('id,full_name,email').in('id', ids)).data ?? [] : [];
    return { members: m.data ?? [], invites: i.data ?? [], profiles: p };
  } });
  const [perms, setPerms] = useState<string[]>([]); const [edit, setEdit] = useState<{ id: string; role: string; permissions: string[] } | null>(null);
  async function run(a: string, p: Record<string, Json>) { try { await commercial(a, p); toast.success('Equipe atualizada.'); await qc.invalidateQueries({ queryKey: ['team', organizationId] }); return true; } catch (e) { fail(e); return false; } }
  const active = (team.data?.members ?? []).filter(m => m.status === 'active').length + 1;
  const prof = (id: string) => team.data?.profiles.find(p => p.id === id);
  return <section className="mt-10 border-t border-border pt-6">
    <h2 className="text-xl font-bold">Gestão de equipe</h2>
    <p className="mt-1 text-sm text-steel">Vagas: {active} de {maxUsers ?? '—'} usadas (inclui o proprietário). Sem permissões marcadas, o membro usa os recursos do plano, exceto gestão de equipe.</p>
    <form className="mt-5 grid gap-3 rounded-md border border-border bg-card p-5" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await run('invite_member', { organization_id: organizationId, email: String(f.get('email')), role: String(f.get('role')), permissions: perms })) { e.currentTarget.reset(); setPerms([]); } }}>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]"><Input name="email" type="email" required placeholder="E-mail do funcionário" /><select name="role" className="h-12 rounded-2xl border border-border bg-card px-3" disabled={!isOwner}><option value="member">Funcionário</option><option value="admin">Administrador da empresa</option></select><Button type="submit"><MailPlus /> Convidar</Button></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{MEMBER_PERMISSIONS.map(([k, l]) => <label key={k} className="inline-flex items-center gap-2"><input type="checkbox" checked={perms.includes(k)} onChange={e => setPerms(e.target.checked ? [...perms, k] : perms.filter(x => x !== k))} />{l}</label>)}</div>
      <p className="text-xs text-steel">O funcionário entra com a própria conta usando este e-mail e aceita o convite na área "Funcionário". O envio de e-mail do convite ainda não está configurado — avise a pessoa diretamente.</p>
    </form>
    {(team.data?.invites ?? []).length ? <><h3 className="mt-6 font-bold">Convites pendentes</h3>{team.data!.invites.map(i => <div key={i.id} className="flex justify-between gap-2 border-b border-border py-3 text-sm"><span>{i.email} · {i.role === 'admin' ? 'Administrador' : 'Funcionário'}</span><Button size="sm" variant="ghost" onClick={() => void run('revoke_invite', { id: i.id })}>Cancelar convite</Button></div>)}</> : null}
    <h3 className="mt-6 font-bold">Membros</h3>
    <div className="divide-y divide-border">{(team.data?.members ?? []).map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-semibold">{prof(m.user_id)?.full_name ?? prof(m.user_id)?.email ?? 'Conta'}</p><p className="text-steel">{m.role === 'admin' ? 'Administrador' : 'Funcionário'} · {({ pending: 'Aguardando aprovação', active: 'Ativo', rejected: 'Recusado', blocked: 'Bloqueado' } as Record<string, string>)[m.status]} · {m.permissions.length ? `${m.permissions.length} permissão(ões)` : 'recursos do plano'}</p></div>
      {m.user_id !== user?.id ? <div className="flex flex-wrap gap-1">{m.status !== 'active' ? <Button size="sm" onClick={() => void run('update_member', { id: m.id, status: 'active' })}>Aprovar</Button> : null}{m.status === 'pending' ? <Button size="sm" variant="ghost" onClick={() => void run('update_member', { id: m.id, status: 'rejected' })}>Recusar</Button> : null}<Button size="sm" variant="outline" onClick={() => setEdit({ id: m.id, role: m.role, permissions: m.permissions })}>Permissões</Button>{m.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => void run('update_member', { id: m.id, status: 'blocked' })}>Remover acesso</Button> : null}</div> : <span className="text-xs text-steel">Você</span>}</div>)}{!(team.data?.members ?? []).length ? <p className="py-4 text-sm text-steel">Nenhum membro ainda.</p> : null}</div>
    <Dialog open={Boolean(edit)} onOpenChange={o => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>Papel e permissões</DialogTitle></DialogHeader>{edit ? <div className="grid gap-3"><select className="h-12 rounded-2xl border border-border bg-card px-3" value={edit.role} disabled={!isOwner} onChange={e => setEdit({ ...edit, role: e.target.value })}><option value="member">Funcionário</option><option value="admin">Administrador da empresa</option></select>{!isOwner ? <p className="text-xs text-steel">Só o proprietário altera administradores.</p> : null}<div className="grid gap-1 text-sm">{MEMBER_PERMISSIONS.map(([k, l]) => <label key={k} className="inline-flex items-center gap-2"><input type="checkbox" checked={edit.permissions.includes(k)} onChange={e => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, k] : edit.permissions.filter(x => x !== k) })} />{l}</label>)}</div><Button onClick={async () => { if (await run('update_member', { id: edit.id, role: edit.role, permissions: edit.permissions })) setEdit(null); }}>Salvar</Button></div> : null}</DialogContent></Dialog>
  </section>;
}

export function InvitesInbox() {
  const { user } = useAuth(); const qc = useQueryClient();
  const inv = useQuery({ queryKey: ['my-invites', user?.id], enabled: Boolean(user), queryFn: async () => { const { data } = await supabase.from('organization_invites').select('*, organizations(name)').eq('status', 'pending'); return data ?? []; } });
  if (!(inv.data ?? []).length) return null;
  return <div className="mt-8 rounded-md border border-aqua/40 bg-aqua/5 p-6"><h2 className="text-lg font-bold">Convite empresarial pendente</h2>{inv.data!.map(i => <div key={i.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{(i.organizations as { name?: string } | null)?.name ?? 'Empresa'} convidou você como {i.role === 'admin' ? 'administrador' : 'funcionário'}.</span><Button size="sm" onClick={async () => { try { await commercial('accept_invite', { id: i.id }); toast.success('Vínculo aceito.'); await qc.invalidateQueries(); } catch (e) { fail(e); } }}>Aceitar convite</Button></div>)}</div>;
}
