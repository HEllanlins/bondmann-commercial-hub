import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionPage } from '@/components/platform/plans';
import { platformHead } from '@/lib/platform/meta';
export const Route=createFileRoute('/_authenticated/assinatura')({head:()=>platformHead('Minha assinatura','Situação e histórico da sua assinatura Bondmann.'),component:SubscriptionPage});
