# Estado da evolução — outubro de 2026

A base TanStack Start foi preservada. A entrada pública oferece Cliente, Representante e Empresa (proprietário ou funcionário). Os tipos de experiência são separados das funções de autorização. Hellan continua administrador; Pedro continua Cliente.

## Entregue nesta etapa
- Temas claro/escuro/sistema também no site público, com preferência persistente.
- Planos centralizados no banco: Intermediário, Plus, Enterprise e Empresa. Seleção registra pedido pendente, sem simular pagamento.
- Organizações com código de entrada, solicitação individual, aprovação/recusa/bloqueio, limite do plano e histórico.
- Administração restrita com usuários, empresas, representantes, assinaturas, planos, recursos e solicitações.
- Administrador não depende de assinatura; recursos sem implementação permanecem Em breve.
- Catálogo com quantidade/unidade/observações e registro da solicitação; histórico próprio do cliente e fila comercial.
- Gravação de plano e seus recursos em uma operação atômica, com autorização administrativa.

## Verificações realmente executadas
- Compilação automática: build OK após as alterações.
- Navegador: escolha de acesso, planos individuais/empresariais, todas as novas áreas de Hellan, área do cliente de Pedro.
- Pedro é redirecionado para sua área ao tentar administração ou painel interno; sem plano, não recebe recursos de representante; sem vínculo, funcionário mostra solicitação de acesso.
- Tema escuro persistiu após recarregar; telas de cliente e planos foram verificadas em 390 × 844 e 1280 × 1800, sem rolagem horizontal da página nos testes.
- Plano Intermediário salvo com os mesmos valores, recarregado e relido; resposta de gravação 204.
- Nenhum erro de página apareceu nos testes executados.

## Limitações e testes ainda pendentes
- Não há produto publicado. O envio real de solicitação não foi testado; não foram inventados produtos.
- Cadastro de organização, aprovação de funcionário e ativação/cancelamento/vencimento de assinatura ainda precisam de teste completo com dados de teste identificados. Não alterei o acesso real de Pedro nem ativei assinaturas fictícias.
- Google completo, recebimento real de confirmação/recuperação por e-mail e deploy Vercel não foram validados nesta etapa.
- Pagamento online, notificações de e-mail, CRM, prospecção, rotas, IA e relatórios não implementados não executam operações.
- Vercel: manter VITE_SITE_URL=https://bondmann-company.vercel.app. Google fora da hospedagem gerenciada exige configuração OAuth própria e VITE_AUTH_OAUTH_MODE=direct; retorno público em /login.
- PWA preservado. Android/Capacitor não compilado; deploy Vercel ainda requer validação do ambiente de hospedagem.

---

# Bondmann Commercial Hub

PROJETO: PLATAFORMA COMERCIAL BONDMANN



Quero iniciar a construção de uma plataforma web profissional para uma operação comercial ligada à Bondmann Química.



IMPORTANTE: este projeto NÃO é para ser hospedado na Lovable Cloud.



O destino final de hospedagem/deploy será a Vercel.



A aplicação deve ser construída com arquitetura compatível com Vercel, priorizando:



- React

- Vite

- TypeScript

- Supabase

- PWA

- Capacitor para futura geração de aplicativo Android através do Android Studio



Se houver alguma limitação técnica que impeça Vite, utilize uma alternativa React compatível com Vercel, mas NÃO utilize uma arquitetura que gere problemas de build/deploy na Vercel.



Não criar dependência desnecessária de Lovable Cloud.



O Supabase deve ser o backend principal do projeto e, sempre que possível dentro da integração da Lovable, deve ser gerenciado/conectado pela própria Lovable para facilitar a evolução do projeto.



---



1. OBJETIVO DO SISTEMA



A plataforma terá duas grandes finalidades:



1. Apresentar a Bondmann, seus produtos, soluções, segmentos, serviços e canais de contato para clientes e visitantes.



2. Criar uma plataforma comercial interna para representantes/colaboradores, com:



- prospecção de empresas;

- organização de empresas;

- roteirização;

- visitas;

- CRM;

- follow-ups;

