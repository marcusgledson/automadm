import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Filter, ArrowUpDown, TrendingUp, TrendingDown, Landmark, UserRound, RefreshCw,
} from "lucide-react";
import SaveDestinationPanel from "@/components/SaveDestinationPanel";
import { useBankStatements, type BankStatementRow } from "@/hooks/useBankStatements";
import { maskDocument } from "@/lib/accountHolder";

const ALL = "todos";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type SortField = "data" | "lancamento" | "descricao" | "documento" | "valor" | "tipo_lancamento";
type SortDir = "asc" | "desc";

/** Consulta os lançamentos já gravados na base, no mesmo padrão da Análise do Extrato. */
export default function SavedStatementsTable() {
  const { rows, loading, fetchAll } = useBankStatements();

  const [search, setSearch] = useState("");
  const [banco, setBanco] = useState(ALL);
  const [conta, setConta] = useState(ALL);
  const [titular, setTitular] = useState(ALL);
  const [tipo, setTipo] = useState(ALL);
  const [categoria, setCategoria] = useState(ALL);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const uniq = (vals: (string | null | undefined)[]) =>
    [...new Set(vals.filter((v): v is string => !!v && v.trim() !== ""))].sort();

  const opts = useMemo(() => ({
    bancos: uniq(rows.map((r) => r.banco)),
    contas: uniq(rows.map((r) => `${r.agencia}/${r.conta}`)),
    titulares: uniq(rows.map((r) => r.titular)),
    tipos: uniq(rows.map((r) => r.tipo_lancamento)),
    categorias: uniq(rows.map((r) => r.categoria)),
  }), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const data = rows.filter((r) => {
      if (banco !== ALL && r.banco !== banco) return false;
      if (conta !== ALL && `${r.agencia}/${r.conta}` !== conta) return false;
      if (titular !== ALL && (r.titular ?? "") !== titular) return false;
      if (tipo !== ALL && r.tipo_lancamento !== tipo) return false;
      if (categoria !== ALL && r.categoria !== categoria) return false;
      if (de && (!r.data || r.data < de)) return false;
      if (ate && (!r.data || r.data > ate)) return false;
      if (term && !`${r.descricao ?? ""} ${r.lancamento ?? ""} ${r.documento ?? ""} ${r.data_raw ?? r.data ?? ""}`
        .toLowerCase().includes(term)) return false;
      return true;
    });
    return [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === "valor") cmp = Number(a.valor) - Number(b.valor);
      else if (sortField === "data") cmp = String(a.data ?? "").localeCompare(String(b.data ?? ""));
      else cmp = String(a[sortField] ?? "").localeCompare(String(b[sortField] ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, banco, conta, titular, tipo, categoria, de, ate, sortField, sortDir]);

  const summary = useMemo(() => {
    const mov = filtered.filter((r) => r.categoria !== "Saldo do Dia");
    const creditos = mov.filter((r) => Number(r.valor) > 0).reduce((s, r) => s + Number(r.valor), 0);
    const debitos = mov.filter((r) => Number(r.valor) < 0).reduce((s, r) => s + Number(r.valor), 0);
    return { creditos, debitos, saldo: creditos + debitos, total: filtered.length };
  }, [filtered]);

  /** Dados da instituição / conta / titular do conjunto filtrado. */
  const header = useMemo(() => {
    const first = filtered[0] as BankStatementRow | undefined;
    if (!first) return null;
    const contasSet = new Set(filtered.map((r) => `${r.agencia}/${r.conta}`));
    const bancosSet = new Set(filtered.map((r) => r.banco ?? ""));
    const titularesSet = new Set(filtered.map((r) => r.titular ?? ""));
    return {
      banco: bancosSet.size === 1 ? first.banco : `${bancosSet.size} instituições`,
      bancoCodigo: bancosSet.size === 1 ? first.banco_codigo : null,
      conta: contasSet.size === 1 ? `Ag ${first.agencia} / Conta ${first.conta}` : `${contasSet.size} contas`,
      titular: titularesSet.size === 1 ? first.titular : `${titularesSet.size} titulares`,
      documento: titularesSet.size === 1 ? first.documento_titular : null,
    };
  }, [filtered]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
  };

  const buildFile = () => {
    const head = "data;banco;agencia;conta;titular;documento_titular;lancamento;descricao;documento;tipo;categoria;valor\n";
    const body = filtered.map((r) => [
      r.data ?? "", r.banco ?? "", r.agencia, r.conta, r.titular ?? "", r.documento_titular ?? "",
      r.lancamento ?? "", (r.descricao ?? "").replace(/;/g, ","), r.documento ?? "",
      r.tipo_lancamento ?? "", r.categoria ?? "", r.valor,
    ].join(";")).join("\n");
    return {
      blob: new Blob([head + body], { type: "text/csv;charset=utf-8" }),
      fileName: `extrato-consulta-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  };

  const selectBlock = (label: string, value: string, onChange: (v: string) => void, values: string[], allLabel: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {values.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Identificação da conta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">Base de Extratos Gravados</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {header ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1">
                  <Landmark className="h-3 w-3 text-primary" />
                  {header.bancoCodigo ? `${header.bancoCodigo} · ` : ""}{header.banco || "Instituição não informada"} · {header.conta}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1">
                  <UserRound className="h-3 w-3 text-primary" />
                  {header.titular || "Titular não informado"}
                  {header.documento ? ` · ${maskDocument(header.documento)}` : ""}
                </span>
              </>
            ) : (
              <span>Nenhum lançamento gravado para os filtros atuais.</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchAll()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Totais */}
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
          <p className="text-xs font-medium text-muted-foreground">Saldo (Mov.)</p>
          <p className={`mt-1 text-2xl font-bold ${summary.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
            {fmt(summary.saldo)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Label className="text-xs text-muted-foreground">Pesquisar</Label>
          <Search className="absolute left-3 top-[34px] h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Descrição, data, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-10"
          />
        </div>
        <Filter className="mb-2 h-4 w-4 text-muted-foreground" />
        {selectBlock("Banco", banco, setBanco, opts.bancos, "Todos os bancos")}
        {selectBlock("Agência / Conta", conta, setConta, opts.contas, "Todas as contas")}
        {selectBlock("Titular", titular, setTitular, opts.titulares, "Todos os titulares")}
        {selectBlock("Tipo de lançamento", tipo, setTipo, opts.tipos, "Todos os tipos")}
        {selectBlock("Categoria", categoria, setCategoria, opts.categorias, "Todas as categorias")}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" className="h-9 w-[150px] text-xs" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" className="h-9 w-[150px] text-xs" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-h-[calc(100vh-460px)] overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {(["data", "lancamento", "descricao", "documento", "valor", "tipo_lancamento"] as SortField[]).map((f) => (
                  <TableHead key={f} className="whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(f)} className="-ml-2 gap-1 font-medium">
                      {{
                        data: "Data", lancamento: "Lançamento", descricao: "Detalhes",
                        documento: "N° Documento", valor: "Valor", tipo_lancamento: "Tipo Lançamento",
                      }[f]}
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                ))}
                <TableHead className="whitespace-nowrap">Ag/Conta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {loading ? "Carregando lançamentos…" : "Nenhum registro encontrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 1000).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{r.data_raw ?? r.data ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <Badge variant="outline">{r.lancamento ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[260px] text-sm">{r.descricao ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{r.documento || "—"}</TableCell>
                    <TableCell className={`whitespace-nowrap text-sm font-medium ${Number(r.valor) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {fmt(Number(r.valor))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={r.tipo === "Crédito" ? "default" : r.tipo === "Débito" ? "destructive" : "secondary"}>
                        {r.tipo_lancamento ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.agencia}/{r.conta}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <SaveDestinationPanel
        buildFile={buildFile}
        disabled={filtered.length === 0}
        title="Salvar resultado da consulta"
        description="Gera um arquivo CSV com os lançamentos filtrados."
      />
    </div>
  );
}
