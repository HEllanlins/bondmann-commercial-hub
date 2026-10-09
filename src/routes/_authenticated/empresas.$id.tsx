import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Clock3, Globe, Mail, MapPin, MessageCircle, Navigation, Pencil, Phone, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/bond/field';
import { supabase } from '@/integrations/supabase/client';
import { fetchAccess } from '@/lib/auth/use-auth';
import { isStaffRole } from '@/lib/auth/roles';
import { HubMap } from '@/components/hub/hub-map';
import { Card, CompanyForm, Empty, FollowUpForm, Pill, Select, VisitForm } from '@/components/hub/hub-ui';
import { Inference } from '@/components/hub/modules-field';
import { geocodeAddress } from '@/lib/hub/maps.functions';
import { COMPANY_STAGES, PIPELINE, VISIT_RESULTS, addToTodayRoute, brl, companyName, followStatus, FOLLOW_LABELS, fmtDate, logEvent, navUrl, useCompanies, useFollowUps, useInvalidateHub, useOpportunities, useSegments, useVisits } from '@/lib/hub/data';

export const Route = createFileRoute('/_authenticated/empresas/$id')({
  beforeLoad: async ({ context }) => { const a = await fetchAccess(context.user.id); if (!isStaffRole(a.role)) throw redirect({ to: '/cliente' }); },
  head: () => ({ meta: [{ title: 'Empresa — Bondmann Commercial Hub' }, { name: 'description', content: 'Ficha completa da empresa no Hub Comercial Bondmann.' }, { property: 'og:title', content: 'Empresa — Bondmann Commercial Hub' }, { property: 'og:description', content: 'Ficha completa da empresa no Hub Comercial Bondmann.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const { id } = Route.useParams();
  const { data: companies = [], isLoading } = useCompanies(); const { data: segments = [] } = useSegments(); const { data: visits = [] } = useVisits(); const { data: fus = [] } = useFollowUps(); const { data: opps = [] } = useOpportunities();
  const events = useQuery({ queryKey: ['hub', 'events', id], queryFn: async () => (await supabase.from('company_events').select('*').eq('company_id', id).order('created_at', { ascending: false })).data ?? [] });
  const inv = useInvalidateHub(); const geocode = useServerFn(geocodeAddress);
  const [edit, setEdit] = useState(false); const [visit, setVisit] = useState(false); const [fu, setFu] = useState(false); const [note, setNote] = useState(''); const [locating, setLocating] = useState(false);
  const c = companies.find(x => x.id === id);
  if (isLoading) return <Shell><p className="text-sm text-steel">Carregando…</p></Shell>;
  if (!c) return <Shell><Empty>Empresa não encontrada ou sem permissão de acesso.</Empty></Shell>;
  const seg = segments.find(s => s.id === c.segment_id);
  async function setStage(stage: string) { await supabase.from('companies').update({ stage }).eq('id', id); await logEvent(id, 'status', `Status alterado para ${COMPANY_STAGES[stage]}`); await inv(); toast.success('Status atualizado.'); }
  async function addNote() { if (!note.trim()) return; await logEvent(id, 'observacao', note.trim()); setNote(''); await inv(); toast.success('Observação adicionada.'); }
  async function locate() {
    const addr = [c!.address, c!.neighborhood, c!.city, c!.state].filter(Boolean).join(', ');
    if (!addr) return toast.error('O cadastro não possui endereço para localizar.');
    setLocating(true);
    try { const r = await geocode({ data: { address: addr } }); if (!r) toast.error('Não consegui confirmar a localização.'); else { await supabase.from('companies').update({ latitude: r.lat, longitude: r.lng }).eq('id', id); await logEvent(id, 'localizacao', `Localização identificada: ${r.address}`); await inv(); toast.success('Localização encontrada.'); } }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Falha'); } finally { setLocating(false); }
  }
  const nf = <span className="italic text-steel/70">não cadastrado</span>;
  const timeline = [
    ...(events.data ?? []).map(e => ({ at: e.created_at, kind: e.kind, text: e.description })),
    ...visits.filter(v => v.company_id === id).map(v => ({ at: v.done_at ?? v.scheduled_for ?? v.created_at, kind: 'visita', text: v.status === 'realizada' ? `Visita realizada${v.result ? ` — ${VISIT_RESULTS[v.result]}` : ''}` : `Visita ${v.status} para ${fmtDate(v.scheduled_for)}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return <Shell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{companyName(c)}</h1>{c.trade_name ? <p className="text-sm text-steel">{c.name}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><Pill tone="info">{seg?.name ?? 'Sem segmento'}</Pill><Pill>{COMPANY_STAGES[c.stage] ?? c.stage}</Pill><span className="text-steel"><MapPin className="inline size-3" /> {[c.neighborhood, c.city, c.state].filter(Boolean).join(', ') || 'Localização não cadastrada'}</span></div><p className="mt-1 text-xs text-steel">Origem: {c.source === 'google_maps' ? 'Prospecção (Google Maps)' : 'Cadastro manual'}</p></div>
      <Select value={c.stage} onChange={e => void setStage(e.target.value)} className="w-48" aria-label="Alterar status">{Object.entries(COMPANY_STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      <Button onClick={async () => { const r = await addToTodayRoute(id); await inv(); toast.success(r === 'exists' ? 'Já está na rota de hoje.' : 'Adicionada à rota de hoje.'); }}><RouteIcon /> Adicionar à rota</Button>
      <Button variant="outline" onClick={() => setVisit(true)}><CalendarDays /> Registrar visita</Button>
      <Button variant="outline" onClick={() => setFu(true)}><Clock3 /> Criar follow-up</Button>
      <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Editar empresa</Button>
      <Button asChild variant="outline"><a href={navUrl(c)} target="_blank" rel="noreferrer"><Navigation /> Abrir navegação</a></Button>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card><h2 className="font-bold">Dados confirmados no cadastro</h2><dl className="mt-3 space-y-2 text-sm">
        <div><Phone className="inline size-4 text-aqua" /> {c.phone ? <a href={`tel:${c.phone}`} className="underline">{c.phone}</a> : nf}</div>
        <div><MessageCircle className="inline size-4 text-aqua" /> {c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="underline">{c.whatsapp}</a> : nf}</div>
        <div><Mail className="inline size-4 text-aqua" /> {c.email ? <a href={`mailto:${c.email}`} className="underline">{c.email}</a> : nf}</div>
        <div><Globe className="inline size-4 text-aqua" /> {c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="underline">{c.website}</a> : nf}</div>
        <div><MapPin className="inline size-4 text-aqua" /> {c.address ?? nf}</div>
        <div>Atividade: {c.activity ?? nf} · CNPJ: {c.cnpj ?? nf}</div>
        {c.notes ? <p className="text-steel">{c.notes}</p> : null}
      </dl><div className="mt-4"><Inference segmentId={c.segment_id} text={`${c.name} ${c.activity ?? ''}`} /></div></Card>
      <div>{c.latitude !== null && c.longitude !== null ? <HubMap points={[{ id: c.id, lat: c.latitude, lng: c.longitude, title: companyName(c) }]} className="h-72" /> : <Empty action={<Button size="sm" onClick={() => void locate()} disabled={locating}>{locating ? 'Procurando…' : 'Localizar pelo endereço'}</Button>}>Sem localização no mapa. É possível tentar identificar pelo endereço cadastrado.</Empty>}</div>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-3">
      <Card><h2 className="font-bold">Oportunidades</h2>{opps.filter(o => o.company_id === id).map(o => <p key={o.id} className="mt-2 text-sm">{o.title} · <b>{PIPELINE.find(p => p[0] === o.stage)?.[1]}</b> · {brl(o.value_cents)}</p>)}{!opps.some(o => o.company_id === id) ? <p className="mt-2 text-sm text-steel">Nenhuma oportunidade. <Link to="/painel" search={{ modulo: 'CRM' }} className="text-aqua">Criar no CRM</Link></p> : null}</Card>
      <Card><h2 className="font-bold">Follow-ups</h2>{fus.filter(f => f.company_id === id).map(f => <p key={f.id} className="mt-2 text-sm">{f.title} · {fmtDate(f.due_at)} · <b>{FOLLOW_LABELS[followStatus(f)]}</b></p>)}{!fus.some(f => f.company_id === id) ? <p className="mt-2 text-sm text-steel">Nenhum follow-up.</p> : null}</Card>
      <Card><h2 className="font-bold">Adicionar observação</h2><Textarea value={note} onChange={e => setNote(e.target.value)} className="mt-2 min-h-20" placeholder="Ex.: Comprador pediu retorno em 15 dias." /><Button size="sm" className="mt-2" onClick={() => void addNote()} disabled={!note.trim()}>Salvar observação</Button></Card>
    </div>
    <Card className="mt-6"><h2 className="font-bold">Histórico</h2>{timeline.length ? <ol className="mt-3 space-y-3 border-l border-border pl-4">{timeline.map((t, i) => <li key={i} className="text-sm"><p className="text-xs text-steel">{fmtDate(t.at)} · {t.kind}</p><p>{t.text}</p></li>)}</ol> : <p className="mt-2 text-sm text-steel">Sem registros ainda.</p>}</Card>
    <CompanyForm open={edit} onOpenChange={setEdit} company={c} /><VisitForm open={visit} onOpenChange={setVisit} companyId={id} /><FollowUpForm open={fu} onOpenChange={setFu} companyId={id} />
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background"><header className="flex h-16 items-center border-b border-border px-5 lg:px-10"><Link to="/painel" search={{ modulo: 'Empresas' }} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" /> Voltar para Empresas</Link></header><main className="mx-auto max-w-6xl px-5 py-8 lg:px-10">{children}</main></div>;
}