- inteligência sobre produtos e aplicações;

- dashboard comercial;

- assistência por IA;

- futuramente automações e inteligência comercial.



A plataforma deve ser construída de maneira modular para que novos recursos possam ser adicionados posteriormente sem precisar reconstruir a aplicação.



NÃO tente implementar todas as funcionalidades futuras neste primeiro momento.



A prioridade agora é construir uma fundação sólida, segura, escalável e visualmente profissional.



---



2. STACK PRINCIPAL



Utilizar:



- React

- TypeScript

- Vite

- Supabase

- PWA

- Capacitor

- Vercel



Preferências:



- código organizado;

- componentes reutilizáveis;

- arquitetura modular;

- responsividade completa;

- mobile-first quando apropriado;

- boa experiência em desktop;

- boa experiência em celular;

- estrutura preparada para Android através do Capacitor.



O projeto deverá continuar sendo uma aplicação web/PWA mesmo após a integração do Capacitor.



Não criar uma aplicação Android separada neste momento.



O Capacitor deve apenas preparar a aplicação web para futura abertura/build no Android Studio.



---



3. HOSPEDAGEM



A hospedagem oficial do projeto será:



Vercel.



Não utilizar Lovable Cloud como hospedagem final.



Preparar o projeto para:



- npm install;

- npm run build;

- deploy na Vercel;

- funcionamento correto das rotas em produção;

- variáveis de ambiente;

- integração segura com Supabase.



Evitar qualquer configuração específica que faça o projeto depender do ambiente interno da Lovable.



---



4. SUPABASE



Utilizar Supabase como backend principal.



Utilizar:



- Supabase Auth;

- PostgreSQL;

- Row Level Security (RLS);

- tabelas relacionais;

- policies;

- storage quando necessário futuramente.



A arquitetura deve ser preparada para que a Lovable consiga evoluir o banco posteriormente.



Não colocar credenciais secretas diretamente no código-fonte.



Nunca expor:



- service role key;

- secrets;

- tokens privados;

- credenciais administrativas.



A chave pública/anônima do Supabase pode ser utilizada conforme a arquitetura oficial do Supabase.



Toda operação sensível deve ser protegida por autenticação, autorização e RLS.



---



5. AUTENTICAÇÃO



Criar um sistema de autenticação funcional.



Métodos inicialmente desejados:



E-mail e senha



Permitir:



- cadastro;

- login;

- logout;

- recuperação de senha;

- alteração de senha;

- sessão persistente;

- tratamento de sessão expirada;

- mensagens de erro amigáveis.



Google Login



Implementar login com Google através do Supabase Auth/OAuth.



O fluxo deve ser funcional e preparado para produção.



Não criar apenas um botão visual de "Entrar com Google".



O botão deve realmente iniciar o fluxo OAuth do Supabase.



A arquitetura deve considerar corretamente:



- redirect URL;

- callback;

- sessão;

- criação automática do usuário;

- associação do usuário ao perfil interno.



Deixar claramente documentado no projeto quais configurações externas do Google/Supabase ainda precisarão ser preenchidas manualmente caso sejam necessárias, sem colocar secrets no frontend.



---



6. PERFIS DE USUÁRIO



Criar uma estrutura de usuários baseada em perfil/role.



Inicialmente teremos:



ADMINISTRADOR



Acesso completo ao sistema administrativo.



COLABORADOR



Acesso ao painel interno de acordo com suas permissões.



CLIENTE



Acesso à área normal do cliente, sem acesso aos dados internos/comerciais.



VISITANTE



Usuário não autenticado navegando pelo site público.



---



7. PRIMEIRO ADMINISTRADOR



O primeiro administrador será criado posteriormente com meu e-mail.



A estrutura do banco deve permitir que esse primeiro usuário seja definido como administrador.



IMPORTANTE:



Um usuário NÃO pode simplesmente escolher "Administrador" durante o cadastro.



O cadastro público deve sempre criar inicialmente um usuário como:



CLIENTE.



Somente um administrador autorizado poderá promover esse usuário para:



- COLABORADOR;

- ADMINISTRADOR.



