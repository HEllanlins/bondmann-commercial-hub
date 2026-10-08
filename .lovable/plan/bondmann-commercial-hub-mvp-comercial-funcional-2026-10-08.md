# Bondmann Commercial Hub — MVP comercial funcional

Evoluir a base atual (TanStack Start, autenticação, permissões, temas e área administrativa continuam iguais). Assinaturas ficam fora desta etapa. O administrador acessa todos os módulos.

## Fluxo que vai funcionar de ponta a ponta

```text
Prospecção -> Empresa salva -> Lead no CRM -> Rota do dia -> Visita registrada
   -> o estágio no CRM avança -> Follow-up criado -> o Dashboard é atualizado -> a IA consulta tudo
```

## Módulos (todos sem "Em breve")

1. **Dashboard**: números reais de prospecção, visitas (hoje, próximas, realizadas, atrasadas), CRM, follow-ups e comercial (oportunidades, propostas, valor potencial). Quando não houver dados, aparece uma mensagem de "nada cadastrado ainda".
2. **Prospecção**: busca por palavra-chave, segmento, cidade/bairro, raio e "perto de mim", com lista e mapa lado a lado (no celular, em abas). Cada resultado mostra a fonte ("Google Maps") e marca o que "não foi encontrado". Ações: Ver, Adicionar à prospecção, Adicionar à rota.
3. **Inteligência comercial**: potencial Alto/Médio/Baixo e possíveis necessidades, calculados por regras ligadas ao segmento. Também mostra os produtos do catálogo relacionados. Isso aparece sempre com o selo "Inferência comercial", separado dos "Dados confirmados".
4. **Empresas**: cadastro central com os status Prospect, Lead, Visitado, Em negociação, Cliente, Cliente ativo, Sem interesse, Perdido e Inativo. Tem filtros e busca.
5. **Página da empresa**: cabeçalho, contatos (WhatsApp e telefone com link direto), mapa, ações (rota, visita, follow-up, editar, status, observação) e uma linha do tempo com o histórico.
6. **Rotas / Minha rota de hoje**: escolher empresas, definir a ordem (reordenar), ver no mapa com distância e tempo estimados (marcados como estimativa) e o status de cada parada. O botão "Abrir navegação" abre o Google Maps ou o Waze.
7. **CRM**: funil Prospect -> Contatado -> Visitado -> Interessado -> Proposta -> Cliente, com oportunidades ligadas à empresa, valor estimado e produtos.
8. **Visitas**: abas Hoje, Próximas, Realizadas e Atrasadas. Ao registrar o resultado (Interessado, Sem interesse, Retorno, Proposta, Teste, Venda, Reagendar), o sistema atualiza o CRM e sugere um follow-up.
9. **Follow-ups**: prioridade, data e hora. Status Pendente/Hoje/Atrasado calculados automaticamente, além de Concluir e Cancelar.
10. **Produtos (gestão)**: adicionar, editar, ver, ativar/desativar, disponibilidade (Disponível, Baixo estoque, Indisponível, Sob consulta, sempre como controle interno), aplicações e segmentos. Nenhuma ficha técnica será inventada.
11. **Relatórios**: indicadores de prospecção, visitas por período e segmento, conversões no CRM, follow-ups e produtos mais associados ou solicitados. Filtros por período, segmento, responsável e status.
12. **Assistente IA**: responde com base nos dados que o próprio usuário pode ver (leads, próxima visita, follow-ups atrasados, empresas não visitadas, produtos por segmento) e ensina a usar o sistema, com botões que abrem a página certa. Para encontrar um local, usa a busca de mapas e responde "Não consegui confirmar" quando não encontra.
13. **Configurações**: perfil (nome, foto, telefone), tema, preferências de notificação e preferências comerciais (região, segmentos, raio, horário). Inclui também a troca de senha e a saída de todas as sessões.
14. **Notificações**: um sino com a central de avisos (follow-up de hoje ou atrasado, visita próxima, nova solicitação de cliente, funcionário aguardando aprovação), gerados a partir dos dados.

## Dados reais e demonstração
- Nenhuma empresa, telefone ou endereço será inventado. Os resultados da prospecção vêm só da busca real.
- Não serão criados dados de demonstração automaticamente.

## Integrações
- **Mapas e busca de empresas**: Google Maps Platform, conectado pela Lovable (vou abrir o cartão de conexão). A busca é cobrada por uso, então ela só roda quando você pede, com no máximo 20 resultados e sem atualização automática.
- **IA**: IA da Lovable, sem você precisar de chave própria.
- **Vercel**: a chave de mapas fornecida pela Lovable só funciona nos endereços da Lovable. Para o mapa aparecer em bondmann-company.vercel.app, vai ser preciso ter uma chave Google própria. No final, vou listar exatamente as variáveis e onde configurá-las.

## Detalhes técnicos
- Migração: ampliar `companies` (bairro, lat/lng, whatsapp, source, place_id, status com os novos estados, potencial). Novas tabelas: `company_events` (linha do tempo), `opportunities` (+ `opportunity_products`), `routes` / `route_stops`, `visits` (campos: horário, resultado, próximo passo), `follow_ups` (prioridade, status), `products` (disponibilidade, informações técnicas, observações), `notification_prefs` e `user_settings`. Segmentos comerciais configuráveis, com palavras-chave e necessidades em `segments`. Acesso pelo dono do registro (owner) ou por staff/admin, com GRANT e RLS.
- Funções de servidor autenticadas: `searchPlaces`, `geocode` e `computeRoute` (Routes API) passando pelo gateway, e `askAssistant` (Lovable AI com ferramentas que consultam o banco como o próprio usuário, então as permissões são respeitadas).
- O mapa usa Maps JavaScript carregado só no navegador e marcadores próprios, com `clickableIcons:false`.
- Módulos em `src/components/hub/*`. As rotas continuam em `/painel?modulo=` e a nova página de empresa fica em `/_authenticated/empresas/$id`.
- Validação: build, Playwright como Hellan cobrindo o fluxo completo e checagem de celular e temas. O mapa não pode ser testado aqui, o que será informado.
