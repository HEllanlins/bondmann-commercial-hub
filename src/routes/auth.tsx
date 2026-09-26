import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/bond/auth-pages';
export const Route=createFileRoute('/auth')({head:()=>({meta:[{title:'Entrar — Bondmann Química'},{name:'description',content:'Entrar na plataforma Bondmann.'},{property:'og:title',content:'Entrar — Bondmann Química'},{property:'og:description',content:'Entrar na plataforma Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AuthPage mode="login"/>});
