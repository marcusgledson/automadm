import { avaliarSenha, SENHA_FRACA_MSG, SENHA_MAX } from "@/lib/password";

/** Indicador visual da força da senha, com aviso em pt-BR quando fraca. */
export default function PasswordStrengthMeter({ value }: { value: string }) {
  if (!value) return null;
  const { score, label, tone, ok } = avaliarSenha(value);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < score ? tone : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Força da senha: <span className="font-medium text-foreground">{label}</span>
      </p>
      {value.length > SENHA_MAX && (
        <p className="text-xs text-destructive">A senha deve ter no máximo {SENHA_MAX} caracteres.</p>
      )}
      {!ok && value.length <= SENHA_MAX && <p className="text-xs text-destructive">{SENHA_FRACA_MSG}</p>}
    </div>
  );
}
