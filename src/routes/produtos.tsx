import { createFileRoute } from '@tanstack/react-router';
import { ProductsPage } from '@/components/site/public-pages';
export const Route = createFileRoute('/produtos')({
 head: () => ({meta: [{title: 'Produtos — Bondmann Química'}, {name:'description',content:'Explore o catálogo de produtos Bondmann por segmento e categoria.'}, {property:'og:title',content:'Produtos — Bondmann Química'}, {property:'og:description',content:'Explore o catálogo de produtos Bondmann por segmento e categoria.'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}]}),
 component: ProductsPage,
});
