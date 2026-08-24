import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Landmark, FileText, Columns3, Sparkles, AlertTriangle, CheckCircle2, Loader2, BookmarkCheck, Trash2,
} from "lucide-react";
import type { FinancialRecord } from "@/lib/fileParser";
import type { ColumnField, DetectedColumn } from "@/lib/pdfStatementParser";
import type { BankDetection } from "@/lib/bankDetect";

const FIELD_LABELS: Record<ColumnField, string> = {
  data: "Data",
  descricao: "Descrição / Histórico",
  documento: "Documento",
  valor: "Valor",
  debito: "Débito (saída)",
  credito: "Crédito (entrada)",
  saldo: "Saldo",
  tipo: "Tipo",
  categoria: "Categoria",
  ignorar: "Ignorar coluna",
};

const STRATEGY_LABEL: Record<string, string> = {
  colunas: "Tabela com cabeçalho reconhecido",
  blocos: "Lançamentos por bloco de data",
  linhas: "Leitura genérica linha a linha",
};

const CONF_STYLE: Record<string, string> = {
  alta: "bg-emerald-500/12 text-emerald-600",
  media: "bg-amber-500/15 text-amber-600",
  baixa: "bg-destructive/12 text-destructive",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseBrl = (s: string) => {
  const n = parseFloat(s.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  open: boolean;
  fileName?: string;
  bank?: BankDetection;
  account: { banco?: string; agencia?: string; conta?: string };
  titular?: string;
  strategy: "colunas" | "linhas" | "blocos";
  columns?: DetectedColumn[];
  records: FinancialRecord[];
  identifying?: boolean;
  /** Um mapeamento salvo deste banco/layout foi aplicado automaticamente. */
  profileApplied?: boolean;
  /** Salvar o mapeamento atual para reutilizar nos próximos PDFs. */
  saveMapping?: boolean;
  onSaveMappingChange?: (v: boolean) => void;
  onForgetProfile?: () => void;
  onIdentifyLogo?: () => void;
  onColumnsChange?: (columns: DetectedColumn[]) => void;
  onRecordsChange?: (records: FinancialRecord[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PdfPreviewDialog({
  open, fileName, bank, account, titular, strategy, columns, records,
  identifying, profileApplied, saveMapping = true, onSaveMappingChange, onForgetProfile,
  onIdentifyLogo, onColumnsChange, onRecordsChange, onCancel, onConfirm,
}: Props) {
  const [fixing, setFixing] = useState(false);
  const [onlyAmbiguous, setOnlyAmbiguous] = useState(false);

  const totals = useMemo(() => {
    const entradas = records.filter((r) => r.valor > 0).reduce((a, r) => a + r.valor, 0);
    const saidas = records.filter((r) => r.valor < 0).reduce((a, r) => a + r.valor, 0);
    const datas = records.map((r) => r.data).filter(Boolean);
    return { entradas, saidas, saldo: entradas + saidas, de: datas[0], ate: datas[datas.length - 1] };
  }, [records]);

  const ambiguousCount = useMemo(
    () => records.filter((r) => r.confianca && r.confianca !== "alta").length,
    [records],
  );

  /** Índices exibidos: ambíguos primeiro, limitados a 25 (ou todos os ambíguos). */
  const visible = useMemo(() => {
    const idx = records.map((_, i) => i);
    const rank = (i: number) => (records[i].confianca === "baixa" ? 0 : records[i].confianca === "media" ? 1 : 2);
    const sorted = idx.sort((a, b) => rank(a) - rank(b) || a - b);
    const filtered = onlyAmbiguous ? sorted.filter((i) => rank(i) < 2) : sorted;
    return filtered.slice(0, 40);
  }, [records, onlyAmbiguous]);

  const setField = (idx: number, field: ColumnField) => {
    if (!columns || !onColumnsChange) return;
    onColumnsChange(columns.map((c, i) => (i === idx ? { ...c, field } : c)));
  };

  const patchRecord = (idx: number, patch: Partial<FinancialRecord>) => {
    if (!onRecordsChange) return;
    onRecordsChange(records.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const confBadge =
    bank?.confidence === "alta" ? { txt: "alta confiança", cls: "bg-primary/10 text-primary" }
      : bank?.confidence === "media" ? { txt: "confiança média", cls: "bg-amber-500/15 text-amber-600" }
        : { txt: "baixa confiança", cls: "bg-destructive/10 text-destructive" };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-primary" />
            Confira os lançamentos reconhecidos
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {fileName && (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />{fileName}
              </span>
            )}
            <span>· {records.length} lançamento{records.length === 1 ? "" : "s"}</span>
            <span>· {STRATEGY_LABEL[strategy]}</span>
            {ambiguousCount > 0 && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600">
                {ambiguousCount} precisa{ambiguousCount === 1 ? "" : "m"} de revisão
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 px-4 py-3 sm:px-5">
            {profileApplied && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <BookmarkCheck className="h-4 w-4" />
                  Mapeamento salvo deste banco aplicado automaticamente.
                </span>
                {onForgetProfile && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={onForgetProfile}>
                    <Trash2 className="h-3.5 w-3.5" /> Descartar mapeamento salvo
                  </Button>
                )}
              </div>
            )}

            {/* Identificação */}
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {bank?.name || account.banco || "Banco não identificado"}
                </span>
                {bank?.code && <Badge variant="outline" className="text-[10px]">COMPE {bank.code}</Badge>}
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${confBadge.cls}`}>
                  {bank ? `${bank.source === "logo" ? "logo" : bank.source === "codigo" ? "código" : "nome"} · ${confBadge.txt}` : "não detectado"}
                </span>
                {onIdentifyLogo && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={onIdentifyLogo} disabled={identifying}>
                    {identifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Identificar pela logo
                  </Button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><p className="text-muted-foreground">Agência</p><p className="font-mono font-semibold">{account.agencia || "—"}</p></div>
                <div><p className="text-muted-foreground">Conta</p><p className="font-mono font-semibold">{account.conta || "—"}</p></div>
                <div><p className="text-muted-foreground">Titular</p><p className="truncate font-semibold">{titular || "—"}</p></div>
                <div><p className="text-muted-foreground">Período</p><p className="font-semibold">{totals.de || "—"} a {totals.ate || "—"}</p></div>
              </div>
              {bank?.evidence && (
                <p className="mt-2 truncate text-[11px] text-muted-foreground">Evidência: “{bank.evidence}”</p>
              )}
            </div>

            {/* Totais */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border/60 bg-card/60 p-2">
                <p className="text-muted-foreground">Entradas</p>
                <p className="font-semibold text-emerald-600">{brl(totals.entradas)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/60 p-2">
                <p className="text-muted-foreground">Saídas</p>
                <p className="font-semibold text-destructive">{brl(totals.saidas)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/60 p-2">
                <p className="text-muted-foreground">Resultado</p>
                <p className="font-semibold">{brl(totals.saldo)}</p>
              </div>
            </div>

            {/* Correção de colunas */}
            {columns?.length ? (
              <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                <button
                  type="button"
                  onClick={() => setFixing((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-sm font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <Columns3 className="h-4 w-4 text-primary" />
                    Colunas reconhecidas ({columns.length})
                  </span>
                  <span className="text-xs text-primary">{fixing ? "ocultar" : "corrigir"}</span>
                </button>
                {!fixing ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {columns.map((c) => `${c.label} → ${FIELD_LABELS[c.field]}`).join(" · ")}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {columns.map((c, i) => (
                      <div key={`${c.label}-${i}`} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={c.label}>{c.label}</span>
                        <Select value={c.field} onValueChange={(v) => setField(i, v as ColumnField)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(FIELD_LABELS) as ColumnField[]).map((f) => (
                              <SelectItem key={f} value={f} className="text-xs">{FIELD_LABELS[f]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
                {onSaveMappingChange && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2">
                    <Switch id="save-map" checked={saveMapping} onCheckedChange={onSaveMappingChange} />
                    <Label htmlFor="save-map" className="text-xs text-muted-foreground">
                      Memorizar este mapeamento para os próximos PDFs deste banco
                    </Label>
                  </div>
                )}
              </div>
            ) : (
              <p className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Este extrato não possui cabeçalho tabular; a leitura foi feita por contexto. Revise os lançamentos abaixo antes de confirmar.
              </p>
            )}

            {/* Amostra */}
            {ambiguousCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch id="only-amb" checked={onlyAmbiguous} onCheckedChange={setOnlyAmbiguous} />
                <Label htmlFor="only-amb" className="text-xs text-muted-foreground">
                  Mostrar somente lançamentos ambíguos ({ambiguousCount})
                </Label>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Confiança</th>
                    <th className="px-2 py-1.5 text-left font-medium">Data</th>
                    <th className="px-2 py-1.5 text-left font-medium">Descrição</th>
                    <th className="px-2 py-1.5 text-left font-medium">Categoria</th>
                    <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => {
                    const r = records[i];
                    const conf = r.confianca ?? "alta";
                    const ambiguo = conf !== "alta";
                    return (
                      <tr
                        key={i}
                        className={`border-t border-border/50 ${conf === "baixa" ? "bg-destructive/5" : conf === "media" ? "bg-amber-500/5" : ""}`}
                      >
                        <td className="px-2 py-1">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${CONF_STYLE[conf]}`}
                            title={r.avisos?.join(" · ") || "Leitura sem ambiguidades"}
                          >
                            {conf}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 font-mono">
                          {ambiguo && onRecordsChange ? (
                            <Input
                              value={r.data}
                              onChange={(e) => patchRecord(i, { data: e.target.value })}
                              className="h-7 w-[92px] px-1 font-mono text-xs"
                            />
                          ) : r.data}
                        </td>
                        <td className="max-w-[280px] px-2 py-1" title={r.avisos?.join(" · ") || r.descricao}>
                          {ambiguo && onRecordsChange ? (
                            <Input
                              value={r.descricao}
                              onChange={(e) => patchRecord(i, { descricao: e.target.value })}
                              className="h-7 px-1 text-xs"
                            />
                          ) : <span className="block truncate">{r.descricao}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{r.categoria}</td>
                        <td className={`whitespace-nowrap px-2 py-1 text-right font-medium ${r.valor < 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {ambiguo && onRecordsChange ? (
                            <Input
                              defaultValue={r.valor.toFixed(2).replace(".", ",")}
                              onBlur={(e) => {
                                const v = parseBrl(e.target.value);
                                if (v !== r.valor) {
                                  patchRecord(i, {
                                    valor: v,
                                    tipo: v > 0 ? "Crédito" : v < 0 ? "Débito" : "Neutro",
                                    tipoLancamento: v >= 0 ? "CREDIT" : "DEBIT",
                                  });
                                }
                              }}
                              className="h-7 w-[104px] px-1 text-right text-xs"
                            />
                          ) : brl(r.valor)}
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">Nenhum lançamento com o mapeamento atual.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {records.length > visible.length && (
              <p className="text-[11px] text-muted-foreground">
                Mostrando {visible.length} de {records.length} lançamentos (ambíguos primeiro).
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={records.length === 0} className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
