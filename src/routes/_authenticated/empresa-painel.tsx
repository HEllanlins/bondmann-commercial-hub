import { createFileRoute } from '@tanstack/react-router';
import { CommercialArea } from '@/components/platform/portals';
import { platformHead } from '@/lib/platform/meta';
export const Route=createFileRoute('/_authenticated/empresa-painel')({head:()=>platformHead('Empresa','Área Empresa do Bondmann Commercial Hub.'),component:()=> <CommercialArea area="empresa"/>});