---



8. SISTEMA DE PERMISSÕES



Não depender somente de esconder menus no frontend.



A segurança precisa existir também no backend/banco.



Utilizar Supabase RLS e políticas apropriadas.



Preparar a arquitetura para permissões granulares no futuro.



Exemplo:



Um colaborador pode ter:



- dashboard;

- empresas;

- prospecção;

- rotas;

- CRM.



Enquanto outro colaborador pode ter permissões diferentes.



O administrador deverá futuramente poder controlar essas permissões.



Nesta primeira etapa, criar a estrutura necessária para isso, mas não precisamos construir ainda uma tela extremamente complexa de gerenciamento de permissões.



---



9. SEPARAÇÃO ENTRE CLIENTE E ÁREA INTERNA



O sistema deverá reconhecer o perfil autenticado e apresentar a interface correspondente.



Visitante



Acesso:



- Landing page;

- empresa;

- produtos;

- soluções;

- serviços;

- contato;

- IA pública.



Cliente



Acesso:



- área pública;

- produtos;

- soluções;

- atendimento;

- IA;

- perfil/minha conta.



NÃO deve acessar:



- CRM;

- prospecções;

- rotas comerciais;

- outros clientes;

- relatórios internos;

- usuários;

- configurações administrativas.



Colaborador



Acesso ao painel interno de acordo com suas permissões.



Administrador



Acesso completo ao painel administrativo.



---



10. ESTRUTURA VISUAL



Criar uma identidade visual profissional, moderna e tecnológica para uma empresa química/industrial.



A interface deve transmitir:



- confiança;

- tecnologia;

- precisão;

- indústria;

- profissionalismo;

- inovação.



Não quero um dashboard genérico de template.



Criar uma identidade visual própria para a plataforma.



A interface deve funcionar perfeitamente em:



- computador;

- notebook;

- tablet;

- celular.



Evitar elementos gigantescos que prejudiquem o uso em telas pequenas.



---



11. LANDING PAGE PÚBLICA



Criar inicialmente a estrutura da landing page.



Seções:



Hero



Apresentação da Bondmann e chamada principal.



Sobre a empresa



Área preparada para informações institucionais.



Soluções



Apresentar os principais segmentos/áreas de atuação.



Inicialmente preparar estrutura para categorias como:



- Agro;

- Automotivo;

- Industrial;

- Metalurgia;

- Construção;

- Limpeza/Higiene;

- Tratamento de água;

- outros segmentos que serão definidos posteriormente.



Não inventar informações específicas sobre a empresa.



Deixar o conteúdo estruturado para ser substituído/ajustado posteriormente com informações oficiais.



Produtos



Criar uma área preparada para o catálogo.



Serviços



Criar uma seção para serviços técnicos e comerciais.



Contato



Criar estrutura para:



- telefone;

- WhatsApp;

- e-mail;

- endereço;

- mapa;

- Instagram;

- outros canais.



Os dados reais de contato serão definidos posteriormente.



Não inventar contatos.



IA



Adicionar espaço visual para o futuro assistente de IA da Bondmann.



---



12. CATÁLOGO DE PRODUTOS



Criar a estrutura inicial para produtos.



Cada produto deverá futuramente poder possuir:



- nome;

- código;

- descrição;

- categoria;

- segmento;

- aplicação;

- características;

- documentação;

- imagem;

- status;

- produtos relacionados.



A estrutura deve permitir relacionar:



PRODUTO → APLICAÇÃO → SEGMENTO → NECESSIDADE.



Isso será extremamente importante para a futura IA comercial.



Não cadastrar produtos fictícios neste momento.



A base real será alimentada posteriormente a partir das informações oficiais da Bondmann.



---



13. PAINEL INTERNO



Criar a estrutura inicial do painel administrativo/comercial.



Menu preparado para:



- Dashboard;

- Prospecção;

- Empresas;

- Rotas;

- CRM;

- Visitas;

- Follow-ups;

- Produtos;

- Relatórios;

- IA Comercial;

- Usuários;

- Configurações.



Nesta primeira etapa, não é necessário implementar toda a lógica de cada módulo.



