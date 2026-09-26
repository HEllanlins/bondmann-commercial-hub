import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/bond/auth-pages';
export const Route=createFileRoute('/cadastro')({head:()=>({meta:[{title:'Cadastro — Bondmann Química'},{name:'description',content:'Cadastro na plataforma Bondmann.'},{property:'og:title',content:'Cadastro — Bondmann Química'},{property:'og:description',content:'Cadastro na plataforma Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AuthPage mode="signup"/>});
