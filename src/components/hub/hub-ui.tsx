import { useState, type ReactNode, type ComponentProps } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/bond/field';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { COMPANY_STAGES, PRIORITIES, VISIT_RESULTS, logEvent, myId, useCompanies, useInvalidateHub, useSegments, type Company, type Visit } from '@/lib/hub/data';

export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cn('h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground outline-none focus:border-aqua', className)} {...p} />;
}
export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warn' | 'ok' | 'bad' | 'info' }) {
  const t = { default: 'bg-secondary text-foreground', warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', bad: 'bg-destructive/15 text-destructive', info: 'bg-aqua/15 text-aqua' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-steel">{children}{action ? <div className="mt-4">{action}</div> : null}</div>;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-md border border-border bg-card p-5', className)}>{children}</div>;
}
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="mt-8"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{title}</h2>{action}</div>{children}</section>;
}
export function Modal({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}</DialogContent></Dialog>;
}
export function Tabs<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: [K, string, number?][] }) {
  return <div className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1">{items.map(([k, l, n]) => <button key={k} type="button" onClick={() => onChange(k)} className={`whitespace-nowrap rounded px-3 py-2 text-sm font-semibold ${value === k ? 'bg-secondary text-foreground' : 'text-steel hover:text-foreground'}`}>{l}{n !== undefined ? ` (${n})` : ''}</button>)}</div>;
}

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');

export function CompanyForm({ open, onOpenChange, company, initial }: { open: boolean; onOpenChange: (v: boolean) => void; company?: Company; initial?: Partial<Company> }) {
  const { data: segments = [] } = useSegments(); const inv = useInvalidateHub(); const [saving, setSaving] = useState(false);
  const base = company ?? initial ?? {};
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const f = new FormData(e.currentTarget); const v = (k: string) => (String(f.get(k) ?? '').trim() || null);
    const row = { name: v('name') ?? '', trade_name: v('trade_name'), cnpj: v('cnpj'), phone: v('phone'), whatsapp: v('whatsapp'), email: v('email'), website: v('website'), address: v('address'), neighborhood: v('neighborhood'), city: v('city'), state: v('state'), activity: v('activity'), segment_id: v('segment_id'), stage: v('stage') ?? 'prospect', notes: v('notes') };
    try {
      if (!row.name) throw new Error('Informe o nome da empresa.');
      if (company) { const { error } = await supabase.from('companies').update(row).eq('id', company.id); if (error) throw error; await logEvent(company.id, 'edicao', 'Dados da empresa atualizados'); }
      else {
        const seg = segments.find(s => s.id === row.segment_id);
        const { data, error } = await supabase.from('companies').insert({ ...row, owner_id: await myId(), source: initial?.source ?? 'manual', place_id: initial?.place_id ?? null, latitude: initial?.latitude ?? null, longitude: initial?.longitude ?? null, potential: seg?.potential ?? null }).select('id').single();
        if (error) throw error; await logEvent(data.id, 'cadastro', `Empresa cadastrada (origem: ${initial?.source ?? 'manual'})`);
      }
      toast.success('Empresa salva.'); await inv(); onOpenChange(false);
    } catch (err) { fail(err); } finally { setSaving(false); }
  }
  const d = (k: keyof Company) => (base[k] as string | null | undefined) ?? '';
  return <Modal open={open} onOpenChange={onOpenChange} title={company ? 'Editar empresa' : 'Nova empresa'}>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Razão social / nome *"><Input name="name" defaultValue={d('name')} required /></Field>
      <Field label="Nome fantasia"><Input name="trade_name" defaultValue={d('trade_name')} /></Field>
      <Field label="Telefone"><Input name="phone" defaultValue={d('phone')} /></Field>
      <Field label="WhatsApp"><Input name="whatsapp" defaultValue={d('whatsapp')} /></Field>
      <Field label="E-mail"><Input name="email" type="email" defaultValue={d('email')} /></Field>
      <Field label="Website"><Input name="website" defaultValue={d('website')} /></Field>
      <div className="sm:col-span-2"><Field label="Endereço"><Input name="address" defaultValue={d('address')} /></Field></div>
      <Field label="Bairro"><Input name="neighborhood" defaultValue={d('neighborhood')} /></Field>
      <Field label="Cidade"><Input name="city" defaultValue={d('city')} /></Field>
      <Field label="UF"><Input name="state" maxLength={2} defaultValue={d('state')} /></Field>
      <Field label="CNPJ"><Input name="cnpj" defaultValue={d('cnpj')} /></Field>
      <Field label="Atividade"><Input name="activity" defaultValue={d('activity')} /></Field>
      <Field label="Segmento"><Select name="segment_id" defaultValue={d('segment_id')}><option value="">Não definido</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Status"><Select name="stage" defaultValue={d('stage') || 'prospect'}>{Object.entries(COMPANY_STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Field label="Observações"><Textarea name="notes" defaultValue={d('notes')} /></Field></div>
      <Button type="submit" disabled={saving} className="sm:col-span-2">{saving ? 'Salvando…' : 'Salvar empresa'}</Button>
    </form>
  </Modal>;
}

