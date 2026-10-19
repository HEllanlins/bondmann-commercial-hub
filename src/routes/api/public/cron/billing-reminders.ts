import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

/** Rotina diária: aviso 5 dias antes do vencimento, fim de teste e acesso encerrado. Sem duplicidade (dedupe_key). */
export const Route = createFileRoute('/api/public/cron/billing-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request); if (denied) return denied;
        const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
        const now = Date.now();
        const { data: subs } = await db.from('platform_subscriptions').select('id,user_id,organization_id,status,valid_until,plan_id,payment_method,stripe_subscription_id').in('status', ['active', 'trial', 'awaiting_payment']);
        const { data: plans } = await db.from('platform_plans').select('id,name,price_cents');
        let created = 0;
        for (const s of subs ?? []) {
          if (!s.valid_until) continue;
          const due = new Date(s.valid_until); const days = Math.ceil((due.getTime() - now) / 864e5);
          const uid = s.user_id ?? (await db.from('organizations').select('owner_id').eq('id', s.organization_id!).maybeSingle()).data?.owner_id; if (!uid) continue;
          const plan = plans?.find(p => p.id === s.plan_id); const dueTxt = due.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const price = plan?.price_cents != null ? (plan.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'sob consulta';
          let n: { kind: string; title: string; body: string; key: string } | null = null;
          if (days === 5 && s.status !== 'trial') n = { kind: 'due_soon', title: 'Sua assinatura vence em 5 dias', body: `Olá! Sua assinatura do Bondmann Commercial Hub (${plan?.name ?? s.plan_id}) vence em ${dueTxt}, valor ${price}. ${s.stripe_subscription_id ? 'Verifique sua forma de pagamento para evitar a interrupção do acesso.' : 'Gere o pagamento para evitar a interrupção do acesso.'}`, key: `due5:${s.id}:${s.valid_until}` };
          else if (days <= 2 && days > 0 && s.status === 'trial') n = { kind: 'trial_ending', title: 'Seu teste grátis está terminando', body: `O teste termina em ${dueTxt}. Escolha um plano para continuar usando os recursos.`, key: `trial2:${s.id}:${s.valid_until}` };
          else if (days <= 0) n = { kind: s.status === 'trial' ? 'trial_ended' : 'blocked', title: s.status === 'trial' ? 'Teste grátis encerrado' : 'Acesso aos recursos bloqueado', body: 'Seus dados estão preservados. Regularize a assinatura para voltar a usar os recursos.', key: `end:${s.id}:${s.valid_until}` };
          if (!n) continue;
          const r = await db.from('user_notifications').upsert({ user_id: uid, kind: n.kind, title: n.title, body: n.body, link: '/assinatura', dedupe_key: n.key }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
          created += r.data?.length ?? 0;
        }
        return Response.json({ ok: true, created });
      },
    },
  },
});
