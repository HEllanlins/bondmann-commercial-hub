import { useEffect, useRef, useState } from 'react';

export type MapPoint = { id: string; lat: number; lng: number; title: string; label?: string; html?: string };

declare global { interface Window { google?: any; __bondMapsReady?: () => void } }

let loader: Promise<void> | null = null;
function loadMaps() {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
  const channel = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] ?? '';
  if (!key) return Promise.reject(new Error('missing-key'));
  loader = new Promise((resolve, reject) => {
    window.__bondMapsReady = () => resolve();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__bondMapsReady&channel=${channel}`;
    s.async = true; s.onerror = () => reject(new Error('load-failed'));
    document.head.appendChild(s);
  });
  return loader;
}

function decode(enc: string) {
  const pts: { lat: number; lng: number }[] = []; let i = 0, lat = 0, lng = 0;
  while (i < enc.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, result = 0;
      do { b = enc.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

/** Mapa Google (somente navegador). Credential-bearing previews mostram aviso sem chamar o Google. */
export function HubMap({ points, onSelect, polyline, className = 'h-80' }: { points: MapPoint[]; onSelect?: (id: string) => void; polyline?: string | null; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'blocked'>('loading');

  useEffect(() => {
    if (/-devserver-/.test(window.location.hostname)) { setState('blocked'); return; }
    loadMaps().then(() => {
      if (!el.current) return;
      map.current = new window.google.maps.Map(el.current, { center: { lat: -15.79, lng: -47.88 }, zoom: 11, clickableIcons: false, mapTypeControl: false, streetViewControl: false, styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }] });
      setState('ready');
    }).catch(() => setState('error'));
  }, []);

  useEffect(() => {
    if (state !== 'ready' || !map.current) return;
    const g = window.google.maps;
    overlays.current.forEach(o => o.setMap(null)); overlays.current = [];
    const bounds = new g.LatLngBounds(); const info = new g.InfoWindow();
    points.forEach(p => {
      const m = new g.Marker({ position: { lat: p.lat, lng: p.lng }, map: map.current, title: p.title, label: p.label });
      m.addListener('click', () => { onSelect?.(p.id); if (p.html) { const div = document.createElement('div'); div.style.color = '#111'; div.textContent = p.html; info.setContent(div); info.open({ map: map.current, anchor: m }); } });
      overlays.current.push(m); bounds.extend({ lat: p.lat, lng: p.lng });
    });
    if (polyline) { const line = new g.Polyline({ path: decode(polyline), map: map.current, strokeColor: '#1aa6b7', strokeWeight: 4 }); overlays.current.push(line); }
    if (points.length === 1) { map.current.setCenter({ lat: points[0]!.lat, lng: points[0]!.lng }); map.current.setZoom(15); }
    else if (points.length > 1) map.current.fitBounds(bounds, 40);
  }, [state, points, polyline, onSelect]);

  return <div className={`relative overflow-hidden rounded-md border border-border bg-muted ${className}`}>
    <div ref={el} className="absolute inset-0" />
    {state !== 'ready' ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-steel">
      {state === 'loading' ? 'Carregando mapa…' : state === 'blocked' ? 'O mapa aparece no endereço publicado do aplicativo. A lista ao lado continua funcional.' : 'Não foi possível carregar o mapa neste endereço. Verifique a chave de mapas configurada.'}
    </div> : null}
  </div>;
}