export function VisitForm({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId?: string }) {
  const { data: companies = [] } = useCompanies(); const inv = useInvalidateHub(); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); const f = new FormData(e.currentTarget);
    try {
      const cid = String(f.get('company_id') ?? ''); const date = String(f.get('date')); const time = String(f.get('time') || '09:00');
      if (!cid || !date) throw new Error('Escolha a empresa e a data.');
      const { error } = await supabase.from('visits').insert({ company_id: cid, owner_id: await myId(), scheduled_for: new Date(`${date}T${time}`).toISOString(), status: 'agendada', summary: String(f.get('summary') ?? '') || null });
      if (error) throw error; await logEvent(cid, 'visita', `Visita agendada para ${new Date(`${date}T${time}`).toLocaleString('pt-BR')}`);
      toast.success('Visita agendada.'); await inv(); onOpenChange(false);
    } catch (err) { fail(err); } finally { setSaving(false); }
  }
  return <Modal open={open} onOpenChange={onOpenChange} title="Agendar visita">
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Empresa"><Select name="company_id" defaultValue={companyId ?? ''} required><option value="">Selecione</option>{companies.map(c => <option key={c.id} value={c.id}>{c.trade_name || c.name}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Data"><Input name="date" type="date" required defaultValue={new Date().toLocaleDateString('en-CA')} /></Field><Field label="Horário"><Input name="time" type="time" defaultValue="09:00" /></Field></div>
      <Field label="Objetivo"><Textarea name="summary" /></Field>
      <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Agendar'}</Button>
    </form>
  </Modal>;
}

const RESULT_STAGE: Record<string, { company: string; opp: string | null }> = { interessado: { company: 'negociacao', opp: 'interessado' }, sem_interesse: { company: 'sem_interesse', opp: 'perdido' }, retorno: { company: 'visitado', opp: 'visitado' }, proposta: { company: 'negociacao', opp: 'proposta' }, teste: { company: 'negociacao', opp: 'interessado' }, venda: { company: 'cliente', opp: 'cliente' }, reagendar: { company: 'visitado', opp: null } };

export function VisitResultForm({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  const inv = useInvalidateHub(); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!visit?.company_id) return; setSaving(true); const f = new FormData(e.currentTarget);
    const result = String(f.get('result')); const next = String(f.get('next_step') ?? '').trim(); const fuDate = String(f.get('fu_date') ?? '');
    try {
      const { error } = await supabase.from('visits').update({ status: 'realizada', result, notes: String(f.get('notes') ?? '') || null, next_step: next || null, done_at: new Date().toISOString() }).eq('id', visit.id);
      if (error) throw error;
      const map = RESULT_STAGE[result]!;
      await supabase.from('companies').update({ stage: map.company }).eq('id', visit.company_id);
      if (map.opp) {
        const { data: opp } = await supabase.from('opportunities').select('id').eq('company_id', visit.company_id).not('stage', 'in', '(cliente,perdido)').limit(1).maybeSingle();
        if (opp) await supabase.from('opportunities').update({ stage: map.opp, updated_at: new Date().toISOString() }).eq('id', opp.id);
        else if (result !== 'sem_interesse') await supabase.from('opportunities').insert({ company_id: visit.company_id, owner_id: await myId(), title: 'Oportunidade gerada em visita', stage: map.opp });
      }
      if (next && fuDate) await supabase.from('follow_ups').insert({ company_id: visit.company_id, owner_id: await myId(), title: next, due_at: new Date(`${fuDate}T09:00`).toISOString(), priority: 'media', status: 'pendente' });
      await supabase.from('route_stops').update({ status: 'visitada' }).eq('company_id', visit.company_id).eq('status', 'pendente');
      await logEvent(visit.company_id, 'visita', `Visita realizada — resultado: ${VISIT_RESULTS[result]}${next ? `. Próximo passo: ${next}` : ''}`);
      toast.success('Visita registrada. CRM e follow-ups atualizados.'); await inv(); onClose();
    } catch (err) { fail(err); } finally { setSaving(false); }
  }
  return <Modal open={Boolean(visit)} onOpenChange={v => !v && onClose()} title="Registrar resultado da visita">
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Resultado"><Select name="result" required defaultValue="interessado">{Object.entries(VISIT_RESULTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="Observações"><Textarea name="notes" /></Field>
      <Field label="Próximo passo" hint="Se informar uma data, um follow-up é criado automaticamente."><Input name="next_step" placeholder="Ex.: Enviar proposta" /></Field>
      <Field label="Data do follow-up"><Input name="fu_date" type="date" /></Field>
      <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Registrar visita'}</Button>
    </form>
  </Modal>;
}

export function FollowUpForm({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId?: string }) {
  const { data: companies = [] } = useCompanies(); const inv = useInvalidateHub(); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); const f = new FormData(e.currentTarget);
    try {
      const cid = String(f.get('company_id') ?? '') || null; const date = String(f.get('date')); const time = String(f.get('time') || '09:00');
      const title = String(f.get('title') ?? '').trim(); if (!title || !date) throw new Error('Informe a descrição e a data.');
      const { error } = await supabase.from('follow_ups').insert({ company_id: cid, owner_id: await myId(), title, notes: String(f.get('notes') ?? '') || null, due_at: new Date(`${date}T${time}`).toISOString(), priority: String(f.get('priority')), status: 'pendente' });
      if (error) throw error; if (cid) await logEvent(cid, 'follow-up', `Follow-up criado: ${title}`);
      toast.success('Follow-up criado.'); await inv(); onOpenChange(false);
    } catch (err) { fail(err); } finally { setSaving(false); }
  }
  return <Modal open={open} onOpenChange={onOpenChange} title="Novo follow-up">
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Empresa"><Select name="company_id" defaultValue={companyId ?? ''}><option value="">Sem empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.trade_name || c.name}</option>)}</Select></Field>
      <Field label="Descrição"><Input name="title" required placeholder="Ex.: Ligar para o comprador" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Data"><Input name="date" type="date" required defaultValue={new Date().toLocaleDateString('en-CA')} /></Field><Field label="Horário (opcional)"><Input name="time" type="time" /></Field></div>
      <Field label="Prioridade"><Select name="priority" defaultValue="media">{Object.entries(PRIORITIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="Notas"><Textarea name="notes" /></Field>
      <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Criar follow-up'}</Button>
    </form>
  </Modal>;
}
