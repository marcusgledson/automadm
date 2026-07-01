import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, ListChecks, X } from "lucide-react";
import type { FinancialRecord } from "@/lib/fileParser";

const CATEGORIAS = [
  "Saldo do Dia", "PIX", "Transferência", "Boleto", "Tarifa",
  "Pagamento", "Saque", "Depósito", "Compra", "Rendimento", "Estorno", "Outros",
];

interface EditableRow extends FinancialRecord {
  __include: boolean;
}

interface Props {
  open: boolean;
  records: FinancialRecord[];
  onCancel: () => void;
  onConfirm: (edited: FinancialRecord[]) => void;
}

export default function EditableRecordsDialog({ open, records, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<EditableRow[]>([]);

  useEffect(() => {
    if (open) setRows(records.map((r) => ({ ...r, __include: true })));
  }, [open, records]);

  const included = useMemo(() => rows.filter((r) => r.__include).length, [rows]);

  const updateRow = (idx: number, patch: Partial<EditableRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, __include: checked })));
  };

  const handleConfirm = () => {
    const final: FinancialRecord[] = rows
      .filter((r) => r.__include)
      .map(({ __include: _drop, ...rest }) => rest);
    onConfirm(final);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Revisar lançamentos antes de importar
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1"><ListChecks className="h-3 w-3" /> {included} de {rows.length} selecionado(s)</Badge>
            Edite descrição e categoria, ou desmarque linhas que não devem ser importadas.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>Marcar todas</Button>
            <Button size="sm" variant="outline" onClick={() => toggleAll(false)}>Desmarcar todas</Button>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead className="min-w-[260px]">Descrição</TableHead>
                <TableHead className="w-40">Categoria</TableHead>
                <TableHead className="w-24 text-right">Valor</TableHead>
                <TableHead className="w-20">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem lançamentos.</TableCell></TableRow>
              ) : rows.map((r, idx) => (
                <TableRow key={`${r.fitid || idx}`} className={!r.__include ? "opacity-50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={r.__include}
                      onCheckedChange={(v) => updateRow(idx, { __include: v === true })}
                      aria-label="Incluir lançamento"
                    />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.data}</TableCell>
                  <TableCell>
                    <Input
                      value={r.descricao}
                      onChange={(e) => updateRow(idx, { descricao: e.target.value })}
                      disabled={!r.__include}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.categoria}
                      onValueChange={(v) => updateRow(idx, { categoria: v })}
                      disabled={!r.__include}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`text-right text-xs font-mono ${r.valor < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                  <TableCell className="text-xs">{r.tipo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={included === 0}>
            Confirmar {included} lançamento{included === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
