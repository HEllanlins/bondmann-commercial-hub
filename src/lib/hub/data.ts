import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type T = Database['public']['Tables'];
export type Company = T['companies']['Row'];
export type Visit = T['visits']['Row'];
export type FollowUp = T['follow_ups']['Row'];
export type Opportunity = T['opportunities']['Row'];
export type Product = T['products']['Row'];
export type Segment = T['segments']['Row'];
export type RouteRow = T['routes']['Row'] & { route_stops: T['route_stops']['Row'][] };

export const COMPANY_STAGES: Record<string, string> = { prospect: 'Prospect', lead: 'Lead', visitado: 'Visitado', negociacao: 'Em negociação', cliente: 'Cliente', cliente_ativo: 'Cliente ativo', sem_interesse: 'Sem interesse', perdido: 'Perdido', inativo: 'Inativo' };
export const PIPELINE: [string, string][] = [['prospect', 'Prospect'], ['contatado', 'Contatado'], ['visitado', 'Visitado'], ['interessado', 'Interessado'], ['proposta', 'Proposta'], ['cliente', 'Cliente'], ['perdido', 'Perdido']];
export const VISIT_RESULTS: Record<string, string> = { interessado: 'Interessado', sem_interesse: 'Sem interesse', retorno: 'Solicitar retorno', proposta: 'Solicitar proposta', teste: 'Teste de produto', venda: 'Venda', reagendar: 'Reagendar' };
export const PRIORITIES: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const AVAILABILITY: Record<string, string> = { disponivel: 'Disponível', baixo_estoque: 'Baixo estoque', indisponivel: 'Indisponível', sob_consulta: 'Sob consulta' };
export const POTENTIAL: Record<string, string> = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };

export const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const brl = (c: number | null) => (c === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100));
export const companyName = (c?: Pick<Company, 'name' | 'trade_name'> | null) => (c ? c.trade_name || c.name : '—');

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export function followStatus(f: FollowUp): 'concluido' | 'cancelado' | 'atrasado' | 'hoje' | 'pendente' {
  if (f.status === 'concluido' || f.done) return 'concluido';
  if (f.status === 'cancelado') return 'cancelado';
  if (!f.due_at) return 'pendente';
  const due = new Date(f.due_at); const today = startOfDay(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (due < today) return 'atrasado';
  if (due < tomorrow) return 'hoje';
  return 'pendente';
}
export const FOLLOW_LABELS = { concluido: 'Concluído', cancelado: 'Cancelado', atrasado: 'Atrasado', hoje: 'Hoje', pendente: 'Pendente' };
export function visitBucket(v: Visit): 'realizada' | 'cancelada' | 'atrasada' | 'hoje' | 'futura' {
  if (v.status === 'realizada') return 'realizada';
  if (v.status === 'cancelada') return 'cancelada';
  if (!v.scheduled_for) return 'futura';
  const d = new Date(v.scheduled_for); const today = startOfDay(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d < today) return 'atrasada';
  if (d < tomorrow) return d < new Date() ? 'atrasada' : 'hoje';
  return 'futura';
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const navUrl = (c: Pick<Company, 'latitude' | 'longitude' | 'address' | 'name'>) =>
  c.latitude !== null && c.longitude !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address || c.name)}`;
export const wazeUrl = (c: Pick<Company, 'latitude' | 'longitude'>) => (c.latitude !== null && c.longitude !== null ? `https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes` : null);

/** Inferência comercial a partir do segmento cadastrado. Nunca é dado confirmado. */
export function inferFor(segment: Segment | undefined, products: Product[]) {
  if (!segment) return null;
  const related = products.filter(p => p.segment_id === segment.id && p.status !== 'inativo');
  return { potential: segment.potential, needs: segment.needs, products: related };
}
export function guessSegment(text: string, segments: Segment[]) {
  const t = text.toLowerCase();
  return segments.find(s => s.slug !== 'outros' && [s.name, ...s.keywords].some(k => t.includes(k.toLowerCase().split(' ')[0]!)));
}

async function q<R>(p: PromiseLike<{ data: R | null; error: { message: string } | null }>) { const { data, error } = await p; if (error) throw new Error(error.message); return (data ?? []) as R; }

export const useCompanies = () => useQuery({ queryKey: ['hub', 'companies'], queryFn: () => q<Company[]>(supabase.from('companies').select('*').order('updated_at', { ascending: false })) });
export const useVisits = () => useQuery({ queryKey: ['hub', 'visits'], queryFn: () => q<Visit[]>(supabase.from('visits').select('*').order('scheduled_for')) });
export const useFollowUps = () => useQuery({ queryKey: ['hub', 'follow_ups'], queryFn: () => q<FollowUp[]>(supabase.from('follow_ups').select('*').order('due_at')) });
export const useOpportunities = () => useQuery({ queryKey: ['hub', 'opportunities'], queryFn: () => q<Opportunity[]>(supabase.from('opportunities').select('*').order('updated_at', { ascending: false })) });
export const useProducts = () => useQuery({ queryKey: ['hub', 'products'], queryFn: () => q<Product[]>(supabase.from('products').select('*').order('name')) });
export const useSegments = () => useQuery({ queryKey: ['hub', 'segments'], queryFn: () => q<Segment[]>(supabase.from('segments').select('*').order('sort_order')) });
export const useRoutes = () => useQuery({ queryKey: ['hub', 'routes'], queryFn: () => q<RouteRow[]>(supabase.from('routes').select('*, route_stops(*)').order('route_date', { ascending: false }).limit(20)) });
export const useRequests = () => useQuery({ queryKey: ['hub', 'requests'], queryFn: () => q<T['product_requests']['Row'][]>(supabase.from('product_requests').select('*').order('created_at', { ascending: false })) });

export function useInvalidateHub() { const qc = useQueryClient(); return () => qc.invalidateQueries({ queryKey: ['hub'] }); }

export async function logEvent(companyId: string, kind: string, description: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('company_events').insert({ company_id: companyId, owner_id: data.user.id, kind, description });
}
export async function myId() { const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error('Sessão expirada.'); return data.user.id; }

/** Garante a rota de hoje e adiciona a empresa como parada. */
export async function addToTodayRoute(companyId: string) {
  const uid = await myId();
  const today = new Date().toLocaleDateString('en-CA');
  let { data: route } = await supabase.from('routes').select('id, route_stops(id,company_id,position)').eq('owner_id', uid).eq('route_date', today).maybeSingle();
  if (!route) {
    const ins = await supabase.from('routes').insert({ owner_id: uid, route_date: today, name: 'Minha rota de hoje' }).select('id, route_stops(id,company_id,position)').single();
    if (ins.error) throw new Error(ins.error.message);
    route = ins.data;
  }
  if (route.route_stops.some(s => s.company_id === companyId)) return 'exists';
  const pos = route.route_stops.reduce((m, s) => Math.max(m, s.position), -1) + 1;
  const { error } = await supabase.from('route_stops').insert({ route_id: route.id, company_id: companyId, position: pos });
  if (error) throw new Error(error.message);
  await logEvent(companyId, 'rota', 'Adicionada à rota de hoje');
  return 'added';
}
