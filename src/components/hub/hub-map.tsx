import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
export type MapPoint = { id:string;lat:number;lng:number;title:string;label?:string;html?:string;status?:string };
function decode(enc:string) { const pts:[number,number][]=[];let i=0,lat=0,lng=0;while(i<enc.length){for(const k of [0,1]){let b=0,shift=0,result=0;do{b=enc.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32&&i<enc.length);const d=result&1?~(result>>1):result>>1;if(k===0)lat+=d;else lng+=d;}pts.push([lat/1e5,lng/1e5]);}return pts; }
export function HubMap({points,onSelect,polyline,className='h-80',onPick,livePosition}:{points:MapPoint[];onSelect?:((id:string)=>void)|undefined;polyline?:string|null|undefined;className?:string;onPick?:((p:{lat:number;lng:number})=>void)|undefined;livePosition?:{lat:number;lng:number}|null|undefined}) {
 const el=useRef<HTMLDivElement>(null);const map=useRef<Leaflet.Map|null>(null);const L=useRef<typeof Leaflet|null>(null);const group=useRef<Leaflet.LayerGroup|null>(null);const gps=useRef<Leaflet.CircleMarker|null>(null);const select=useRef(onSelect);select.current=onSelect;const pick=useRef(onPick);pick.current=onPick;const [ready,setReady]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{let disposed=false;let observer:ResizeObserver|undefined;
  import('leaflet').then(lib=>{if(disposed||!el.current)return;L.current=lib;const m=lib.map(el.current).setView([-15.79,-47.88],10);map.current=m;
   lib.tileLayer(import.meta.env['VITE_OSM_TILE_URL']||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap">Corrigir mapa</a>'}).addTo(m);
   group.current=lib.layerGroup().addTo(m);m.on('click',(e:Leaflet.LeafletMouseEvent)=>pick.current?.({lat:e.latlng.lat,lng:e.latlng.lng}));observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(el.current);setReady(true);
  }).catch(()=>setError(true));return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const lib=L.current,m=map.current,g=group.current;if(!ready||!lib||!m||!g)return;g.clearLayers();const coords:Leaflet.LatLngExpression[]=[];
  for(const p of points){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;coords.push([p.lat,p.lng]);const marker=lib.marker([p.lat,p.lng],{icon:lib.divIcon({className:'bond-map-icon',html:'',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(g);const icon=marker.getElement();if(icon){icon.textContent=p.label??'•';icon.dataset['status']=p.status??'pendente';}
   const content=document.createElement('div');content.className='bond-map-popup';const title=document.createElement('strong');title.textContent=p.title;content.append(title);if(p.html){const detail=document.createElement('p');detail.textContent=p.html;content.append(detail);}marker.bindPopup(content);marker.on('click',()=>select.current?.(p.id));
  }
  if(polyline){const line=decode(polyline);lib.polyline(line,{color:getComputedStyle(document.documentElement).getPropertyValue('--aqua').trim(),weight:4}).addTo(g);coords.push(...line);}
  if(coords.length===1)m.setView(coords[0] as Leaflet.LatLngExpression,15);else if(coords.length>1)m.fitBounds(lib.latLngBounds(coords),{padding:[35,35],maxZoom:16});
 },[ready,points,polyline]);
 useEffect(()=>{const lib=L.current,m=map.current;if(!lib||!m||!ready)return;if(!livePosition){gps.current?.remove();gps.current=null;return;}if(gps.current)gps.current.setLatLng([livePosition.lat,livePosition.lng]);else gps.current=lib.circleMarker([livePosition.lat,livePosition.lng],{radius:8,color:getComputedStyle(document.documentElement).getPropertyValue('--bond').trim(),fillOpacity:1}).addTo(m).bindTooltip('Sua localização');},[ready,livePosition]);
 return <div className={`relative isolate overflow-hidden rounded-md border border-border bg-muted ${className}`}><div ref={el} className="absolute inset-0" aria-label="Mapa comercial OpenStreetMap"/>{!ready?<div className="absolute inset-0 z-10 grid place-items-center bg-muted p-6 text-center text-sm text-steel">{error?'Não foi possível abrir o mapa. Tente novamente.':'Carregando mapa…'}</div>:null}</div>;
}
