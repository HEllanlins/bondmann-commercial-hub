import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { planAppointments, type Coordinate, type PlannedStop } from './route-planner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
async function authorize(context: Ctx, keys: string[]) {
  for (const key of keys) { const { data } = await context.supabase.rpc('can_use_feature', { _key: key }); if (data) return; }
  throw new Error('Este recurso não está incluído no seu acesso.');
}
function coordinates(p: Coordinate) { return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180; }

/** Owner-scoped cache; shared atomic limiter enforces provider limits across all users. */
async function cached(admin: SupabaseClient<Database>, provider: string, url: string, init: RequestInit, ttl: number) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url + (init.body ?? '')));
  const uid=(await admin.auth.getUser()).data.user?.id; if(!uid)throw new Error('Sessão expirada.');
  const key = uid + ':' + provider + ':' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const { data: hit } = await admin.from('map_service_cache').select('payload').eq('cache_key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (hit) return hit.payload;
  const { data: claimed, error } = await admin.rpc('claim_map_provider', { _provider: provider });
  if (error || !claimed) throw new Error('O serviço público está ocupado. Aguarde alguns segundos e tente novamente.');
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'BondmannCommercialHub/1.0 (+https://bondmann-company.vercel.app)', ...init.headers } });
    if (!res.ok) throw new Error('Serviço público de mapas indisponível. Seu cadastro permanece salvo. Tente novamente mais tarde.');
    const text = await res.text(); if (text.length > 4000000) throw new Error('Área muito extensa. Reduza o raio da pesquisa.');
    const payload = JSON.parse(text) as Json;
    await admin.from('map_service_cache').upsert({ cache_key: key, payload, expires_at: new Date(Date.now() + ttl).toISOString() });
    return payload;
  } finally { /* Atomic shared slots are never released early. */ }
}

type Geo = { lat: string; lon: string; display_name: string };
async function geocode(admin: SupabaseClient<Database>, address: string, base: string) {
  const url = `${base.replace(/\/$/, '')}/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address.trim().toLowerCase())}`;
  const json = await cached(admin, 'nominatim', url, {}, 30 * 86400000) as unknown as Geo[];
  const p = json[0]; return p ? { address: p.display_name, lat: Number(p.lat), lng: Number(p.lon) } : null;
}
export const geocodeAddress = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => { const address = String(input.address ?? '').trim().slice(0, 240); if (address.length < 4) throw new Error('Endereço insuficiente para localizar.'); return { address }; })
  .handler(async ({ data, context }) => {
    await authorize(context, ['clientes', 'prospeccao']);
    const supabaseAdmin = context.supabase;
    return geocode(supabaseAdmin, data.address, process.env['NOMINATIM_URL'] || 'https://nominatim.openstreetmap.org');
  });

