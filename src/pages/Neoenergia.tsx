import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Zap, ArrowLeft, Minimize2, Maximize2, X, Upload, Loader2, FileText, Trash2, Eye, Archive, ArchiveRestore, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import GoogleDriveImport from "@/components/GoogleDriveImport";
import { getInvoiceKey, normalizeMesReferencia } from "@/lib/invoiceKey";
import { loadInvoices, saveInvoices, archiveInvoices, loadArchived, removeArchived, saveArchived, type StoredInvoice } from "@/lib/invoiceStore";
import { useConsumptionBills } from "@/hooks/useConsumptionBills";
import { toBillRow, type ExtractedInvoice } from "@/lib/billMapper";

interface InvoiceData {
  fileName: string;
  titular?: string;
  cpf_cnpj?: string;
  endereco?: string;
  numero_instalacao?: string;
  mes_referencia?: string;
  data_vencimento?: string;
  consumo_kwh?: number;
  valor_energia?: number;
  valor_distribuicao?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  contrib_iluminacao?: number;
  bandeira_tarifaria?: string;
  valor_bandeira?: number;
  valor_total?: number;
  itens_fatura?: { descricao: string; quantidade?: string; preco_unitario?: number; valor: number }[];
  historico_consumo?: { mes: string; consumo_kwh: number; valor?: number }[];
  [key: string]: unknown;
}

