import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Landmark, FileSpreadsheet, Database, PencilLine } from "lucide-react";

interface Props {
  open: boolean;
  banco?: string;
  agencia?: string;
  conta?: string;
  fileName?: string | null;
  totalRecords: number;
  onReview: () => void;
  onConfirm: () => void;
  onClose: () => void;
  mode: "pre" | "post";
  savedCount?: number;
  expensesCount?: number;
}

export default function ImportSummaryDialog({
  open, banco, agencia, conta, fileName, totalRecords,
  onReview, onConfirm, onClose, mode, savedCount, expensesCount,
}: Props) {
  const isPost = mode === "post";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPost
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Importação concluída</>
              : <><Database className="h-4 w-4 text-primary" /> Resumo da importação</>}
          </DialogTitle>
          <DialogDescription>
            {isPost ? "Confira os dados gravados na base." : "Revise antes de gravar na base."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {fileName && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> {fileName}
            </div>
          )}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="h-4 w-4 text-primary" />
              {banco || "Banco não identificado"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Agência</p>
                <p className="font-mono font-semibold">{agencia || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Conta</p>
                <p className="font-mono font-semibold">{conta || "—"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">
              {totalRecords} lançamento{totalRecords === 1 ? "" : "s"} {isPost ? "carregado(s)" : "prontos"}
            </Badge>
            {isPost && savedCount !== undefined && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                Extrato: {savedCount}
              </Badge>
            )}
            {isPost && expensesCount !== undefined && expensesCount > 0 && (
              <Badge variant="outline">Despesas: {expensesCount}</Badge>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isPost ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onReview} className="gap-2">
                <PencilLine className="h-4 w-4" /> Revisar antes
              </Button>
              <Button onClick={onConfirm} className="gap-2">
                <Database className="h-4 w-4" /> Confirmar e gravar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