Criar a arquitetura, navegação e telas-base de forma organizada, deixando claro quais módulos ainda estão em desenvolvimento.



---



14. DASHBOARD INICIAL



Criar um dashboard administrativo preparado para futuramente mostrar:



- visitas do dia;

- empresas prospectadas;

- leads;

- negociações;

- follow-ups;

- clientes;

- oportunidades;

- atividades recentes.



Neste primeiro momento podemos utilizar estados vazios/empty states em vez de inventar dados.



Exemplo:



"Você ainda não possui visitas registradas."



"Comece sua primeira prospecção."



---



15. IA



Preparar a arquitetura para duas IAs diferentes.



IA 1 — ASSISTENTE COMERCIAL INTERNO



Será utilizada por administradores e colaboradores.



Futuramente poderá:



- pesquisar empresas;

- pesquisar clientes;

- criar registros;

- consultar histórico;

- sugerir empresas;

- sugerir produtos;

- criar roteiros;

- registrar visitas;

- criar follow-ups;

- consultar CRM;

- resumir informações;

- responder perguntas sobre produtos;

- auxiliar o representante.



IA 2 — ASSISTENTE PARA CLIENTES



Será utilizada na área pública/cliente.



Futuramente poderá:



- explicar a Bondmann;

- explicar produtos;

- ajudar a encontrar soluções;

- entender necessidades;

- fazer perguntas;

- realizar pré-atendimento;

- qualificar leads;

- coletar dados de contato;

- encaminhar o cliente para atendimento humano.



IMPORTANTE:



Nesta primeira etapa NÃO é necessário implementar a IA completa.



Preparar a arquitetura visual e técnica para que ela possa ser integrada posteriormente.



A camada de IA deve ser desacoplada do restante do sistema para permitir trocar o provedor posteriormente.



A primeira IA poderá utilizar um provedor gratuito para testes.



Posteriormente poderemos migrar para um provedor pago, possivelmente OpenAI.



A troca do provedor não deve exigir reconstrução do frontend.



---



16. SEGURANÇA



Este projeto terá dados comerciais e dados pessoais de usuários.



Segurança é prioridade desde a primeira versão.



Implementar as melhores práticas apropriadas à arquitetura.



No mínimo:



- Supabase Auth;

- Row Level Security;

- autorização por role;

- proteção de rotas;

- proteção de dados por usuário;

- validação de entrada;

- sanitização quando necessária;

- tratamento seguro de erros;

- não expor secrets;

- não expor service role key;

- não confiar apenas no frontend para autorização;

- evitar XSS;

- evitar exposição desnecessária de dados;

- políticas RLS específicas;

- sessões corretamente gerenciadas;

- logout correto;

- recuperação de senha segura;

- OAuth configurado corretamente;

- proteção das operações administrativas;

- princípio do menor privilégio.



Não retornar mensagens de erro contendo secrets, SQL, stack traces ou informações internas para o usuário final.



Não armazenar senhas manualmente.



Usar exclusivamente o sistema de autenticação apropriado do Supabase.



---



17. PWA



Configurar a aplicação como Progressive Web App.



Preparar:



- manifest;

- ícones;

- nome da aplicação;

- tema;

- instalação no navegador;

- comportamento adequado em celular;

- service worker conforme apropriado;

- experiência semelhante a aplicativo.



A aplicação deve continuar funcionando normalmente como website.



---



18. CAPACITOR



Preparar o projeto para integração com Capacitor.



Instalar/configurar a base necessária para posteriormente executar:



- npx cap add android;

- npx cap sync;

- npx cap open android.



Não criar funcionalidades nativas desnecessárias agora.



O objetivo é deixar a aplicação preparada para que posteriormente eu possa abrir o projeto no Android Studio e gerar o APK.



A aplicação deve continuar sendo a mesma base React/PWA utilizada na web.



---



19. RESPONSIVIDADE



Priorizar experiência:



Desktop



Dashboard completo, sidebar e telas comerciais.



Mobile



Navegação adaptada para celular.



Botões grandes o suficiente para toque.



