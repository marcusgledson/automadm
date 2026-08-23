import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fingerprint, KeyRound, RotateCcw, ShieldCheck, Timer } from "lucide-react";
import PinSetupDialog from "@/components/PinSetupDialog";
import PinVerifyDialog from "@/components/PinVerifyDialog";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { AUTOLOCK_OPTIONS, getAutoLockMinutes, setAutoLockMinutes } from "@/lib/autoLock";

/** Segurança do aparelho: biometria, PIN e bloqueio automático. */
export default function SecuritySettingsPanel() {
  const {
    available: bioAvailable,
    enabled: bioEnabled,
    pinEnabled,
    enable: bioEnable,
    disable: bioDisable,
    definePin,
    disablePinWithCurrent,
    verifyForPinReset,
    lock: bioLock,
  } = useBiometricLock();

  const [pinOpen, setPinOpen] = useState(false);
  const [pinResetOpen, setPinResetOpen] = useState(false);
  const [verifyRemoveOpen, setVerifyRemoveOpen] = useState(false);
  const [verifyChangeOpen, setVerifyChangeOpen] = useState(false);
  const [autoLock, setAutoLock] = useState(getAutoLockMinutes());

  const toggleBiometric = useCallback(async () => {
    if (bioEnabled) {
      bioDisable();
      toast.success("Desbloqueio biométrico desativado.");
      return;
    }
    try {
      await bioEnable();
      toast.success("Desbloqueio biométrico ativado neste aparelho.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar a biometria.");
    }
  }, [bioEnabled, bioEnable, bioDisable]);

  const handleForgotPin = useCallback(async () => {
    if (!bioAvailable || !bioEnabled) {
      toast.error("Ative a biometria para poder redefinir o PIN sem informá-lo.");
      return;
    }
    const ok = await verifyForPinReset();
    if (!ok) {
      toast.error("Não foi possível confirmar sua identidade.");
      return;
    }
    setPinResetOpen(true);
  }, [bioAvailable, bioEnabled, verifyForPinReset]);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Fingerprint className="h-4 w-4 text-primary" /> Biometria / Face ID
        </h4>
        <p className="text-xs text-muted-foreground">
          Usa a segurança nativa do aparelho para desbloquear o aplicativo.
        </p>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={toggleBiometric}
          disabled={!bioAvailable}
        >
          <Fingerprint className="h-4 w-4" />
          {!bioAvailable
            ? "Biometria indisponível neste aparelho"
            : bioEnabled
              ? "Desativar biometria"
              : "Ativar biometria / Face ID"}
        </Button>
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> PIN de acesso
        </h4>
        <p className="text-xs text-muted-foreground">
          De 4 a 8 dígitos, guardados apenas neste aparelho de forma criptografada.
        </p>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => (pinEnabled ? setVerifyRemoveOpen(true) : setPinOpen(true))}
        >
          <KeyRound className="h-4 w-4" />
          {pinEnabled ? "Desativar PIN de acesso" : "Ativar PIN de acesso"}
        </Button>
        {pinEnabled && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={() => setVerifyChangeOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Alterar PIN
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleForgotPin}
              disabled={!bioAvailable || !bioEnabled}
            >
              <ShieldCheck className="h-4 w-4" /> Esqueci o PIN
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Timer className="h-4 w-4 text-primary" /> Bloqueio automático
        </h4>
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tempo de inatividade</Label>
            <Select
              value={String(autoLock)}
              onValueChange={(v) => {
                const m = Number(v);
                setAutoLockMinutes(m);
                setAutoLock(m);
                toast.success(`O app será bloqueado após ${m} min de inatividade.`);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOLOCK_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minuto{m === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {((bioAvailable && bioEnabled) || pinEnabled) && (
            <Button variant="secondary" className="sm:mt-5" onClick={bioLock}>
              <ShieldCheck className="h-4 w-4" /> Bloquear agora
            </Button>
          )}
        </div>
      </section>

      <PinSetupDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={definePin} />
      <PinSetupDialog open={pinResetOpen} onOpenChange={setPinResetOpen} onConfirm={definePin} />
      <PinVerifyDialog
        open={verifyRemoveOpen}
        onOpenChange={setVerifyRemoveOpen}
        title="Desativar PIN de acesso"
        description="Digite o PIN atual para remover o bloqueio por PIN deste aparelho."
        onVerify={disablePinWithCurrent}
        onSuccess={() => toast.success("PIN de acesso removido.")}
      />
      <PinVerifyDialog
        open={verifyChangeOpen}
        onOpenChange={setVerifyChangeOpen}
        title="Alterar PIN de acesso"
        description="Digite o PIN atual para em seguida cadastrar um novo."
        onVerify={disablePinWithCurrent}
        onSuccess={() => setPinResetOpen(true)}
      />
    </div>
  );
}
