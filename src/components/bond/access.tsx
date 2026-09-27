import { useEffect, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth/use-auth';
import { isStaffRole } from '@/lib/auth/roles';
import { PageLoader } from '@/components/bond/surface';
export function Access({staff=false,children}:{staff?:boolean;children:ReactNode}){const {loading,session,role}=useAuth();const navigate=useNavigate();useEffect(()=>{if(loading)return;if(!session)void navigate({to:'/auth',replace:true});else if(staff&&!isStaffRole(role))void navigate({to:'/cliente',replace:true});else if(!staff&&isStaffRole(role))void navigate({to:'/painel',search:{modulo:'Dashboard'},replace:true})},[loading,session,role,staff,navigate]);if(loading||!session||staff&&!isStaffRole(role)||!staff&&isStaffRole(role))return <PageLoader/>;return <>{children}</>}
