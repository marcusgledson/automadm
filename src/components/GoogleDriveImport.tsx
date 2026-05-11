import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { FolderOpen, Loader2, FileText, Download, CheckCircle2, AlertCircle, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInvoiceKey, normalizeMesReferencia } from "@/lib/invoiceKey";

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  status: "pending" | "processing" | "done" | "error";
  errorMsg?: string;
}

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

interface GoogleDriveImportProps {
  onInvoicesImported: (invoices: InvoiceData[]) => void;
  existingInvoices?: InvoiceData[];
}

export default function GoogleDriveImport({ onInvoicesImported, existingInvoices = [] }: GoogleDriveImportProps) {
  const [folderLink, setFolderLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [pdfPassword, setPdfPassword] = useState("");

  const listFiles = useCallback(async () => {
    if (!folderLink.trim()) {
      toast.error("Cole o link da pasta do Google Drive.");
      return;
    }

    setLoading(true);
    setFiles([]);
    setSelectedFiles(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("list-drive-files", {
        body: { folderLink: folderLink.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro ao listar arquivos");

      if (data.files.length === 0) {
        toast.info("Nenhum PDF encontrado nesta pasta.");
        setLoading(false);
        return;
      }

      const existingNames = new Set(existingInvoices.map((i) => (i.fileName || "").toLowerCase()));
      const driveFiles: DriveFile[] = data.files.map((f: { id: string; name: string; size: number | null; modifiedTime: string | null }) => {
        const already = existingNames.has((f.name || "").toLowerCase());
        return {
          ...f,
          status: already ? ("done" as const) : ("pending" as const),
          errorMsg: already ? "Já importado" : undefined,
        };
      });

      setFiles(driveFiles);
      // Pré-selecionar apenas os ainda não importados
      setSelectedFiles(new Set(driveFiles.filter((f) => f.status === "pending").map((f) => f.id)));
      const novos = driveFiles.filter((f) => f.status === "pending").length;
      const repetidos = driveFiles.length - novos;
      toast.success(`${driveFiles.length} PDF(s) encontrado(s)${repetidos ? ` — ${repetidos} já importado(s)` : ""}.`);
    } catch (err: unknown) {
      console.error("Error listing files:", err);
      const message = err instanceof Error ? err.message : "Erro ao listar arquivos.";
      if (message.includes("API key") || message.includes("chave da API")) {
        toast.error("Problema com a API Key do Google", {
          description: message,
          duration: 10000,
        });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [folderLink]);

  const toggleFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  const importSelected = useCallback(async () => {
    const toProcess = files.filter((f) => selectedFiles.has(f.id));
    if (toProcess.length === 0) {
      toast.error("Selecione ao menos um arquivo.");
      return;
    }

    setImporting(true);

    // Validação prévia da senha usando o primeiro PDF ainda não processado
    const sample = toProcess.find((f) => f.status !== "done") || toProcess[0];
    try {
      const { data: vData, error: vErr } = await supabase.functions.invoke("validate-pdf-password", {
        body: { fileId: sample.id, password: pdfPassword || undefined },
      });
      if (vErr) throw new Error(vErr.message);
      if (!vData?.success) {
        toast.error(vData?.error || "Senha inválida.", {
          description: "Corrija a senha e tente novamente.",
        });
        setImporting(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao validar a senha do PDF.";
      toast.error(msg);
      setImporting(false);
      return;
    }

    const importedInvoices: InvoiceData[] = [];
    // Chaves já existentes (instalação + mês/ano) para evitar duplicidade
    const existingKeys = new Set(existingInvoices.map((i) => getInvoiceKey(i)));
    let duplicates = 0;

    for (const file of toProcess) {
      // Skip se já marcado como done (já importado anteriormente)
      if (file.status === "done") {
        duplicates++;
        continue;
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "processing" as const } : f))
      );

      try {
        const { data, error } = await supabase.functions.invoke("download-drive-file", {
          body: { fileId: file.id, fileName: file.name, password: pdfPassword || undefined },
        });

        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || "Erro ao processar");

        const invoice: InvoiceData = {
          ...data.data,
          fileName: file.name,
          mes_referencia: normalizeMesReferencia(data.data?.mes_referencia as string | undefined),
        };
        const key = getInvoiceKey(invoice);

        if (existingKeys.has(key)) {
          duplicates++;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, status: "done" as const, errorMsg: "Duplicado (instalação/mês)" }
                : f
            )
          );
          continue;
        }
        existingKeys.add(key);
        importedInvoices.push(invoice);
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: "done" as const } : f))
        );
      } catch (err) {
        console.error("Error processing", file.name, err);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error" as const, errorMsg: err instanceof Error ? err.message : "Erro" }
              : f
          )
        );
      }
      // Pequeno intervalo para evitar rate-limit (429) da IA
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (importedInvoices.length > 0) {
      onInvoicesImported(importedInvoices);
      toast.success(
        `${importedInvoices.length} fatura(s) importada(s)${duplicates ? ` — ${duplicates} ignorada(s) por duplicidade` : ""}.`
      );
    } else if (duplicates > 0) {
      toast.info(`Nenhuma nova fatura — ${duplicates} já estavam importadas.`);
    }

    setImporting(false);
  }, [files, selectedFiles, onInvoicesImported, existingInvoices]);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="opacity-0 animate-fade-up" style={{ animationDelay: "50ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FolderOpen className="h-5 w-5 text-accent" />
          Importar do Google Drive
        </CardTitle>
        <CardDescription>
          Cole o link de uma pasta compartilhada do Google Drive contendo os PDFs das faturas.
          A pasta deve estar compartilhada como "Qualquer pessoa com o link".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://drive.google.com/drive/folders/..."
            value={folderLink}
            onChange={(e) => setFolderLink(e.target.value)}
            disabled={loading || importing}
            className="flex-1"
          />
          <Button onClick={listFiles} disabled={loading || importing || !folderLink.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Listar PDFs
          </Button>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
              <label className="text-sm font-medium">Senha de visualização do PDF (se houver)</label>
              <p className="text-xs text-muted-foreground">
                Algumas faturas da Neoenergia abrem com senha (CPF/CNPJ do titular). Informe abaixo antes de importar — a mesma senha será usada para todos os arquivos selecionados.
              </p>
              <Input
                type="password"
                placeholder="Ex: somente números do CPF/CNPJ"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                disabled={importing}
                autoComplete="off"
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.size} de {files.length} selecionado(s)
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={importing}>
                  {selectedFiles.size === files.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiles((prev) =>
                      prev.map((f) =>
                        selectedFiles.has(f.id)
                          ? { ...f, status: "done" as const, errorMsg: "Arquivado" }
                          : f
                      )
                    );
                    setSelectedFiles(new Set());
                    toast.success("Arquivos arquivados.");
                  }}
                  disabled={importing || selectedFiles.size === 0}
                  title="Marcar como arquivado (não remove da lista)"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));
                    setSelectedFiles(new Set());
                    toast.success("Selecionados removidos da lista.");
                  }}
                  disabled={importing || selectedFiles.size === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir selecionados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiles([]);
                    setSelectedFiles(new Set());
                    toast.success("Lista limpa.");
                  }}
                  disabled={importing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar tudo
                </Button>
                <Button size="sm" onClick={importSelected} disabled={importing || selectedFiles.size === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Importar selecionados
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow
                      key={file.id}
                      className={`cursor-pointer ${selectedFiles.has(file.id) ? "bg-primary/5" : ""}`}
                      onClick={() => !importing && toggleFile(file.id)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFile(file.id)}
                          disabled={importing}
                          className="rounded border-border"
                        />
                      </TableCell>
                      <TableCell className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[300px]">{file.name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatSize(file.size)}</TableCell>
                      <TableCell>
                        {file.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                        {file.status === "processing" && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Processando
                          </Badge>
                        )}
                        {file.status === "done" && (
                          <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        )}
                        {file.status === "error" && (
                          <Badge variant="destructive" className="gap-1" title={file.errorMsg}>
                            <AlertCircle className="h-3 w-3" /> Erro
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
