import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Minimize2, Maximize2, X, Filter, Trash2, BarChart3, Receipt, Search, FileUp, PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import UniversalBillUpload from "@/components/UniversalBillUpload";
import ExpenseForm from "@/components/ExpenseForm";
import { useConsumptionBills, type BillType } from "@/hooks/useConsumptionBills";
import { useExpenses } from "@/hooks/useExpenses";

const TIPO_LABEL: Record<BillType, string> = {
  energia: "Energia", internet: "Internet", agua: "Água", gas: "Gás",
  iptu: "IPTU", ipva: "IPVA", taxa: "Taxa", telefone: "Telefone", outro: "Outro",
};

const TIPO_CLASSES: Record<BillType, string> = {
  energia: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  internet: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  agua: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  gas: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  iptu: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  ipva: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  taxa: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  telefone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  outro: "bg-muted text-muted-foreground border-border",
};

const fmt = (v: number | null | undefined) =>
  v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, da] = d.split("-");
  return da ? `${da}/${m}/${y}` : d;
};

export default function ContasCentral() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { bills, loading, fetchAll, deleteMany } = useConsumptionBills();
  const { expenses, loading: loadingExp, fetchAll: fetchExp, deleteMany: deleteExp } = useExpenses();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedExp, setSelectedExp] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"contas" | "despesas">("contas");
  const [entry, setEntry] = useState<"arquivo" | "manual">("arquivo");

  const [fTipo, setFTipo] = useState<string>("__all__");
  const [fInst, setFInst] = useState("");
  const [fRef, setFRef] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fOrigem, setFOrigem] = useState<string>("__all__");

  const filtered = useMemo(() => bills.filter((b) => {
    if (fTipo !== "__all__" && b.tipo_conta !== fTipo) return false;
    if (fInst && !b.codigo_instalacao.toLowerCase().includes(fInst.toLowerCase())) return false;
    if (fRef && !(b.mes_referencia || "").toLowerCase().includes(fRef.toLowerCase())) return false;
    if (fOrigem !== "__all__" && b.source !== fOrigem) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      const hay = `${b.titular ?? ""} ${b.endereco ?? ""} ${b.fornecedor ?? ""} ${b.file_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fFrom && b.data_vencimento < fFrom) return false;
    if (fTo && b.data_vencimento > fTo) return false;
    return true;
  }), [bills, fTipo, fInst, fRef, fSearch, fFrom, fTo, fOrigem]);

  const expFiltered = useMemo(() => {
    return expenses.filter((e) => {
      if (fSearch) {
        const q = fSearch.toLowerCase();
        const hay = `${e.detalhes ?? ""} ${e.numero_documento ?? ""} ${e.categoria ?? ""} ${e.tipo_lancamento ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fOrigem !== "__all__" && e.origem !== fOrigem) return false;
      if (fFrom && (e.data_vencimento ?? "") < fFrom) return false;
      if (fTo && (e.data_vencimento ?? "") > fTo) return false;
      return true;
    });
  }, [expenses, fSearch, fFrom, fTo, fOrigem]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, b) => s + (Number(b.valor_total) || 0), 0),
    media: filtered.length ? filtered.reduce((s, b) => s + (Number(b.valor_total) || 0), 0) / filtered.length : 0,
  }), [filtered]);

  const expTotals = useMemo(() => ({
    count: expFiltered.length,
    total: expFiltered.reduce((s, e) => s + (Number(e.valor) || 0), 0),
    media: expFiltered.length ? expFiltered.reduce((s, e) => s + (Number(e.valor) || 0), 0) / expFiltered.length : 0,
  }), [expFiltered]);

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((b) => b.id)));
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} fatura(s)?`)) return;
    const ok = await deleteMany([...selected]);
    if (ok) { toast.success("Faturas excluídas"); setSelected(new Set()); }
    else toast.error("Erro ao excluir");
  };
  const toggleExp = (id: string) =>
    setSelectedExp((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllExp = () =>
    setSelectedExp(selectedExp.size === expFiltered.length ? new Set() : new Set(expFiltered.map((e) => e.id)));
  const deleteSelectedExp = async () => {
    if (selectedExp.size === 0) return;
    if (!confirm(`Excluir ${selectedExp.size} despesa(s)?`)) return;
    const ok = await deleteExp([...selectedExp]);
    if (ok) { toast.success("Despesas excluídas"); setSelectedExp(new Set()); }
    else toast.error("Erro ao excluir");
  };

  const clearFilters = () => {
    setFTipo("__all__"); setFInst(""); setFRef(""); setFSearch(""); setFFrom(""); setFTo(""); setFOrigem("__all__");
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  }, []);
  const handleClose = useCallback(() => {
    if (confirm("Deseja realmente sair do aplicativo?")) signOut();
  }, [signOut]);

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Receipt className="h-5 w-5 text-accent" />
          <span className="truncate text-sm font-semibold text-foreground">Central de Contas e Despesas</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-2 hidden text-xs text-muted-foreground sm:block">{user?.email}</div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Aplicativo minimizado")}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="safe-bottom flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "contas" | "despesas")} className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="contas" className="flex-1 sm:flex-none">Contas de Consumo</TabsTrigger>
              <TabsTrigger value="despesas" className="flex-1 sm:flex-none">Despesas / Boletos</TabsTrigger>
            </TabsList>

            <TabsContent value="contas" className="space-y-5 mt-4">
              {/* Toggle de entrada */}
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur w-fit">
                <Button size="sm" variant={entry === "arquivo" ? "default" : "ghost"} onClick={() => setEntry("arquivo")} className="gap-2">
                  <FileUp className="h-4 w-4" /> Carregar arquivo
                </Button>
                <Button size="sm" variant={entry === "manual" ? "default" : "ghost"} onClick={() => setEntry("manual")} className="gap-2">
                  <PencilLine className="h-4 w-4" /> Lançar manualmente
                </Button>
              </div>
              {entry === "arquivo"
                ? <UniversalBillUpload onInserted={fetchAll} />
                : <ExpenseForm onSaved={fetchExp} />}

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Filter className="h-5 w-5 text-accent" /> Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label className="text-xs">Tipo de conta</Label>
                      <Select value={fTipo} onValueChange={setFTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          {Object.entries(TIPO_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Origem</Label>
                      <Select value={fOrigem} onValueChange={setFOrigem}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas</SelectItem>
                          <SelectItem value="upload">Upload</SelectItem>
                          <SelectItem value="drive">Google Drive</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Código de Instalação</Label>
                      <Input value={fInst} onChange={(e) => setFInst(e.target.value)} placeholder="Buscar…" />
                    </div>
                    <div>
                      <Label className="text-xs">Mês Referência</Label>
                      <Input value={fRef} onChange={(e) => setFRef(e.target.value)} placeholder="Ex: 03/2025" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Busca (titular, fornecedor, arquivo)</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Vencimento de</Label>
                      <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Vencimento até</Label>
                      <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
                    </div>
                    <div className="flex items-end gap-2 lg:col-span-4">
                      <Button variant="outline" className="flex-1 sm:flex-none" onClick={clearFilters}>Limpar filtros</Button>
                      <Button className="flex-1 sm:flex-none gap-2" onClick={() => navigate("/neoenergia/analytics")}>
                        <BarChart3 className="h-4 w-4" /> Análises & Projeções
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Faturas</p><p className="mt-1 text-xl sm:text-2xl font-bold">{totals.count}</p></div>
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Valor Total</p><p className="mt-1 text-xl sm:text-2xl font-bold text-destructive">{fmt(totals.total)}</p></div>
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Média/Fatura</p><p className="mt-1 text-xl sm:text-2xl font-bold">{fmt(totals.media)}</p></div>
              </div>

              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Faturas Carregadas</CardTitle>
                      <CardDescription>Ordenadas por vencimento (crescente). {loading && "Carregando…"}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={deleteSelected} disabled={selected.size === 0} className="text-destructive gap-2">
                      <Trash2 className="h-4 w-4" /> Excluir ({selected.size})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-[640px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                            </TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Instalação</TableHead>
                            <TableHead>Titular</TableHead>
                            <TableHead>Referência</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Consumo</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">Nenhuma fatura encontrada.</TableCell></TableRow>
                          ) : filtered.map((b) => (
                            <TableRow key={b.id} data-state={selected.has(b.id) ? "selected" : undefined}>
                              <TableCell><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} /></TableCell>
                              <TableCell><Badge variant="outline" className={TIPO_CLASSES[b.tipo_conta]}>{TIPO_LABEL[b.tipo_conta]}</Badge></TableCell>
                              <TableCell className="text-xs uppercase text-muted-foreground">{b.source}</TableCell>
                              <TableCell className="text-sm">{b.fornecedor || "—"}</TableCell>
                              <TableCell className="text-sm font-mono">{b.codigo_instalacao}</TableCell>
                              <TableCell className="text-sm max-w-[180px] truncate">{b.titular || "—"}</TableCell>
                              <TableCell className="text-sm">{b.mes_referencia || "—"}</TableCell>
                              <TableCell className="text-sm">{fmtDate(b.data_vencimento)}</TableCell>
                              <TableCell className="text-sm">{b.consumo != null ? `${Number(b.consumo).toLocaleString("pt-BR")} ${b.unidade_consumo || ""}` : "—"}</TableCell>
                              <TableCell className="text-right text-sm font-medium text-destructive">{fmt(Number(b.valor_total))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="despesas" className="space-y-5 mt-4">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur w-fit">
                <Button size="sm" variant={entry === "arquivo" ? "default" : "ghost"} onClick={() => setEntry("arquivo")} className="gap-2">
                  <FileUp className="h-4 w-4" /> Carregar arquivo
                </Button>
                <Button size="sm" variant={entry === "manual" ? "default" : "ghost"} onClick={() => setEntry("manual")} className="gap-2">
                  <PencilLine className="h-4 w-4" /> Lançar manualmente
                </Button>
              </div>

              {entry === "arquivo" ? (
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="text-base">Importar boletos / despesas via PDF</CardTitle>
                    <CardDescription>
                      Use o mesmo importador unificado. Para débitos vindos do OFX, basta clicar em "Salvar na Base" na tela Extrato — os débitos viram despesas automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UniversalBillUpload onInserted={() => { fetchAll(); fetchExp(); }} />
                  </CardContent>
                </Card>
              ) : (
                <ExpenseForm onSaved={fetchExp} />
              )}

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5 text-accent" /> Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label className="text-xs">Origem</Label>
                      <Select value={fOrigem} onValueChange={setFOrigem}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="ofx">OFX</SelectItem>
                          <SelectItem value="upload">Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Busca</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Categoria, detalhes, documento…" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Vencimento de</Label>
                      <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Vencimento até</Label>
                      <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button variant="outline" className="w-full" onClick={clearFilters}>Limpar filtros</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Despesas</p><p className="mt-1 text-xl sm:text-2xl font-bold">{expTotals.count}</p></div>
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Valor Total</p><p className="mt-1 text-xl sm:text-2xl font-bold text-destructive">{fmt(expTotals.total)}</p></div>
                <div className="card-elevated p-4"><p className="text-xs text-muted-foreground">Média</p><p className="mt-1 text-xl sm:text-2xl font-bold">{fmt(expTotals.media)}</p></div>
              </div>

              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Despesas Registradas</CardTitle>
                      <CardDescription>Ordenadas por vencimento (crescente). {loadingExp && "Carregando…"}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={deleteSelectedExp} disabled={selectedExp.size === 0} className="text-destructive gap-2">
                      <Trash2 className="h-4 w-4" /> Excluir ({selectedExp.size})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-[640px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox checked={expFiltered.length > 0 && selectedExp.size === expFiltered.length} onCheckedChange={toggleAllExp} />
                            </TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Nº Documento</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expFiltered.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Nenhuma despesa registrada.</TableCell></TableRow>
                          ) : expFiltered.map((e) => (
                            <TableRow key={e.id} data-state={selectedExp.has(e.id) ? "selected" : undefined}>
                              <TableCell><Checkbox checked={selectedExp.has(e.id)} onCheckedChange={() => toggleExp(e.id)} /></TableCell>
                              <TableCell className="text-sm">{e.tipo_lancamento}</TableCell>
                              <TableCell className="text-sm">{e.categoria ?? "—"}</TableCell>
                              <TableCell className="text-sm font-mono">{e.numero_documento ?? "—"}</TableCell>
                              <TableCell className="text-sm max-w-[260px] truncate">{e.detalhes ?? "—"}</TableCell>
                              <TableCell className="text-xs uppercase text-muted-foreground">{e.origem}</TableCell>
                              <TableCell className="text-sm">{fmtDate(e.data_vencimento)}</TableCell>
                              <TableCell className="text-sm">{fmtDate(e.data_pagamento)}</TableCell>
                              <TableCell className="text-right text-sm font-medium text-destructive">{fmt(Number(e.valor))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
