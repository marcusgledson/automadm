import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useInvestments, type NewInvestmentInput } from "@/hooks/useInvestments";

const EMPTY = {
  instituicao: "", tipo_investimento: "", ativo: "",
  valor_aplicado: "", valor_bruto: "", valor_liquido: "", rendimento: "",
  data_aplicacao: "", data_vencimento: "", data_carencia: "",
  liquidez: "", indexador: "", percentual_indexador: "", taxa_contratada: "",
  rentabilidade_periodo: "", ir: "", iof: "", quantidade: "", preco_unitario: "",
  observacoes: "",
};

type Form = typeof EMPTY;

const num = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Inclusão manual de investimento (mesma chave de deduplicação do upload). */
export default function ManualInvestmentDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const { upsertInvestment } = useInvestments();

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.instituicao.trim() || !form.ativo.trim() || !form.data_aplicacao) {
      toast.error("Informe Instituição, Ativo e Data de aplicação.");
      return;
    }
    setSaving(true);
    const payload: NewInvestmentInput = {
      instituicao: form.instituicao.trim(),
      tipo_investimento: form.tipo_investimento.trim() || "Não informado",
      ativo: form.ativo.trim(),
      valor_aplicado: num(form.valor_aplicado),
      valor_bruto: num(form.valor_bruto),
      valor_liquido: num(form.valor_liquido),
      rendimento: num(form.rendimento),
      data_aplicacao: form.data_aplicacao,
      data_vencimento: form.data_vencimento || null,
      data_carencia: form.data_carencia || null,
      liquidez: form.liquidez.trim() || null,
      indexador: form.indexador.trim() || null,
      percentual_indexador: num(form.percentual_indexador),
      taxa_contratada: form.taxa_contratada.trim() || null,
      rentabilidade_periodo: num(form.rentabilidade_periodo),
      ir: num(form.ir),
      iof: num(form.iof),
      quantidade: num(form.quantidade),
      preco_unitario: num(form.preco_unitario),
      observacoes: form.observacoes.trim() || null,
      explicacao: {},
      raw: { origem: "inclusao_manual" },
      file_name: null,
      source: "manual",
    };
    const res = await upsertInvestment(payload);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Não foi possível salvar."); return; }
    toast.success("Investimento salvo.");
    setForm(EMPTY);
    setOpen(false);
    onSaved?.();
  };

  const field = (k: keyof Form, label: string, type = "text", placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 text-sm" type={type} value={form[k]} placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" /> Inclusão manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incluir investimento manualmente</DialogTitle>
          <DialogDescription>
            Instituição, Ativo e Data de aplicação formam a chave — reenviar os mesmos dados atualiza o registro.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("instituicao", "Instituição *", "text", "Ex.: Banco do Brasil")}
            {field("ativo", "Ativo *", "text", "Ex.: CDB Pós 2027")}
            {field("tipo_investimento", "Tipo", "text", "CDB, LCI, Tesouro, Fundo…")}
            {field("data_aplicacao", "Data de aplicação *", "date")}
            {field("data_vencimento", "Data de vencimento", "date")}
            {field("data_carencia", "Carência (resgate a partir de)", "date")}
            {field("valor_aplicado", "Valor aplicado (R$)")}
            {field("valor_bruto", "Valor bruto atual (R$)")}
            {field("valor_liquido", "Valor líquido atual (R$)")}
            {field("rendimento", "Rendimento (R$)")}
            {field("indexador", "Indexador", "text", "CDI, IPCA, Prefixado")}
            {field("percentual_indexador", "% do indexador", "text", "Ex.: 110")}
            {field("taxa_contratada", "Taxa contratada", "text", "Ex.: IPCA + 6% a.a.")}
            {field("rentabilidade_periodo", "Rentabilidade do período (%)")}
            {field("liquidez", "Liquidez", "text", "Diária, no vencimento…")}
            {field("ir", "IR retido (R$)")}
            {field("iof", "IOF (R$)")}
            {field("quantidade", "Quantidade")}
            {field("preco_unitario", "Preço unitário (R$)")}
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar investimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
