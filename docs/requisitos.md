# Requisitos do projeto prático Broadcast

## Decisões confirmadas

- Escopo de teste prático, com implementação simples e sem cobertura excessiva de casos excepcionais.
- React com TypeScript e Vite no diretório `web/`.
- Firebase Auth, Firestore e Cloud Functions; funções no diretório `functions/`.
- Material UI para componentes e Tailwind CSS para estilização.
- Paradigma funcional, código limpo e organizado, sem orientação a objeto no código da aplicação.
- Firestore em tempo real e sem subcoleções.
- Um usuário representa um cliente independente. Clientes não podem acessar dados de outros clientes.
- Cadastro e login pelo OAuth do Google usando Firebase Auth.
- CRUD de conexões, contendo nome.
- CRUD de contatos, contendo nome e telefone, vinculados a uma conexão.
- Mensagens de texto para um ou mais contatos da conexão selecionada.
- Envio simulado imediato ou agendado, sem disparo real.
- Filtros de mensagens enviadas e agendadas.
- Cloud Functions devem mudar mensagens agendadas para enviadas no horário do disparo.
- Usar Firebase Task Queue Functions com Google Cloud Tasks e `scheduleTime` para processar mensagens agendadas, sem consulta periódica. A função apenas registra o envio simulado no Firestore.
- Permitir agendamentos futuros com até 30 dias de antecedência.
- Alterações de horário devem atualizar o agendamento; tarefas antigas ou de mensagens excluídas não devem efetuar o envio simulado.
- CRUD completo de mensagens: criação, consulta, edição e exclusão, tanto para enviadas quanto para agendadas. Esta orientação substitui as restrições anteriores de edição e exclusão.
- Cada contato terá um menu de três pontos com a opção “Apagar todas as mensagens”, que exclui apenas os registros daquele contato, preservando os dos demais destinatários.
- Ao selecionar vários contatos para um envio, criar um registro de mensagem independente por destinatário.
- Excluir um contato também exclui todas as suas mensagens, enviadas e agendadas, mediante confirmação explícita informando esse efeito.
- Bloquear a exclusão de uma conexão enquanto ela tiver mensagens, explicando o motivo na interface.
- Operações básicas de CRUD fazem parte do escopo por padrão; esclarecer apenas ambiguidades ou conflitos reais.
- O modo de uso depende do objetivo: emuladores locais para demonstrar todas as Functions sem custo, ou Firebase Spark na nuvem com gravações diretas no Firestore.
- Alternativa de custo zero confirmada: manter as Functions em TypeScript, mas permitir que o app grave diretamente no Firestore com regras por usuário. O status de agendamento passa a ser atualizado quando o app está aberto ou quando voltar a ser aberto.
- Selecionar o modo por feature flags: Functions desligadas no padrão gratuito; Functions podem ser testadas pelos emuladores locais ou habilitadas na nuvem com Blaze.
- Descoberta com uma pergunta por vez e registro das decisões durante a conversa.

## Estado

Descoberta concluída e implementação autorizada pelo usuário. Código do frontend, funções, regras, índices e instruções de configuração implementados. O projeto Firebase ainda não foi criado; publicação e validação no ambiente real dependem dessa configuração.
