import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Bell, Check, Plus, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Field, Input, Textarea } from '@/components/bond/field';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { ThemeToggle } from '@/lib/theme';
import { askHub } from '@/lib/hub/ai.functions';
import { Card, Empty, FollowUpForm, Modal, Pill, Section, Select, Tabs, VisitForm, VisitResultForm } from './hub-ui';
import { AVAILABILITY, FOLLOW_LABELS, PIPELINE, PRIORITIES, VISIT_RESULTS, brl, companyName, followStatus, fmtDate, logEvent, myId, visitBucket, useCompanies, useFollowUps, useInvalidateHub, useOpportunities, useProducts, useRequests, useSegments, useVisits, type Product, type Visit } from '@/lib/hub/data';

const useName = () => { const { data: cs = [] } = useCompanies(); return (id: string | null) => companyName(cs.find(c => c.id === id)); };

export function CRM() {
  const { data: opps = [] } = useOpportunities(); const { data: companies = [] } = useCompanies(); const { data: products = [] } = useProducts(); const inv = useInvalidateHub(); const name = useName(); const [open, setOpen] = useState(false);
  async function move(id: string, stage: string, companyId: string) {
    await supabase.from('opportunities').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    const cs = { proposta: 'negociacao', interessado: 'negociacao', cliente: 'cliente', perdido: 'perdido', contatado: 'lead', visitado: 'visitado' }[stage];
    if (cs) await supabase.from('companies').update({ stage: cs }).eq('id', companyId);
    await logEvent(companyId, 'crm', `Oportunidade movida para ${PIPELINE.find(p => p[0] === stage)?.[1]}`); await inv();
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const cid = String(f.get('company_id'));
    const value = String(f.get('value') ?? '').replace(',', '.'); const pids = f.getAll('products').map(String);
    const { error } = await supabase.from('opportunities').insert({ company_id: cid, owner_id: await myId(), title: String(f.get('title')), stage: String(f.get('stage')), value_cents: value ? Math.round(Number(value) * 100) : null, product_ids: pids, notes: String(f.get('notes') ?? '') || null });
    if (error) return toast.error(error.message);
    await supabase.from('companies').update({ stage: 'lead' }).eq('id', cid).eq('stage', 'prospect');
    await logEvent(cid, 'crm', `Oportunidade criada: ${String(f.get('title'))}`); toast.success('Oportunidade criada.'); setOpen(false); await inv();
  }
  return <div className="mt-6">
    <div className="flex justify-end"><Button onClick={() => setOpen(true)} disabled={!companies.length}><Plus /> Nova oportunidade</Button></div>
    {opps.length === 0 ? <div className="mt-4"><Empty>{companies.length ? 'Nenhuma oportunidade ainda. Crie uma a partir de uma empresa ou registre uma visita.' : 'Cadastre empresas primeiro para criar oportunidades.'}</Empty></div> :
      <div className="mt-4 flex gap-3 overflow-x-auto pb-4">{PIPELINE.map(([k, l]) => { const col = opps.filter(o => o.stage === k); return <div key={k} className="w-64 shrink-0 rounded-md border border-border bg-muted/40 p-3"><p className="text-sm font-bold">{l} <span className="text-steel">({col.length})</span></p><p className="text-[11px] text-steel">{brl(col.reduce((s, o) => s + (o.value_cents ?? 0), 0))}</p><div className="mt-3 space-y-2">{col.map(o => <div key={o.id} className="rounded-md border border-border bg-card p-3 text-sm"><p className="font-semibold">{o.title}</p><Link to="/empresas/$id" params={{ id: o.company_id }} className="text-xs text-aqua">{name(o.company_id)}</Link><p className="mt-1 text-xs text-steel">{brl(o.value_cents)}{o.product_ids.length ? ` · ${o.product_ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(', ')}` : ''}</p><Select value={o.stage} onChange={e => void move(o.id, e.target.value, o.company_id)} className="mt-2 h-9 text-xs" aria-label="Mover etapa">{PIPELINE.map(([pk, pl]) => <option key={pk} value={pk}>{pl}</option>)}</Select></div>)}</div></div>; })}</div>}
    <Modal open={open} onOpenChange={setOpen} title="Nova oportunidade"><form onSubmit={create} className="grid gap-3">
      <Field label="Empresa"><Select name="company_id" required>{companies.map(c => <option key={c.id} value={c.id}>{companyName(c)}</option>)}</Select></Field>
      <Field label="Título"><Input name="title" required placeholder="Ex.: Fornecimento de desengraxante" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Etapa"><Select name="stage" defaultValue="contatado">{PIPELINE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field><Field label="Valor estimado (R$)"><Input name="value" inputMode="decimal" /></Field></div>
      {products.length ? <Field label="Produtos relacionados"><select name="products" multiple className="min-h-24 w-full rounded-2xl border border-border bg-card p-2 text-sm">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field> : null}
      <Field label="Notas"><Textarea name="notes" /></Field><Button type="submit">Criar</Button></form></Modal>
  </div>;
}

