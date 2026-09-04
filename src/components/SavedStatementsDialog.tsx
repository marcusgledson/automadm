import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import SaveDestinationPanel from "@/components/SaveDestinationPanel";
import { useBankStatements, type BankStatementRow } from "@/hooks/useBankStatements";

const ALL = "__todos__";
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Consulta o extrato já gravado por Banco, Conta, Titular, período e tipo. */
export default function SavedStatementsDialog({ open, onOpenChange }: Props) {
  const { rows, loading, fetchAll } = useBankStatements();
  const [banco, setBanco] = useState(ALL);
  const [conta, setConta] = useState(ALL);
  const [titular, setTitular] = useState(ALL);
  const [tipo, setTipo] = useState(ALL);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => { if (open) void fetchAll(); }, [open, fetchAll]);

  const opts = useMemo(() => {
    const uniq = (vals: (string | null)[]) =>
      [...new Set(vals.filter((v): v is string => !!v && v.trim() !== ""))].sort();
    return {
      bancos: uniq(rows.map((r) => r.banco)),
      contas: uniq(rows.map((r) => `${r.agencia}/${r.conta}`)),
      titulares: uniq(rows.map((r) => (r as BankStatementRow & { titular?: string | null }).titular ?? null)),
      tipos: uniq(rows.map((r) => r.tipo_lancamento)),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return rows.filter((r) => {
      const rTitular = (r as BankStatementRow & { titular?: string | null }).titular ?? "";
      if (banco !== ALL && r.banco !== banco) return false;
      if (conta !== ALL && `${r.agencia}/${r.conta}` !== conta) return false;
      if (titular !== ALL && rTitular !== titular) return false;
      if (tipo !== ALL && r.tipo_lancamento !== tipo) return false;
      if (de && (!r.data || r.data < de)) return false;
      if (ate && (!r.data || r.data > ate)) return false;
      if (term && !`${r.descricao ?? ""} ${r.lancamento ?? ""} ${r.documento ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, banco, conta, titular, tipo, de, ate, busca]);

  const total = filtered.reduce((s, r) => s + Number(r.valor || 0), 0);

  const buildFile = () => {
    const header = "data;banco;agencia;conta;titular;lancamento;descricao;tipo;valor\n";
    const body = filtered
      .map((r) => {
        const t = (r as BankStatementRow & { titular?: string | null }).titular ?? "";
        return [r.data ?? "", r.banco ?? "", r.agencia, r.conta, t, r.lancamento ?? "",
          (r.descricao ?? "").replace(/;/g, ","), r.tipo_lancamento ?? "", r.valor].join(";");
      })
      .join("\n");
    return {
      blob: new Blob([header + body], { type: "text/csv;charset=utf-8" }),
      fileName: `extrato-consulta-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  };

  const selectBlock = (label: string, value: string, onChange: (v: string) => void, values: string[]) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {values.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Consultar extratos gravados
          </DialogTitle>
          <DialogDescription>
            Filtre os lançamentos já salvos na base por banco, conta, titular, período ou tipo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {selectBlock("Banco", banco, setBanco, opts.bancos)}
          {selectBlock("Agência / Conta", conta, setConta, opts.contas)}
          {selectBlock("Titular", titular, setTitular, opts.titulares)}
          {selectBlock("Tipo de lançamento", tipo, setTipo, opts.tipos)}
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input className="h-8 text-xs" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input className="h-8 text-xs" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Buscar na descrição</Label>
            <Input className="h-8 text-xs" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: pix, tarifa, salário" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{filtered.length} lançamento(s)</Badge>
          <Badge variant={total >= 0 ? "secondary" : "destructive"}>Soma: {brl(total)}</Badge>
          {loading && <span className="text-muted-foreground">Carregando…</span>}
        </div>

        <ScrollArea className="h-[320px] rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Banco</TableHead>
                <TableHead className="text-xs">Ag/Conta</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-right text-xs">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 500).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.data_raw ?? r.data ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.banco ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.agencia}/{r.conta}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs" title={r.descricao ?? ""}>
                    {r.descricao ?? r.lancamento ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.tipo_lancamento ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{brl(Number(r.valor || 0))}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum lançamento gravado corresponde aos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <SaveDestinationPanel
          buildFile={buildFile}
          disabled={filtered.length === 0}
          title="Salvar resultado da consulta"
          description="Gera um CSV com os lançamentos filtrados."
        />
      </DialogContent>
    </Dialog>
  );
}
