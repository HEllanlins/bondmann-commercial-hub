import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

type Msg = { role: 'user' | 'assistant'; content: string };

const GUIDE = `Você é o Assistente do Bondmann Commercial Hub, plataforma comercial da Bondmann Química.
Módulos (menu lateral do Hub Comercial): Dashboard, Prospecção (buscar empresas no mapa e salvar), Empresas (cadastro central e página detalhada com ações), Rotas (Rotas Comerciais, vincular visitas da data, definir início no mapa ou GPS, Gerar Rota, iniciar e concluir paradas), CRM (funil de oportunidades), Visitas (agendar e registrar resultado), Follow-ups (próximas ações), Produtos (catálogo e disponibilidade), Relatórios, Assistente IA, Configurações.
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
    const { data: staff } = await sb.rpc('can_use_feature', { _key: 'ia' });
    if (!staff) throw new Error('O assistente de IA não está incluído no seu plano.');
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
    const input = [{ role: 'system', content: `${GUIDE}\n\nCONTEXTO (JSON):\n${JSON.stringify(ctx)}` }, ...data.messages];
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('IA desconectada. Configure GEMINI_API_KEY do Google AI Studio em projeto sem faturamento.');
    const model = 'gemini-2.5-flash-lite';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: input[0]?.content ?? GUIDE }] },
        contents: data.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error('Cota gratuita de IA esgotada ou limite de frequência atingido. Aguarde a renovação; não há troca para provedor pago.');
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(`Gemini recusou a configuração [${res.status}]. Verifique a chave e a disponibilidade da API no Google AI Studio.`);
      throw new Error(`Gemini indisponível [${res.status}]. Tente novamente mais tarde.`);
    }
    const response = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
    if (response.promptFeedback?.blockReason) throw new Error('O provedor recusou esta solicitação.');
    const text = response.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('Gemini não retornou resposta. Verifique a solicitação e a cota no AI Studio.');
    const m = text.match(/\[\[abrir:([^\]]+)\]\]/);
    const requested=m?.[1]?.trim();
    const allowed:Record<string,string>={'Dashboard':'dashboard','Prospecção':'prospeccao','Empresas':'clientes','Rotas':'rotas','CRM':'crm','Visitas':'visitas','Follow-ups':'followups','Produtos':'catalogo','Relatórios':'relatorios','Assistente IA':'ia'};
    let action:string|null=null;
    if(requested==='Configurações')action=requested;else if(requested&&allowed[requested]){const permission=await sb.rpc('can_use_feature',{_key:allowed[requested]});if(permission.data)action=requested;}
    return { content: text.replace(/\[\[abrir:[^\]]+\]\]/g, '').trim(), action };
  });
