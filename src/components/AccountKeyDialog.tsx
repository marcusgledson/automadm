import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, AlertCircle, CheckCircle2 } from "lucide-react";

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

  // Marca quais campos vieram do OFX (auto-detectados) vs vazios (faltantes).
  const detected = useMemo(() => ({
    banco: !!(defaultBanco && defaultBanco.trim()),
    agencia: !!(defaultAgencia && defaultAgencia.trim()),
    conta: !!(defaultConta && defaultConta.trim()),
  }), [defaultBanco, defaultAgencia, defaultConta]);

  const missingList = useMemo(() => {
    const m: string[] = [];
    if (!detected.agencia) m.push("Agência");
    if (!detected.conta) m.push("Conta");
    return m;
  }, [detected]);

  useEffect(() => {
    if (open) {
      setBanco(defaultBanco ?? "");
      setAgencia(maskAgency(defaultAgencia ?? ""));
      setConta(maskAccount(defaultConta ?? ""));
    }
  }, [open, defaultBanco, defaultAgencia, defaultConta]);

  const contaDigits = conta.replace(/\D/g, "");
  const agenciaOk = agencia.length >= 1;
  const contaOk = contaDigits.length >= 2;
  const valid = agenciaOk && contaOk;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Confirmar Agência e Conta
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              {missingList.length > 0
                ? "Não foi possível identificar todos os dados no arquivo OFX. Preencha os campos faltantes conforme o seu extrato bancário."
                : "Confirme os dados de identificação extraídos do OFX. A conta deve incluir o dígito verificador."}
            </span>
            {missingList.length > 0 && (
              <span className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Faltando: <strong>{missingList.join(" e ")}</strong></span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="banco">Banco (opcional)</Label>
              {detected.banco && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> auto
                </Badge>
              )}
            </div>
            <Input
              id="banco"
              placeholder="Nome ou código (ex.: 001)"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="agencia">Agência</Label>
                {detected.agencia ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> auto
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>
                )}
              </div>
              <Input
                id="agencia"
                inputMode="numeric"
                placeholder="0000"
                value={agencia}
                onChange={(e) => setAgencia(maskAgency(e.target.value))}
                autoFocus={!detected.agencia}
                aria-invalid={!agenciaOk}
                className={!detected.agencia && !agenciaOk ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="conta">Conta + Dígito</Label>
                {detected.conta ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> auto
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>
                )}
              </div>
              <Input
                id="conta"
                inputMode="numeric"
                placeholder="00000-0"
                value={conta}
                onChange={(e) => setConta(maskAccount(e.target.value))}
                autoFocus={detected.agencia && !detected.conta}
                aria-invalid={!contaOk}
                className={!detected.conta && !contaOk ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Exemplo: agência <strong>1234</strong>, conta <strong>56789-0</strong>. O dígito verificador é obrigatório
            e identifica unicamente sua conta na instituição.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm({ banco: banco || undefined, agencia, conta })} disabled={!valid}>
            Confirmar e carregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
