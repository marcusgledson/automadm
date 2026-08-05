import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Fingerprint, Loader2, ScanFace, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function BiometricLockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const { signOut, user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    const ok = await onUnlock();
    if (!ok) toast.error("Não foi possível confirmar sua identidade. Tente novamente.");
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <Fingerprint className="h-12 w-12 text-primary" />
        <ScanFace className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background p-1 text-primary" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Acesso protegido</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Use a biometria ou o reconhecimento facial do seu aparelho para desbloquear o aplicativo.
        </p>
        {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button className="w-full gap-2" onClick={handle} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          Desbloquear
        </Button>
        <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
