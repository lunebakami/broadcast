# Broadcast

Projeto prático SaaS para organizar conexões e contatos e simular mensagens imediatas ou agendadas. React + TypeScript + Vite, Material UI e Tailwind CSS no frontend; Firebase Auth, Firestore e Cloud Functions no backend.

## Rodar localmente

Requer Node.js 22 e npm. Para iniciar o Emulator Suite, instale também o JDK 21 ou mais recente. Execute na raiz:

```bash
npm install
cp web/.env.example web/.env.local
# Preencha web/.env.local com a configuração pública do aplicativo Firebase.
npm run dev
```

Abra o endereço informado pelo Vite. Sem configuração, a página mostra instruções de conexão. A seção seguinte mostra como usar os emuladores no modo sem faturamento; nenhuma etapa exige React Scripts.

### Executar sem faturamento

Para desenvolver sem cartão e sem projeto na nuvem, teste Auth, Firestore, regras e Functions nos emuladores oficiais. Em dois terminais, na raiz:

```bash
cp web/.env.emulator.example web/.env.emulator
npm run emulators
```

```bash
npm run dev:emulator -w web
```

Abra `http://localhost:5173`, clique em **Continuar com Google** e use uma identidade fictícia no fluxo do Auth Emulator. Dados ficam no Firestore Emulator e são apagados quando ele encerra, a menos que sejam exportados. O painel dos emuladores fica em `http://localhost:4000`. O projeto `demo-broadcast` impede o uso acidental de recursos reais.

As flags nesse arquivo habilitam os emuladores e fazem as operações passarem pela callable Function local. Os task queues e funções agendadas também são emulados sem Cloud Tasks na nuvem. O ambiente local testa a lógica das Functions, mas não reproduz integralmente retries e permissões IAM da produção. O modo gratuito na nuvem é outro caminho: copie `.env.example` para `.env.local` e mantenha `VITE_ENABLE_FUNCTIONS=false`. Nesse modo, o cliente usa regras para gravar no Firestore e atualiza mensagens vencidas quando o app estiver aberto ou voltar a ser aberto.

## Criar o projeto Firebase

