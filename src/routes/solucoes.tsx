import { createFileRoute } from '@tanstack/react-router';
import { SolutionsPage } from '@/components/site/public-pages';
export const Route = createFileRoute('/solucoes')({
 head: () => ({meta: [{title: 'Soluções — Bondmann Química'}, {name:'description',content:'Da necessidade à aplicação e ao produto: conheça as soluções Bondmann.'}, {property:'og:title',content:'Soluções — Bondmann Química'}, {property:'og:description',content:'Da necessidade à aplicação e ao produto: conheça as soluções Bondmann.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: SolutionsPage,
});
