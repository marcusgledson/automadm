import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FolderOpen, Loader2, Download, Trash2, Save, Link as LinkIcon, FileSpreadsheet, AlertCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDriveLinks } from "@/hooks/useDriveLinks";

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
}

interface GoogleDriveOFXImportProps {
  onOFXLoaded: (payload: { text: string; fileName: string }) => void | Promise<void>;
}

export default function GoogleDriveOFXImport({ onOFXLoaded }: GoogleDriveOFXImportProps) {
  const [folderLink, setFolderLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [downloadError, setDownloadError] = useState<{ file: DriveFile; message: string; hint?: string } | null>(null);
  const { links: savedLinks, addLink, removeLink } = useDriveLinks();

  const saveCurrentLink = useCallback(async () => {
    const res = await addLink(folderLink, linkLabel);
    if (!res.ok) toast.error(res.error || "Falha ao salvar o link.");
    else { toast.success("Link salvo na lista."); setLinkLabel(""); }
  }, [folderLink, linkLabel, addLink]);

  const deleteSavedLink = useCallback(async (id: string) => {
    if (!confirm("Excluir este link salvo?")) return;
    const res = await removeLink(id);
    if (!res.ok) toast.error(res.error || "Falha ao excluir.");
    else toast.success("Link excluído.");
  }, [removeLink]);

  const listFiles = useCallback(async () => {
    if (!folderLink.trim()) {
      toast.error("Cole o link da pasta do Google Drive.");
      return;
    }
    setLoading(true);
    setFiles([]);
    setDownloadError(null);
    try {
      const { data, error } = await supabase.functions.invoke("list-drive-files", {
        body: { folderLink: folderLink.trim(), fileType: "ofx" },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro ao listar arquivos");
      if (data.files.length === 0) {
        toast.info("Nenhum arquivo .OFX encontrado nesta pasta.");
      } else {
        setFiles(data.files);
        toast.success(`${data.files.length} arquivo(s) OFX encontrado(s).`);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao listar arquivos.";
      const friendly = /401|unauth/i.test(raw)
        ? "Sessão expirada. Faça login novamente."
        : /403|perm|share|compart/i.test(raw)
          ? "Sem permissão para acessar a pasta. Compartilhe como 'Qualquer pessoa com o link'."
          : /404|not.?found/i.test(raw)
            ? "Pasta não encontrada. Confira o link."
            : raw;
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  }, [folderLink]);

  const importOne = useCallback(async (file: DriveFile) => {
    setImportingId(file.id);
    setDownloadError(null);
    try {
      const { data, error } = await supabase.functions.invoke("download-drive-ofx", {
        body: { fileId: file.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha ao baixar OFX");
      await onOFXLoaded({ text: data.text as string, fileName: file.name });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao importar OFX.";
      let message = raw;
      let hint: string | undefined;
      if (/401|unauth/i.test(raw)) {
        message = "Sessão expirada.";
        hint = "Faça login novamente e tente outra vez.";
      } else if (/403|perm|share|compart/i.test(raw)) {
        message = "Sem permissão para baixar este arquivo.";
        hint = "Compartilhe a pasta como 'Qualquer pessoa com o link' no Google Drive.";
      } else if (/404|not.?found/i.test(raw)) {
        message = "Arquivo não encontrado no Drive.";
        hint = "Talvez tenha sido movido ou excluído. Liste a pasta novamente.";
      } else if (/vaz|empty/i.test(raw)) {
        message = "Arquivo OFX vazio.";
      } else if (/network|fetch|timeout|tempo/i.test(raw)) {
        message = "Falha de rede ao baixar o OFX.";
        hint = "Verifique sua conexão e tente novamente.";
      }
      setDownloadError({ file, message, hint });
      toast.error(`${file.name}: ${message}`);
    } finally {
      setImportingId(null);
    }
  }, [onOFXLoaded]);

  const retryDownload = useCallback(() => {
    if (downloadError) importOne(downloadError.file);
  }, [downloadError, importOne]);


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
          Importar OFX do Google Drive
        </CardTitle>
        <CardDescription>
          Cole o link de uma pasta compartilhada como "Qualquer pessoa com o link" contendo arquivos .OFX.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="https://drive.google.com/drive/folders/..."
            value={folderLink}
            onChange={(e) => setFolderLink(e.target.value)}
            disabled={loading || !!importingId}
            className="flex-1"
          />
          <Input
            placeholder="Apelido (opcional)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            disabled={loading || !!importingId}
            className="sm:max-w-[180px]"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={saveCurrentLink}
              disabled={loading || !!importingId || !folderLink.trim()}
              title="Salvar este link na lista"
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Salvar link</span>
            </Button>
            <Button onClick={listFiles} disabled={loading || !!importingId || !folderLink.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Listar OFX
            </Button>
          </div>
        </div>

        {savedLinks.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-2">
            <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
              Links salvos ({savedLinks.length})
            </p>
            <ul className="space-y-1">
              {savedLinks.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-foreground hover:underline"
                    onClick={() => setFolderLink(l.url)}
                    title={l.url}
                    disabled={loading || !!importingId}
                  >
                    {l.label ? (
                      <span><span className="font-medium">{l.label}</span> <span className="text-xs text-muted-foreground">— {l.url}</span></span>
                    ) : (
                      <span className="text-xs">{l.url}</span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteSavedLink(l.id)}
                    disabled={loading || !!importingId}
                    title="Excluir link salvo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="w-24">Tamanho</TableHead>
                  <TableHead className="w-32 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        {file.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatSize(file.size)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => importOne(file)}
                        disabled={!!importingId}
                      >
                        {importingId === file.id
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <Download className="h-4 w-4 mr-2" />}
                        Carregar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
