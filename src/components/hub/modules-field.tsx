import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Building2, CalendarDays, Clock3, Handshake, LocateFixed, MapPin, Navigation, Plus, Route as RouteIcon, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/bond/field';
import { supabase } from '@/integrations/supabase/client';
import { HubMap } from './hub-map';
import { sameProspect } from '@/lib/hub/route-planner';
import { Card, CompanyForm, Empty, Pill, Section, Select, Tabs } from './hub-ui';
import { searchPlaces, type PlaceResult } from '@/lib/hub/maps.functions';
import { COMPANY_STAGES, POTENTIAL, addToTodayRoute, brl, companyName, distanceKm, followStatus, fmtDate, guessSegment, inferFor, navUrl, visitBucket, wazeUrl, useCompanies, useFollowUps, useInvalidateHub, useOpportunities, useProducts, useRoutes, useSegments, useVisits, type Company } from '@/lib/hub/data';

const ModLink = ({ m, children }: { m: string; children: React.ReactNode }) => <Link to="/painel" search={{ modulo: m }} className="text-xs font-semibold text-aqua">{children}</Link>;

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string | undefined }) {
  return <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-steel">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p>{hint ? <p className="mt-1 text-[11px] text-steel">{hint}</p> : null}</div>;
}

export function Dashboard() {
  const c = useCompanies(), v = useVisits(), f = useFollowUps(), o = useOpportunities();
  if (c.isLoading || v.isLoading || f.isLoading || o.isLoading) return <p className="mt-8 text-sm text-steel">Carregando indicadores…</p>;
  const cs = c.data ?? [], vs = v.data ?? [], fs = f.data ?? [], os = o.data ?? [];
  const visited = new Set(vs.filter(x => x.status === 'realizada').map(x => x.company_id));
  const vb = vs.map(visitBucket), fb = fs.map(followStatus);
  const count = <T,>(a: T[], x: T) => a.filter(y => y === x).length;
  const openOpps = os.filter(x => !['cliente', 'perdido'].includes(x.stage));
  const potential = openOpps.reduce((s, x) => s + (x.value_cents ?? 0), 0);
  const weekAgo = Date.now() - 7 * 864e5;
  const groups: [string, string, [string, number | string, string?][]][] = [
    ['Prospecção', 'Prospecção', [['Empresas encontradas e salvas', cs.filter(x => ['google_maps', 'openstreetmap'].includes(x.source)).length], ['Novos leads (7 dias)', cs.filter(x => new Date(x.created_at).getTime() > weekAgo).length], ['Empresas selecionadas', cs.filter(x => x.stage !== 'prospect').length], ['Ainda não visitadas', cs.filter(x => !visited.has(x.id)).length]]],
    ['Visitas', 'Visitas', [['Hoje', count(vb, 'hoje')], ['Futuras', count(vb, 'futura')], ['Realizadas', count(vb, 'realizada')], ['Atrasadas', count(vb, 'atrasada')]]],
    ['CRM', 'CRM', [['Leads ativos', cs.filter(x => ['lead', 'visitado'].includes(x.stage)).length], ['Em negociação', cs.filter(x => x.stage === 'negociacao').length], ['Clientes conquistados', cs.filter(x => ['cliente', 'cliente_ativo'].includes(x.stage)).length], ['Perdidos', cs.filter(x => ['perdido', 'sem_interesse'].includes(x.stage)).length]]],
    ['Follow-ups', 'Follow-ups', [['Para hoje', count(fb, 'hoje')], ['Atrasados', count(fb, 'atrasado')], ['Próximos', count(fb, 'pendente')], ['Concluídos', count(fb, 'concluido')]]],
    ['Comercial', 'CRM', [['Oportunidades abertas', openOpps.length], ['Propostas', os.filter(x => x.stage === 'proposta').length], ['Vendas', os.filter(x => x.stage === 'cliente').length], ['Valor potencial', brl(potential), 'Soma das oportunidades abertas'], ['Clientes ativos', cs.filter(x => x.stage === 'cliente_ativo').length]]],
  ];
  const today = vs.filter(x => visitBucket(x) === 'hoje'); const late = fs.filter(x => followStatus(x) === 'atrasado');
  const name = (id: string | null) => companyName(cs.find(x => x.id === id));
  return <>
    {cs.length === 0 ? <div className="mt-8"><Empty action={<Button asChild><Link to="/painel" search={{ modulo: 'Prospecção' }}><Search /> Começar prospecção</Link></Button>}>Você ainda não possui empresas cadastradas. Os indicadores serão preenchidos conforme você usar os módulos.</Empty></div> : null}
    {groups.map(([title, mod, stats]) => <Section key={title} title={title} action={<ModLink m={mod}>Abrir {mod}</ModLink>}><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{stats.map(([l, val, h]) => <Stat key={l} label={l} value={val} hint={h} />)}</div></Section>)}
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <Card><h3 className="font-bold">Visitas de hoje</h3>{today.length ? <ul className="mt-3 space-y-2 text-sm">{today.map(x => <li key={x.id} className="flex justify-between gap-2"><span>{name(x.company_id)}</span><span className="text-steel">{fmtDate(x.scheduled_for)}</span></li>)}</ul> : <p className="mt-3 text-sm text-steel">Você não possui visitas para hoje.</p>}</Card>
      <Card><h3 className="font-bold">Follow-ups atrasados</h3>{late.length ? <ul className="mt-3 space-y-2 text-sm">{late.map(x => <li key={x.id} className="flex justify-between gap-2"><span>{x.title} · {name(x.company_id)}</span><span className="text-destructive">{fmtDate(x.due_at)}</span></li>)}</ul> : <p className="mt-3 text-sm text-steel">Nenhum follow-up atrasado.</p>}</Card>
    </div>
  </>;
}

