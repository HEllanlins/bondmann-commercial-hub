import { createFileRoute } from '@tanstack/react-router';
import { verifyStripeSignature } from '@/lib/billing/stripe.server';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['STRIPE_WEBHOOK_SECRET'];
        if (!secret) return new Response('not configured', { status: 500 });
        const body = await request.text();
        if (!(await verifyStripeSignature(body, request.headers.get('stripe-signature'), secret))) return new Response('invalid signature', { status: 400 });
        const event = JSON.parse(body) as { id: string; type: string; data: { object: Obj } };
        const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
        const seen = await db.from('stripe_events').insert({ id: event.id, type: event.type });
        if (seen.error) return new Response(seen.error.code === '23505' ? 'duplicate' : 'error', { status: seen.error.code === '23505' ? 200 : 500 });

        const o = event.data.object;
        const findSub = async (subId?: string | null, stripeSub?: string | null) => {
          if (subId) { const r = await db.from('platform_subscriptions').select('*').eq('id', subId).maybeSingle(); if (r.data) return r.data; }
          if (stripeSub) { const r = await db.from('platform_subscriptions').select('*').eq('stripe_subscription_id', stripeSub).maybeSingle(); return r.data; }
          return null;
        };
        const ownerOf = async (s: { user_id: string | null; organization_id: string | null }) => s.user_id ?? (await db.from('organizations').select('owner_id').eq('id', s.organization_id!).maybeSingle()).data?.owner_id ?? null;
        const notify = async (s: { user_id: string | null; organization_id: string | null }, kind: string, title: string, text: string, key: string) => {
          const uid = await ownerOf(s); if (!uid) return;
          await db.from('user_notifications').upsert({ user_id: uid, kind, title, body: text, link: '/assinatura', dedupe_key: key }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
        };
        const activate = async (s: Obj, until: Date, amount: number, ref: string, method: string) => {
          await db.from('platform_subscriptions').update({ status: 'active', valid_until: until.toISOString(), renews_at: until.toISOString(), started_at: s.started_at ?? new Date().toISOString(), last_payment_at: new Date().toISOString(), payment_method: method, blocked_reason: null }).eq('id', s.id);
          const by = (await ownerOf(s as never)) ?? s.granted_by;
          if (by) await db.from('subscription_payments').upsert({ subscription_id: s.id, amount_cents: amount, paid_at: new Date().toISOString().slice(0, 10), method: `stripe:${method}`, recorded_by: by, stripe_ref: ref, status: 'paid' }, { onConflict: 'stripe_ref', ignoreDuplicates: true });
          await db.from('platform_events').insert({ actor_id: null, organization_id: s.organization_id, subject_user_id: by, event: 'stripe_payment', details: { ref, amount, method } });
          await notify(s as never, 'payment_confirmed', 'Pagamento confirmado', `Recebemos seu pagamento. Acesso liberado até ${until.toLocaleDateString('pt-BR')}.`, `paid:${ref}`);
        };
        const plus30 = (s: Obj) => { const b = s.valid_until && new Date(s.valid_until) > new Date() ? new Date(s.valid_until) : new Date(); return new Date(b.getTime() + 30 * 864e5); };

        try {
          switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded': {
              const s = await findSub(o.metadata?.sub_id, null); if (!s) break;
              if (o.mode === 'subscription' && o.subscription) await db.from('platform_subscriptions').update({ stripe_subscription_id: o.subscription }).eq('id', s.id);
              if (o.mode === 'payment') {
                if (o.payment_status === 'paid') await activate(s, plus30(s), o.amount_total, o.payment_intent ?? o.id, o.payment_method_types?.[0] ?? 'stripe');
                else { await db.from('platform_subscriptions').update({ status: s.status === 'active' || s.status === 'trial' ? s.status : 'awaiting_payment' }).eq('id', s.id); await notify(s, 'charge_created', 'Cobrança gerada', 'Seu boleto/Pix foi gerado. O acesso é liberado assim que o pagamento for confirmado.', `pending:${o.id}`); }
              }
              break;
            }
            case 'checkout.session.async_payment_failed':
            case 'checkout.session.expired': {
              const s = await findSub(o.metadata?.sub_id, null); if (s && o.mode === 'payment') await notify(s, 'payment_failed', 'Pagamento não concluído', 'O boleto ou Pix não foi pago dentro do prazo. Gere uma nova cobrança na sua assinatura.', `fail:${o.id}`);
              break;
            }
            case 'invoice.paid': {
              const stripeSub = o.subscription ?? o.parent?.subscription_details?.subscription;
              const s = await findSub(o.subscription_details?.metadata?.sub_id ?? o.parent?.subscription_details?.metadata?.sub_id, stripeSub); if (!s) break;
              if (stripeSub && !s.stripe_subscription_id) await db.from('platform_subscriptions').update({ stripe_subscription_id: stripeSub }).eq('id', s.id);
              const end = o.lines?.data?.[0]?.period?.end; await activate(s, end ? new Date(end * 1000) : plus30(s), o.amount_paid, o.id, 'card');
              break;
            }
            case 'invoice.payment_failed': {
              const s = await findSub(null, o.subscription ?? o.parent?.subscription_details?.subscription); if (!s) break;
              await db.from('platform_subscriptions').update({ blocked_reason: 'payment_failed' }).eq('id', s.id);
              await notify(s, 'payment_failed', 'Pagamento recusado', 'Não conseguimos cobrar seu cartão. Atualize a forma de pagamento para manter o acesso.', `invfail:${o.id}`);
              break;
            }
            case 'customer.subscription.deleted': {
              const s = await findSub(o.metadata?.sub_id, o.id); if (!s) break;
              await db.from('platform_subscriptions').update({ status: 'cancelled', blocked_reason: 'cancelled' }).eq('id', s.id);
              await notify(s, 'subscription_cancelled', 'Assinatura cancelada', 'Sua assinatura foi cancelada. Seus dados continuam preservados.', `cancel:${o.id}`);
              break;
            }
          }
        } catch (e) {
          console.error('webhook processing failed', event.type, e);
          await db.from('stripe_events').delete().eq('id', event.id); // permite nova tentativa da Stripe
          return new Response('error', { status: 500 });
        }
        return new Response('ok');
      },
    },
  },
});
