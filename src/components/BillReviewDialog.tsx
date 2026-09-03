import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, ClipboardCheck, AlertTriangle } from "lucide-react";
import type { NewBillInput } from "@/hooks/useConsumptionBills";

/** Colunas da Central de Contas que podem receber um campo capturado. */
const TARGETS = [
  { key: "codigo_instalacao", label: "Código de Instalação *", type: "text" },
  { key: "data_vencimento", label: "Data de Vencimento * (AAAA-MM-DD)", type: "text" },
  { key: "fornecedor", label: "Fornecedor / Sacador", type: "text" },
  { key: "titular", label: "Titular / Contribuinte", type: "text" },
  { key: "cpf_cnpj", label: "CPF / CNPJ", type: "text" },
  { key: "endereco", label: "Endereço", type: "text" },
  { key: "mes_referencia", label: "Mês de referência (MM/AAAA)", type: "text" },
  { key: "valor_total", label: "Valor total", type: "number" },
  { key: "consumo", label: "Consumo", type: "number" },
  { key: "unidade_consumo", label: "Unidade do consumo", type: "text" },
] as const;

type TargetKey = (typeof TARGETS)[number]["key"];

interface Props {
  open: boolean;
  fileName: string;
  /** Linha sugerida pelo mapeamento automático. */
  suggestion: NewBillInput | null;
  /** Todos os campos lidos do documento (inclusive os não mapeados). */
  captured: Record<string, unknown>;
  /** Aviso de duplicidade detectada pela chave (instalação + vencimento). */
  duplicateWarning?: string | null;
  onCancel: () => void;
  onConfirm: (row: NewBillInput) => void;
}

function flatten(obj: Record<string, unknown>, prefix = ""): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.slice(0, 12).forEach((item, i) => {
        if (item && typeof item === "object") out.push(...flatten(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push({ key: `${key}[${i}]`, value: String(item) });
      });
    } else if (typeof v === "object") {
      out.push(...flatten(v as Record<string, unknown>, key));
    } else {
      out.push({ key, value: String(v) });
    }
  }
  return out;
}

export default function BillReviewDialog({
  open, fileName, suggestion, captured, duplicateWarning, onCancel, onConfirm,
}: Props) {
  const [row, setRow] = useState<NewBillInput | null>(suggestion);
  const [target, setTarget] = useState<TargetKey>("codigo_instalacao");

  useEffect(() => { setRow(suggestion); }, [suggestion]);

  const fields = useMemo(() => flatten(captured ?? {}), [captured]);

  if (!row) return null;

  const setField = (key: TargetKey, raw: string) => {
    const def = TARGETS.find((t) => t.key === key)!;
    const value = def.type === "number"
      ? (raw.trim() === "" ? null : Number(raw.replace(/\./g, "").replace(",", ".")))
      : (raw.trim() === "" ? null : raw);
    setRow((prev) => (prev ? { ...prev, [key]: value } as NewBillInput : prev));
  };

  const valid = !!row.codigo_instalacao && /^\d{4}-\d{2}-\d{2}$/.test(row.data_vencimento ?? "");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Conferir dados lidos — {fileName}
          </DialogTitle>
          <DialogDescription>
            Escolha o campo de destino e clique em um valor capturado para aplicá-lo.
            Os campos não mapeados continuam guardados no detalhe da fatura.
          </DialogDescription>
        </DialogHeader>

        {duplicateWarning && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            {duplicateWarning}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Campos capturados */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="text-sm font-medium">Campos lidos ({fields.length})</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                value={target}
                onChange={(e) => setTarget(e.target.value as TargetKey)}
              >
                {TARGETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <ScrollArea className="h-[340px]">
              <ul className="divide-y divide-border/60">
                {fields.map((f) => (
                  <li key={f.key} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50">
                    <span className="w-1/2 truncate text-muted-foreground" title={f.key}>{f.key}</span>
                    <span className="flex-1 truncate font-medium" title={f.value}>{f.value}</span>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      title={`Usar em: ${TARGETS.find((t) => t.key === target)?.label}`}
                      onClick={() => setField(target, f.value)}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
                {fields.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum campo foi reconhecido no documento.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>

          {/* Destino */}
          <ScrollArea className="h-[380px] rounded-lg border border-border p-3">
            <div className="space-y-3">
              {TARGETS.map((t) => {
                const v = (row as unknown as Record<string, unknown>)[t.key];
                return (
                  <div key={t.key} className={target === t.key ? "rounded-md ring-1 ring-primary/40 p-1" : "p-1"}>
                    <Label className="text-xs">{t.label}</Label>
                    <Input
                      className="h-8 text-sm"
                      value={v === null || v === undefined ? "" : String(v)}
                      onFocus={() => setTarget(t.key)}
                      onChange={(e) => setField(t.key, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Badge variant={valid ? "secondary" : "destructive"} className="text-xs">
            {valid ? "Chave completa: instalação + vencimento" : "Informe Código de Instalação e Vencimento (AAAA-MM-DD)"}
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Descartar</Button>
            <Button disabled={!valid} onClick={() => onConfirm(row)}>Confirmar e gravar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
