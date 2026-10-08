import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

type Msg = { role: 'user' | 'assistant'; content: string };

const GUIDE = `Você é o Assistente do Bondmann Commercial Hub, plataforma comercial da Bondmann Química.
Módulos (menu lateral do Hub Comercial): Dashboard, Prospecção (buscar empresas no mapa e salvar), Empresas (cadastro central e página detalhada com ações), Rotas (Minha rota de hoje, ordenar paradas, Abrir navegação), CRM (funil de oportunidades), Visitas (agendar e registrar resultado), Follow-ups (próximas ações), Produtos (catálogo e disponibilidade), Relatórios, Assistente IA, Configurações.
Como fazer: cadastrar empresa = Empresas > "Nova empresa" ou Prospecção > "Adicionar à prospecção". Criar rota = em Empresas/Prospecção clique "Adicionar à rota" e abra Rotas. Registrar visita = Visitas > "Nova visita" e depois "Registrar resultado". Follow-up = Follow-ups > "Novo follow-up" ou na página da empresa.
Regras: responda em português, de forma objetiva. Use SOMENTE os dados do CONTEXTO abaixo, que já respeitam as permissões do usuário. Nunca invente empresas, endereços, telefones, distâncias ou fatos. Se não houver dado, diga claramente que não há registro. Quando um endereço estiver incompleto, diga que o cadastro não possui endereço completo e sugira usar a busca no mapa na página da empresa. Separe "dado cadastrado" de "sugestão/inferência".
Quando for útil oferecer navegação, termine com uma linha no formato [[abrir:NomeDoModulo]] usando exatamente um dos nomes dos módulos acima.`;

export const askHub = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: Msg[] }) => {
    const messages = (input.messages ?? []).slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: String(m.content ?? '').slice(0, 2000) }));
    if (!messages.length) throw new Error('Mensagem vazia.');
    return { messages };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: staff } = await sb.rpc('is_staff', { _user_id: context.userId });
    if (!staff) throw new Error('Acesso restrito à equipe comercial.');
    const now = new Date().toISOString();
    const [companies, visits, fus, opps, products, segments, routes] = await Promise.all([
      sb.from('companies').select('id,name,trade_name,stage,city,neighborhood,address,phone,whatsapp,segment_id,potential,latitude').order('updated_at', { ascending: false }).limit(80),
      sb.from('visits').select('scheduled_for,status,result,next_step,company_id').order('scheduled_for').limit(60),
      sb.from('follow_ups').select('title,due_at,status,priority,done,company_id').order('due_at').limit(60),
      sb.from('opportunities').select('title,stage,value_cents,company_id').limit(60),
      sb.from('products').select('name,code,category,availability,status,segment_id').limit(80),
      sb.from('segments').select('id,name,needs'),
      sb.from('routes').select('route_date,route_stops(position,status,company_id)').order('route_date', { ascending: false }).limit(3),
    ]);
    const cname = new Map((companies.data ?? []).map(c => [c.id, c.trade_name || c.name]));
    const sname = new Map((segments.data ?? []).map(s => [s.id, s.name]));
    const ctx = {
      agora: now,
      empresas: (companies.data ?? []).map(c => ({ nome: c.trade_name || c.name, status: c.stage, segmento: c.segment_id ? sname.get(c.segment_id) : null, cidade: c.city, bairro: c.neighborhood, endereco: c.address || 'não cadastrado', telefone: c.phone || 'não cadastrado', whatsapp: c.whatsapp || 'não cadastrado', potencial_inferido: c.potential, tem_localizacao: c.latitude !== null })),
      visitas: (visits.data ?? []).map(v => ({ empresa: cname.get(v.company_id ?? '') ?? '—', data: v.scheduled_for, status: v.status, resultado: v.result, proximo_passo: v.next_step })),
      followups: (fus.data ?? []).map(f => ({ titulo: f.title, empresa: cname.get(f.company_id ?? '') ?? '—', prazo: f.due_at, status: f.status, prioridade: f.priority })),
      oportunidades: (opps.data ?? []).map(o => ({ titulo: o.title, etapa: o.stage, valor_reais: o.value_cents !== null ? o.value_cents / 100 : null, empresa: cname.get(o.company_id) ?? '—' })),
      produtos: (products.data ?? []).map(p => ({ nome: p.name, codigo: p.code, categoria: p.category, disponibilidade: p.availability, segmento: p.segment_id ? sname.get(p.segment_id) : null })),
      segmentos_e_necessidades_inferidas: (segments.data ?? []).map(s => ({ nome: s.name, necessidades: s.needs })),
      rotas: (routes.data ?? []).map(r => ({ data: r.route_date, paradas: (r.route_stops ?? []).sort((a, b) => a.position - b.position).map(s => ({ empresa: cname.get(s.company_id) ?? '—', status: s.status })) })),
    };
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error('IA não configurada.');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', stream: true, store: false, reasoning: { effort: 'low' },
        input: [{ role: 'system', content: `${GUIDE}\n\nCONTEXTO (JSON):\n${JSON.stringify(ctx)}` }, ...data.messages],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      console.error(`AI gateway [${res.status}]: ${t}`);
      if (res.status === 402) throw new Error('Os créditos de IA acabaram. Adicione créditos para continuar usando o assistente.');
      if (res.status === 429) throw new Error('Muitas solicitações no momento. Aguarde alguns segundos e tente novamente.');
      throw new Error(`O assistente não respondeu [${res.status}].`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', failed: string | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw) as { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
          if (ev.type === 'response.output_text.delta' && ev.delta) text += ev.delta;
          if (ev.type === 'error' || ev.type === 'response.failed') failed = ev.error?.message ?? ev.response?.error?.message ?? 'falha';
        } catch { /* ignora linha parcial */ }
      }
    }
    if (failed) throw new Error(`O assistente não conseguiu responder: ${failed}`);
    if (!text.trim()) throw new Error('O assistente não retornou resposta.');
    const m = text.match(/\[\[abrir:([^\]]+)\]\]/);
    return { content: text.replace(/\[\[abrir:[^\]]+\]\]/g, '').trim(), action: m ? m[1]!.trim() : null };
  });
