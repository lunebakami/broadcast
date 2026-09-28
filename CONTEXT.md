# Broadcast

Aplicação para organizar contatos por conexão e simular o envio imediato ou agendado de mensagens, com uma área independente para cada cliente.

## Linguagem

**Cliente**:
Pessoa cadastrada que possui uma área exclusiva de conexões, contatos e mensagens. Cada cliente corresponde a um único usuário, sem equipe compartilhada.

**Conexão**:
Agrupamento identificado por um nome, pertencente a um cliente, com seus próprios contatos e mensagens.

**Contato**:
Pessoa identificada por nome e telefone dentro de uma conexão.

**Mensagem**:
Texto destinado a um contato de uma conexão, para envio simulado imediato ou agendado. Selecionar vários contatos gera mensagens independentes, de modo que excluir as mensagens de um contato preserve as dos demais.

**Mensagem agendada**:
Mensagem que aguarda a data e o horário definidos para seu envio simulado.

**Mensagem enviada**:
Mensagem cujo envio simulado foi registrado, sem entrega real aos destinatários.
