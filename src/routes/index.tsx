import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/components/site/public-pages';
export const Route = createFileRoute('/')({
 head: () => ({meta: [{title: 'Bondmann Química — Soluções químicas'}, {name:'description',content:'Conheça segmentos, soluções e produtos da Bondmann Química.'}, {property:'og:title',content:'Bondmann Química — Soluções químicas'}, {property:'og:description',content:'Conheça segmentos, soluções e produtos da Bondmann Química.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: HomePage,
});
