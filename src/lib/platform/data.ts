import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Plan=Row<'platform_plans'>;
export type Feature=Row<'platform_features'>;
export type Subscription=Row<'platform_subscriptions'>;
export type Organization=Row<'organizations'>;
export type Member=Row<'organization_members'>;
export type AccountKind='cliente'|'representante'|'proprietario'|'funcionario';
export type Snapshot={accounts:Row<'platform_accounts'>[];organizations:Organization[];members:Member[];subscriptions:Subscription[];events:Row<'platform_events'>[];requests:Row<'product_requests'>[];profiles:{id:string;full_name:string|null;email:string|null;created_at:string}[];access:Record<'representante'|'empresa'|'funcionario',boolean>};
export const KIND_LABELS={cliente:'Cliente',representante:'Representante',proprietario:'Proprietário',funcionario:'Funcionário'};
export const STATUS_LABELS:Record<string,string>={pending:'Pendente',active:'Ativa',expired:'Vencida',cancelled:'Cancelada',rejected:'Recusado',blocked:'Bloqueado',in_progress:'Em atendimento',completed:'Concluída',disabled:'Indisponível',coming_soon:'Em breve',available:'Disponível'};
export const currency=(c:number|null)=>c===null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export const date=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'—';
export const subscriptionStatus=(s:Subscription)=>s.status==='active'&&(!s.valid_until||new Date(s.valid_until)<=new Date())?'expired':s.status;
export const catalogOptions=queryOptions({queryKey:['platform-catalog'],queryFn:async()=>{const [p,f,l]=await Promise.all([supabase.from('platform_plans').select('*').order('price_cents'),supabase.from('platform_features').select('*').order('name'),supabase.from('platform_plan_features').select('*')]);if(p.error||f.error||l.error)throw new Error('Não foi possível consultar os planos.');return {plans:p.data??[],features:f.data??[],links:l.data??[]};}});
export const snapshotOptions=(id:string)=>queryOptions({queryKey:['platform-snapshot',id],queryFn:async()=>{const {data,error}=await supabase.rpc('platform_snapshot');if(error)throw new Error('Não foi possível consultar sua conta.');return data as unknown as Snapshot;}});
export function usePlatform(id?:string){return useQuery({...snapshotOptions(id??''),enabled:Boolean(id)});}
export function usePlatformAction(){const qc=useQueryClient();return useMutation({mutationFn:async({action,payload}:{action:string;payload:Record<string,Json>})=>{const {error}=await supabase.rpc('platform_action',{_action:action,_payload:payload});if(error){const m=error.message;throw new Error(m.includes('member_limit')?'O limite de funcionários do plano foi atingido.':m.includes('active_subscription')?'É necessária uma assinatura ativa.':m.includes('invalid_organization')?'Código da empresa não encontrado.':m.includes('membership_exists')?'Você já possui um vínculo ou solicitação.':'Não foi possível concluir. Confira os dados e tente novamente.');}},onSuccess:async()=>{await qc.invalidateQueries({queryKey:['platform-snapshot']});}});}
export const IMPLEMENTED=new Set(['catalogo','dashboard','segmentos','equipe']);
export const featureReady=(f:Feature)=>f.status==='available'&&Boolean(f.implementation_key)&&IMPLEMENTED.has(f.implementation_key??'');
export function rememberAccess(kind:AccountKind|'admin'){sessionStorage.setItem('bond-access',kind);localStorage.setItem('bond-access-intent',kind);}
export function accessIntent():AccountKind|'admin'|null{const k=sessionStorage.getItem('bond-access')??localStorage.getItem('bond-access-intent');return k==='cliente'||k==='representante'||k==='proprietario'||k==='funcionario'||k==='admin'?k:null;}
