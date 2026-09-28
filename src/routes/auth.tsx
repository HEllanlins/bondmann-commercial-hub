import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/auth')({beforeLoad:({location})=>{throw redirect({to:'/login',hash:location.hash,replace:true})}});