export type PlaceResult = { placeId: string; name: string; address: string | null; city: string | null; neighborhood: string | null; state: string | null; phone: string | null; website: string | null; email: string | null; whatsapp: string | null; activity: string | null; lat: number | null; lng: number | null; status: string | null };
type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: {lat: number; lon: number}; tags?: Record<string,string> };
function category(query: string) {
  const q=query.toLowerCase();
  if (/oficin|automotiv|mec.nic/.test(q)) return ['["shop"="car_repair"]','["shop"="car_parts"]'];
  if (/agro|fazend/.test(q)) return ['["shop"="agrarian"]','["landuse"="farmyard"]'];
  if (/metal|usin|ind.str|m.quin/.test(q)) return ['["man_made"="works"]','["industrial"]'];
  if (/transport/.test(q)) return ['["office"="logistics"]','["industrial"="logistics"]'];
  if (/constru|concreto/.test(q)) return ['["shop"="trade"]','["industrial"="concrete"]'];
  if (/limpez|higiene/.test(q)) return ['["shop"="chemistry"]','["office"="company"]'];
  return ['["shop"]','["office"="company"]','["man_made"="works"]'];
}
export const searchPlaces = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((i: {query: string; city?: string; neighborhood?: string; lat?: number|null; lng?: number|null; radiusKm?: number}) => {
  const query=String(i.query??'').trim().slice(0,120); if(query.length<2) throw new Error('Informe uma atividade ou segmento.');
  const point=typeof i.lat==='number'&&typeof i.lng==='number'?{lat:i.lat,lng:i.lng}:null;
  if(point&&!coordinates(point)) throw new Error('Coordenadas inválidas.');
  return {query,city:String(i.city??'').slice(0,80),neighborhood:String(i.neighborhood??'').slice(0,80),point,radiusKm:Math.min(10,Math.max(1,Number(i.radiusKm)||3))};
 })
 .handler(async ({data,context})=>{
  await authorize(context,['prospeccao']);
  const supabaseAdmin=context.supabase;
  let point=data.point;
  if(!point){ const address=[data.neighborhood,data.city].filter(Boolean).join(', '); if(!address) throw new Error('Escolha um ponto no mapa, autorize GPS ou informe a cidade.'); point=await geocode(supabaseAdmin,address,process.env['NOMINATIM_URL']||'https://nominatim.openstreetmap.org'); }
  if(!point) throw new Error('Região não encontrada. Escolha um ponto no mapa.');
  const around=`(around:${data.radiusKm*1000},${point.lat},${point.lng})`;
  const query=`[out:json][timeout:20];(${category(data.query).map(tag=>`nwr${tag}${around};`).join('')});out center tags 100;`;
  const json=await cached(supabaseAdmin,'overpass',process.env['OVERPASS_URL']||'https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(query)}`},3600000) as unknown as {elements?:OsmElement[];remark?:string};
  if(json.remark) throw new Error('A pesquisa excedeu o limite do serviço. Reduza a região e tente novamente.');
  return (json.elements??[]).filter(e=>e.tags?.['name']).slice(0,100).map((e):PlaceResult=>{
    const t=e.tags??{}; const position=e.center??{lat:e.lat,lon:e.lon};
    return {placeId:`osm:${e.type}:${e.id}`,name:t['name']??'',address:[t['addr:street'],t['addr:housenumber'],t['addr:city']].filter(Boolean).join(', ')||null,city:t['addr:city']??null,neighborhood:t['addr:suburb']??null,state:t['addr:state']??null,phone:t['contact:phone']??t['phone']??null,website:t['contact:website']??t['website']??null,email:t['contact:email']??t['email']??null,whatsapp:t['contact:whatsapp']??null,activity:t['industrial']??t['shop']??t['office']??t['man_made']??null,lat:position.lat??null,lng:position.lon??null,status:'Dados colaborativos OpenStreetMap · não verificados'};
  });
 });

export const computeRoute = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((i:{points:Coordinate[];optimize?:boolean;appointments?:PlannedStop[];startSec?:number})=>{
  const points=i.points??[];if(points.length<2||points.length>26||!points.every(coordinates))throw new Error('Informe entre 2 e 26 pontos com localização válida.');
  if(i.appointments && (i.appointments.length!==points.length-1||i.appointments.some(s=>!Number.isFinite(s.durationSec)||s.durationSec<60||s.durationSec>28800||(s.appointmentSec!==null&&!Number.isFinite(s.appointmentSec)))))throw new Error('Compromissos inválidos.');
  return {points,optimize:Boolean(i.optimize),appointments:i.appointments,startSec:Number.isFinite(i.startSec)?Number(i.startSec):0};
 })
 .handler(async ({data,context})=>{
  await authorize(context,['rotas']);const supabaseAdmin=context.supabase;
  const base=(process.env['OSRM_URL']||'https://routing.openstreetmap.de/routed-car').replace(/\/$/,'');
  let points=data.points; let schedule:ReturnType<typeof planAppointments>=[]; let order:number[]|null=null;
  if(data.optimize&&data.appointments){
    const matrix=await cached(supabaseAdmin,'osrm',`${base}/table/v1/driving/${points.map(p=>`${p.lng},${p.lat}`).join(';')}?annotations=duration`,{},300000) as unknown as {code:string;durations:(number|null)[][]};
    if(matrix.code!=='Ok')throw new Error('Não foi possível calcular os deslocamentos entre as visitas.');
    schedule=planAppointments(data.appointments,matrix.durations,data.startSec);
    if(schedule.some(s=>s.conflict&&!Number.isFinite(s.arrivalSec)))throw new Error('Há destinos sem ligação rodoviária. Revise as coordenadas.');
    order=schedule.map(s=>data.appointments?.findIndex(a=>a.id===s.id)??-1);
    const origin=points[0];if(!origin)throw new Error('Origem ausente.');
    points=[origin,...order.flatMap(i=>{const p=data.points[i+1];return p?[p]:[];})];
    // The distributed limiter also applies between table and route calls.
    await new Promise(resolve=>setTimeout(resolve,1200));
  }
  const json=await cached(supabaseAdmin,'osrm',`${base}/route/v1/driving/${points.map(p=>`${p.lng},${p.lat}`).join(';')}?overview=full&geometries=polyline&steps=false`,{},300000) as unknown as {code:string;routes?:{distance:number;duration:number;geometry:string;legs:{distance:number;duration:number}[]}[]};
  const r=json.routes?.[0];if(json.code!=='Ok'||!r)throw new Error('Trajeto rodoviário indisponível para estes pontos.');
  return {distanceMeters:r.distance,durationSec:r.duration,polyline:r.geometry,legs:r.legs.map(l=>({distanceMeters:l.distance,durationSec:l.duration})),order,schedule};
 });
