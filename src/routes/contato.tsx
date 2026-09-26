import { createFileRoute } from '@tanstack/react-router';
import { ContactPage } from '@/components/site/public-pages';
export const Route = createFileRoute('/contato')({
 head: () => ({meta: [{title: 'Contato — Bondmann Química'}, {name:'description',content:'Encontre os canais de contato da Bondmann Química.'}, {property:'og:title',content:'Contato — Bondmann Química'}, {property:'og:description',content:'Encontre os canais de contato da Bondmann Química.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: ContactPage,
});
