# Manter Cloud Tasks como alternativa para agendamentos

Para o modo de nuvem com Cloud Functions habilitadas, usaremos Firebase Task Queue Functions integradas ao Google Cloud Tasks, com uma tarefa agendada por mensagem. A tarefa atualiza o status no Firestore, sem enviar uma mensagem real. Escolhemos a fila em lugar de uma consulta periódica aos agendamentos e limitamos a antecedência a 30 dias.

Editar o horário exige atualizar o agendamento, e tarefas obsoletas ou associadas a mensagens excluídas não devem alterar os dados. O horário define quando a tarefa pode ser executada; não representa uma garantia de execução no segundo exato.

Esta é uma alternativa opcional. A decisão padrão sem faturamento está documentada em [ADR 0004](0004-modo-gratuito-e-emuladores.md).

Referências: [Task Queue Functions](https://firebase.google.com/docs/functions/task-functions) e [limites do Cloud Tasks](https://docs.cloud.google.com/tasks/docs/quotas).
