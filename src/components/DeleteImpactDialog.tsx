import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ListTree, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { buildImpactPlan, type ImpactPlan, type ImpactTableKey } from "@/lib/deleteImpact";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ImpactTableKey | "all" | null;
  userId: string | undefined;
  onConfirm: (plan: ImpactPlan) => void;
}

export default function DeleteImpactDialog({ open, onOpenChange, target, userId, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<ImpactPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!open || !target || !userId) return;
    setShowList(false);
    setPlan(null);
    setError(null);
    setLoading(true);
    buildImpactPlan(target, userId)
      .then(setPlan)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, target, userId]);

  const dependents = plan?.groups.filter((g) => g.dependent) ?? [];
  const safe = !!plan && !plan.hasDependents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-primary" />
            Análise de impacto da exclusão
          </DialogTitle>
          <DialogDescription>
            {plan ? `Alvo: ${plan.targetLabel}` : "Verificando interdependências..."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Mapeando a cadeia de informações...
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {plan && !loading && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {safe ? (
              <div className="flex gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Exclusão segura</p>
                  <p className="text-muted-foreground">
                    Nenhum outro dado depende destes registros. A cadeia de informações permanece íntegra.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Atenção: exclusão em cadeia</p>
                  <p className="text-muted-foreground">
                    Ao prosseguir, você apagará <strong>toda a cadeia de informações relacionadas</strong> listada
                    abaixo. Esta ação é irreversível.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {plan.groups.map((g) => (
                <div
                  key={`${g.key}-${g.dependent}`}
                  className="rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{g.label}</span>
                    <Badge variant={g.dependent ? "destructive" : "secondary"}>
                      {g.count} {g.count === 1 ? "registro" : "registros"}
                      {g.dependent ? " · dependente" : ""}
                    </Badge>
                  </div>
                  {g.reason && <p className="mt-1 text-xs text-muted-foreground">{g.reason}</p>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Total a excluir: <strong>{plan.totalRows}</strong> registros
                {dependents.length > 0 && ` · ${dependents.length} tabela(s) dependente(s)`}
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowList((v) => !v)}>
              {showList ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showList ? "Ocultar lista" : "Visualizar lista de registros"}
            </Button>

            {showList && (
              <div className="space-y-3">
                {plan.groups.map((g) => (
                  <div key={`list-${g.key}-${g.dependent}`} className="rounded-md border border-border/60">
                    <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                      {g.label} {g.count > g.rows.length && `(mostrando ${g.rows.length} de ${g.count})`}
                    </div>
                    <div className="max-h-56 overflow-auto">
                      {g.rows.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Sem registros.</p>
                      ) : (
                        g.rows.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-1.5 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs">{r.primary}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{r.secondary}</p>
                            </div>
                            {r.value && <span className="shrink-0 text-xs font-medium">{r.value}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!plan || loading || plan.totalRows === 0}
            onClick={() => plan && onConfirm(plan)}
          >
            {safe ? "Confirmar exclusão" : "Prosseguir e apagar a cadeia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
