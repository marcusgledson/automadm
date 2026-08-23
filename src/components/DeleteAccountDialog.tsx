import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { verifyPin } from "@/lib/pinLock";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Fingerprint, KeyRound, Loader2, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CONFIRM_WORD = "EXCLUIR";

/**
 * Exclusão definitiva da conta.
 * Exige senha e, quando configurados, também biometria e PIN.
 * Antes de apagar, gera e envia ao e-mail cadastrado a cópia dos dados (LGPD).
 */
export default function DeleteAccountDialog({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();
  const { available: bioAvailable, enabled: bioEnabled, pinEnabled, verifyForPinReset } = useBiometricLock();

  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [word, setWord] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsBio = bioAvailable && bioEnabled;
  const needsPin = pinEnabled;
  const ready =
    !!password && word.trim().toUpperCase() === CONFIRM_WORD && (!needsBio || bioOk) && (!needsPin || pin.length >= 4);

  const reset = () => {
    setPassword("");
    setPin("");
    setWord("");
    setBioOk(false);
    setError(null);
  };

  const runBiometric = async () => {
    const ok = await verifyForPinReset();
    setBioOk(ok);
    if (ok) toast.success("Identidade confirmada pela biometria.");
    else toast.error("Não foi possível confirmar sua biometria.");
  };

  const execute = async () => {
    if (!user?.email) return;
    setBusy(true);
    setError(null);
    try {
      if (needsPin) {
        const okPin = await verifyPin(user.id, pin);
        if (!okPin) throw new Error("PIN incorreto.");
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authErr) throw new Error("Senha incorreta.");

      const { data, error: fnErr } = await supabase.functions.invoke("manage-org-users", {
        body: { action: "delete_account", confirm: CONFIRM_WORD },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(String(data.error));

      // Cópia local dos dados (LGPD) para o titular guardar.
      if (data?.export) {
        const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      // Remove segredos locais do aparelho.
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("app_pin_") || k.startsWith("biometric_") || k === "app_pin_users")
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignora */
      }

      toast.success(
        data?.email_sent
          ? "Conta excluída. Enviamos a cópia dos seus dados para o e-mail cadastrado."
          : "Conta excluída. Baixamos a cópia dos seus dados neste aparelho.",
      );
      onOpenChange(false);
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Excluir minha conta
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é definitiva. Todos os seus dados (extratos, contas, despesas, investimentos, metas,
            configurações e perfil) serão apagados e o acesso será encerrado. Em conformidade com a LGPD,
            enviaremos ao e-mail cadastrado (<strong>{user?.email}</strong>) a confirmação da exclusão com a
            cópia dos seus dados a partir da data da solicitação.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Senha da conta</Label>
            <Input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {needsBio && (
            <div className="space-y-1">
              <Label className="text-xs">Confirmação biométrica</Label>
              <Button
                type="button"
                variant={bioOk ? "secondary" : "outline"}
                className="w-full justify-start"
                onClick={runBiometric}
                disabled={busy}
              >
                <Fingerprint className="h-4 w-4" />
                {bioOk ? "Biometria confirmada" : "Confirmar com biometria / Face ID"}
              </Button>
            </div>
          )}

          {needsPin && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <KeyRound className="h-3 w-3" /> PIN de acesso
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">
              Digite <strong>{CONFIRM_WORD}</strong> para liberar o botão
            </Label>
            <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder={CONFIRM_WORD} />
          </div>

          {error && (
            <p className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={execute} disabled={busy || !ready}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir conta definitivamente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
