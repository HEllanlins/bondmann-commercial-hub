import { createFileRoute } from '@tanstack/react-router';
import { PlansPage } from '@/components/platform/plans';
import { platformHead } from '@/lib/platform/meta';
export const Route=createFileRoute('/planos')({head:()=>platformHead('Planos','Planos individuais e empresariais Bondmann.'),component:PlansPage});
