import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PencilLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useExpenses, type NewExpense } from "@/hooks/useExpenses";

const TIPOS = ["Débito", "Boleto", "PIX", "Transferência", "Tarifa", "Pagamento", "Compra", "Outros"];
const CATEGORIAS = ["Energia", "Internet", "Água", "Gás", "IPTU", "IPVA", "Taxa", "Telefone", "Aluguel", "Cartão", "Mercado", "Saúde", "Educação", "Outros"];

export default function ExpenseForm({ onSaved }: { onSaved?: () => void }) {
  const { insertOne } = useExpenses();
  const [form, setForm] = useState<NewExpense>({
    tipo_lancamento: "Débito",
    categoria: "Outros",
    numero_documento: "",
    detalhes: "",
    valor: 0,
    data_vencimento: null,
    data_pagamento: null,
    origem: "manual",
    source_ref: null,
    raw: {},
  });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof NewExpense>(k: K, v: NewExpense[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.valor || form.valor <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setBusy(true);
    const res = await insertOne(form);
    setBusy(false);
    if (res.ok) {
      toast.success("Despesa registrada.");
      setForm((f) => ({ ...f, numero_documento: "", detalhes: "", valor: 0, data_vencimento: null, data_pagamento: null }));
      onSaved?.();
    } else {
      toast.error(res.error || "Erro ao salvar.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PencilLine className="h-5 w-5 text-accent" /> Lançamento Manual
        </CardTitle>
        <CardDescription>Digite uma despesa diretamente sem precisar de arquivo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de Lançamento</Label>
            <Select value={form.tipo_lancamento} onValueChange={(v) => set("tipo_lancamento", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={form.categoria ?? "Outros"} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nº Documento</Label>
            <Input value={form.numero_documento ?? ""} onChange={(e) => set("numero_documento", e.target.value)} placeholder="Ex: 12345" />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" min={0} value={form.valor || ""}
              onChange={(e) => set("valor", parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Data Vencimento</Label>
            <Input type="date" value={form.data_vencimento ?? ""}
              onChange={(e) => set("data_vencimento", e.target.value || null)} />
          </div>
          <div>
            <Label className="text-xs">Data Pagamento/Recebimento</Label>
            <Input type="date" value={form.data_pagamento ?? ""}
              onChange={(e) => set("data_pagamento", e.target.value || null)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Detalhes</Label>
            <Textarea rows={2} value={form.detalhes ?? ""} onChange={(e) => set("detalhes", e.target.value)}
              placeholder="Descrição completa do lançamento" />
          </div>
        </div>
        <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar despesa
        </Button>
      </CardContent>
    </Card>
  );
}
