import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ArrowLeft, Home, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { GOAL_SCOPES, useBudgetGoals } from "@/hooks/useBudgetGoals";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export default function Metas() {
  const navigate = useNavigate();
  const { progress, loading, upsertGoal, removeGoal } = useBudgetGoals();

  const [titulo, setTitulo] = useState("");
  const [escopo, setEscopo] = useState("energia");
  const [referencia, setReferencia] = useState("");
  const [orcado, setOrcado] = useState("");
  const [economia, setEconomia] = useState("");
  const [prazo, setPrazo] = useState("");
  const [alerta, setAlerta] = useState("90");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const scopeIsExpense = escopo === "despesas";
  const estourando = progress.filter((p) => p.estourou);

  const create = async () => {
    if (!titulo.trim()) return toast.error("Informe um título para a meta.");
    const valor = Number(orcado.replace(",", "."));
    if (!valor || valor <= 0) return toast.error("Informe um valor orçado válido.");
    const res = await upsertGoal({
      titulo: titulo.trim(),
      escopo,
      referencia: scopeIsExpense ? referencia.trim() || null : null,
      valor_orcado: valor,
      meta_economia: Number(economia.replace(",", ".")) || 0,
      prazo: prazo || null,
      alerta_percentual: Number(alerta) || 100,
      status: "ativa",
    });
    if (!res.ok) return toast.error(res.error ?? "Falha ao salvar a meta.");
    toast.success("Meta criada.");
    setTitulo("");
    setOrcado("");
    setEconomia("");
    setPrazo("");
  };

  return (
    <div className="app-surface flex min-h-screen flex-col">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
          </Button>
          <Target className="h-5 w-5 text-primary" />
          <span className="truncate text-sm font-semibold">Metas e Orçamento</span>
        </div>
        <UserMenu />
      </header>

      <main className="safe-bottom mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6">
        {estourando.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Orçamento ultrapassado</AlertTitle>
            <AlertDescription>
              {estourando.length} meta(s) com custo real acima do orçado:{" "}
              {estourando.map((p) => p.goal.titulo).join(", ")}.
            </AlertDescription>
          </Alert>
        )}

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Nova meta</CardTitle>
            <CardDescription>
              Defina objetivo de economia e prazo para qualquer modalidade de consumo ou indicação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>Modalidade</Label>
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_SCOPES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scopeIsExpense && (
              <div className="space-y-1.5">
                <Label htmlFor="ref">Categoria (indicação livre)</Label>
                <Input id="ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="ex.: combustível" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="orcado">Valor orçado (R$)</Label>
              <Input id="orcado" inputMode="decimal" value={orcado} onChange={(e) => setOrcado(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="economia">Objetivo de economia (R$)</Label>
              <Input id="economia" inputMode="decimal" value={economia} onChange={(e) => setEconomia(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo</Label>
              <Input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alerta">Alertar ao atingir (%)</Label>
              <Input id="alerta" inputMode="numeric" value={alerta} onChange={(e) => setAlerta(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={create}>Criar meta</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {progress.map((p) => (
            <Card key={p.goal.id} className={`card-elevated ${p.estourou ? "border-destructive/60" : ""}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{p.goal.titulo}</CardTitle>
                  <CardDescription>
                    {GOAL_SCOPES.find((s) => s.id === p.goal.escopo)?.label ?? p.goal.escopo}
                    {p.goal.referencia ? ` · ${p.goal.referencia}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  {p.estourou ? (
                    <Badge variant="destructive">Estourou</Badge>
                  ) : p.emAlerta ? (
                    <Badge variant="secondary">Em alerta</Badge>
                  ) : (
                    <Badge variant="outline">No prazo</Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setToDelete(p.goal.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Progress value={Math.min(100, p.percentual)} />
                <div className="flex justify-between text-muted-foreground">
                  <span>Realizado: <strong className="text-foreground">{brl(p.realizado)}</strong></span>
                  <span>Orçado: {brl(Number(p.goal.valor_orcado))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Meta de economia: {brl(Number(p.goal.meta_economia))}</span>
                  <span className={p.economiaProjetada >= 0 ? "text-emerald-600" : "text-destructive"}>
                    Projeção: {brl(p.economiaProjetada)}
                  </span>
                </div>
                {p.goal.prazo && (
                  <p className="text-xs text-muted-foreground">
                    Prazo: {new Date(p.goal.prazo).toLocaleDateString("pt-BR")}
                    {p.diasRestantes !== null && ` · ${p.diasRestantes} dia(s) restante(s)`}
                  </p>
                )}
                {p.estourou && (
                  <p className="text-xs font-medium text-destructive">
                    Custo real ultrapassou o orçado em {brl(Math.abs(p.restante))}.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {!loading && progress.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
          )}
        </div>
      </main>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              A meta será removida. Os lançamentos financeiros não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                const res = await removeGoal(toDelete);
                setToDelete(null);
                if (res.ok) toast.success("Meta excluída.");
                else toast.error(res.error ?? "Falha ao excluir.");
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