1. No [console Firebase](https://console.firebase.google.com/), crie um projeto com o nome **Broadcast**. O ID deve ser globalmente único; por exemplo, `broadcast-seu-identificador` se estiver disponível.
2. Para usar apenas Auth e Firestore com a feature flag de Functions desligada, o plano Spark gratuito é suficiente. Crie o banco **Cloud Firestore**, edição Standard, modo nativo, preferencialmente em `us-central1`. As regras deste repositório serão publicadas no deploy.
3. Em **Authentication → Sign-in method**, habilite apenas **Google** e configure o e-mail de suporte solicitado pelo Google. O primeiro acesso com Google cria a conta automaticamente.
4. Em **Authentication → Settings → Authorized domains**, confirme `localhost` para desenvolvimento e autorize o domínio `SEU_PROJECT_ID.web.app` (e `SEU_PROJECT_ID.firebaseapp.com`, se for usar) para publicação.
5. Em **Configurações do projeto → Seus aplicativos**, registre um aplicativo Web chamado **Broadcast Web**. Copie `apiKey`, `authDomain`, `projectId` e `appId` para `web/.env.local`, usando os nomes definidos em `.env.example`.
6. Mantenha `VITE_FIREBASE_FUNCTIONS_REGION=us-central1`, a mesma região definida em `functions/src/firebase.ts`.
7. No plano Spark, deixe `VITE_ENABLE_FUNCTIONS=false`. Para publicar Functions e usar Cloud Tasks, será necessário associar faturamento e ativar Blaze.

A configuração Web é pública. Credenciais de conta de serviço não devem ser colocadas no frontend. As funções usam a identidade do ambiente do Google Cloud.

## Publicar o modo gratuito

O Hosting, Auth e Firestore podem ser usados no projeto Spark. Configure o projeto e o `.env.local`, depois publique as regras e o frontend:

```bash
npx firebase login
npx firebase use --add
npm run deploy:free
```

Este modo não publica as Functions. O status de mensagens agendadas só muda quando o app aberto identifica uma mensagem vencida ou quando o usuário volta a abrir o app.

## Deploy automático pelo GitHub

O workflow `.github/workflows/firebase.yml` valida lint, formatação e build nos PRs
destinados à `main`. Cada push na `main`, incluindo merges de PRs, publica o frontend,
as regras e os índices do Firestore no projeto `broadcast-68476` após essas verificações.
Também é possível executar o workflow manualmente pela aba Actions na `main`.

O deploy mantém `VITE_ENABLE_FUNCTIONS=false` e `VITE_USE_FIREBASE_EMULATORS=false`.
As publicações são executadas uma por vez para evitar deploys simultâneos.

Secrets do repositório:

- `BROADCAST_WEB_ENV`: conteúdo de `web/.env.local` usado no build de produção.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: identificador do provedor de identidade do GitHub.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: conta de serviço com permissões de deploy.

A autenticação usa Workload Identity Federation com credenciais temporárias,
restrita ao workflow na branch `main` deste repositório. PRs executam as verificações
sem acesso aos secrets de deploy. Referência: [Google GitHub Actions Auth](https://github.com/google-github-actions/auth).

Ao alterar a configuração local do Firebase, atualize o secret:

```bash
gh secret set BROADCAST_WEB_ENV --repo lunebakami/broadcast < web/.env.local
```

## Publicar Functions e Cloud Tasks

```bash
npx firebase login
npx firebase use --add
npm run build
npx firebase deploy --only firestore,functions
```

Selecione o projeto criado. O comando `use --add` grava o vínculo em `.firebaserc`. O primeiro deploy de `deliverMessage` cria a fila correspondente. Caso a CLI solicite habilitar APIs, siga a indicação para o próprio projeto.

Configure as permissões da fila após o deploy. O script abaixo requer [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) e uma conta com permissão de alterar IAM:

```bash
gcloud auth login
bash scripts/configure-queue-iam.sh SEU_PROJECT_ID
```

O script identifica a conta de execução das funções, permite enfileirar tarefas e acessar o Firestore, permite usá-la como identidade da tarefa e concede acesso ao serviço privado `deliverMessage`. As funções usam a mesma conta padrão de execução; se configurar contas diferentes, ajuste as permissões correspondentes. O endpoint de entrega não é público.

Para publicar frontend, regras, Functions e Cloud Tasks usando o plano Blaze:

```bash
npm run deploy
```

As variáveis `VITE_*` são incorporadas ao build. Sempre refaça o build depois de alterá-las.

## Funcionalidades

- Cadastro e login pelo Google com Firebase Auth; o primeiro acesso cria a conta.
- CRUD de conexões e de contatos (nome e telefone).
- Criação de mensagens para um ou mais contatos da conexão selecionada, até 100 destinatários por operação.
- Envio fake imediato e agendamento para até 30 dias no futuro, usando o fuso local do dispositivo na entrada e timestamps absolutos no armazenamento.
- Flag `VITE_ENABLE_FUNCTIONS`: Functions remotas (`true`) ou operação direta do cliente com regras (`false`). O padrão é `false`.
- Flag `VITE_USE_FIREBASE_EMULATORS`: conecta Auth, Firestore e Functions ao Emulator Suite local.
- Consulta, edição e exclusão de mensagens; filtros de status e contato no Firestore, e busca por texto/nome na página carregada.
- Paginação por cursor, com até 10 mensagens por página, na ordem de criação decrescente retornada pelo Firestore.
- Menu de três pontos por contato com “Apagar todas as mensagens”.
- Exclusão do contato apaga suas mensagens enviadas e agendadas, com confirmação.
- Exclusão da conexão é bloqueada enquanto houver mensagens. Sem mensagens, exclui a conexão e seus contatos.
- Atualizações em tempo real com `onSnapshot` e cancelamento dos listeners ao sair ou trocar de conexão.

## Organização

```text
web/src/
  components/   Componentes compartilhados e diálogos
  features/     Autenticação, conexões, contatos e mensagens
  hooks/        Sessão e consultas em tempo real
  lib/
    firebase.ts       Inicialização dos SDKs e flags de ambiente
    mutations/        Uma operação de gravação por arquivo e roteamento por modo
    messageQueries.ts Consultas, contagem e assinatura da página de mensagens
    types.ts          Tipos dos documentos
    errors.ts         Mensagens de erro
functions/src/
  firebase.ts   Inicialização do Admin SDK e região
  validation.ts Validação dos dados de entrada
  mutations.ts  Autenticação, validação da ação e despacho
  mutations/    Uma operação de gravação por arquivo e helpers de transação
  scheduling.ts Gatilho de enfileiramento e processamento
  index.ts      Exportações para o Firebase
scripts/        Configuração das permissões da fila
docs/           Requisitos e decisões de arquitetura
```

O código da aplicação usa funções e componentes funcionais, sem classes próprias.

## Dados e isolamento

Existem apenas três coleções na raiz do Firestore, **sem subcoleções**:

| Coleção       | Dados principais                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `connections` | `ownerId`, `name`, timestamps                                                                                                            |
| `contacts`    | `ownerId`, `connectionId`, `name`, `phone`, timestamps                                                                                   |
| `messages`    | `ownerId`, `connectionId`, `contactId`, nome/telefone do destinatário, `text`, `status`, `scheduledAt`, `sentAt`, `revision`, timestamps |

`ownerId` identifica quem criou cada documento. No modo com Functions, ele sempre vem do token verificado pelo Firebase, nunca do formulário. No modo gratuito do cliente, as regras verificam `ownerId`, os campos e os vínculos entre os registros antes de permitir a gravação. Todas as consultas do frontend incluem o usuário autenticado.

A criação e edição de mensagens e contatos usam transações e atualizam os registros relacionados. No modo gratuito, cada destinatário é processado em uma transação própria; uma falha no meio de um envio para vários contatos pode deixar parte das mensagens criada. No modo Functions, a criação para os destinatários selecionados acontece em uma única transação.

Cada destinatário tem sua própria mensagem. Editar ou excluir um registro não afeta os demais destinatários. Nome e telefone ficam registrados no momento da criação; a tela resolve o nome atual pelo `contactId` usando a lista de contatos em tempo real, sem reescrever as mensagens quando um contato é renomeado. O telefone exibido permanece o registrado no envio.

## Listagem, paginação e contadores

A página de mensagens usa `onSnapshot` com `limit(10)` e cursores `startAfter`. O Firestore ordena por `createdAt` decrescente; o frontend preserva essa ordem. Status e contato são filtrados antes da paginação. A busca textual atua somente nos dez registros carregados, usando o nome atual do contato.

Quando a página retorna exatamente 10 documentos, uma consulta agregada obtém o total do mesmo filtro para calcular se existe próxima página. Quando retorna menos de 10, o total é inferido pela posição da página e pela quantidade recebida, sem consulta agregada. O listener refaz essa decisão quando a página muda em tempo real; a paginação não usa intervalo de polling. O listener anterior é cancelado ao trocar de página ou de filtro.

Os cartões **Enviadas** e **Agendadas** têm um fluxo separado: usam consultas agregadas ao abrir a conexão e a cada 15 segundos. Portanto, os totais do cabeçalho podem demorar até o próximo ciclo para refletir alterações. As contagens retornam números sem baixar o histórico completo de mensagens.

Conexões e contatos continuam sendo carregados integralmente por listeners. No modo gratuito, excluir um contato ou limpar suas mensagens aceita até 450 mensagens por operação; excluir uma conexão sem mensagens aceita até 499 contatos. Essas exclusões usam lotes, enquanto o modo Functions usa transações. O projeto não implementa exclusões em massa para grandes volumes.

## Agendamento no modo Functions

1. `mutate` cria a mensagem com status `scheduled` e uma revisão única.
2. `enqueueMessage`, disparada pela escrita no Firestore, enfileira a tarefa com `scheduleTime`.
3. `deliverMessage` compara a revisão e o status atuais em uma transação e registra `sent` e `sentAt`.
4. O listener do frontend recebe o novo status mesmo que o usuário tenha fechado e reaberto a página.

A edição gera uma nova revisão. Tarefas antigas ficam inofensivas e terminam sem alteração; mensagens excluídas também são ignoradas. A tarefa não envia SMS, WhatsApp ou qualquer comunicação real. Uma mensagem já enviada pode ter seu texto editado sem novo envio ou alteração do horário original.

O gatilho de enfileiramento permite retries e usa IDs determinísticos para evitar tarefas duplicadas. A entrega também é idempotente. O serviço pode executar após o horário solicitado; não há garantia de precisão no segundo exato.

## Agendamento no modo gratuito

O frontend consulta os agendamentos vencidos a cada 10 segundos, em lotes de até 10 mensagens por usuário. Também verifica ao abrir o app, ao receber foco e ao mudar a visibilidade da página. Uma transação confirma que a mensagem ainda está agendada e que o horário venceu antes de marcar o envio simulado. As regras também permitem que o proprietário antecipe explicitamente o envio ao editar a mensagem.

Se o navegador estiver fechado, a mensagem permanece agendada até o próximo acesso. Havendo mais de 10 mensagens vencidas, elas são processadas nos próximos ciclos. A atualização não tem garantia de precisão no segundo exato; não há serviço executando esse fluxo com o navegador fechado.

Referências: [Firebase Task Queue Functions](https://firebase.google.com/docs/functions/task-functions), [limites do Cloud Tasks](https://docs.cloud.google.com/tasks/docs/quotas) e [integração MUI/Tailwind](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/).

## Validação

```bash
npm run build       # TypeScript e bundle do frontend; compilação das funções
npm run typecheck   # Verificação de tipos
npm run lint        # Regras Airbnb para JavaScript/TypeScript e React
npm run format      # Formatação de todos os arquivos suportados pelo Prettier
npm run emulators   # Auth, Firestore e Functions localmente, sem faturamento
```

Após configurar e publicar o Firebase, confira o fluxo real:

1. Cadastre dois usuários. Crie uma conexão e contatos com o primeiro; o segundo não deve visualizar nem alterar esses registros.
2. Abra duas abas da mesma conta e confira a atualização em tempo real de conexões, contatos e mensagens.
3. Envie uma mensagem imediata para dois contatos e confira os dois registros como enviados.
4. Crie mais de 10 mensagens, navegue entre páginas e confira a ordem de criação, os filtros e o limite de 10 registros por página.
5. No modo gratuito sem Functions, agende uma mensagem para alguns minutos depois e deixe o app aberto para conferir o status depois do horário. Ao voltar a abrir o app, mensagens vencidas também são atualizadas.
6. Edite um agendamento antes do disparo; o horário antigo não deve processar a mensagem.
7. Exclua uma mensagem agendada e confirme que ela não reaparece após o horário.
8. Apague as mensagens de um contato e confirme que as do outro permanecem.
9. Confira o bloqueio ao excluir conexão com mensagens e a exclusão em cascata ao remover um contato.
10. Confira login com Google, edição e exclusão de cada entidade.

A compilação local não substitui essa validação com Auth, regras, IAM e Cloud Tasks publicados.
