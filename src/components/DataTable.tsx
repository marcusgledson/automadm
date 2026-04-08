import { useState, useMemo } from "react";
import { FinancialRecord } from "@/lib/fileParser";
import { exportToXlsx } from "@/lib/exportXlsx";
import { exportSummary } from "@/lib/exportSummary";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Search, ArrowUpDown, TrendingUp, TrendingDown, Filter, FileDown, Image, FileText } from "lucide-react";
import { toast } from "sonner";

interface DataTableProps {
  records: FinancialRecord[];
}

type SortField = "data" | "descricao" | "valor" | "tipo" | "categoria";
type SortDir = "asc" | "desc";

export default function DataTable({ records }: DataTableProps) {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const tipos = useMemo(() => [...new Set(records.map((r) => r.tipo))], [records]);
  const categorias = useMemo(() => [...new Set(records.map((r) => r.categoria))].sort(), [records]);

  const filtered = useMemo(() => {
    let data = records;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.descricao.toLowerCase().includes(q) ||
          r.data.includes(q) ||
          r.documento?.toLowerCase().includes(q)
      );
    }
    if (filterTipo !== "todos") data = data.filter((r) => r.tipo === filterTipo);
    if (filterCategoria !== "todos") data = data.filter((r) => r.categoria === filterCategoria);
    data = [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === "valor") cmp = a.valor - b.valor;
      else cmp = String(a[sortField]).localeCompare(String(b[sortField]));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [records, search, filterTipo, filterCategoria, sortField, sortDir]);

  const summary = useMemo(() => {
    const movimentacoes = filtered.filter((r) => r.categoria !== "Saldo do Dia");
    const creditos = movimentacoes.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
    const debitos = movimentacoes.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
    // Saldo do dia: pega o registro mais recente (última data)
    const saldosDoDia = filtered.filter((r) => r.categoria === "Saldo do Dia");
    const saldoDia = saldosDoDia.length > 0
      ? saldosDoDia.sort((a, b) => b.data.localeCompare(a.data))[0].valor
      : null;
    return {
      creditos,
      debitos,
      saldo: creditos + debitos,
      saldoDia,
      total: filtered.length,
    };
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleExportXlsx = () => {
    try {
      exportToXlsx(filtered, "extrato-financeiro.xlsx");
      toast.success("Relatório XLSX exportado com sucesso!");
    } catch {
      toast.error("Erro ao gerar o relatório XLSX");
    }
  };

  const handleExportSummary = async (format: "pdf" | "image") => {
    setShowExportDialog(false);
    try {
      await exportSummary({ records, filterTipo, filterCategoria, format });
      toast.success(`Resumo exportado como ${format === "pdf" ? "PDF" : "Imagem"}!`);
    } catch {
      toast.error("Erro ao gerar o resumo");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Registros</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Créditos
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{fmt(summary.creditos)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> Débitos
          </p>
          <p className="mt-1 text-2xl font-bold text-destructive">{fmt(summary.debitos)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Saldo</p>
          <p className={`mt-1 text-2xl font-bold ${summary.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
            {fmt(summary.saldo)}
          </p>
        </div>
      </div>

      {/* Filters + Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar descrição, data, documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Categorias</SelectItem>
              {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportXlsx} className="gap-2">
            <FileDown className="h-4 w-4" />
            Relatório XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="gap-2">
            <FileText className="h-4 w-4" />
            Enviar Resumo
          </Button>
        </div>
      </div>

      {/* Pivot by category */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {categorias.map((cat) => {
          const items = filtered.filter((r) => r.categoria === cat);
          if (items.length === 0) return null;
          const total = items.reduce((s, r) => s + r.valor, 0);
          return (
            <button
              key={cat}
              onClick={() => setFilterCategoria(filterCategoria === cat ? "todos" : cat)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                filterCategoria === cat ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-xs font-medium text-muted-foreground">{cat}</p>
              <p className="text-sm font-bold text-foreground">{items.length}</p>
              <p className={`text-xs ${total >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(total)}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-[calc(100vh-420px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                {(["data", "descricao", "valor", "tipo", "categoria"] as SortField[]).map((f) => (
                  <TableHead key={f}>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(f)} className="gap-1 -ml-2 font-medium">
                      {{ data: "Data", descricao: "Descrição", valor: "Valor", tipo: "Tipo", categoria: "Categoria" }[f]}
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell>
                </TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-sm">{r.data}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{r.descricao}</TableCell>
                    <TableCell className={`whitespace-nowrap text-sm font-medium ${r.valor >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(r.valor)}</TableCell>
                    <TableCell><Badge variant={r.tipo === "Crédito" ? "default" : r.tipo === "Débito" ? "destructive" : "secondary"}>{r.tipo}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{r.categoria}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Export Summary Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Resumo Financeiro</DialogTitle>
            <DialogDescription>
              Escolha o formato de saída para o resumo com os filtros atuais aplicados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p><strong>Filtros ativos:</strong></p>
              <p>Tipo: {filterTipo === "todos" ? "Todos" : filterTipo}</p>
              <p>Categoria: {filterCategoria === "todos" ? "Todas" : filterCategoria}</p>
              <p>Registros: {filtered.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handleExportSummary("pdf")} className="gap-2 h-20 flex-col" variant="outline">
                <FileText className="h-6 w-6 text-destructive" />
                <span className="text-sm font-medium">Exportar PDF</span>
              </Button>
              <Button onClick={() => handleExportSummary("image")} className="gap-2 h-20 flex-col" variant="outline">
                <Image className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">Exportar Imagem</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
