import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (pin: string) => Promise<void>;
};

export default function PinSetupDialog({ open, onOpenChange, onConfirm }: Props) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPin("");
    setConfirmPin("");
  };

  const handleConfirm = async () => {
    if (pin.length < 4) {
      toast.error("O PIN deve ter no mínimo 4 dígitos.");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Os PINs não coincidem.");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(pin);
      toast.success("PIN de acesso definido neste aparelho.");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível definir o PIN.");
    }
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Definir PIN de acesso</DialogTitle>
          <DialogDescription>
            Escolha um PIN de 4 a 6 dígitos. Ele fica guardado apenas neste aparelho, de forma
            criptografada, e será solicitado ao abrir o aplicativo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Novo PIN</Label>
            <InputOTP maxLength={6} value={pin} onChange={setPin}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="space-y-2">
            <Label>Confirme o PIN</Label>
            <InputOTP maxLength={6} value={confirmPin} onChange={setConfirmPin}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
