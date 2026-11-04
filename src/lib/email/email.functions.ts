import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Envia os convites pendentes da empresa do chamador (verificado via RLS) quando o e-mail está configurado. */
export const sendInviteEmails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(input.organizationId))) throw new Error('invalid');
    return { organizationId: input.organizationId };
  })
  .handler(async ({ data, context }) => {
    const { data: org } = await context.supabase.from('organizations').select('id,owner_id').eq('id', data.organizationId).maybeSingle();
    if (!org) return { sent: 0, configured: false };
    const { deliverPendingEmails } = await import('./email.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return deliverPendingEmails(supabaseAdmin, { organizationId: data.organizationId });
  });
