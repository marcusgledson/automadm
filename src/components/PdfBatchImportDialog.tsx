import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, FileText, Loader2, XCircle, Layers, AlertTriangle } from "lucide-react";
import type { FinancialRecord } from "@/lib/fileParser";
import type { BankDetection } from "@/lib/bankDetect";

export type BatchStatus = "pendente" | "lendo" | "pronto" | "erro" | "importado";

export interface BatchItem {
  fileName: string;
  status: BatchStatus;
  selected: boolean;
  error?: string;
  records: FinancialRecord[];
  account: { banco?: string; agencia?: string; conta?: string };
  titular?: string;
  documento?: string;
  bank?: BankDetection;
  /** Lançamentos removidos por já existirem em outro arquivo do lote. */
  duplicadosLote?: number;
  /** Lançamentos que já constam na base. */
  duplicadosBase?: number;
  importados?: number;
}

interface Props {
  open: boolean;
  items: BatchItem[];
  running: boolean;
  saving: boolean;
  finished: boolean;
  progress: { current: number; total: number };
  onToggle: (index: number) => void;
  onCancelRun: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

const periodOf = (r: FinancialRecord[]) =>
  r.length ? `${r[0].data} a ${r[r.length - 1].data}` : "—";

const ambiguousOf = (r: FinancialRecord[]) =>
  r.filter((x) => x.confianca && x.confianca !== "alta").length;

export default function PdfBatchImportDialog({
  open, items, running, saving, finished, progress, onToggle, onCancelRun, onClose, onConfirm,
}: Props) {
  const ready = items.filter((i) => i.status === "pronto" || i.status === "importado");
  const selected = items.filter((i) => i.selected && i.status === "pronto");
  const totalRecords = selected.reduce((a, i) => a + i.records.length, 0);
  const totalAmbiguous = selected.reduce((a, i) => a + ambiguousOf(i.records), 0);
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !running && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Importação em lote de extratos
          </DialogTitle>
          <DialogDescription className="text-xs">
            {running
              ? `Lendo arquivo ${progress.current} de ${progress.total}…`
              : finished
                ? "Importação concluída. Confira o resumo por arquivo."
                : `${ready.length} de ${items.length} arquivo(s) prontos · ${totalRecords} lançamento(s) selecionado(s)`}
          </DialogDescription>
        </DialogHeader>

        {(running || saving) && (
          <div className="px-4 pt-3 sm:px-5">
            <Progress value={saving ? 100 : pct} className="h-2" />
          </div>
        )}

        <ScrollArea className="max-h-[58vh]">
          <div className="space-y-2 px-4 py-3 sm:px-5">
            {totalAmbiguous > 0 && !finished && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {totalAmbiguous} lançamento(s) com leitura ambígua serão importados. Para revisar linha a linha,
                importe o arquivo individualmente.
              </p>
            )}

            {items.map((item, i) => (
              <div key={`${item.fileName}-${i}`} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="pt-0.5">
                  {item.status === "lendo" ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    : item.status === "erro" ? <XCircle className="h-4 w-4 text-destructive" />
                      : item.status === "importado" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : item.status === "pronto" ? (
                          <Checkbox checked={item.selected} onCheckedChange={() => onToggle(i)} disabled={saving} />
                        ) : <FileText className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.fileName}</p>
                  {item.status === "erro" ? (
                    <p className="text-xs text-destructive">{item.error}</p>
                  ) : item.status === "pendente" ? (
                    <p className="text-xs text-muted-foreground">Na fila…</p>
                  ) : item.status === "lendo" ? (
                    <p className="text-xs text-muted-foreground">Lendo o PDF…</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{item.bank?.name || item.account.banco || "Banco não identificado"}</span>
                      <span>Ag {item.account.agencia || "—"} / Conta {item.account.conta || "—"}</span>
                      <span>{item.records.length} lançamento(s)</span>
                      <span>{periodOf(item.records)}</span>
                      {ambiguousOf(item.records) > 0 && (
                        <span className="text-amber-600">{ambiguousOf(item.records)} ambíguo(s)</span>
                      )}
                      {!!item.duplicadosLote && <span>{item.duplicadosLote} repetido(s) no lote</span>}
                      {!!item.duplicadosBase && <span>{item.duplicadosBase} já na base</span>}
                      {item.status === "importado" && (
                        <span className="text-emerald-600">{item.importados ?? 0} gravado(s)</span>
                      )}
                    </div>
                  )}
                  {item.status === "pronto" && (!item.account.agencia || !item.account.conta) && (
                    <p className="mt-1 text-[11px] text-destructive">
                      Agência/Conta não identificadas — este arquivo não pode ser gravado em lote.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
          {running ? (
            <Button variant="outline" onClick={onCancelRun}>Cancelar leitura</Button>
          ) : finished ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={onConfirm} disabled={saving || selected.length === 0} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Importar {selected.length} arquivo(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
