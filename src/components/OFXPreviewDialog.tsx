import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Landmark, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import type { ParsedOFXStatement } from "@/lib/fileParser";

interface OFXPreviewDialogProps {
  open: boolean;
  fileName?: string;
  statements: ParsedOFXStatement[];
  onCancel: () => void;
  onConfirm: (statementIndex: number) => void;
}

export default function OFXPreviewDialog({
  open, fileName, statements, onCancel, onConfirm,
}: OFXPreviewDialogProps) {
  const [selected, setSelected] = useState(0);

  useEffect(() => { if (open) setSelected(0); }, [open, statements]);

  const total = statements.reduce((acc, s) => acc + s.records.length, 0);
  const multi = statements.length > 1;
  const current = statements[selected];
  const missing = current && (!current.account.agencia || !current.account.conta);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            {multi ? "Selecione a conta para importar" : "Pré-visualização do OFX"}
          </DialogTitle>
          <DialogDescription>
            {fileName ? <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{fileName}</span> : null}
            {fileName ? " · " : ""}
            {statements.length} conta{statements.length === 1 ? "" : "s"} detectada{statements.length === 1 ? "" : "s"} · {total} lançamento{total === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <RadioGroup value={String(selected)} onValueChange={(v) => setSelected(Number(v))} className="space-y-2">
            {statements.map((s, i) => {
              const ok = !!(s.account.agencia && s.account.conta);
              return (
                <Label
                  key={i}
                  htmlFor={`stmt-${i}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selected === i ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem id={`stmt-${i}`} value={String(i)} className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">
                        {s.account.banco || "Banco não identificado"}
                      </span>
                      {ok ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> detectado
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> incompleto
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Agência</p>
                        <p className="font-mono font-semibold">{s.account.agencia || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conta</p>
                        <p className="font-mono font-semibold">{s.account.conta || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lançamentos</p>
                        <p className="font-semibold">{s.records.length}</p>
                      </div>
                    </div>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>

          {missing && (
            <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Esta conta está incompleta. Você poderá preencher Agência/Conta na próxima etapa.</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(selected)} disabled={!current || current.records.length === 0}>
            {missing ? "Continuar e completar" : "Importar conta selecionada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
