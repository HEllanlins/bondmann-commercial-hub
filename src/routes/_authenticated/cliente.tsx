import { createFileRoute } from '@tanstack/react-router';
import { ClientPortal } from '@/components/bond/portals';
export const Route=createFileRoute('/_authenticated/cliente')({head:()=>({meta:[{title:'Área do cliente — Bondmann'},{name:'description',content:'Portal do cliente Bondmann.'},{property:'og:title',content:'Área do cliente — Bondmann'},{property:'og:description',content:'Portal do cliente Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:ClientPortal});
