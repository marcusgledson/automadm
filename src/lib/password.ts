export const SENHA_MIN = 8;
export const SENHA_MAX = 20;

export const SENHA_FRACA_MSG =
  "A senha digitada é fraca em segurança e fácil de adivinhar. Por favor, escolha uma senha mais forte com letras, números e caracteres especiais.";

export interface ForcaSenha {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Classe de cor (token semântico) da barra de progresso. */
  tone: string;
  ok: boolean;
}

/** Avalia a força da senha considerando tamanho e variedade de caracteres. */
export function avaliarSenha(senha: string): ForcaSenha {
  let pontos = 0;
  if (senha.length >= SENHA_MIN) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;
  if (/^(.)\1+$/.test(senha) || /^(123|abc|senha|password|qwerty)/i.test(senha)) pontos = 1;

  const score = Math.min(4, Math.max(0, pontos - 1)) as ForcaSenha["score"];
  const labels = ["Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"];
  const tones = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-primary", "bg-primary"];
  return {
    score,
    label: labels[score],
    tone: tones[score],
    ok: senha.length >= SENHA_MIN && senha.length <= SENHA_MAX && score >= 2,
  };
}

/** Valida tamanho e força, devolvendo a mensagem de erro em pt-BR ou null. */
export function validarSenha(senha: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha deve ter no mínimo ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha deve ter no máximo ${SENHA_MAX} caracteres.`;
  if (!avaliarSenha(senha).ok) return SENHA_FRACA_MSG;
  return null;
}

/** Mascara um e-mail mostrando os 3 primeiros e 3 últimos caracteres antes do @. */
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "***";
  const ini = local.slice(0, 3);
  const fim = local.length > 6 ? local.slice(-3) : "";
  return `${ini}${"*".repeat(Math.max(3, local.length - ini.length - fim.length))}${fim}@${dominio}`;
}

/** Mascara um telefone mostrando os 4 primeiros e os 3 últimos dígitos. */
export function mascararTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length < 8) return "*".repeat(d.length);
  return `${d.slice(0, 4)}${"*".repeat(d.length - 7)}${d.slice(-3)}`;
}
