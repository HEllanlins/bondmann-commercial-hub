import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth/use-auth';
import { isStaffRole } from '@/lib/auth/roles';
import { supabase } from '@/integrations/supabase/client';
import { PageLoader } from '@/components/bond/surface';
/** staff=true: equipe Bondmann ou representante/empresa com Hub Comercial liberado (verificado no banco). */
export function Access({staff=false,children}:{staff?:boolean;children:ReactNode}){
  const {loading,session,role}=useAuth();const navigate=useNavigate();
  const [hub,setHub]=useState<boolean|null>(null);
  useEffect(()=>{if(!staff||loading||!session)return;if(isStaffRole(role)){setHub(true);return}let a=true;void supabase.rpc('can_use_hub').then(({data})=>{if(a)setHub(Boolean(data))});return()=>{a=false}},[staff,loading,session,role]);
  const allowed=staff?hub===true:!(isStaffRole(role)&&role!=='admin');
  const pending=loading||!session||(staff&&hub===null);
  useEffect(()=>{if(loading)return;if(!session){void navigate({to:'/login',replace:true});return}if(pending)return;if(!allowed)void (staff?navigate({to:'/cliente',replace:true}):navigate({to:'/painel',search:{modulo:'Dashboard'},replace:true}))},[loading,session,pending,allowed,staff,navigate]);
  if(pending||!allowed)return <PageLoader/>;return <>{children}</>;
}
