/** Tradução das mensagens de erro de autenticação do backend para pt-BR. */
const MAP: { match: RegExp; msg: string }[] = [
  { match: /invalid login credentials/i, msg: "E-mail ou senha incorretos." },
  { match: /email not confirmed/i, msg: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada." },
  { match: /user already registered|already been registered/i, msg: "Já existe uma conta com este e-mail." },
  { match: /password should be at least/i, msg: "A senha deve ter pelo menos 8 caracteres." },
  { match: /(pwned|leaked|compromised) password|has been leaked/i, msg: "Esta senha aparece em vazamentos conhecidos. Escolha outra senha." },
  { match: /unable to validate email|invalid email/i, msg: "Informe um e-mail válido." },
  { match: /email rate limit|over_email_send_rate_limit|too many requests|rate limit/i, msg: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
  { match: /signups not allowed|signup is disabled/i, msg: "Novos cadastros estão desativados no momento." },
  { match: /new password should be different/i, msg: "A nova senha deve ser diferente da senha atual." },
  { match: /token has expired|invalid or has expired|expired/i, msg: "O link expirou. Solicite um novo." },
  { match: /user not found/i, msg: "Não encontramos uma conta com esses dados." },
  { match: /network|failed to fetch/i, msg: "Falha de conexão. Verifique sua internet e tente novamente." },
  { match: /unsupported provider/i, msg: "Este provedor de acesso não está habilitado." },
];

/** Devolve uma mensagem amigável em português para um erro de autenticação. */
export function traduzirErroAuth(error: unknown): string {
  const raw = typeof error === "string" ? error : (error as { message?: string })?.message ?? "";
  for (const { match, msg } of MAP) if (match.test(raw)) return msg;
  return raw || "Não foi possível concluir a operação. Tente novamente.";
}
