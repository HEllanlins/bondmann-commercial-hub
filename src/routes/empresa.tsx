import { createFileRoute } from '@tanstack/react-router';
import { CompanyPage } from '@/components/site/public-pages';
export const Route = createFileRoute('/empresa')({
 head: () => ({meta: [{title: 'Empresa — Bondmann Química'}, {name:'description',content:'Conheça a proposta institucional e a estrutura comercial Bondmann.'}, {property:'og:title',content:'Empresa — Bondmann Química'}, {property:'og:description',content:'Conheça a proposta institucional e a estrutura comercial Bondmann.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: CompanyPage,
});
