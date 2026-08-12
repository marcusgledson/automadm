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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  /** Deve retornar true quando o PIN for válido. */
  onVerify: (pin: string) => Promise<boolean>;
  onSuccess?: () => void;
};

export default function PinVerifyDialog({
  open,
  onOpenChange,
  title = "Confirme seu PIN",
  description = "Digite o PIN atual para continuar.",
  onVerify,
  onSuccess,
}: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (pin.length < 4) return;
    setBusy(true);
    const ok = await onVerify(pin);
    setBusy(false);
    if (!ok) {
      toast.error("PIN incorreto.");
      setPin("");
      return;
    }
    setPin("");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setPin("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={busy}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={busy || pin.length < 4}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