export function Visitas() {
  const { data: visits = [] } = useVisits(); const name = useName(); const inv = useInvalidateHub();
  const [tab, setTab] = useState<'hoje' | 'futura' | 'realizada' | 'atrasada'>('hoje'); const [open, setOpen] = useState(false); const [reg, setReg] = useState<Visit | null>(null);
  const b = visits.map(v => ({ v, k: visitBucket(v) })); const list = b.filter(x => x.k === tab).map(x => x.v);
  const n = (k: string) => b.filter(x => x.k === k).length;
  async function cancel(v: Visit) { await supabase.from('visits').update({ status: 'cancelada' }).eq('id', v.id); await inv(); }
  return <div className="mt-6">
    <div className="flex flex-wrap justify-between gap-3"><Tabs value={tab} onChange={setTab} items={[['hoje', 'Hoje', n('hoje')], ['futura', 'Próximas', n('futura')], ['atrasada', 'Atrasadas', n('atrasada')], ['realizada', 'Realizadas', n('realizada')]]} /><Button onClick={() => setOpen(true)}><Plus /> Nova visita</Button></div>
    <div className="mt-4 space-y-3">{list.length === 0 ? <Empty>{visits.length ? 'Nenhuma visita nesta lista.' : 'Você ainda não possui visitas cadastradas.'}</Empty> : list.map(v => <Card key={v.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><Link to="/empresas/$id" params={{ id: v.company_id ?? '' }} className="font-bold hover:text-aqua">{name(v.company_id)}</Link><p className="text-xs text-steel">{fmtDate(v.scheduled_for)}{v.summary ? ` · ${v.summary}` : ''}</p>{v.result ? <p className="mt-1 text-sm">Resultado: <b>{VISIT_RESULTS[v.result]}</b>{v.next_step ? ` · Próximo passo: ${v.next_step}` : ''}</p> : null}{v.notes ? <p className="text-xs text-steel">{v.notes}</p> : null}</div>
      {v.status !== 'realizada' ? <div className="flex gap-2"><Button size="sm" onClick={() => setReg(v)}><Check /> Registrar resultado</Button><Button size="sm" variant="ghost" onClick={() => void cancel(v)}>Cancelar</Button></div> : <Pill tone="ok">Realizada</Pill>}</div></Card>)}</div>
    <VisitForm open={open} onOpenChange={setOpen} /><VisitResultForm visit={reg} onClose={() => setReg(null)} />
  </div>;
}

export function FollowUps() {
  const { data: fus = [] } = useFollowUps(); const name = useName(); const inv = useInvalidateHub(); const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'hoje' | 'atrasado' | 'pendente' | 'concluido' | 'cancelado'>('hoje');
  const b = fus.map(f => ({ f, k: followStatus(f) })); const n = (k: string) => b.filter(x => x.k === k).length;
  async function set(id: string, status: string, cid: string | null, title: string) { await supabase.from('follow_ups').update({ status, done: status === 'concluido' }).eq('id', id); if (cid) await logEvent(cid, 'follow-up', `Follow-up ${status === 'concluido' ? 'concluído' : 'cancelado'}: ${title}`); await inv(); }
  return <div className="mt-6">
    <div className="flex flex-wrap justify-between gap-3"><Tabs value={tab} onChange={setTab} items={[['hoje', 'Hoje', n('hoje')], ['atrasado', 'Atrasados', n('atrasado')], ['pendente', 'Próximos', n('pendente')], ['concluido', 'Concluídos', n('concluido')], ['cancelado', 'Cancelados', n('cancelado')]]} /><Button onClick={() => setOpen(true)}><Plus /> Novo follow-up</Button></div>
    <div className="mt-4 space-y-3">{b.filter(x => x.k === tab).length === 0 ? <Empty>{fus.length ? 'Nada nesta lista.' : 'Você ainda não possui follow-ups.'}</Empty> : b.filter(x => x.k === tab).map(({ f, k }) => <Card key={f.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{f.title}</p><p className="text-xs text-steel">{f.company_id ? name(f.company_id) : 'Sem empresa'} · {fmtDate(f.due_at)} · Prioridade {PRIORITIES[f.priority] ?? f.priority}</p>{f.notes ? <p className="mt-1 text-sm text-steel">{f.notes}</p> : null}</div><div className="flex items-center gap-2"><Pill tone={k === 'atrasado' ? 'bad' : k === 'hoje' ? 'warn' : k === 'concluido' ? 'ok' : 'default'}>{FOLLOW_LABELS[k]}</Pill>{k !== 'concluido' && k !== 'cancelado' ? <><Button size="sm" onClick={() => void set(f.id, 'concluido', f.company_id, f.title)}><Check /> Concluir</Button><Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => void set(f.id, 'cancelado', f.company_id, f.title)}><X /></Button></> : null}</div></div></Card>)}</div>
    <FollowUpForm open={open} onOpenChange={setOpen} />
  </div>;
}

export function Produtos() {
  const { data: products = [] } = useProducts(); const { data: segments = [] } = useSegments(); const inv = useInvalidateHub();
  const [edit, setEdit] = useState<Product | 'new' | null>(null); const [view, setView] = useState<Product | null>(null); const [q, setQ] = useState(''); const [seg, setSeg] = useState('');
  const list = products.filter(p => (!seg || p.segment_id === seg) && (!q || `${p.name} ${p.code ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim() || null;
    const row = { name: v('name') ?? '', code: v('code'), category: v('category'), description: v('description'), segment_id: v('segment_id'), availability: v('availability') ?? 'sob_consulta', technical_info: v('technical_info'), notes: v('notes'), image_url: v('image_url'), features: (v('features') ?? '').split('\n').map(s => s.trim()).filter(Boolean), status: v('status') ?? 'ativo', is_published: f.get('is_published') === 'on' };
    const r = edit === 'new' ? await supabase.from('products').insert(row) : await supabase.from('products').update({ ...row, updated_at: new Date().toISOString() }).eq('id', (edit as Product).id);
    if (r.error) return toast.error(r.error.message); toast.success('Produto salvo.'); setEdit(null); await inv();
  }
  async function quick(p: Product, patch: Partial<Product>) { const { error } = await supabase.from('products').update(patch).eq('id', p.id); if (error) toast.error(error.message); await inv(); }
  const cur = edit && edit !== 'new' ? edit : null;
  return <div className="mt-6">
    <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]"><Input placeholder="Buscar produto, código ou categoria" value={q} onChange={e => setQ(e.target.value)} /><Select value={seg} onChange={e => setSeg(e.target.value)}><option value="">Todos os segmentos</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Button className="h-12" onClick={() => setEdit('new')}><Plus /> Adicionar produto</Button></div>
    <p className="mt-2 text-xs text-steel">Disponibilidade é controle interno; não há integração com estoque em tempo real.</p>
    <div className="mt-4">{list.length === 0 ? <Empty>{products.length ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado ainda. Adicione os produtos do catálogo Bondmann.'}</Empty> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(p => <Card key={p.id}><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{p.name}</p><p className="text-xs text-steel">{p.code ?? 'sem código'} · {p.category ?? 'sem categoria'} · {segments.find(s => s.id === p.segment_id)?.name ?? 'sem segmento'}</p></div><Pill tone={p.status === 'ativo' ? 'ok' : 'default'}>{p.status === 'ativo' ? 'Ativo' : 'Inativo'}</Pill></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Select value={p.availability} onChange={e => void quick(p, { availability: e.target.value })} className="h-9 w-40 text-xs" aria-label="Disponibilidade">{Object.entries(AVAILABILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select><Button size="sm" variant="outline" onClick={() => setView(p)}>Ver</Button><Button size="sm" variant="outline" onClick={() => setEdit(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => void quick(p, { status: p.status === 'ativo' ? 'inativo' : 'ativo' })}>{p.status === 'ativo' ? 'Desativar' : 'Ativar'}</Button></div></Card>)}</div>}</div>
    <Modal open={Boolean(edit)} onOpenChange={v => !v && setEdit(null)} title={cur ? 'Editar produto' : 'Adicionar produto'}><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome *"><Input name="name" required defaultValue={cur?.name ?? ''} /></Field><Field label="Código"><Input name="code" defaultValue={cur?.code ?? ''} /></Field>
      <Field label="Categoria"><Input name="category" defaultValue={cur?.category ?? ''} /></Field><Field label="Segmento"><Select name="segment_id" defaultValue={cur?.segment_id ?? ''}><option value="">Nenhum</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Disponibilidade"><Select name="availability" defaultValue={cur?.availability ?? 'sob_consulta'}>{Object.entries(AVAILABILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field><Field label="Status"><Select name="status" defaultValue={cur?.status ?? 'ativo'}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></Select></Field>
      <div className="sm:col-span-2"><Field label="Descrição"><Textarea name="description" defaultValue={cur?.description ?? ''} /></Field></div>
      <div className="sm:col-span-2"><Field label="Aplicações (uma por linha)"><Textarea name="features" defaultValue={cur?.features.join('\n') ?? ''} /></Field></div>
      <div className="sm:col-span-2"><Field label="Informações técnicas" hint="Preencha apenas com dados oficiais da ficha técnica."><Textarea name="technical_info" defaultValue={cur?.technical_info ?? ''} /></Field></div>
      <Field label="Imagem (URL)"><Input name="image_url" defaultValue={cur?.image_url ?? ''} /></Field><Field label="Observações"><Input name="notes" defaultValue={cur?.notes ?? ''} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_published" defaultChecked={cur?.is_published ?? false} /> Publicar no catálogo público</label>
      <Button type="submit" className="sm:col-span-2">Salvar produto</Button></form></Modal>
    <Modal open={Boolean(view)} onOpenChange={v => !v && setView(null)} title={view?.name ?? ''}>{view ? <div className="space-y-2 text-sm">{view.image_url ? <img src={view.image_url} alt={view.name} className="max-h-48 rounded-md" /> : null}<p><b>Código:</b> {view.code ?? '—'} · <b>Categoria:</b> {view.category ?? '—'}</p><p><b>Disponibilidade:</b> {AVAILABILITY[view.availability]}</p><p>{view.description ?? 'Sem descrição cadastrada.'}</p>{view.features.length ? <p><b>Aplicações:</b> {view.features.join(', ')}</p> : null}<p><b>Informações técnicas:</b> {view.technical_info ?? 'não cadastradas'}</p>{view.notes ? <p><b>Obs.:</b> {view.notes}</p> : null}</div> : null}</Modal>
  </div>;
}

export function Relatorios() {
  const { data: companies = [] } = useCompanies(); const { data: visits = [] } = useVisits(); const { data: fus = [] } = useFollowUps(); const { data: opps = [] } = useOpportunities(); const { data: products = [] } = useProducts(); const { data: segments = [] } = useSegments(); const { data: requests = [] } = useRequests();
  const [days, setDays] = useState(30); const [seg, setSeg] = useState(''); const [stage, setStage] = useState('');
  const since = Date.now() - days * 864e5; const inP = (d: string | null) => !d || new Date(d).getTime() >= since;
  const cs = companies.filter(c => (!seg || c.segment_id === seg) && (!stage || c.stage === stage)); const ids = new Set(cs.map(c => c.id));
  const vs = visits.filter(v => ids.has(v.company_id ?? '') && inP(v.scheduled_for)); const os = opps.filter(o => ids.has(o.company_id) && inP(o.created_at)); const fs = fus.filter(f => (!f.company_id || ids.has(f.company_id)) && inP(f.created_at));
  const prodCount = useMemo(() => { const m = new Map<string, number>(); os.forEach(o => o.product_ids.forEach(id => m.set(id, (m.get(id) ?? 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [os]);
  const reqCount = useMemo(() => { const m = new Map<string, number>(); requests.filter(r => inP(r.created_at) && r.product_id).forEach(r => m.set(r.product_id!, (m.get(r.product_id!) ?? 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [requests, since]);
  const pn = (id: string) => products.find(p => p.id === id)?.name ?? 'Produto';
  const won = os.filter(o => o.stage === 'cliente').length;
  const Row = ({ l, v }: { l: string; v: string | number }) => <div className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span className="text-steel">{l}</span><b>{v}</b></div>;
  return <div className="mt-6">
    <div className="grid gap-3 md:grid-cols-3"><Select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={3650}>Todo o período</option></Select><Select value={seg} onChange={e => setSeg(e.target.value)}><option value="">Todos os segmentos</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select value={stage} onChange={e => setStage(e.target.value)}><option value="">Todos os status</option>{Object.entries({ prospect: 'Prospect', lead: 'Lead', visitado: 'Visitado', negociacao: 'Em negociação', cliente: 'Cliente', cliente_ativo: 'Cliente ativo', perdido: 'Perdido' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div>
    <p className="mt-2 text-xs text-steel">Responsável: seus próprios registros e os da equipe visíveis para você.</p>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card><h3 className="font-bold">Prospecção</h3><Row l="Empresas adicionadas no período" v={cs.filter(c => inP(c.created_at)).length} /><Row l="Encontradas via Google Maps" v={cs.filter(c => c.source === 'google_maps' && inP(c.created_at)).length} /><Row l="Empresas visitadas" v={new Set(vs.filter(v => v.status === 'realizada').map(v => v.company_id)).size} /></Card>
      <Card><h3 className="font-bold">Visitas</h3><Row l="Realizadas" v={vs.filter(v => v.status === 'realizada').length} /><Row l="Agendadas" v={vs.filter(v => v.status === 'agendada').length} />{segments.map(s => ({ s, n: vs.filter(v => v.status === 'realizada' && companies.find(c => c.id === v.company_id)?.segment_id === s.id).length })).filter(x => x.n).map(x => <Row key={x.s.id} l={`· ${x.s.name}`} v={x.n} />)}</Card>
      <Card><h3 className="font-bold">CRM</h3><Row l="Leads" v={cs.filter(c => ['lead', 'visitado'].includes(c.stage)).length} /><Row l="Oportunidades" v={os.length} /><Row l="Conversões (clientes)" v={won} /><Row l="Taxa de conversão" v={os.length ? `${Math.round((won / os.length) * 100)}%` : '—'} /><Row l="Valor em aberto" v={brl(os.filter(o => !['cliente', 'perdido'].includes(o.stage)).reduce((s, o) => s + (o.value_cents ?? 0), 0))} /></Card>
      <Card><h3 className="font-bold">Follow-ups</h3><Row l="Concluídos" v={fs.filter(f => followStatus(f) === 'concluido').length} /><Row l="Atrasados" v={fs.filter(f => followStatus(f) === 'atrasado').length} /><Row l="Pendentes" v={fs.filter(f => ['pendente', 'hoje'].includes(followStatus(f))).length} /></Card>
      <Card><h3 className="font-bold">Produtos mais associados</h3>{prodCount.length ? prodCount.map(([id, n]) => <Row key={id} l={pn(id)} v={n} />) : <p className="mt-2 text-sm text-steel">Sem produtos associados a oportunidades.</p>}</Card>
      <Card><h3 className="font-bold">Produtos solicitados por clientes</h3>{reqCount.length ? reqCount.map(([id, n]) => <Row key={id} l={pn(id)} v={n} />) : <p className="mt-2 text-sm text-steel">Nenhuma solicitação no período.</p>}</Card>
    </div>
  </div>;
}

export function Configuracoes() {
  const { user, fullName } = useAuth(); const [saving, setSaving] = useState(false); const { data: segments = [] } = useSegments();
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
  if (prefs === null && user) void supabase.from('user_settings').select('preferences').eq('user_id', user.id).maybeSingle().then(({ data }) => setPrefs((data?.preferences as Record<string, unknown>) ?? {}));
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!user) return; setSaving(true); const f = new FormData(e.currentTarget); const { error } = await supabase.from('profiles').update({ full_name: String(f.get('full_name') ?? '') || null, phone: String(f.get('phone') ?? '') || null, avatar_url: String(f.get('avatar_url') ?? '') || null }).eq('id', user.id); setSaving(false); if (error) toast.error(error.message); else toast.success('Perfil atualizado.'); }
  async function savePrefs(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!user) return; const f = new FormData(e.currentTarget); const p = { language: f.get('language'), notify: ['visitas', 'followups', 'oportunidades', 'solicitacoes', 'mensagens'].filter(k => f.get(`n_${k}`) === 'on'), region: f.get('region'), segments: f.getAll('segments'), radiusKm: Number(f.get('radius')) || 10, workStart: f.get('workStart'), workEnd: f.get('workEnd') }; const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, preferences: p as never, updated_at: new Date().toISOString() }); if (error) toast.error(error.message); else { setPrefs(p); toast.success('Preferências salvas.'); } }
  async function changePassword(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const pw = String(f.get('pw')); if (pw.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres.'); if (pw !== String(f.get('pw2'))) return toast.error('As senhas não conferem.'); const { error } = await supabase.auth.updateUser({ password: pw }); if (error) toast.error(error.message); else { toast.success('Senha alterada.'); e.currentTarget.reset(); } }
  const p = (prefs ?? {}) as { language?: string; notify?: string[]; region?: string; segments?: string[]; radiusKm?: number; workStart?: string; workEnd?: string };
  const [profile, setProfile] = useState<{ phone: string | null; avatar_url: string | null } | null>(null);
  if (profile === null && user) void supabase.from('profiles').select('phone,avatar_url').eq('id', user.id).maybeSingle().then(({ data }) => setProfile(data ?? { phone: null, avatar_url: null }));
  return <div className="mt-6 grid gap-5 lg:grid-cols-2">
    <Card><h3 className="font-bold">Perfil</h3>{profile ? <form onSubmit={saveProfile} className="mt-3 grid gap-3"><Field label="Nome"><Input name="full_name" defaultValue={fullName ?? ''} /></Field><Field label="E-mail" hint="O e-mail de acesso não é alterado aqui."><Input value={user?.email ?? ''} disabled /></Field><Field label="Telefone"><Input name="phone" defaultValue={profile.phone ?? ''} /></Field><Field label="Foto (URL)"><Input name="avatar_url" defaultValue={profile.avatar_url ?? ''} /></Field><Button type="submit" disabled={saving}>Salvar perfil</Button></form> : <p className="mt-3 text-sm text-steel">Carregando…</p>}</Card>
    <Card><h3 className="font-bold">Conta e sessão</h3><div className="mt-3 flex items-center justify-between"><span className="text-sm">Tema</span><ThemeToggle /></div><form onSubmit={changePassword} className="mt-4 grid gap-3"><Field label="Nova senha"><Input name="pw" type="password" autoComplete="new-password" /></Field><Field label="Confirmar senha"><Input name="pw2" type="password" autoComplete="new-password" /></Field><Button type="submit" variant="outline">Alterar senha</Button></form><Button variant="ghost" className="mt-3" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); window.location.href = '/login'; }}>Encerrar todas as sessões</Button></Card>
    {prefs ? <Card className="lg:col-span-2"><h3 className="font-bold">Preferências, notificações e área comercial</h3><form onSubmit={savePrefs} className="mt-3 grid gap-4 md:grid-cols-2">
      <Field label="Idioma"><Select name="language" defaultValue={p.language ?? 'pt-BR'}><option value="pt-BR">Português (Brasil)</option></Select></Field>
      <fieldset className="space-y-1 text-sm"><legend className="text-[12px] font-semibold uppercase text-steel">Notificações internas</legend>{[['visitas', 'Visitas'], ['followups', 'Follow-ups'], ['oportunidades', 'Oportunidades'], ['solicitacoes', 'Solicitações de clientes'], ['mensagens', 'Mensagens']].map(([k, l]) => <label key={k} className="mr-4 inline-flex items-center gap-2"><input type="checkbox" name={`n_${k}`} defaultChecked={!p.notify || p.notify.includes(k!)} /> {l}</label>)}</fieldset>
      <Field label="Região de atuação"><Input name="region" defaultValue={p.region ?? ''} placeholder="Ex.: Distrito Federal" /></Field>
      <Field label="Raio de prospecção (km)"><Input name="radius" type="number" min={1} max={50} defaultValue={p.radiusKm ?? 10} /></Field>
      <Field label="Segmentos de interesse"><select name="segments" multiple defaultValue={p.segments ?? []} className="min-h-28 w-full rounded-2xl border border-border bg-card p-2 text-sm">{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Início do expediente"><Input name="workStart" type="time" defaultValue={p.workStart ?? '08:00'} /></Field><Field label="Fim do expediente"><Input name="workEnd" type="time" defaultValue={p.workEnd ?? '18:00'} /></Field></div>
      <Button type="submit" className="md:col-span-2">Salvar preferências</Button></form></Card> : null}
  </div>;
}

export function NotificationBell() {
  const { data: fus = [] } = useFollowUps(); const { data: visits = [] } = useVisits(); const { data: requests = [] } = useRequests(); const { data: opps = [] } = useOpportunities(); const name = useName();
  const soon = Date.now() + 2 * 3600e3; const dayAgo = Date.now() - 864e5;
  const items: { k: string; text: string; mod: string; tone: 'bad' | 'warn' | 'info' }[] = [
    ...fus.filter(f => followStatus(f) === 'atrasado').map(f => ({ k: `fa${f.id}`, text: `Follow-up atrasado: ${f.title}`, mod: 'Follow-ups', tone: 'bad' as const })),
    ...fus.filter(f => followStatus(f) === 'hoje').map(f => ({ k: `fh${f.id}`, text: `Follow-up para hoje: ${f.title}`, mod: 'Follow-ups', tone: 'warn' as const })),
    ...visits.filter(v => v.status === 'agendada' && v.scheduled_for && new Date(v.scheduled_for).getTime() > Date.now() && new Date(v.scheduled_for).getTime() < soon).map(v => ({ k: `v${v.id}`, text: `Visita próxima: ${name(v.company_id)} às ${new Date(v.scheduled_for!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mod: 'Visitas', tone: 'warn' as const })),
    ...opps.filter(o => new Date(o.created_at).getTime() > dayAgo).map(o => ({ k: `o${o.id}`, text: `Nova oportunidade: ${o.title}`, mod: 'CRM', tone: 'info' as const })),
    ...requests.filter(r => r.status === 'pending').map(r => ({ k: `r${r.id}`, text: 'Nova solicitação de produto de cliente', mod: 'Produtos', tone: 'info' as const })),
  ];
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notificações (${items.length})`} className="relative"><Bell />{items.length ? <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span> : null}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-0"><p className="border-b border-border p-3 text-sm font-bold">Notificações</p><div className="max-h-80 overflow-y-auto">{items.length ? items.map(i => <Link key={i.k} to="/painel" search={{ modulo: i.mod }} className="block border-b border-border p-3 text-sm hover:bg-secondary"><Pill tone={i.tone}>{i.mod}</Pill><p className="mt-1">{i.text}</p></Link>) : <p className="p-4 text-sm text-steel">Nenhuma notificação no momento.</p>}</div></PopoverContent></Popover>;
}

type ChatMsg = { role: 'user' | 'assistant'; content: string; action?: string | null };
const MODULES = ['Dashboard', 'Prospecção', 'Empresas', 'Rotas', 'CRM', 'Visitas', 'Follow-ups', 'Produtos', 'Relatórios', 'Assistente IA', 'Configurações'];
export function HubAssistant() {
  const ask = useServerFn(askHub); const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([]); const [text, setText] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const suggestions = ['Qual minha próxima visita?', 'Tenho algum follow-up atrasado?', 'Quais são meus leads?', 'Mostre empresas que ainda não visitei.', 'Quais produtos estão relacionados ao segmento Metalurgia?', 'Como faço para criar uma rota?'];
  async function send(v: string) {
    if (!v.trim() || loading) return; const next: ChatMsg[] = [...messages, { role: 'user', content: v.trim() }]; setMessages(next); setText(''); setLoading(true); setError(null);
    try { const r = await ask({ data: { messages: next.map(m => ({ role: m.role, content: m.content })) } }); setMessages([...next, { role: 'assistant', content: r.content, action: r.action && MODULES.includes(r.action) ? r.action : null }]); }
    catch (e) { setError(e instanceof Error ? e.message : 'O assistente não respondeu.'); } finally { setLoading(false); }
  }
  return <div className="mt-6 max-w-3xl overflow-hidden rounded-md border border-border bg-card">
    <div className="flex items-center gap-3 border-b border-border p-4"><Sparkles className="size-5 text-aqua" /><div><h2 className="font-bold">Assistente Bondmann</h2><p className="text-xs text-steel">Responde com base nos dados que você pode ver na plataforma.</p></div></div>
    <div className="flex h-[55vh] flex-col gap-3 overflow-y-auto p-4" aria-live="polite">{messages.length === 0 ? <div className="my-auto"><p className="text-sm text-steel">Pergunte sobre empresas, visitas, follow-ups, CRM, produtos ou como usar o sistema.</p><div className="mt-4 flex flex-wrap gap-2">{suggestions.map(s => <Button key={s} variant="outline" size="sm" className="h-auto whitespace-normal py-2 text-left" onClick={() => void send(s)}>{s}</Button>)}</div></div> : messages.map((m, i) => <div key={i} className={`max-w-[88%] whitespace-pre-wrap rounded-md px-4 py-3 text-sm ${m.role === 'user' ? 'ml-auto bg-secondary' : 'bg-muted'}`}>{m.content}{m.action ? <div className="mt-2"><Button size="sm" variant="outline" onClick={() => void navigate({ to: '/painel', search: { modulo: m.action! } })}>Abrir {m.action}</Button></div> : null}</div>)}{loading ? <p className="text-sm text-steel">Consultando seus dados…</p> : null}{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>
    <form onSubmit={e => { e.preventDefault(); void send(text); }} className="flex gap-2 border-t border-border p-3"><Input aria-label="Mensagem para o assistente" value={text} onChange={e => setText(e.target.value)} placeholder="Escreva sua pergunta" /><Button type="submit" size="icon" aria-label="Enviar" disabled={loading || !text.trim()} className="size-12"><Send /></Button></form>
  </div>;
}
export { Section };
