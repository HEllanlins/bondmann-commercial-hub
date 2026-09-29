import { createFileRoute, redirect } from '@tanstack/react-router';
import { StaffPortal } from '@/components/bond/portals';
import { fetchAccess } from '@/lib/auth/use-auth';
import { isStaffRole } from '@/lib/auth/roles';
const modules=['Dashboard','Prospecção','Empresas','Rotas','CRM','Visitas','Follow-ups','Produtos','Relatórios','Assistente IA','Usuários','Configurações'];
export const Route=createFileRoute('/_authenticated/painel')({beforeLoad:async({context})=>{const access=await fetchAccess(context.user.id);if(!isStaffRole(access.role))throw redirect({to:'/cliente'});},validateSearch:(search:Record<string,unknown>)=>({modulo:typeof search['modulo']==='string'&&modules.includes(search['modulo'])?search['modulo']:'Dashboard'}),head:()=>({meta:[{title:'Painel comercial — Bondmann'},{name:'description',content:'Painel comercial Bondmann.'},{property:'og:title',content:'Painel comercial — Bondmann'},{property:'og:description',content:'Painel comercial Bondmann.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=>{const {modulo}=Route.useSearch();return <StaffPortal module={modulo}/>}});
