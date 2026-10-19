import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { stripe } from './stripe.server';

const METHODS = ['card', 'boleto', 'pix'] as const;
export type PayMethod = (typeof METHODS)[number];

function originOf() {
  const req = getRequest();
  const site = process.env['SITE_URL']?.replace(/\/+$/, '');
  return site || new URL(req.url).origin;
}

/** Cria a sessão de pagamento da Stripe. A liberação só acontece pelo webhook. */
export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ planId: z.string().min(1).max(60), method: z.enum(METHODS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: plan } = await supabase.from('platform_plans').select('*').eq('id', data.planId).eq('active', true).maybeSingle();
    if (!plan || plan.offer_active === false || plan.price_cents === null) return { error: 'Plano indisponível para contratação online.' };
    let orgId: string | null = null;
    if (plan.audience === 'empresa') {
      const { data: org } = await supabase.from('organizations').select('id').eq('owner_id', userId).maybeSingle();
      if (!org) return { error: 'Cadastre sua empresa antes de contratar o plano empresarial.' };
      orgId = org.id;
    }
    const amount = Math.round(plan.price_cents * (1 - Number(plan.discount_percent ?? 0) / 100));
    if (amount < 50) return { error: 'Valor do plano inválido.' };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const scope = orgId ? supabaseAdmin.from('platform_subscriptions').select('*').eq('organization_id', orgId) : supabaseAdmin.from('platform_subscriptions').select('*').eq('user_id', userId);
    let { data: sub } = await scope.maybeSingle();
    if (!sub) {
      const ins = await supabaseAdmin.from('platform_subscriptions').insert({ user_id: orgId ? null : userId, organization_id: orgId, plan_id: plan.id, status: 'pending' }).select('*').single();
      if (ins.error) { console.error(ins.error); return { error: 'Não foi possível preparar a assinatura.' }; }
      sub = ins.data;
    }
    const email = (claims as { email?: string }).email;
    let customer = sub.stripe_customer_id;
    try {
      if (!customer) {
        const c = await stripe<{ id: string }>('customers', { email, 'metadata[user_id]': userId, 'metadata[organization_id]': orgId ?? '' });
        customer = c.id;
      }
      await supabaseAdmin.from('platform_subscriptions').update({ stripe_customer_id: customer, payment_method: data.method, ...(sub.status === 'pending' || sub.status === 'expired' || sub.status === 'cancelled' ? { plan_id: plan.id } : {}) }).eq('id', sub.id);
      const base = originOf();
      const meta = { 'metadata[sub_id]': sub.id, 'metadata[plan_id]': plan.id, 'metadata[user_id]': userId };
      const common = {
        customer, ...meta, client_reference_id: sub.id, locale: 'pt-BR',
        success_url: `${base}/assinatura?pagamento=retorno`, cancel_url: `${base}/assinatura?pagamento=cancelado`,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': 'brl',
        'line_items[0][price_data][unit_amount]': amount,
        'line_items[0][price_data][product_data][name]': `Bondmann Commercial Hub — ${plan.name}`,
      };
      const session = data.method === 'card'
        ? await stripe<{ url: string }>('checkout/sessions', { ...common, mode: 'subscription', 'payment_method_types[0]': 'card', 'line_items[0][price_data][recurring][interval]': plan.billing_interval === 'year' ? 'year' : 'month', 'subscription_data[metadata][sub_id]': sub.id, 'subscription_data[metadata][plan_id]': plan.id })
        : await stripe<{ url: string }>('checkout/sessions', { ...common, mode: 'payment', 'payment_method_types[0]': data.method, 'payment_intent_data[metadata][sub_id]': sub.id, ...(data.method === 'boleto' ? { 'payment_method_options[boleto][expires_after_days]': 3 } : { 'payment_method_options[pix][expires_after_seconds]': 86400 }) });
      return { url: session.url };
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      return { error: /payment method type|not activated|pix|boleto/i.test(m) ? 'Este meio de pagamento ainda não está liberado na conta Stripe. Escolha outro meio.' : 'Não foi possível abrir o pagamento. Tente novamente.' };
    }
  });

/** Portal da Stripe para trocar cartão, ver faturas e cancelar. */
export const openBillingPortal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc('current_subscription');
    const s = data as { stripe_customer_id?: string | null } | null;
    if (!s?.stripe_customer_id) return { error: 'Nenhum pagamento online registrado ainda.' };
    try {
      const p = await stripe<{ url: string }>('billing_portal/sessions', { customer: s.stripe_customer_id, return_url: `${originOf()}/assinatura` });
      return { url: p.url };
    } catch { return { error: 'O portal de pagamentos não está disponível. Ative-o na Stripe.' }; }
  });
