import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/bond/auth-pages';
export const Route=createFileRoute('/recuperar-senha')({head:()=>({meta:[{title:'Recuperar senha — Bondmann Química'},{name:'description',content:'Recuperar senha na plataforma Bondmann.'},{property:'og:title',content:'Recuperar senha — Bondmann Química'},{property:'og:description',content:'Recuperar senha na plataforma Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AuthPage mode="forgot"/>});
