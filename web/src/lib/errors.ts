const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/popup-closed-by-user': 'O login com Google foi fechado. Tente novamente.',
  'auth/popup-blocked': 'Permita pop-ups para entrar com o Google.',
  'auth/unauthorized-domain': 'Este domínio ainda não foi autorizado no Firebase Auth.',
  'auth/operation-not-allowed': 'Habilite este método de login no Firebase Auth.',
  'auth/network-request-failed': 'Não foi possível conectar. Confira sua internet.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'functions/internal': 'Não foi possível concluir. Tente novamente.',
  'functions/unavailable':
    'Serviço indisponível. Confira a conexão e o deploy das funções.',
  'permission-denied': 'Acesso negado. Confira sua sessão e as regras do Firestore.',
};

export function errorText(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return (
    (code && MESSAGES[code]) ||
    (error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
  );
}
