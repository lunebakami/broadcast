# Isolar clientes com coleções planas e gravações autenticadas

O enunciado exige Firestore sem subcoleções, isolamento entre clientes e atualizações em tempo real. Usaremos coleções de primeiro nível com `ownerId` e referências por ID: o frontend lê com listeners protegidos pelas regras, enquanto as gravações passam por uma Cloud Function autenticada que valida a propriedade e os vínculos antes de usar o Admin SDK.

Centralizar as gravações facilita a consistência entre exclusões relacionadas e as regras de domínio, ao custo de uma chamada de função para cada mutação. O Admin SDK ignora regras do Firestore, portanto a validação de acesso no backend é obrigatória e o `ownerId` deve sempre ser derivado da autenticação.
