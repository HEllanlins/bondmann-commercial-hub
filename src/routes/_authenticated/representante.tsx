import { createFileRoute } from '@tanstack/react-router';
import { CommercialArea } from '@/components/platform/portals';
import { platformHead } from '@/lib/platform/meta';
export const Route=createFileRoute('/_authenticated/representante')({head:()=>platformHead('Representante','Área Representante do Bondmann Commercial Hub.'),component:()=> <CommercialArea area="representante"/>});
