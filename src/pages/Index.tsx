import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FolderOpen, Minimize2, Maximize2, X, ArrowLeft, Database, Loader2, Landmark } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { useNavigate } from "react-router-dom";
import { parseOFXFull, FinancialRecord, OFXAccountInfo, ParsedOFXStatement } from "@/lib/fileParser";
import FileUploader from "@/components/FileUploader";
import DataTable from "@/components/DataTable";
import AccountKeyDialog from "@/components/AccountKeyDialog";
import OFXPreviewDialog from "@/components/OFXPreviewDialog";
import GoogleDriveOFXImport from "@/components/GoogleDriveOFXImport";
import { toast } from "sonner";
import { useBankStatements } from "@/hooks/useBankStatements";
import { useExpenses } from "@/hooks/useExpenses";

export default function Index() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [account, setAccount] = useState<OFXAccountInfo>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDB, setSavingDB] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<{ statements: ParsedOFXStatement[]; fileName: string } | null>(null);
  const [pendingParsed, setPendingParsed] = useState<{ records: FinancialRecord[]; account: OFXAccountInfo; fileName: string } | null>(null);

  const { upsertMany } = useBankStatements();
  const { upsertManyFromOFX } = useExpenses();

  const processOFXText = useCallback((text: string, originFileName: string) => {
    const parsed = parseOFXFull(text);
    if (parsed.records.length === 0) {
      toast.error("Nenhum registro encontrado no arquivo OFX");
      return;
    }
    // Sempre passa pelo pré-visualizador (mostra agência/conta detectadas; permite escolher conta se houver várias).
    setPendingPreview({ statements: parsed.statements, fileName: originFileName });
  }, []);

  const confirmPreview = useCallback((idx: number) => {
    if (!pendingPreview) return;
    const stmt = pendingPreview.statements[idx];
    const fn = pendingPreview.fileName;
    setPendingPreview(null);
    if (!stmt.account.agencia || !stmt.account.conta) {
      setPendingParsed({ records: stmt.records, account: stmt.account, fileName: fn });
      toast.info("Informe a agência e conta manualmente para continuar.");
      return;
    }
    setRecords(stmt.records);
    setAccount(stmt.account);
    setFileName(fn);
    toast.success(`${stmt.records.length} registros carregados de ${fn}`);
  }, [pendingPreview]);


  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Formato inválido. Apenas arquivos OFX são aceitos.");
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      processOFXText(text, file.name);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar o arquivo OFX.");
    } finally {
      setLoading(false);
    }
  }, [processOFXText]);

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
    if (confirm("Deseja realmente sair do aplicativo?")) signOut();
  }, [signOut]);

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

  const saveToDatabase = async () => {
    if (records.length === 0) return;
    if (!account.agencia || !account.conta) {
      toast.error("OFX sem Agência/Conta no cabeçalho. Não é possível gravar.");
      return;
    }
    setSavingDB(true);
    const ctx = { agencia: account.agencia, conta: account.conta, banco: account.banco, fileName: fileName ?? undefined };
    const a = await upsertMany(records, ctx);
    const accountRef = `${account.agencia}/${account.conta}`;
    const b = await upsertManyFromOFX(records, accountRef);
    setSavingDB(false);
    if (!a.ok) toast.error(`Extrato: ${a.error}`);
    else toast.success(`Extrato salvo (${a.count} linhas).`);
    if (!b.ok) toast.error(`Despesas: ${b.error}`);
    else if (b.count > 0) toast.success(`${b.count} débito(s) replicado(s) em Despesas.`);
  };

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">Extrato Financeiro</span>
          {fileName && <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">— {fileName}</span>}
        </div>
        <div className="flex items-center gap-1">
          {records.length > 0 && (
            <Button variant="ghost" size="sm" onClick={openFilePicker} className="mr-1 hidden gap-2 text-xs sm:flex">
              <FolderOpen className="h-4 w-4" /> Abrir OFX
            </Button>
          )}
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-3 sm:p-5">
        {records.length === 0 ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-stretch justify-center gap-4 py-4">
            <div className="opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <FileUploader onFileSelected={handleFile} loading={loading} />
            </div>
            <GoogleDriveOFXImport
              onOFXLoaded={({ text, fileName: fn }) => processOFXText(text, fn)}
            />
          </div>
        ) : (
          <div className="h-full opacity-0 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-foreground sm:text-xl">Análise do Extrato</h1>
                {(account.agencia || account.conta) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1">
                      <Landmark className="h-3 w-3 text-primary" />
                      {account.banco ? `${account.banco} · ` : ""}
                      Ag {account.agencia || "—"} / Conta {account.conta || "—"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={saveToDatabase} disabled={savingDB} className="gap-2">
                  {savingDB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Salvar na Base
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setRecords([]); setFileName(null); setAccount({}); }} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Novo Arquivo
                </Button>
              </div>
            </div>
            <DataTable records={records} />
          </div>
        )}
      </main>

      <OFXPreviewDialog
        open={!!pendingPreview}
        fileName={pendingPreview?.fileName}
        statements={pendingPreview?.statements ?? []}
        onCancel={() => setPendingPreview(null)}
        onConfirm={confirmPreview}
      />

      <AccountKeyDialog
        open={!!pendingParsed}
        defaultBanco={pendingParsed?.account.banco}
        defaultAgencia={pendingParsed?.account.agencia}
        defaultConta={pendingParsed?.account.conta}
        onCancel={() => setPendingParsed(null)}
        onConfirm={({ banco, agencia, conta }) => {
          if (!pendingParsed) return;
          setRecords(pendingParsed.records);
          setAccount({ banco, agencia, conta });
          setFileName(pendingParsed.fileName);
          toast.success(`${pendingParsed.records.length} registros carregados de ${pendingParsed.fileName}`);
          setPendingParsed(null);
        }}
      />
    </div>
  );
}