function Inference({ segmentId, text }: { segmentId?: string | null; text?: string }) {
  const { data: segments = [] } = useSegments(); const { data: products = [] } = useProducts();
  const seg = segments.find(s => s.id === segmentId) ?? (text ? guessSegment(text, segments) : undefined);
  const inf = inferFor(seg, products);
  if (!inf || !seg) return <p className="text-xs text-steel">Sem segmento identificado para inferência.</p>;
  return <div className="rounded-md border border-dashed border-aqua/40 bg-aqua/5 p-3 text-xs">
    <p className="font-bold text-aqua">Inferência comercial · não confirmado</p>
    <p className="mt-1">Segmento provável: <b>{seg.name}</b> · Potencial: <b>{POTENTIAL[inf.potential] ?? inf.potential}</b></p>
    {inf.needs.length ? <p className="mt-1">Possíveis necessidades: {inf.needs.join(', ')}</p> : null}
    <p className="mt-1">Produtos possivelmente relacionados: {inf.products.length ? inf.products.map(p => p.name).join(', ') : 'nenhum produto do catálogo cadastrado para este segmento'}</p>
  </div>;
}
export { Inference };

const NF = <span className="italic text-steel/70">não encontrado</span>;

export function Prospeccao() {
  const search = useServerFn(searchPlaces); const { data: segments = [] } = useSegments(); const { data: companies = [] } = useCompanies(); const inv = useInvalidateHub();
  const [form, setForm] = useState({ query: '', segment: '', city: '', neighborhood: '', radiusKm: 3 });
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<PlaceResult[] | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [view, setView] = useState<'lista' | 'mapa'>('lista');
  const saved = useMemo(() => new Map(companies.filter(c => c.place_id).map(c => [String(c.place_id), c])), [companies]);
  function locate() { if (!navigator.geolocation) return void toast.error('Localização indisponível neste dispositivo.'); navigator.geolocation.getCurrentPosition(p => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success('Localização atual definida como referência.'); }, () => toast.error('Permissão de localização negada.')); }
  async function run(e: React.FormEvent) {
    e.preventDefault(); const seg = segments.find(s => s.id === form.segment);
    const query = [form.query, seg ? (seg.keywords[0] ?? seg.name) : ''].filter(Boolean).join(' ');
    if (!query.trim()) return void toast.error('Informe uma palavra-chave ou um segmento.');
    setLoading(true); setError(null);
    try { setResults(await search({ data: { query, city: form.city, neighborhood: form.neighborhood, lat: origin?.lat ?? null, lng: origin?.lng ?? null, radiusKm: form.radiusKm } })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha na busca.'); } finally { setLoading(false); }
  }
  async function save(p: PlaceResult, route = false) {
    let c = saved.get(p.placeId) ?? companies.find(c => sameProspect(c, { name: p.name, address: p.address, place_id: p.placeId }));
    if (!c) {
      const seg = segments.find(s => s.id === form.segment) ?? guessSegment(`${p.name} ${p.activity ?? ''}`, segments);
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      const { data, error } = await supabase.from('companies').insert({ name: p.name, address: p.address, city: p.city, neighborhood: p.neighborhood, state: p.state, phone: p.phone, email: p.email, whatsapp: p.whatsapp, website: p.website, activity: p.activity, latitude: p.lat, longitude: p.lng, place_id: p.placeId, source: 'openstreetmap', segment_id: seg?.id ?? null, potential: seg?.potential ?? null, stage: 'prospect', owner_id: u.user.id }).select('*').single();
      if (error) return void toast.error(error.message);
      c = data; await supabase.from('company_events').insert({ company_id: c.id, owner_id: u.user.id, kind: 'cadastro', description: 'Adicionada pela Prospecção (fonte: OpenStreetMap)' });
      toast.success('Empresa adicionada à prospecção.');
    }
    if (route) { const r = await addToTodayRoute(c.id); toast.success(r === 'exists' ? 'A empresa já está na rota de hoje.' : 'Adicionada à rota de hoje.'); }
    await inv();
  }
  const withDist = (results ?? []).map(p => ({ ...p, dist: origin && p.lat !== null && p.lng !== null ? distanceKm(origin, { lat: p.lat, lng: p.lng }) : null }));
  const points = withDist.filter(p => p.lat !== null && p.lng !== null).map((p, i) => ({ id: p.placeId, lat: Number(p.lat), lng: Number(p.lng), title: p.name, label: String(i + 1), html: `${p.name} — ${p.address ?? 'endereço não encontrado'}` }));
  return <div className="mt-6">
    <form onSubmit={run} className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-6">
      <div className="md:col-span-2"><Field label="Palavra-chave / atividade"><Input value={form.query} onChange={e => setForm({ ...form, query: e.target.value })} placeholder="Ex.: oficina mecânica, metalúrgica" /></Field></div>
      <Field label="Segmento"><Select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}><option value="">Todos</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Cidade / região"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Brasília" /></Field>
      <Field label="Bairro"><Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} /></Field>
      <Field label="Raio (km)"><Input type="number" min={1} max={10} value={form.radiusKm} onChange={e => setForm({ ...form, radiusKm: Number(e.target.value) })} /></Field>
      <div className="flex flex-wrap gap-2 md:col-span-6"><Button type="submit" disabled={loading}><Search /> {loading ? 'Buscando…' : 'Buscar empresas'}</Button><Button type="button" variant="outline" onClick={locate}><LocateFixed /> {origin ? 'Localização definida' : 'Usar minha localização'}</Button><span className="self-center text-xs text-steel">Fonte: OpenStreetMap · até 100 resultados · cobertura colaborativa.</span></div>
    </form>
    {error ? <div className="mt-4 rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div> : null}
    {results === null ? <div className="mt-6"><Empty>Faça uma busca para encontrar potenciais clientes. Exemplos: "oficinas" em Brasília, "metalúrgica" no segmento Metalurgia.</Empty></div> : results.length === 0 ? <div className="mt-6"><Empty>Nenhuma empresa encontrada para esta busca.</Empty></div> : <>
      <div className="mt-4 lg:hidden"><Tabs value={view} onChange={setView} items={[['lista', 'Lista', results.length], ['mapa', 'Mapa']]} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className={`${view === 'mapa' ? 'hidden lg:block' : ''} space-y-3`}>{withDist.map((p, i) => { const s = saved.get(p.placeId); return <div key={p.placeId} className={`rounded-md border bg-card p-4 ${selected === p.placeId ? 'border-aqua' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{i + 1}. {p.name}</p><p className="text-xs text-steel">{p.activity ?? 'Atividade não informada'}</p></div>{s ? <Pill tone="ok">Salva</Pill> : <Pill tone="info">OpenStreetMap</Pill>}</div>
          <dl className="mt-2 grid gap-1 text-sm"><div><MapPin className="inline size-3" /> {p.address ?? NF}</div><div>Bairro: {p.neighborhood ?? NF} · Cidade: {p.city ?? NF}</div><div>Telefone: {p.phone ?? NF} · WhatsApp: {p.whatsapp ?? NF} · E-mail: {p.email ?? NF}</div><div>Website: {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-aqua underline">{p.website.replace(/^https?:\/\//, '').slice(0, 40)}</a> : NF}</div>
            <div>{p.dist !== null ? <>📍 {p.dist.toFixed(1).replace('.', ',')} km em linha reta (estimativa)</> : <span className="text-steel">Distância: defina sua localização</span>}</div></dl>
          <div className="mt-3"><Inference text={`${p.name} ${p.activity ?? ''} ${form.query}`} segmentId={form.segment || null} /></div>
          <div className="mt-3 flex flex-wrap gap-2">{s ? <Button asChild size="sm" variant="outline"><Link to="/empresas/$id" params={{ id: s.id }}>Ver empresa</Link></Button> : <Button size="sm" variant="outline" onClick={() => void save(p)}><Plus /> Adicionar à prospecção</Button>}<Button size="sm" onClick={() => void save(p, true)}><RouteIcon /> Adicionar à rota</Button></div>
        </div>; })}</div>
        <div className={`${view === 'lista' ? 'hidden lg:block' : ''}`}><div className="lg:sticky lg:top-4"><HubMap points={points} onSelect={setSelected} onPick={setOrigin} livePosition={origin} className="h-[70vh]" /></div></div>
      </div></>}
  </div>;
}

export function Empresas() {
  const { data: companies = [], isLoading } = useCompanies(); const { data: segments = [] } = useSegments();
  const [q, setQ] = useState(''); const [stage, setStage] = useState(''); const [seg, setSeg] = useState(''); const [open, setOpen] = useState(false);
  const list = companies.filter(c => (!stage || c.stage === stage) && (!seg || c.segment_id === seg) && (!q || `${c.name} ${c.trade_name ?? ''} ${c.city ?? ''} ${c.neighborhood ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return <div className="mt-6">
    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"><Input placeholder="Buscar por nome, cidade ou bairro" value={q} onChange={e => setQ(e.target.value)} /><Select value={stage} onChange={e => setStage(e.target.value)}><option value="">Todos os status</option>{Object.entries(COMPANY_STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select><Select value={seg} onChange={e => setSeg(e.target.value)}><option value="">Todos os segmentos</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Button onClick={() => setOpen(true)} className="h-12"><Plus /> Nova empresa</Button></div>
    <div className="mt-5">{isLoading ? <p className="text-sm text-steel">Carregando…</p> : list.length === 0 ? <Empty>{companies.length ? 'Nenhuma empresa corresponde aos filtros.' : 'Você ainda não possui empresas cadastradas. Use a Prospecção ou cadastre manualmente.'}</Empty> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(c => <Link key={c.id} to="/empresas/$id" params={{ id: c.id }} className="rounded-md border border-border bg-card p-4 transition hover:border-aqua"><div className="flex items-start justify-between gap-2"><p className="font-bold">{companyName(c)}</p><Pill>{COMPANY_STAGES[c.stage] ?? c.stage}</Pill></div><p className="mt-1 text-xs text-steel">{segments.find(s => s.id === c.segment_id)?.name ?? 'Sem segmento'} · {[c.neighborhood, c.city].filter(Boolean).join(', ') || 'Localização não cadastrada'}</p><p className="mt-2 text-xs text-steel">Origem: {c.source === 'openstreetmap' ? 'Prospecção (OpenStreetMap)' : c.source === 'google_maps' ? 'Prospecção (fonte anterior)' : 'Cadastro manual'}</p></Link>)}</div>}</div>
    <CompanyForm open={open} onOpenChange={setOpen} />
  </div>;
}

export { CommercialRoutes as Rotas } from './commercial-routes';

export const HubIcons = { Building2, CalendarDays, Clock3, Handshake };
export type { Company };
