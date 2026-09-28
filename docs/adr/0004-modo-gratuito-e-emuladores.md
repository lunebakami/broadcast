# Manter uma alternativa gratuita e testar Functions localmente

Como a conta do usuário solicita um cartão e apresenta uma cobrança que ele não pode assumir, o projeto terá três modos selecionáveis por variáveis de ambiente. O modo gratuito padrão grava diretamente no Firestore com regras que restringem cada registro ao proprietário; nele, o status de mensagens agendadas é atualizado enquanto o app estiver aberto ou ao voltar a ser aberto. As Functions e o processamento via Cloud Tasks permanecem no repositório, condicionados à flag `VITE_ENABLE_FUNCTIONS=true`.

Para demonstrar e testar Auth, regras, Firestore, Functions e tarefas agendadas sem vincular faturamento, usaremos Firebase Local Emulator Suite com o projeto demonstrativo `demo-broadcast`. As Functions e task queues emuladas não representam completamente os comportamentos de retry e IAM da nuvem. Publicar Functions continua exigindo o plano Blaze; o modo gratuito evita esse deploy.

Essa escolha prioriza terminar e demonstrar o projeto sem comprometer financeiramente o usuário. A limitação do modo gratuito é que um agendamento vencido enquanto o navegador está fechado só muda de status na próxima abertura do app.
