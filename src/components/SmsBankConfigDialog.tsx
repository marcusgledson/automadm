import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { SmsBankConfigRow } from "@/hooks/useSmsBankConfigs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<SmsBankConfigRow> | null;
  onSave: (row: Partial<SmsBankConfigRow> & { bank_name: string }) => Promise<boolean> | boolean;
}

const csv = (arr?: string[] | null) => (arr ?? []).join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function SmsBankConfigDialog({ open, onOpenChange, initial, onSave }: Props) {
  const [bank, setBank] = useState("");
  const [senders, setSenders] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [regex, setRegex] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBank(initial?.bank_name ?? "");
    setSenders(csv(initial?.senders));
    setDebit(csv(initial?.debit_keywords));
    setCredit(csv(initial?.credit_keywords));
    setRegex(initial?.amount_regex ?? "");
    setAgencia(initial?.agencia ?? "");
    setConta(initial?.conta ?? "");
    setActive(initial?.is_active ?? true);
  }, [open, initial]);

  const handleSave = async () => {
    if (!bank.trim()) return;
    setSaving(true);
    const ok = await onSave({
      bank_name: bank.trim(),
      senders: fromCsv(senders),
      debit_keywords: fromCsv(debit),
      credit_keywords: fromCsv(credit),
      amount_regex: regex.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      is_active: active,
      is_preset: false,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar banco" : "Adicionar banco"}</DialogTitle>
          <DialogDescription>
            Configure remetentes SMS e palavras-chave para identificar débitos e créditos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nome do banco</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ex.: Itaú" />
          </div>
          <div>
            <Label>Remetentes SMS (separados por vírgula)</Label>
            <Input value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="ITAU, ITAÚ" />
          </div>
          <div>
            <Label>Palavras-chave de débito</Label>
            <Input value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="compra, débito, pix enviado" />
          </div>
          <div>
            <Label>Palavras-chave de crédito</Label>
            <Input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="crédito, pix recebido, depósito" />
          </div>
          <div>
            <Label>Regex de valor (opcional)</Label>
            <Input value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="Ex.: R\$\s*([\d.,]+)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Agência</Label>
              <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
            </div>
            <div>
              <Label>Conta</Label>
              <Input value={conta} onChange={(e) => setConta(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="sms-active" />
            <Label htmlFor="sms-active">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !bank.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
