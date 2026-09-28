import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/bond/auth-pages';
export const Route=createFileRoute('/login')({head:()=>({meta:[{title:'Entrar — Bondmann Commercial Hub'},{name:'description',content:'Entrar no Bondmann Commercial Hub.'},{property:'og:title',content:'Entrar — Bondmann Commercial Hub'},{property:'og:description',content:'Entrar no Bondmann Commercial Hub.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AuthPage mode="login"/>});
