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

Abra `http://localhost:5173` e crie uma conta fictícia na tela de cadastro. Dados ficam no Firestore Emulator e são apagados quando ele encerra, a menos que sejam exportados. O painel dos emuladores fica em `http://localhost:4000`. O projeto `demo-broadcast` impede o uso acidental de recursos reais.

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
- Consulta, edição e exclusão de mensagens; filtros por status, contato e texto.
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
  lib/          Firebase, tipos e mensagens de erro
functions/src/
  firebase.ts   Inicialização do Admin SDK e região
  validation.ts Validação dos dados de entrada
  mutations.ts  Operações autenticadas e transações
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

Transações mantêm as operações relacionadas consistentes. A criação de mensagens e contatos também atualiza os registros relacionados, evitando que exclusões simultâneas deixem novos registros órfãos.

Cada destinatário tem sua própria mensagem. Editar ou excluir um registro não afeta os demais destinatários. Nome e telefone ficam registrados no momento da criação; editar o contato não reescreve o histórico.

## Agendamento no modo Functions

1. `mutate` cria a mensagem com status `scheduled` e uma revisão única.
2. `enqueueMessage`, disparada pela escrita no Firestore, enfileira a tarefa com `scheduleTime`.
3. `deliverMessage` compara a revisão e o status atuais em uma transação e registra `sent` e `sentAt`.
4. O listener do frontend recebe o novo status mesmo que o usuário tenha fechado e reaberto a página.

A edição gera uma nova revisão. Tarefas antigas ficam inofensivas e terminam sem alteração; mensagens excluídas também são ignoradas. A tarefa não envia SMS, WhatsApp ou qualquer comunicação real. Uma mensagem já enviada pode ter seu texto editado sem novo envio ou alteração do horário original.

O gatilho de enfileiramento permite retries e usa IDs determinísticos para evitar tarefas duplicadas. A entrega também é idempotente. O serviço pode executar após o horário solicitado; não há garantia de precisão no segundo exato. Para o teste prático, as listas são carregadas integralmente e as exclusões relacionadas usam uma transação, sem paginação ou processamento de grandes volumes.

## Agendamento no modo gratuito

O frontend escuta mensagens pelo Firestore em tempo real. Quando uma mensagem agendada vence, uma transação muda seu status para enviado. A regra do Firestore só permite essa transição depois do horário previsto. Se o navegador estiver fechado, a mensagem continua como agendada até que o usuário reabra o app; nesse momento ela é atualizada. Nenhum processo roda em segundo plano no horário exato neste modo.

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
4. No modo gratuito sem Functions, agende uma mensagem para alguns minutos depois e deixe o app aberto para conferir o status depois do horário. Ao voltar a abrir o app, mensagens vencidas também são atualizadas.
5. Edite um agendamento antes do disparo; o horário antigo não deve processar a mensagem.
6. Exclua uma mensagem agendada e confirme que ela não reaparece após o horário.
7. Apague as mensagens de um contato e confirme que as do outro permanecem.
8. Confira o bloqueio ao excluir conexão com mensagens e a exclusão em cascata ao remover um contato.
9. Confira login com Google, edição e exclusão de cada entidade.

A compilação local não substitui essa validação com Auth, regras, IAM e Cloud Tasks publicados.

Verificações locais realizadas: build do frontend e das funções, formatação com Prettier, sintaxe do script de IAM e oito verificações de validação de entrada (telefone, texto e limites de agendamento). A inspeção visual não foi realizada porque nenhum navegador estava disponível nesta sessão.

A auditoria de dependências ainda aponta cinco ocorrências moderadas transitivas, incluindo duas na árvore de produção, em `uuid`/`gaxios` e no tooling do Firebase. As versões diretas foram atualizadas; não foram aplicados overrides incompatíveis nem downgrade forçado da CLI.
