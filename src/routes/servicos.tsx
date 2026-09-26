import { createFileRoute } from '@tanstack/react-router';
import { ServicesPage } from '@/components/site/public-pages';
export const Route = createFileRoute('/servicos')({
 head: () => ({meta: [{title: 'Serviços — Bondmann Química'}, {name:'description',content:'Conheça os caminhos de atendimento técnico e comercial da Bondmann.'}, {property:'og:title',content:'Serviços — Bondmann Química'}, {property:'og:description',content:'Conheça os caminhos de atendimento técnico e comercial da Bondmann.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: ServicesPage,
});
