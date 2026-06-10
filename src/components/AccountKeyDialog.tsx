import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";

interface AccountKeyDialogProps {
  open: boolean;
  defaultBanco?: string;
  defaultAgencia?: string;
  defaultConta?: string;
  onConfirm: (data: { banco?: string; agencia: string; conta: string }) => void;
  onCancel: () => void;
}

/** Máscara de conta tipo extrato bancário: dígitos + "-" + 1 dígito verificador. Ex.: 12345-6 */
function maskAccount(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 1) return digits;
  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

/** Apenas dígitos para agência, até 6. */
function maskAgency(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

export default function AccountKeyDialog({
  open, defaultBanco, defaultAgencia, defaultConta, onConfirm, onCancel,
}: AccountKeyDialogProps) {
  const [banco, setBanco] = useState(defaultBanco ?? "");
  const [agencia, setAgencia] = useState(maskAgency(defaultAgencia ?? ""));
  const [conta, setConta] = useState(maskAccount(defaultConta ?? ""));

  useEffect(() => {
    if (open) {
      setBanco(defaultBanco ?? "");
      setAgencia(maskAgency(defaultAgencia ?? ""));
      setConta(maskAccount(defaultConta ?? ""));
    }
  }, [open, defaultBanco, defaultAgencia, defaultConta]);

  const contaDigits = conta.replace(/\D/g, "");
  const valid = agencia.length >= 1 && contaDigits.length >= 2;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Confirmar Agência e Conta
          </DialogTitle>
          <DialogDescription>
            Não foi possível identificar a agência/conta no OFX. Informe os dados conforme aparecem no extrato bancário.
            A conta deve incluir o dígito verificador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="banco">Banco (opcional)</Label>
            <Input id="banco" placeholder="Nome ou código (ex.: 001)" value={banco} onChange={(e) => setBanco(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agencia">Agência</Label>
              <Input
                id="agencia"
                inputMode="numeric"
                placeholder="0000"
                value={agencia}
                onChange={(e) => setAgencia(maskAgency(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta">Conta + Dígito</Label>
              <Input
                id="conta"
                inputMode="numeric"
                placeholder="00000-0"
                value={conta}
                onChange={(e) => setConta(maskAccount(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo: agência <strong>1234</strong>, conta <strong>56789-0</strong>.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm({ banco: banco || undefined, agencia, conta })} disabled={!valid}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
