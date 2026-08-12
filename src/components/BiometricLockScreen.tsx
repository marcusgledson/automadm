import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";
import { Fingerprint, Loader2, ScanFace, LogOut, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import PinSetupDialog from "@/components/PinSetupDialog";

type Props = {
  onUnlock: () => Promise<boolean>;
  onUnlockWithPin: (pin: string) => Promise<boolean>;
  biometricEnabled: boolean;
  pinEnabled: boolean;
  lockoutSeconds: number;
  attemptsLeft: number;
  /** Verificação biométrica para autorizar a redefinição do PIN esquecido. */
  onVerifyForPinReset: () => Promise<boolean>;
  onDefinePin: (pin: string) => Promise<void>;
};

function formatWait(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export default function BiometricLockScreen({
  onUnlock,
  onUnlockWithPin,
  biometricEnabled,
  pinEnabled,
  lockoutSeconds,
  attemptsLeft,
  onVerifyForPinReset,
  onDefinePin,
}: Props) {
  const { signOut, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"bio" | "pin">(biometricEnabled ? "bio" : "pin");
  const [pin, setPin] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const blocked = lockoutSeconds > 0;

  const handleBio = async () => {
    setBusy(true);
    const ok = await onUnlock();
    if (!ok) toast.error("Não foi possível confirmar sua identidade. Tente novamente.");
    setBusy(false);
  };

  const handlePin = async () => {
    if (pin.length < 4) return;
    setBusy(true);
    const ok = await onUnlockWithPin(pin);
    if (!ok) {
      toast.error("PIN incorreto.");
      setPin("");
    }
    setBusy(false);
  };

  const handleForgotPin = async () => {
    setBusy(true);
    const ok = await onVerifyForPinReset();
    setBusy(false);
    if (!ok) {
      toast.error("Não foi possível confirmar sua identidade para redefinir o PIN.");
      return;
    }
    setResetOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        {blocked ? (
          <ShieldAlert className="h-12 w-12 text-destructive" />
        ) : mode === "pin" ? (
          <KeyRound className="h-12 w-12 text-primary" />
        ) : (
          <>
            <Fingerprint className="h-12 w-12 text-primary" />
            <ScanFace className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background p-1 text-primary" />
          </>
        )}
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">
          {blocked ? "Acesso bloqueado temporariamente" : "Acesso protegido"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {blocked
            ? `Muitas tentativas incorretas. Aguarde ${formatWait(lockoutSeconds)} para tentar novamente.`
            : mode === "pin"
              ? "Digite seu PIN de acesso para desbloquear o aplicativo."
              : "Use a biometria ou o reconhecimento facial do seu aparelho para desbloquear o aplicativo."}
        </p>
        {!blocked && attemptsLeft < 5 && (
          <p className="text-xs text-destructive">
            {attemptsLeft} tentativa{attemptsLeft === 1 ? "" : "s"} restante
            {attemptsLeft === 1 ? "" : "s"} antes do bloqueio temporário.
          </p>
        )}
        {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        {mode === "pin" ? (
          <>
            <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={busy || blocked}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button
              className="w-full gap-2"
              onClick={handlePin}
              disabled={busy || blocked || pin.length < 4}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Desbloquear com PIN
            </Button>
            {pinEnabled && biometricEnabled && (
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={handleForgotPin}
                disabled={busy || blocked}
              >
                Esqueci meu PIN — redefinir com biometria
              </Button>
            )}
          </>
        ) : (
          <Button className="w-full gap-2" onClick={handleBio} disabled={busy || blocked}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            Desbloquear
          </Button>
        )}

        {biometricEnabled && pinEnabled && (
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={blocked}
            onClick={() => {
              setPin("");
              setMode(mode === "pin" ? "bio" : "pin");
            }}
          >
            {mode === "pin" ? <Fingerprint className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {mode === "pin" ? "Usar biometria" : "Usar PIN"}
          </Button>
        )}

        <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>

      <PinSetupDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={onDefinePin} />
    </div>
  );
}
