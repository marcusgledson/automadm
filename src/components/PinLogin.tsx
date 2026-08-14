import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyPin, type PinUser } from "@/lib/pinLock";
import {
  clearLockout,
  readLockout,
  registerFailure,
  remainingSeconds,
  attemptsLeft as attemptsLeftStore,
} from "@/lib/lockout";

type Props = {
  pinUser: PinUser;
  /** Volta para o acesso tradicional por e-mail e senha. */
  onUseEmail: () => void;
};

function formatWait(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

/**
 * Entrada direta pelo PIN na tela inicial.
 * O cadastro já foi validado por e-mail; aqui o PIN apenas libera a sessão
 * guardada com segurança neste aparelho.
 */
export default function PinLogin({ pinUser, onUseEmail }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(() => remainingSeconds(readLockout(pinUser.userId)));
  const [left, setLeft] = useState(() => attemptsLeftStore(pinUser.userId));

  useEffect(() => {
    const id = window.setInterval(
      () => setWait(remainingSeconds(readLockout(pinUser.userId))),
      1000,
    );
    return () => window.clearInterval(id);
  }, [pinUser.userId]);

  const handleConfirm = async () => {
    if (pin.length < 4 || wait > 0) return;
    setBusy(true);
    const ok = await verifyPin(pinUser.userId, pin);
    if (!ok) {
      const state = registerFailure(pinUser.userId);
      setWait(remainingSeconds(state));
      setLeft(attemptsLeftStore(pinUser.userId));
      setPin("");
      setBusy(false);
      toast.error("PIN incorreto.");
      return;
    }

    // PIN correto: reativa a sessão já validada neste aparelho.
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      const current = await supabase.auth.getSession();
      if (!current.data.session) {
        setBusy(false);
        setPin("");
        toast.error("Sua sessão neste aparelho expirou. Entre uma vez com e-mail e senha.");
        onUseEmail();
        return;
      }
    }
    clearLockout(pinUser.userId);
    setBusy(false);
  };

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        {wait > 0 ? (
          <ShieldAlert className="h-8 w-8 text-destructive" />
        ) : (
          <KeyRound className="h-8 w-8 text-primary" />
        )}
      </div>
      <div>
        <p className="font-medium text-foreground">Entrar com PIN</p>
        <p className="text-sm text-muted-foreground">{pinUser.email}</p>
      </div>

      {wait > 0 ? (
        <p className="text-sm text-destructive">
          Muitas tentativas incorretas. Aguarde {formatWait(wait)}.
        </p>
      ) : (
        <>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={busy}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {left < 5 && (
            <p className="text-xs text-muted-foreground">
              {left} tentativa{left === 1 ? "" : "s"} restante{left === 1 ? "" : "s"}.
            </p>
          )}
          <Button
            className="w-full active:scale-[0.97]"
            onClick={handleConfirm}
            disabled={busy || pin.length < 4}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </>
      )}

      <button
        onClick={onUseEmail}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Entrar com e-mail e senha
      </button>
    </div>
  );
}
