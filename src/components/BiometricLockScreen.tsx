import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";
import { Fingerprint, Loader2, ScanFace, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onUnlock: () => Promise<boolean>;
  onUnlockWithPin: (pin: string) => Promise<boolean>;
  biometricEnabled: boolean;
  pinEnabled: boolean;
};

export default function BiometricLockScreen({
  onUnlock,
  onUnlockWithPin,
  biometricEnabled,
  pinEnabled,
}: Props) {
  const { signOut, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"bio" | "pin">(biometricEnabled ? "bio" : "pin");
  const [pin, setPin] = useState("");

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        {mode === "pin" ? (
          <KeyRound className="h-12 w-12 text-primary" />
        ) : (
          <>
            <Fingerprint className="h-12 w-12 text-primary" />
            <ScanFace className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background p-1 text-primary" />
          </>
        )}
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Acesso protegido</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {mode === "pin"
            ? "Digite seu PIN de acesso para desbloquear o aplicativo."
            : "Use a biometria ou o reconhecimento facial do seu aparelho para desbloquear o aplicativo."}
        </p>
        {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        {mode === "pin" ? (
          <>
            <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={busy}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full gap-2" onClick={handlePin} disabled={busy || pin.length < 4}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Desbloquear com PIN
            </Button>
          </>
        ) : (
          <Button className="w-full gap-2" onClick={handleBio} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            Desbloquear
          </Button>
        )}

        {biometricEnabled && pinEnabled && (
          <Button
            variant="outline"
            className="w-full gap-2"
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
    </div>
  );
}