export default function Neoenergia() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceData[]>(() => loadInvoices() as InvoiceData[]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archived, setArchived] = useState<StoredInvoice[]>(() => loadArchived());
  const { upsertBill } = useConsumptionBills();

  // Persiste (insert/update) fatura no banco — reimportações atualizam o registro
  const persistToDatabase = useCallback(async (inv: InvoiceData, source: "upload" | "drive") => {
    const row = toBillRow(inv as ExtractedInvoice, {
      fileName: inv.fileName || "fatura.pdf",
      tipo_conta: "energia",
      fornecedor: "Neoenergia",
      source,
    });
    if ("error" in row) {
      toast.warning(`${inv.fileName}: não salva na base (${row.error})`);
      return;
    }
    const res = await upsertBill(row);
    if (!res.ok) toast.error(`${inv.fileName}: ${res.error}`);
  }, [upsertBill]);

  useEffect(() => {
    saveInvoices(invoices);
  }, [invoices]);

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map((_, i) => i)));
  };
  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} fatura(s)?`)) return;
    setInvoices((prev) => prev.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
    toast.success("Faturas excluídas");
  };
  const archiveSelected = () => {
    if (selected.size === 0) return;
    const toArchive = invoices.filter((_, i) => selected.has(i));
    // Garante que já temos os dados extraídos e persistidos antes de arquivar.
    const missingData = toArchive.filter((inv) => !inv.numero_instalacao || !inv.valor_total);
    if (missingData.length > 0) {
      toast.error(`Não é possível arquivar: ${missingData.length} fatura(s) sem dados extraídos. Reprocesse antes.`);
      return;
    }
    archiveInvoices(toArchive);
    setArchived(loadArchived());
    setInvoices((prev) => prev.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
    toast.success(`${toArchive.length} fatura(s) arquivada(s)`);
  };

  const unarchiveOne = (fileName: string) => {
    const item = archived.find((a) => a.fileName === fileName);
    if (!item) return;
    const existingKeys = new Set(invoices.map((i) => getInvoiceKey(i)));
    if (existingKeys.has(getInvoiceKey(item))) {
      toast.warning("Fatura já está na lista ativa.");
      return;
    }
    setInvoices((prev) => [...prev, item as InvoiceData]);
    removeArchived(fileName);
    setArchived(loadArchived());
    toast.success("Fatura desarquivada");
  };

  const deleteArchived = (fileName: string) => {
    if (!confirm("Excluir definitivamente esta fatura arquivada?")) return;
    removeArchived(fileName);
    setArchived(loadArchived());
    toast.success("Fatura arquivada excluída");
  };

  const clearAllArchived = () => {
    if (archived.length === 0) return;
    if (!confirm("Excluir todas as faturas arquivadas?")) return;
    saveArchived([]);
    setArchived([]);
  };
  const clearAll = () => {
    if (invoices.length === 0) return;
    if (!confirm("Limpar todas as faturas processadas?")) return;
    setInvoices([]);
    setSelected(new Set());
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (confirm("Deseja realmente sair do aplicativo?")) {
      signOut();
    }
  }, [signOut]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    // Read PDF as array buffer and extract text content
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Simple PDF text extraction - decode text between stream markers
    let text = "";
    const decoder = new TextDecoder("latin1");
    const rawText = decoder.decode(bytes);
    
    // Extract text from PDF text objects (Tj, TJ, etc.)
    const textMatches = rawText.match(/\(([^)]+)\)/g);
    if (textMatches) {
      text = textMatches.map(m => m.slice(1, -1)).join(" ");
    }
    
    // Also try to find readable text segments
    const readableSegments = rawText.match(/[A-Za-zÀ-ÿ0-9\s.,;:\/\-@#$%&*()+=]{10,}/g);
    if (readableSegments) {
      text += "\n" + readableSegments.join("\n");
    }

    return text || "Não foi possível extrair texto do PDF.";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setLoading(true);
    const processed: InvoiceData[] = [];
    let updated = 0;

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast.error(`${file.name} não é um PDF.`);
        continue;
      }

      try {
        toast.info(`Processando ${file.name}...`);
        const pdfText = await extractTextFromPdf(file);

        const { data, error } = await supabase.functions.invoke("parse-invoice", {
          body: { pdfText, fileName: file.name },
        });

        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Erro ao processar");

        const invoice: InvoiceData = {
          ...data.data,
          fileName: file.name,
          mes_referencia: normalizeMesReferencia(data.data?.mes_referencia),
        };
        processed.push(invoice);
        // Persiste (insert/update) no banco unificado
        await persistToDatabase(invoice, "upload");
        toast.success(`${file.name} processado com sucesso!`);
      } catch (err) {
        console.error("Error processing", file.name, err);
        toast.error(`Erro ao processar ${file.name}: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      }
    }

    if (processed.length > 0) {
      setInvoices((prev) => {
        const next = [...prev];
        for (const inv of processed) {
          const key = getInvoiceKey(inv);
          const idx = next.findIndex((x) => getInvoiceKey(x) === key);
          if (idx >= 0) { next[idx] = inv; updated++; }
          else next.push(inv);
        }
        return next;
      });
      if (updated > 0) toast.info(`${updated} fatura(s) atualizada(s) por reimportação.`);
    }
    setLoading(false);
    e.target.value = "";
  };

  const removeInvoice = (index: number) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  };

  const fmt = (v?: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const fmtKwh = (v?: number | null) =>
    v != null ? `${v.toLocaleString("pt-BR")} kWh` : "—";

  const summaryFields: { label: string; key: keyof InvoiceData; format?: "currency" | "kwh" }[] = [
    { label: "Titular", key: "titular" },
    { label: "CPF/CNPJ", key: "cpf_cnpj" },
    { label: "Endereço", key: "endereco" },
    { label: "Instalação", key: "numero_instalacao" },
    { label: "Referência", key: "mes_referencia" },
    { label: "Vencimento", key: "data_vencimento" },
    { label: "Consumo", key: "consumo_kwh", format: "kwh" },
    { label: "Valor Energia", key: "valor_energia", format: "currency" },
    { label: "Distribuição (TUSD)", key: "valor_distribuicao", format: "currency" },
    { label: "ICMS", key: "icms", format: "currency" },
    { label: "PIS", key: "pis", format: "currency" },
    { label: "COFINS", key: "cofins", format: "currency" },
    { label: "Iluminação Pública", key: "contrib_iluminacao", format: "currency" },
    { label: "Bandeira", key: "bandeira_tarifaria" },
    { label: "Valor Bandeira", key: "valor_bandeira", format: "currency" },
    { label: "Total", key: "valor_total", format: "currency" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Title bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Zap className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">Faturas Neoenergia</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-3 flex items-center gap-2 text-xs text-muted-foreground">{user?.email}</div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Aplicativo minimizado")} title="Minimizar">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title={isFullscreen ? "Restaurar" : "Maximizar"}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground" onClick={handleClose} title="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Google Drive import */}
          <GoogleDriveImport
            existingInvoices={invoices}
            onInvoicesImported={(newInvoices) => {
              setInvoices((prev) => {
                const next = [...prev];
                let updated = 0;
                for (const inv of newInvoices) {
                  const key = getInvoiceKey(inv);
                  const idx = next.findIndex((x) => getInvoiceKey(x) === key);
                  if (idx >= 0) { next[idx] = inv; updated++; }
                  else next.push(inv);
                }
                if (updated > 0) toast.info(`${updated} fatura(s) atualizada(s) por reimportação.`);
                return next;
              });
              // Persiste (insert/update) todas as faturas importadas
              newInvoices.forEach((inv) => { void persistToDatabase(inv, "drive"); });
            }}
          />

          {/* Upload area */}
          <Card className="opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-accent" />
                Upload de Faturas
              </CardTitle>
              <CardDescription>
                Arraste ou selecione os PDFs das faturas da Neoenergia. O sistema extrai automaticamente todos os dados usando IA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                  loading ? "border-muted bg-muted/20 pointer-events-none" : "border-border hover:border-primary hover:bg-primary/5"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processando faturas com IA...</p>
                  </>
                ) : (
                  <>
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Clique ou arraste PDFs aqui</p>
                    <p className="text-xs text-muted-foreground">Aceita múltiplos arquivos PDF</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </label>
            </CardContent>
          </Card>

          {/* Results table */}
          {invoices.length > 0 && (
            <Card className="opacity-0 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">Faturas Processadas ({invoices.length})</CardTitle>
                    <CardDescription>Dados extraídos automaticamente via IA</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setArchivedOpen(true)}>
                      <ArchiveRestore className="h-4 w-4" /> Arquivadas ({archived.length})
                    </Button>
                    <Button variant="default" size="sm" onClick={() => navigate("/neoenergia/analytics")}>
                      <BarChart3 className="h-4 w-4" /> Análises & Projeções
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary cards */}
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Total Faturas</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{invoices.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Consumo Total</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {fmtKwh(invoices.reduce((s, i) => s + (i.consumo_kwh || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Valor Total</p>
                    <p className="mt-1 text-2xl font-bold text-destructive">
                      {fmt(invoices.reduce((s, i) => s + (i.valor_total || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">Média/Fatura</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {fmt(invoices.reduce((s, i) => s + (i.valor_total || 0), 0) / invoices.length)}
                    </p>
                  </div>
                </div>

                {/* Bulk action toolbar */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === invoices.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                    <span className="text-muted-foreground">
                      {selected.size} de {invoices.length} selecionada(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={archiveSelected} disabled={selected.size === 0}>
                      <Archive className="h-4 w-4" /> Arquivar
                    </Button>
                    <Button variant="outline" size="sm" onClick={deleteSelected} disabled={selected.size === 0} className="text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir selecionadas
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAll}>
                      <Trash2 className="h-4 w-4" /> Limpar tudo
                    </Button>
                  </div>
                </div>

                {/* Data table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-[640px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Instalação</TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Consumo</TableHead>
                          <TableHead>Bandeira</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv, i) => (
                          <TableRow key={i} data-state={selected.has(i) ? "selected" : undefined}>
                            <TableCell>
                              <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleSelect(i)} />
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">{inv.fileName}</TableCell>
                            <TableCell className="text-sm">{inv.numero_instalacao || "—"}</TableCell>
                            <TableCell className="text-sm">{inv.mes_referencia || "—"}</TableCell>
                            <TableCell className="text-sm">{inv.data_vencimento || "—"}</TableCell>
                            <TableCell className="text-sm">{fmtKwh(inv.consumo_kwh)}</TableCell>
                            <TableCell>
                              {inv.bandeira_tarifaria ? (
                                <Badge variant="outline">{inv.bandeira_tarifaria}</Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-destructive">{fmt(inv.valor_total)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedInvoice(inv)} title="Detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeInvoice(i)} title="Remover">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Invoice detail dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              {selectedInvoice?.fileName}
            </DialogTitle>
            <DialogDescription>Dados extraídos da fatura</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {summaryFields.map(({ label, key, format }) => {
                  const val = selectedInvoice[key];
                  if (val == null) return null;
                  return (
                    <div key={key} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {format === "currency" ? fmt(val as number) : format === "kwh" ? fmtKwh(val as number) : String(val)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Itens da fatura */}
              {selectedInvoice.itens_fatura && selectedInvoice.itens_fatura.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Itens da Fatura</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.itens_fatura.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.descricao}</TableCell>
                          <TableCell className="text-sm">{item.quantidade || "—"}</TableCell>
                          <TableCell className="text-sm">{fmt(item.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Histórico de consumo */}
              {selectedInvoice.historico_consumo && selectedInvoice.historico_consumo.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Histórico de Consumo</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead>Consumo</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.historico_consumo.map((h, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{h.mes}</TableCell>
                          <TableCell className="text-sm">{fmtKwh(h.consumo_kwh)}</TableCell>
                          <TableCell className="text-sm">{fmt(h.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Archived invoices dialog */}
      <Dialog open={archivedOpen} onOpenChange={setArchivedOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-accent" />
              Faturas Arquivadas ({archived.length})
            </DialogTitle>
            <DialogDescription>
              As informações pertinentes já foram salvas na base. Você pode desarquivar para reanalisar ou excluir definitivamente.
            </DialogDescription>
          </DialogHeader>
          {archived.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma fatura arquivada.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={clearAllArchived} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Limpar todas
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Instalação</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archived.map((a) => (
                      <TableRow key={a.fileName}>
                        <TableCell className="text-sm max-w-[220px] truncate">{a.fileName}</TableCell>
                        <TableCell className="text-sm">{a.numero_instalacao || "—"}</TableCell>
                        <TableCell className="text-sm">{a.mes_referencia || "—"}</TableCell>
                        <TableCell className="text-sm font-medium text-destructive">{fmt(a.valor_total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unarchiveOne(a.fileName)} title="Desarquivar">
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteArchived(a.fileName)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
