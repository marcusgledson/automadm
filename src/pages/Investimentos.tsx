import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Home, TrendingUp, Upload, Loader2, FileText, Trash2, Info, BookOpen, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { useInvestments, type Investment } from "@/hooks/useInvestments";
import {
  GLOSSARIO, toInvestmentRow, type ExtractedInvestment,
} from "@/lib/investmentMapper";

const brl = (v?: number | null) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const dataBR = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const raw = new TextDecoder("latin1").decode(new Uint8Array(await file.arrayBuffer()));
    let text = "";
    const m = raw.match(/\(([^)]+)\)/g);
    if (m) text = m.map((s) => s.slice(1, -1)).join(" ");
    const seg = raw.match(/[A-Za-zÀ-ÿ0-9\s.,;:\/\-@#$%&*()+=]{10,}/g);
    if (seg) text += "\n" + seg.join("\n");
    return text;
  }
  return await file.text();
}

export default function Investimentos() {
  const navigate = useNavigate();
  const { investments, loading, upsertInvestment, deleteInvestment } = useInvestments();
  const [instituicao, setInstituicao] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<ExtractedInvestment[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const totals = useMemo(() => {
    const aplicado = investments.reduce((s, i) => s + (i.valor_aplicado ?? 0), 0);
    const atual = investments.reduce((s, i) => s + (i.valor_liquido ?? i.valor_bruto ?? i.valor_aplicado ?? 0), 0);
    return { aplicado, atual, ganho: atual - aplicado };
  }, [investments]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      toast.info(`Lendo ${file.name}…`);
      const text = await extractText(file);
      const { data, error } = await supabase.functions.invoke("parse-investment", {
        body: { text, fileName: file.name },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha na leitura com IA");
      const list = (data.data?.investimentos || []) as ExtractedInvestment[];
      if (list.length === 0) {
        toast.error("Nenhum investimento identificado no arquivo.");
        return;
      }
      setCandidates(list);
      setSelected(Object.fromEntries(list.map((_, i) => [i, true])));
      setFileName(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar arquivo");
    } finally {
      setBusy(false);
    }
  };

  const confirmSelection = async () => {
    setSaving(true);
    let ok = 0, err = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (!selected[i]) continue;
      const row = toInvestmentRow(candidates[i], {
        fileName, source: "upload", instituicao: instituicao || undefined,
      });
      if ("error" in row) { err++; toast.error(`${candidates[i].ativo || "Item"}: ${row.error}`); continue; }
      const res = await upsertInvestment(row);
      if (res.ok) ok++; else { err++; toast.error(res.error || "Erro ao salvar"); }
    }
    setSaving(false);
    setCandidates([]);
    toast.success(`${ok} investimento(s) salvo(s)${err ? `, ${err} com erro` : ""}.`);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-semibold">Meus Investimentos</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setGlossaryOpen(true)}>
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Entenda os termos</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tela inicial</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="safe-bottom mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Total aplicado</CardDescription>
            <CardTitle className="text-xl">{brl(totals.aplicado)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Valor atual</CardDescription>
            <CardTitle className="text-xl">{brl(totals.atual)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Ganho até agora</CardDescription>
            <CardTitle className={`text-xl ${totals.ganho >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {brl(totals.ganho)}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5 text-accent" /> Importar extrato de investimentos
                </CardTitle>
                <CardDescription>
                  Aceita PDF, TXT ou CSV. Se o extrato tiver vários investimentos, você escolhe quais salvar.
                  Tudo é traduzido em linguagem simples — ou inclua manualmente.
                </CardDescription>
              </div>
              <ManualInvestmentDialog />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Instituição (opcional)</Label>
              <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)}
                placeholder="Ex: Banco do Brasil, XP, Nubank" />
            </div>
            <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
              busy ? "pointer-events-none border-muted bg-muted/20" : "border-border hover:border-primary hover:bg-primary/5"
            }`}>
              {busy ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Lendo e traduzindo com IA…</p>
                </>
              ) : (
                <>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique ou arraste o extrato aqui</p>
                  <p className="text-xs text-muted-foreground">PDF, TXT ou CSV</p>
                </>
              )}
              <input type="file" accept=".pdf,.txt,.csv" className="hidden" disabled={busy}
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Investimentos salvos</CardTitle>
            <CardDescription>Abra um item para ver a explicação em linguagem simples.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : investments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum investimento importado ainda.
              </p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {investments.map((inv) => (
                  <InvestmentItem key={inv.id} inv={inv} onDelete={() => deleteInvestment(inv.id)} />
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Seleção de investimentos encontrados */}
      <Dialog open={candidates.length > 0} onOpenChange={(v) => !v && setCandidates([])}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Escolha os investimentos a salvar</DialogTitle>
            <DialogDescription>
              Encontramos {candidates.length} investimento(s) em {fileName}. Marque os que deseja guardar na base.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Aplicação</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Aplicado</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead>Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Checkbox checked={!!selected[i]}
                        onCheckedChange={(v) => setSelected((p) => ({ ...p, [i]: !!v }))} />
                    </TableCell>
                    <TableCell className="font-medium">{c.ativo || "—"}</TableCell>
                    <TableCell>{c.tipo_investimento || "—"}</TableCell>
                    <TableCell>{c.data_aplicacao || "—"}</TableCell>
                    <TableCell>{c.data_vencimento || "—"}</TableCell>
                    <TableCell className="text-right">{brl(c.valor_aplicado)}</TableCell>
                    <TableCell className="text-right">{brl(c.valor_liquido ?? c.valor_bruto)}</TableCell>
                    <TableCell className="text-xs">
                      {c.taxa_contratada ||
                        (c.percentual_indexador && c.indexador ? `${c.percentual_indexador}% do ${c.indexador}` : "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandidates([])} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmSelection} disabled={saving || selectedCount === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar {selectedCount} selecionado(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Glossário */}
      <Dialog open={glossaryOpen} onOpenChange={setGlossaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entenda os termos</DialogTitle>
            <DialogDescription>Explicações rápidas, sem economês.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-auto">
            {GLOSSARIO.map((g) => (
              <div key={g.termo} className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-semibold">{g.termo}</p>
                <p className="text-sm text-muted-foreground">{g.texto}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvestmentItem({ inv, onDelete }: { inv: Investment; onDelete: () => void }) {
  const exp = (inv.explicacao || {}) as Record<string, string | number | null>;
  return (
    <AccordionItem value={inv.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2 text-left">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{inv.ativo}</p>
            <p className="text-xs text-muted-foreground">
              {[inv.instituicao, inv.tipo_investimento].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inv.indexador && <Badge variant="secondary">{inv.taxa_contratada || inv.indexador}</Badge>}
            <span className="text-sm font-medium">{brl(inv.valor_liquido ?? inv.valor_bruto ?? inv.valor_aplicado)}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Data de aplicação" value={dataBR(inv.data_aplicacao)} />
          <Field label="Vencimento" value={dataBR(inv.data_vencimento)} />
          <Field label="Carência até" value={dataBR(inv.data_carencia)} />
          <Field label="Liquidez" value={inv.liquidez || "—"} />
          <Field label="Valor aplicado" value={brl(inv.valor_aplicado)} />
          <Field label="Valor bruto" value={brl(inv.valor_bruto)} />
          <Field label="Valor líquido" value={brl(inv.valor_liquido)} />
          <Field label="Rentabilidade no período"
            value={typeof inv.rentabilidade_periodo === "number" ? `${inv.rentabilidade_periodo}%` : "—"} />
          <Field label="IR / IOF" value={`${brl(inv.ir)} / ${brl(inv.iof)}`} />
        </div>

        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4 text-primary" /> Explicação simples
          </p>
          {["resumo", "taxa", "resgate", "impostos"].map((k) =>
            exp[k] ? <p key={k} className="text-sm text-muted-foreground">{String(exp[k])}</p> : null
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
