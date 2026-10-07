import { createFileRoute,redirect } from '@tanstack/react-router';
import { fetchAccess } from '@/lib/auth/use-auth';
import { AdminPage } from '@/components/platform/admin';
import { platformHead } from '@/lib/platform/meta';
export const Route=createFileRoute('/_authenticated/administracao')({beforeLoad:async({context})=>{const access=await fetchAccess(context.user.id);if(access.role!=='admin')throw redirect({to:'/cliente'});},head:()=>platformHead('Administração','Área restrita de administração Bondmann.'),component:AdminPage});
