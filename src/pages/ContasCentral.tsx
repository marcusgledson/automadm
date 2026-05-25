import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Minimize2, Maximize2, X, Filter, Trash2, BarChart3, Receipt, Search,
} from "lucide-react";
import { toast } from "sonner";
import UniversalBillUpload from "@/components/UniversalBillUpload";
import { useConsumptionBills, type BillType } from "@/hooks/useConsumptionBills";

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
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (d: string) => {
  const [y, m, da] = d.split("-");
  return `${da}/${m}/${y}`;
};

export default function ContasCentral() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { bills, loading, fetchAll, deleteMany } = useConsumptionBills();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [fTipo, setFTipo] = useState<string>("__all__");
  const [fInst, setFInst] = useState("");
  const [fRef, setFRef] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      if (fTipo !== "__all__" && b.tipo_conta !== fTipo) return false;
      if (fInst && !b.codigo_instalacao.toLowerCase().includes(fInst.toLowerCase())) return false;
      if (fRef && !(b.mes_referencia || "").toLowerCase().includes(fRef.toLowerCase())) return false;
      if (fSearch) {
        const q = fSearch.toLowerCase();
        const hay = `${b.titular ?? ""} ${b.endereco ?? ""} ${b.fornecedor ?? ""} ${b.file_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fFrom && b.data_vencimento < fFrom) return false;
      if (fTo && b.data_vencimento > fTo) return false;
      return true;
    });
  }, [bills, fTipo, fInst, fRef, fSearch, fFrom, fTo]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, b) => s + (Number(b.valor_total) || 0), 0),
    media: filtered.length ? filtered.reduce((s, b) => s + (Number(b.valor_total) || 0), 0) / filtered.length : 0,
  }), [filtered]);

  const toggle = (id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((b) => b.id)));
  };
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} fatura(s)?`)) return;
    const ok = await deleteMany([...selected]);
    if (ok) { toast.success("Faturas excluídas"); setSelected(new Set()); }
    else toast.error("Erro ao excluir");
  };
  const clearFilters = () => {
    setFTipo("__all__"); setFInst(""); setFRef(""); setFSearch(""); setFFrom(""); setFTo("");
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  }, []);
  const handleClose = useCallback(() => {
    if (confirm("Deseja realmente sair do aplicativo?")) signOut();
  }, [signOut]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Receipt className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">Central de Contas de Consumo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-3 text-xs text-muted-foreground">{user?.email}</div>
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

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <UniversalBillUpload onInserted={fetchAll} />

          {/* Filtros */}
          <Card>
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
                  <Label className="text-xs">Código de Instalação</Label>
                  <Input value={fInst} onChange={(e) => setFInst(e.target.value)} placeholder="Buscar…" />
                </div>
                <div>
                  <Label className="text-xs">Mês Referência</Label>
                  <Input value={fRef} onChange={(e) => setFRef(e.target.value)} placeholder="Ex: 03/2025" />
                </div>
                <div>
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
                <div className="flex items-end gap-2 lg:col-span-2">
                  <Button variant="outline" className="flex-1" onClick={clearFilters}>Limpar filtros</Button>
                  <Button className="flex-1" onClick={() => navigate("/neoenergia/analytics")}>
                    <BarChart3 className="h-4 w-4" /> Análises & Projeções
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Faturas</p>
              <p className="mt-1 text-2xl font-bold">{totals.count}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="mt-1 text-2xl font-bold text-destructive">{fmt(totals.total)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Média/Fatura</p>
              <p className="mt-1 text-2xl font-bold">{fmt(totals.media)}</p>
            </div>
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg">Faturas Carregadas</CardTitle>
                  <CardDescription>
                    Ordenadas por data de vencimento (crescente). {loading && "Carregando…"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={deleteSelected}
                    disabled={selected.size === 0} className="text-destructive">
                    <Trash2 className="h-4 w-4" /> Excluir ({selected.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="max-h-[640px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={filtered.length > 0 && selected.size === filtered.length}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Tipo</TableHead>
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
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                            Nenhuma fatura encontrada.
                          </TableCell>
                        </TableRow>
                      ) : filtered.map((b) => (
                        <TableRow key={b.id} data-state={selected.has(b.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={TIPO_CLASSES[b.tipo_conta]}>
                              {TIPO_LABEL[b.tipo_conta]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{b.fornecedor || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{b.codigo_instalacao}</TableCell>
                          <TableCell className="text-sm max-w-[180px] truncate">{b.titular || "—"}</TableCell>
                          <TableCell className="text-sm">{b.mes_referencia || "—"}</TableCell>
                          <TableCell className="text-sm">{fmtDate(b.data_vencimento)}</TableCell>
                          <TableCell className="text-sm">
                            {b.consumo != null ? `${Number(b.consumo).toLocaleString("pt-BR")} ${b.unidade_consumo || ""}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-destructive">
                            {fmt(Number(b.valor_total))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
