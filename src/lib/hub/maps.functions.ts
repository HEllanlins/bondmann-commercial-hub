import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';

type Ctx = { supabase: { rpc: (fn: 'can_use_feature', args: { _key: string }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function ensureStaff(context: Ctx) {
  for (const k of ['prospeccao', 'mapas', 'rotas', 'clientes']) { const { data } = await context.supabase.rpc('can_use_feature', { _key: k }); if (data) return; }
  throw new Error('Os recursos de mapas não estão incluídos no seu plano.');
}

/** Na Lovable usa o gateway gerenciado; fora dela (Vercel) usa GOOGLE_MAPS_SERVER_KEY direto no Google. */
async function gateway(path: string, init: RequestInit & { fieldMask?: string }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.fieldMask) headers['X-Goog-FieldMask'] = init.fieldMask;
  const own = process.env['GOOGLE_MAPS_SERVER_KEY'];
  let url: string;
  if (own) {
    const m = path.match(/^\/(places|routes)\/(.*)$/);
    if (m) { url = `https://${m[1]}.googleapis.com/${m[2]}`; headers['X-Goog-Api-Key'] = own; }
    else url = `https://maps.googleapis.com${path}${path.includes('?') ? '&' : '?'}key=${own}`;
  } else {
    const lovable = process.env['LOVABLE_API_KEY'];
    const maps = process.env['GOOGLE_MAPS_API_KEY'];
    if (!lovable || !maps) throw new Error('Integração de mapas não configurada. Defina GOOGLE_MAPS_SERVER_KEY.');
    headers['Authorization'] = `Bearer ${lovable}`; headers['X-Connection-Api-Key'] = maps;
    url = `${GATEWAY_URL}${path}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Maps [${res.status}]: ${body}`);
    if (res.status === 403) throw new Error('O Google recusou a solicitação (403). Verifique se Places, Geocoding e Routes estão ativados na chave.');
    throw new Error(`Serviço de mapas indisponível [${res.status}].`);
  }
  return res.json();
}

export type PlaceResult = {
  placeId: string; name: string; address: string | null; city: string | null; neighborhood: string | null; state: string | null;
  phone: string | null; website: string | null; activity: string | null; lat: number | null; lng: number | null; status: string | null;
};

type RawPlace = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string; websiteUri?: string; primaryTypeDisplayName?: { text?: string }; businessStatus?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

export const searchPlaces = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; city?: string; neighborhood?: string; lat?: number | null; lng?: number | null; radiusKm?: number }) => {
    const query = String(input.query ?? '').trim().slice(0, 160);
    if (query.length < 2) throw new Error('Informe o que deseja procurar.');
    const radiusKm = Math.min(Math.max(Number(input.radiusKm) || 10, 1), 50);
    return { query, city: input.city?.slice(0, 80) ?? '', neighborhood: input.neighborhood?.slice(0, 80) ?? '', lat: typeof input.lat === 'number' ? input.lat : null, lng: typeof input.lng === 'number' ? input.lng : null, radiusKm };
  })
  .handler(async ({ data, context }) => {
    await ensureStaff(context as unknown as Ctx);
    const textQuery = [data.query, data.neighborhood, data.city].filter(Boolean).join(' em ');
    const body: Record<string, unknown> = { textQuery, pageSize: 20, languageCode: 'pt-BR', regionCode: 'BR' };
    if (data.lat !== null && data.lng !== null) body['locationBias'] = { circle: { center: { latitude: data.lat, longitude: data.lng }, radius: data.radiusKm * 1000 } };
    const json = (await gateway('/places/v1/places:searchText', {
      method: 'POST', body: JSON.stringify(body),
      fieldMask: 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.businessStatus,places.addressComponents',
    })) as { places?: RawPlace[] };
    const find = (p: RawPlace, t: string) => p.addressComponents?.find(c => c.types?.includes(t))?.longText ?? null;
    return (json.places ?? []).map((p): PlaceResult => ({
      placeId: p.id, name: p.displayName?.text ?? 'Sem nome', address: p.formattedAddress ?? null,
      city: find(p, 'administrative_area_level_2') ?? find(p, 'locality'), neighborhood: find(p, 'sublocality_level_1') ?? find(p, 'sublocality'),
      state: p.addressComponents?.find(c => c.types?.includes('administrative_area_level_1'))?.shortText ?? null,
      phone: p.nationalPhoneNumber ?? null, website: p.websiteUri ?? null, activity: p.primaryTypeDisplayName?.text ?? null,
      lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, status: p.businessStatus ?? null,
    }));
  });

export const geocodeAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => {
    const address = String(input.address ?? '').trim().slice(0, 240);
    if (address.length < 4) throw new Error('Endereço insuficiente para localizar.');
    return { address };
  })
  .handler(async ({ data, context }) => {
    await ensureStaff(context as unknown as Ctx);
    const json = (await gateway(`/maps/api/geocode/json?region=br&language=pt-BR&address=${encodeURIComponent(data.address)}`, { method: 'GET' })) as { status: string; results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
    const r = json.results?.[0];
    if (json.status !== 'OK' || !r) return null;
    return { address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng };
  });

export const computeRoute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { points: { lat: number; lng: number }[] }) => {
    const points = (input.points ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).slice(0, 25);
    if (points.length < 2) throw new Error('São necessários pelo menos dois pontos com localização.');
    return { points };
  })
  .handler(async ({ data, context }) => {
    await ensureStaff(context as unknown as Ctx);
    const wp = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const pts = data.points;
    const json = (await gateway('/routes/directions/v2:computeRoutes', {
      method: 'POST',
      fieldMask: 'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.polyline.encodedPolyline',
      body: JSON.stringify({ origin: wp(pts[0]!), destination: wp(pts[pts.length - 1]!), intermediates: pts.slice(1, -1).map(wp), travelMode: 'DRIVE', languageCode: 'pt-BR' }),
    })) as { routes?: { distanceMeters?: number; duration?: string; legs?: { distanceMeters?: number; duration?: string }[]; polyline?: { encodedPolyline?: string } }[] };
    const route = json.routes?.[0];
    if (!route || !route.duration) return null;
    const sec = (d?: string) => (d ? parseFloat(d.replace('s', '')) : null);
    return {
      distanceMeters: route.distanceMeters ?? 0, durationSec: sec(route.duration),
      legs: (route.legs ?? []).map(l => ({ distanceMeters: l.distanceMeters ?? 0, durationSec: sec(l.duration) })),
      polyline: route.polyline?.encodedPolyline ?? null,
    };
  });
