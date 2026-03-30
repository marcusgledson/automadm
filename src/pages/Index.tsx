import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Minimize2, Maximize2, X, FileSpreadsheet, FolderOpen, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseFile, FinancialRecord } from "@/lib/fileParser";
import FileUploader from "@/components/FileUploader";
import DataTable from "@/components/DataTable";
import { toast } from "sonner";

export default function Index() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Formato inválido. Apenas arquivos OFX são aceitos.");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        toast.error("Nenhum registro encontrado no arquivo OFX");
      } else {
        setRecords(parsed);
        setFileName(file.name);
        toast.success(`${parsed.length} registros carregados de ${file.name}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar o arquivo OFX.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.setAttribute("accept", ".ofx");
  }, []);

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Title bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Extrato Financeiro</span>
          {fileName && (
            <span className="ml-2 text-xs text-muted-foreground">— {fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {records.length > 0 && (
            <Button variant="ghost" size="sm" onClick={openFilePicker} className="mr-2 gap-2 text-xs">
              <FolderOpen className="h-4 w-4" />
              Abrir OFX
            </Button>
          )}
          <div className="mr-3 flex items-center gap-2 text-xs text-muted-foreground">
            {user?.email}
          </div>
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
      <main className="flex-1 overflow-hidden p-4">
        {records.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-lg opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <FileUploader onFileSelected={handleFile} loading={loading} />
            </div>
          </div>
        ) : (
          <div className="h-full opacity-0 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-xl font-bold text-foreground">Análise do Extrato</h1>
              <Button variant="outline" size="sm" onClick={() => { setRecords([]); setFileName(null); }} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Novo Arquivo
              </Button>
            </div>
            <DataTable records={records} />
          </div>
        )}
      </main>
    </div>
  );
}