Cards responsivos.



Tabelas que não estourem a tela.



Menus adaptados.



Formulários fáceis de utilizar.



O painel comercial deverá ser utilizável em campo por um representante utilizando o celular.



---



20. BANCO DE DADOS — PRIMEIRA ESTRUTURA



Criar uma estrutura inicial preparada para crescer.



Entidades esperadas futuramente:



- profiles;

- user_roles;

- permissions;

- companies;

- contacts;

- products;

- segments;

- applications;

- leads;

- visits;

- follow_ups;

- routes;

- route_stops;

- opportunities;

- ai_conversations;

- ai_messages;

- notifications.



Não é necessário implementar todas as entidades completamente agora.



Criar somente as estruturas necessárias para a fundação e deixar o restante planejado de forma modular.



---



21. QUALIDADE DE CÓDIGO



Manter:



- TypeScript;

- componentes reutilizáveis;

- separação de responsabilidades;

- hooks quando apropriado;

- services para integrações;

- camada de autenticação;

- camada de autorização;

- camada de acesso ao Supabase;

- componentes de UI reutilizáveis;

- tratamento de loading;

- tratamento de erro;

- empty states;

- estados de autenticação.



Evitar:



- código duplicado;

- lógica comercial espalhada pelos componentes;

- secrets hardcoded;

- dados fictícios tratados como dados reais;

- dependências desnecessárias;

- soluções que dificultem o deploy na Vercel.



---



22. EXPERIÊNCIA DE USUÁRIO



A aplicação deve ter:



- loading states;

- skeletons quando fizer sentido;

- mensagens de sucesso;

- mensagens de erro;

- confirmação para ações destrutivas;

- empty states;

- feedback visual;

- navegação clara;

- breadcrumbs quando necessário;

- responsividade.



Não deixar telas parecendo quebradas quando ainda não possuem dados.



---



23. O QUE NÃO FAZER AGORA



NÃO implementar ainda:



- sistema completo de roteirização;

- integração completa com mapas;

- pesquisa automática de empresas;

- CRM completo;

- inteligência comercial completa;

- IA comercial completa;

- IA pública completa;

- integração paga com OpenAI;

- automações complexas;

- relatórios avançados;

- sistema financeiro;

- marketplace;

- funcionalidades que não foram especificadas.



Esses recursos serão desenvolvidos em etapas posteriores.



A prioridade agora é criar uma fundação sólida.



---



24. RESULTADO ESPERADO DESTA PRIMEIRA ETAPA



Ao finalizar esta etapa, quero ter uma aplicação funcionando com:



1. React + TypeScript + Vite;

2. estrutura compatível com Vercel;

3. Supabase conectado;

4. autenticação;

5. cadastro;

6. login;

7. logout;

8. recuperação de senha;

9. login funcional com Google via Supabase;

10. perfis de usuário;

11. separação cliente/colaborador/administrador;

12. proteção de rotas;

13. RLS inicial;

14. landing page profissional;

15. área autenticada do cliente;

16. estrutura inicial do painel interno;

17. PWA configurado;

18. estrutura preparada para Capacitor;

19. arquitetura preparada para IA;

20. arquitetura preparada para futuras expansões.



Antes de finalizar, verifique se:



- npm run build funciona;

- não existem erros TypeScript;

- não existem secrets expostos;

- a aplicação está preparada para deploy na Vercel;

- as rotas funcionam corretamente;

- autenticação funciona;

- logout funciona;

- cadastro funciona;

- Google OAuth está estruturalmente preparado/funcional conforme as credenciais disponíveis;

- usuários clientes não conseguem acessar o painel interno;

- o controle de acesso não depende somente da interface;

- as policies iniciais do Supabase estão configuradas corretamente.



IMPORTANTE:



Não tente implementar funcionalidades futuras apenas para "completar" a aplicação.



Construa uma base profissional, limpa, segura e extensível.



Depois desta etapa, vamos continuar o desenvolvimento em etapas menores, adicionando funcionalidades conforme os requisitos forem definidos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/043270a0-e364-4cfc-b2af-291531194d0d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
