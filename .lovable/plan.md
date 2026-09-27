# Bondmann Commercial Hub — próxima etapa (em fases)

O pedido é grande demais para uma única entrega segura. Vou dividir em 3 fases, cada uma com build e testes reais antes da próxima.

## Fase 1 — Acesso, funções e autenticação própria (esta entrega)
1. **Hellan → Administrador**: localizar o único usuário existente no banco (sem usar o nome do e-mail) e trocar a função dele para administrador por migração. Se houver mais de um usuário, paro e pergunto.
2. **Nova função "Funcionário"**: adicionar ao sistema de funções. Funcionário, colaborador e administrador entram no painel; cliente vai só para a área do cliente. As rotas internas checam a função (não só o menu).
3. **Tela Administração → Usuários**: nome, e-mail, função, status, data de cadastro, último acesso; filtros (todos, por função, ativos/inativos); alterar função e ativar/desativar com janela de confirmação. O administrador não pode remover o próprio acesso.
4. **Autenticação com cara de Bondmann**:
   - Login: mostrar/ocultar senha, lembrar sessão, Google, esqueci senha, criar conta, mensagens amigáveis.
   - Cadastro → tela "Enviamos um link de confirmação" com o e-mail, "Reenviar e-mail" e "Voltar para o login".
   - `/auth/confirm` → "E-mail confirmado!" → botão para `/login`.
   - `/auth/reset-password` → só abre com link válido; requisitos de senha; "Senha alterada com sucesso".
   - Google volta para o próprio site e leva cada pessoa para a área certa; novos usuários Google entram como cliente.
   - Endereços de retorno centralizados num só lugar, usando o domínio do site (preview agora, Vercel depois via variável `VITE_SITE_URL`).
5. **E-mails de autenticação com marca Bondmann** (assuntos "Confirme seu e-mail — Bondmann Commercial Hub" etc.). O envio com remetente próprio exige um domínio de e-mail verificado; preparo os modelos e informo o que falta.
6. **Modo claro / escuro / sistema** com preferência salva.

## Fase 2 — Operação comercial
Prospecção (filtros por segmento, cidade, bairro, status, potencial; dados DEMO marcados), CRM com o funil de 9 etapas e histórico, Planejar rota (selecionar, ordenar por proximidade quando houver coordenadas, "Como chegar" pelo Google Maps, registrar visita), Clientes, Segmentos, dashboard com os novos indicadores.

## Fase 3 — Área do cliente e assistentes IA
Menu completo do cliente (Meus interesses, Atendimento, Perfil), registro de interesse e solicitações, "Bondmann Assistente" (cliente) e "Assistente Bondmann" (equipe) consultando o catálogo real pelo servidor, sem chaves no navegador, com aviso "Não encontrei essa informação no catálogo…" e confirmação antes de ações.

## Sempre
PWA e compatibilidade com Capacitor/Vercel preservados; build executado e testes reais no navegador (logado como Hellan) ao fim de cada fase; relatório honesto do que foi e não foi testado.

## Detalhes técnicos
- Enum `app_role` ganha `funcionario`; `is_staff` inclui a nova função; `admin_set_user_role` passa a aceitá-la; novo `admin_set_user_active` (ban via `auth.users.banned_until` feito no servidor com checagem de admin).
- `src/lib/auth/redirects.ts` centraliza URLs (`VITE_SITE_URL` ou `window.location.origin`).
- Guardas de função no layout do painel (`beforeLoad`) além da RLS.
- Na Vercel: cadastrar o domínio final como URL permitida de retorno da autenticação.
