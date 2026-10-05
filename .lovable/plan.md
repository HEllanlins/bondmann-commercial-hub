# Evolução do Bondmann Commercial Hub

## Base preservada
Manter TanStack Start, páginas, identidade Bondmann, autenticação e backend existentes. Evoluir de forma localizada, com compatibilidade Vercel, PWA e futura integração Capacitor. CRM, mapas, IA complexa, checkout e gateway de pagamento não serão simulados.

## Administrador confirmado
- Manter a conta existente de Hellan, **hellan.lins@gmail.com**, como administrador da plataforma. Pedro permanece Cliente.
- Autorizar pelo perfil registrado no banco, nunca pelo e-mail no navegador.
- Administrador acessa cliente, representante, empresa e administração sem exigir assinatura, vínculo empresarial ou limite de usuários.
- Impedir perda do próprio acesso administrativo e diferenciar administrador da plataforma de proprietário de empresa cliente.

## 1. Temas e entrada pública
- Corrigir contraste de textos, botões, campos, tabelas, menus e janelas nos dois temas. Corrigir também textos sobre fotografias, que hoje reutilizam cores inadequadas no modo escuro.
- Disponibilizar claro / escuro / sistema no cabeçalho público, com preferência persistente.
- Preservar apresentação pública; **Entrar** abre escolha Cliente / Representante / Empresa.
- Empresa oferece Proprietário / Funcionário. Adicionar **Área Restrita** discreta no rodapé, com verificação real de administrador.

## 2. Autenticação e destinos
- Reutilizar login, cadastro, confirmação, recuperação e Google, mantendo o contexto escolhido durante o fluxo.
- Separar tipo de experiência de privilégios administrativos: escolher Representante ou Empresa não concede função administrativa nem acesso ao painel interno atual.
- Cliente → área do cliente; representante → assinatura ou painel; proprietário → assinatura empresarial ou painel; funcionário → pendência, recusa/bloqueio ou painel aprovado.
- Preservar acessos existentes da equipe Bondmann e redirecionamentos centralizados para o domínio da aplicação.

## 3. Planos, recursos e assinaturas
- Criar dados centralizados e persistentes para planos, recursos, vínculos entre planos e recursos, assinaturas e histórico.
- Intermediário: **R$ 69,90/mês**, aproximadamente 5 recursos. Plus: **R$ 119,90/mês**, aproximadamente 10. Enterprise: completo, preço sob configuração. Empresa: **R$ 300/mês**, até **10 funcionários** inicialmente.
- Permitir administrar preços, limites, descrições, status, benefícios e recursos sem valores espalhados pelas telas.
- Estados de assinatura: pendente, ativa, vencida e cancelada, com verificação de validade. Somente administrador poderá ativar manualmente; selecionar plano não libera acesso nem representa pagamento.
- Página de planos e situação da assinatura, troca solicitada de plano e histórico. Preparar descontos, renovação e preço personalizado como dados administráveis, sem integração financeira fictícia.
- Recursos em estados indisponível / Em breve / disponível. Ativar um recurso não implementado nunca transforma o aviso em funcionalidade falsa.

## 4. Empresa e funcionários
- Organizações separadas das empresas prospectadas existentes, com proprietário, informações e assinatura.
- Cadastro empresarial e solicitação de vínculo pelo funcionário, usando identificação da organização; estado inicial Pendente.
- Proprietário visualiza, aprova, recusa e bloqueia funcionários, respeitando limite contratado e assinatura ativa. Bloqueio empresarial não bloqueia a conta global do usuário.
- Cada funcionário mantém perfil, painel e atividades individuais; proprietário acompanha apenas sua organização e equipe.
- Implementar estados vazios verdadeiros para utilização e atividades ainda não registradas; registrar ações de vínculo e assinatura no histórico.

## 5. Administração e cliente
- Evoluir administração com Usuários, Empresas contratantes, Representantes, Assinaturas, Planos e Recursos da Plataforma.
- Listas com filtros, situação real, detalhes básicos e confirmações para alterações de acesso e assinatura.
- Área do cliente mantém catálogo e recebe solicitação de produto com quantidade, confirmação e histórico; equipe/admin consulta as solicitações.
- Preparar endereço comercial configurável e futura notificação por e-mail; não afirmar envio enquanto não houver integração.
- Preservar espaços de CRM, prospecção, rotas e assistentes como Em breve quando ainda sem implementação.

## Detalhes técnicos
- Reutilizar `profiles`, `user_roles`, catálogo e tabelas comerciais. Novos tipos de experiência, organizações e assinaturas serão estruturas adicionais, sem duplicar tabelas existentes ou transformar proprietário em administrador da plataforma.
- Aplicar migrações aditivas com permissões explícitas e isolamento por usuário/organização. Validação de assinatura e vínculo também nas operações de dados, não apenas nos menus.
- Funções internas usando os padrões existentes de TanStack Start e autenticação; segredos permanecem fora do navegador.
- Páginas protegidas sob o layout autenticado existente; cada nova página terá metadados próprios e links válidos.
- Registrar decisões estruturais e manter lista de tarefas para não perder pendências.

## Verificação e entrega
- Testar navegação pública, seletor de acesso, temas, planos, estados de assinatura, menus, solicitações e fluxos empresariais.
- Verificar Hellan sem limites e Pedro sem acesso administrativo; usar sessões autorizadas para testes, sem pedir senhas. Qualquer teste que exija outra conta solicitará a autorização correspondente.
- Verificar telas em computador e celular, erros de execução e resultado da compilação automática da plataforma. Não executar build manual, pois este ambiente já o realiza automaticamente.
- Confirmação e recuperação recebidas por e-mail e Google completo só serão declarados testados se efetivamente exercitados; recebimento e contas externas podem exigir sua participação.
- Informar claramente o que foi implementado, testado e o que depende de gateway de pagamento, domínio de e-mail, credenciais Google e configuração/publicação na Vercel.