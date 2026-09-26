import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/bond/auth-pages';
export const Route=createFileRoute('/redefinir-senha')({head:()=>({meta:[{title:'Nova senha — Bondmann Química'},{name:'description',content:'Nova senha na plataforma Bondmann.'},{property:'og:title',content:'Nova senha — Bondmann Química'},{property:'og:description',content:'Nova senha na plataforma Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AuthPage mode="reset"/>});
