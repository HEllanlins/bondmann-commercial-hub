# Acessos, planos, assinaturas e equipes — Bondmann Commercial Hub

Continua a base atual: as tabelas de planos, recursos, organizações e membros, a Área Restrita e o Hub Comercial. Nada é apagado; tudo o que muda é acrescentado ao que já existe.

## O que muda para cada pessoa

- **Cliente:** continua igual. Não acessa o painel comercial.
- **Representante:** escolhe um plano, preenche a solicitação e vê "Solicitação enviada — aguardando análise". Depois que o administrador aprova (teste grátis ou assinatura), entra no Hub só com os módulos do seu plano.
- **Empresa:**
  - O proprietário solicita o plano empresarial, convida funcionários por e-mail e pode ter mais de um administrador. Define o papel e as permissões de cada membro e acompanha as vagas usadas.
  - O funcionário aceita o convite com a própria conta. O sistema confere se o e-mail da conta é o do convite e usa a assinatura da empresa.
- **Administrador principal (elan.lins@gmail.com):** acesso total, sem assinatura. Hoje essa conta ainda não existe; ela vira administradora automaticamente ao entrar pela primeira vez. Hellan continua administradora.

## Área Restrita (ampliada)
- **Planos:** criar e editar nome, preço, limite de usuários, recursos liberados, dias de teste, oferta ativa e desconto. Será criado o plano "Equipe" (R$ 150/mês, até 5 usuários), que você pode alterar.
- **Solicitações:** contato, plano, tipo de contratação e preço no momento do pedido. Ações: aprovar, recusar e iniciar teste.
- **Assinaturas:**
  - Estados: solicitação pendente, teste grátis ativo, ativa, aguardando pagamento, vencendo em breve, expirada, suspensa e cancelada.
  - Ações: ativar com datas de início e renovação, conceder desconto, estender teste, suspender e reativar, registrar pagamento recebido e adicionar observações.
  - Tudo fica no histórico, com quem fez e quando.
- **Vencimentos e testes:** lista filtrável com quem vence em 7, 3 ou 1 dia(s).
- A tela de usuários atual continua igual.

## Teste grátis de 7 dias
- Os dias de teste são configuráveis por plano.
- Cada conta (e cada empresa) tem um único teste, e o administrador pode abrir exceções.
- Durante o teste aparecem avisos de término próximo. Quando o teste acaba, os módulos ficam bloqueados com o botão "Ver planos", e nenhum dado é apagado.

## Liberação por recurso
- Cada módulo do Hub (Prospecção, Empresas, Rotas, CRM, Visitas, Follow-ups, Produtos, Relatórios, IA, Mapas avançados, Gestão de equipe) fica ligado a um recurso do plano.
- O menu mostra os módulos do plano. Os demais aparecem com a tela "Este recurso faz parte de outro pacote", com o botão "Ver planos".
- O bloqueio também vale no banco de dados e nas buscas de mapas e IA, não só na tela.

## Separação de dados
- Cada representante vê só os próprios dados.
- Na empresa, cada membro vê os próprios registros. Proprietário, administradores e quem tiver a permissão "Ver indicadores da equipe" veem os registros da equipe daquela empresa.
- Nada aparece para outra empresa.

## O que não será simulado
- **E-mails** (aviso ao administrador, convites, vencimentos): o sistema prepara o envio, mas avisa que o e-mail não está configurado até existir um domínio de envio. Os avisos aparecem no sino de notificações.
- **Pagamento:** a contratação continua manual. A estrutura fica pronta para o Stripe (checkout, confirmação pelo servidor, renovação, falha e cancelamento), que só será ligado quando você decidir ativar.

## Detalhes técnicos
- **Mudanças no banco (só acréscimos):**
  - `platform_plans` ganha `trial_days`, `offer_active` e `discount_percent`.
  - Nova tabela `subscription_requests`, com contato, tipo, plano, preço no momento do pedido, empresa, quantidade de usuários, observações e estado `pending_review`.
  - `platform_subscriptions` ganha `trial_ends_at`, `started_at`, `renews_at`, `admin_notes` e `granted_by`, mais novos estados.
  - Nova tabela `subscription_payments`, para pagamentos registrados manualmente.
  - Nova tabela `trial_grants`, para controlar quem já usou o teste.
  - `organization_members` ganha `role` (owner/admin/member), `permissions` e `invited_email`, mais o estado `invited`.
  - `companies`, `visits`, `follow_ups`, `opportunities` e `routes` ganham `organization_id`.
- **Funções no banco (security definer):**
  - `hub_context()`: devolve o plano em vigor, os recursos, a organização e o papel do usuário.
  - `can_use_feature(key)` e `can_view_owner(owner_id)`.
  - Um novo RPC, `platform_action`, para solicitar, aprovar, iniciar teste, convidar, aceitar convite, mudar papel ou permissões, registrar pagamento e suspender.
- **Políticas de acesso:** as regras das tabelas do Hub passam a usar `can_use_feature` + `can_view_owner`. As funções de servidor de mapas e IA verificam o recurso, e o contexto da IA respeita as mesmas regras.
- **Telas:**
  - `/assinatura`, com solicitação e estados.
  - Gestão de equipe na área empresarial, com convite, matriz de permissões e vagas.
  - Abas novas na Área Restrita.
  - Bloqueio por recurso dentro de `StaffPortal`.
- **Testes:** os 17 fluxos do critério de conclusão. As contas de teste serão criadas pelo próprio cadastro, com e-mails de teste, sem alterar Pedro, só com a sua autorização no momento do teste.
