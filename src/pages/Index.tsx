import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FolderOpen, ArrowLeft, Home, Database, Loader2, Landmark, PencilLine, UserRound } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { useNavigate } from "react-router-dom";
import { parseOFXFull, FinancialRecord, OFXAccountInfo, ParsedOFXStatement } from "@/lib/fileParser";
import { parsePdfStatement, PdfPasswordRequiredError, renderHeaderImage, reparseWithColumns, headerSignature, type PdfDiagnostics, type DetectedColumn, type PdfLine, type ParsedPdfStatement } from "@/lib/pdfStatementParser";
import { detectBankFromText, needsLogoFallback, type BankDetection } from "@/lib/bankDetect";

import { extractHolder, maskDocument, type HolderInfo } from "@/lib/accountHolder";
import { supabase } from "@/integrations/supabase/client";

import FileUploader from "@/components/FileUploader";
import DataTable from "@/components/DataTable";
import AccountKeyDialog, { type AccountKeyResult } from "@/components/AccountKeyDialog";
import OFXPreviewDialog from "@/components/OFXPreviewDialog";
import EditableRecordsDialog from "@/components/EditableRecordsDialog";
import PdfPreviewDialog from "@/components/PdfPreviewDialog";
import PdfBatchImportDialog, { type BatchItem } from "@/components/PdfBatchImportDialog";
import { usePdfColumnProfiles } from "@/hooks/usePdfColumnProfiles";
import { dedupeRecords } from "@/lib/dedupeRecords";

import ImportSummaryDialog from "@/components/ImportSummaryDialog";
import GoogleDriveOFXImport from "@/components/GoogleDriveOFXImport";
import SavedStatementsTable from "@/components/SavedStatementsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useBankStatements } from "@/hooks/useBankStatements";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useExpenses } from "@/hooks/useExpenses";

interface PendingParsed {
  records: FinancialRecord[];
  account: OFXAccountInfo;
  fileName: string;
  holder?: HolderInfo;
  bank?: BankDetection;
}

interface PdfPreviewState {
  fileName: string;
  account: OFXAccountInfo;
  holder?: HolderInfo;
  bank?: BankDetection;
  strategy: "colunas" | "linhas" | "blocos";
  columns?: DetectedColumn[];
  headerIndex?: number;
  lines: PdfLine[];
  records: FinancialRecord[];
  /** Assinatura do layout, para memorizar o mapeamento. */
  signature: string;
  /** Um mapeamento salvo foi aplicado automaticamente. */
  profileApplied?: boolean;
}

type ReadPdfResult =
  | { ok: true; parsed: ParsedPdfStatement; bank?: BankDetection; account: OFXAccountInfo; password?: string; diagnostics?: undefined; error?: undefined }
  | { ok: false; error: string; diagnostics?: PdfDiagnostics };




export default function Index() {
  const { user: _user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [account, setAccount] = useState<OFXAccountInfo>({});
  const [accountMeta, setAccountMeta] = useState<{ apelido?: string; titular?: string; documento?: string; accountId?: string }>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDB, setSavingDB] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<{ statements: ParsedOFXStatement[]; fileName: string; holder?: HolderInfo; bank?: BankDetection } | null>(null);
  const [pendingParsed, setPendingParsed] = useState<PendingParsed | null>(null);
  const [pdfFile, setPdfFile] = useState<{ file: File; password?: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState<{ mode: "pre" | "post"; saved?: number; expenses?: number } | null>(null);
  const [duplicate, setDuplicate] = useState<{ existing: number; total: number } | null>(null);
  const [pdfDiag, setPdfDiag] = useState<(PdfDiagnostics & { fileName: string }) | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [identifyingLogo, setIdentifyingLogo] = useState(false);
  const [saveMapping, setSaveMapping] = useState(true);

  const [batch, setBatch] = useState<BatchItem[] | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchFinished, setBatchFinished] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const cancelBatch = useRef(false);

  const { upsertMany, checkExisting } = useBankStatements();
  const { accounts, saveAccount } = useBankAccounts();
  const { upsertManyFromOFX } = useExpenses();
  const { findBySignature, saveProfile, removeProfile } = usePdfColumnProfiles();


  const processOFXText = useCallback((text: string, originFileName: string) => {
    const parsed = parseOFXFull(text);
    if (parsed.records.length === 0) {
      toast.error("Nenhum registro encontrado no arquivo OFX");
      return;
    }
    setPdfFile(null);
    setPendingPreview({
      statements: parsed.statements,
      fileName: originFileName,
      holder: extractHolder(text.split(/\r?\n/)),
      bank: detectBankFromText(text),
    });
  }, []);

  const confirmPreview = useCallback((idx: number) => {
    if (!pendingPreview) return;
    const stmt = pendingPreview.statements[idx];
    const fn = pendingPreview.fileName;
    const { holder, bank } = pendingPreview;
    setPendingPreview(null);
    setPendingParsed({ records: stmt.records, account: stmt.account, fileName: fn, holder, bank });
  }, [pendingPreview]);

  /** Identificação do banco pela logo (IA) a partir de um arquivo PDF. */
  const identifyLogoFor = useCallback(async (file: File, password?: string) => {
    const imageBase64 = await renderHeaderImage(file, password);
    const { data, error } = await supabase.functions.invoke("identify-bank-logo", { body: { imageBase64 } });
    if (error) throw error;
    if (data?.error || !data?.banco) return null;
    return { name: data.banco as string, code: (data.codigo as string) || undefined };
  }, []);

  /** Aplica automaticamente um mapeamento de colunas salvo para o mesmo layout. */
  const applySavedProfile = useCallback(
    (parsed: ParsedPdfStatement, bank?: BankDetection) => {
      const signature = headerSignature({
        bankCode: bank?.code,
        bankName: bank?.name,
        strategy: parsed.strategy,
        columns: parsed.columns,
      });
      const prof = findBySignature(signature);
      if (prof && parsed.columns?.length && prof.columns?.length === parsed.columns.length) {
        const merged = parsed.columns.map((c, i) => ({ ...c, field: prof.columns[i].field }));
        const re = reparseWithColumns(parsed.lines, merged, parsed.headerIndex ?? 0);
        if (re.length > 0) {
          return { signature, columns: merged, records: re, profileApplied: true };
        }
      }
      return { signature, columns: parsed.columns, records: parsed.records, profileApplied: false };
    },
    [findBySignature],
  );

  /**
   * Lê um PDF (pedindo senha quando necessário) e resolve o banco,
   * acionando a identificação por logo quando a confiança é baixa.
   */
  const readPdf = useCallback(
    async (
      file: File,
      opts: { askPassword?: boolean; logoFallback?: boolean } = {},
    ): Promise<ReadPdfResult> => {

      const { askPassword = true, logoFallback = true } = opts;
      let password: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const parsed = await parsePdfStatement(file, password);
          if (parsed.records.length === 0) {
            return { ok: false, error: parsed.diagnostics.motivo ?? "Nenhum lançamento reconhecido.", diagnostics: parsed.diagnostics };
          }
          let bank = parsed.bank;
          const account: OFXAccountInfo = { ...parsed.account };
          if (logoFallback && needsLogoFallback(bank)) {
            try {
              const byLogo = await identifyLogoFor(file, password);
              if (byLogo) {
                bank = { name: byLogo.name, code: byLogo.code, source: "logo", confidence: "alta" };
                account.banco = byLogo.name;
              }
            } catch (e) {
              console.warn("Identificação por logo indisponível", e);
            }
          } else if (bank) {
            account.banco = bank.name;
          }
          return { ok: true, parsed, bank, account, password };
        } catch (err) {
          if (err instanceof PdfPasswordRequiredError) {
            if (!askPassword) return { ok: false, error: "PDF protegido por senha — importe este arquivo individualmente." };
            const input = window.prompt(
              err.wrongPassword
                ? `Senha incorreta. Informe a senha do PDF (${file.name}):`
                : `Este PDF está protegido. Informe a senha (${file.name}):`,
            );
            if (!input) return { ok: false, error: "Importação cancelada (senha não informada)." };
            password = input;
            continue;
          }
          console.error(err);
          return { ok: false, error: "Erro ao ler o PDF do extrato." };
        }
      }
      return { ok: false, error: "Não foi possível abrir o PDF (senha inválida)." };
    },
    [identifyLogoFor],
  );

  const handlePdf = useCallback(async (file: File) => {
    const res = await readPdf(file);
    if (!res.ok) {
      if (res.diagnostics) setPdfDiag({ fileName: file.name, ...res.diagnostics });
      else toast.error(res.error);
      return;
    }
    setPdfFile({ file, password: res.password });
    const applied = applySavedProfile(res.parsed, res.bank);
    setSaveMapping(true);
    setPdfPreview({
      fileName: file.name,
      account: res.account,
      holder: res.parsed.holder,
      bank: res.bank,
      strategy: res.parsed.strategy,
      columns: applied.columns,
      headerIndex: res.parsed.headerIndex,
      lines: res.parsed.lines,
      records: applied.records,
      signature: applied.signature,
      profileApplied: applied.profileApplied,
    });
  }, [readPdf, applySavedProfile]);

  /** Lê uma fila de PDFs em sequência, deduplicando lançamentos entre arquivos. */
  const runBatch = useCallback(async (files: File[]) => {
    cancelBatch.current = false;
    setBatchFinished(false);
    setBatchSaving(false);
    setBatchProgress({ current: 0, total: files.length });
    setBatch(files.map((f) => ({ fileName: f.name, status: "pendente", selected: true, records: [], account: {} })));
    setBatchRunning(true);

    const seen = new Set<string>();
    for (let i = 0; i < files.length; i++) {
      if (cancelBatch.current) break;
      setBatchProgress({ current: i + 1, total: files.length });
      setBatch((prev) => prev?.map((it, k) => (k === i ? { ...it, status: "lendo" } : it)) ?? prev);
      // eslint-disable-next-line no-await-in-loop
      const res = await readPdf(files[i], { askPassword: false });
      if (!res.ok) {
        setBatch((prev) => prev?.map((it, k) => (k === i ? { ...it, status: "erro", selected: false, error: res.error } : it)) ?? prev);
        continue;
      }
      const applied = applySavedProfile(res.parsed, res.bank);
      const { records: unique, removed } = dedupeRecords(applied.records, seen);
      setBatch((prev) =>
        prev?.map((it, k) =>
          k === i
            ? {
                ...it,
                status: "pronto",
                selected: unique.length > 0 && !!res.account.agencia && !!res.account.conta,
                records: unique,
                account: res.account,
                titular: res.parsed.holder?.titular,
                documento: res.parsed.holder?.documento,
                bank: res.bank,
                duplicadosLote: removed,
              }
            : it,
        ) ?? prev,
      );
    }
    setBatchRunning(false);
  }, [readPdf, applySavedProfile]);

  /** Grava em lote os arquivos selecionados, sem duplicar lançamentos. */
  const confirmBatch = useCallback(async () => {
    if (!batch) return;
    setBatchSaving(true);
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (!item.selected || item.status !== "pronto") continue;
      const { agencia, conta, banco } = item.account;
      if (!agencia || !conta) continue;
      // eslint-disable-next-line no-await-in-loop
      const dup = await checkExisting(item.records, { agencia, conta });
      const ctx = {
        agencia, conta, banco,
        fileName: item.fileName,
        accountId: null,
        titular: item.titular ?? null,
        documento: item.documento ?? null,
      };
      // eslint-disable-next-line no-await-in-loop
      const a = await upsertMany(item.records, ctx);
      // eslint-disable-next-line no-await-in-loop
      await upsertManyFromOFX(item.records, `${agencia}/${conta}`);
      setBatch((prev) =>
        prev?.map((it, k) =>
          k === i
            ? a.ok
              ? { ...it, status: "importado" as const, importados: a.count, duplicadosBase: dup.existing }
              : { ...it, status: "erro" as const, error: a.error }
            : it,
        ) ?? prev,
      );
    }
    setBatchSaving(false);
    setBatchFinished(true);
    toast.success("Importação em lote concluída.");
  }, [batch, checkExisting, upsertMany, upsertManyFromOFX]);

  const handleFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    if (!name.endsWith(".ofx") && !isPdf) {
      toast.error("Formato inválido. Aceitos: OFX ou PDF.");
      return;
    }
    setLoading(true);
    try {
      if (isPdf) {
        await handlePdf(file);
      } else {
        const text = await file.text();
        processOFXText(text, file.name);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
  }, [processOFXText, handlePdf]);

  /** Entrada do uploader: 1 arquivo segue o fluxo normal, vários vão para o lote. */
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) { await handleFile(files[0]); return; }
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf");
    const ofx = files.filter((f) => !pdfs.includes(f));
    if (ofx.length) toast.warning("Importação em lote disponível apenas para PDFs. Envie os OFX individualmente.");
    if (pdfs.length === 0) return;
    if (pdfs.length === 1) { await handleFile(pdfs[0]); return; }
    setLoading(true);
    try {
      await runBatch(pdfs);
    } finally {
      setLoading(false);
    }
  }, [handleFile, runBatch]);


  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx,.pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  /** Identificação do banco pela logo (IA), sob demanda. */
  const identifyLogo = useCallback(async () => {
    if (!pdfFile) {
      toast.error("Identificação por logo disponível apenas para PDF.");
      return null;
    }
    try {
      const found = await identifyLogoFor(pdfFile.file, pdfFile.password);
      if (!found) { toast.info("Não foi possível identificar o banco pela logo."); return null; }
      toast.success(`Banco identificado: ${found.name}`);
      return found;
    } catch (e) {
      console.error(e);
      toast.error("Falha ao identificar o banco pela logo.");
      return null;
    }
  }, [pdfFile, identifyLogoFor]);

  /** Reprocessa o PDF com o mapeamento de colunas corrigido pelo usuário. */
  const applyColumnFix = useCallback((columns: DetectedColumn[]) => {
    setPdfPreview((prev) => {
      if (!prev) return prev;
      const records = reparseWithColumns(prev.lines, columns, prev.headerIndex ?? 0);
      if (records.length === 0) toast.warning("Nenhum lançamento com este mapeamento de colunas.");
      return { ...prev, columns, records };
    });
  }, []);

  /** Reidentifica o banco pela logo dentro do preview. */
  const identifyLogoInPreview = useCallback(async () => {
    if (!pdfFile) return;
    setIdentifyingLogo(true);
    const found = await identifyLogo();
    setIdentifyingLogo(false);
    if (!found) return;
    setPdfPreview((prev) =>
      prev
        ? {
            ...prev,
            bank: { name: found.name, code: found.code, source: "logo", confidence: "alta" },
            account: { ...prev.account, banco: found.name },
          }
        : prev,
    );
  }, [pdfFile, identifyLogo]);

  /** Confirma o preview do PDF, memoriza o mapeamento e segue para a chave da conta. */
  const confirmPdfPreview = useCallback(() => {
    setPdfPreview((prev) => {
      if (prev) {
        if (saveMapping && prev.columns?.length) {
          void saveProfile({
            signature: prev.signature,
            bankCode: prev.bank?.code,
            bankName: prev.bank?.name,
            strategy: prev.strategy,
            columns: prev.columns,
          });
        }
        setPendingParsed({
          records: prev.records,
          account: prev.account,
          fileName: prev.fileName,
          holder: prev.holder,
          bank: prev.bank,
        });
      }

      return null;
    });
  }, [saveMapping, saveProfile]);



  const applyAccountKey = useCallback(async (res: AccountKeyResult) => {
    if (!pendingParsed) return;
    let accountId = res.accountId;
    if (res.salvarConta) {
      const saved = await saveAccount({
        apelido: res.apelido,
        agencia: res.agencia,
        conta: res.conta,
        banco: res.banco ?? null,
        bancoCodigo: res.bancoCodigo ?? null,
        titular: res.titular ?? null,
        documento: res.documento ?? null,
        documentoTipo: res.documentoTipo ?? null,
      });
      if (saved.ok) accountId = saved.id ?? accountId;
      else toast.error(`Não foi possível salvar a conta: ${saved.error}`);
    }
    setRecords(pendingParsed.records);
    setAccount({ banco: res.banco, agencia: res.agencia, conta: res.conta });
    setAccountMeta({ apelido: res.apelido, titular: res.titular, documento: res.documento, accountId });
    setFileName(pendingParsed.fileName);
    toast.success(`${pendingParsed.records.length} registros carregados de ${pendingParsed.fileName}`);
    setPendingParsed(null);
  }, [pendingParsed, saveAccount]);

  const doPersist = useCallback(async () => {
    if (records.length === 0) return;
    if (!account.agencia || !account.conta) {
      toast.error("Extrato sem Agência/Conta. Não é possível gravar.");
      return;
    }
    setSavingDB(true);
    const ctx = {
      agencia: account.agencia,
      conta: account.conta,
      banco: account.banco,
      fileName: fileName ?? undefined,
      accountId: accountMeta.accountId ?? null,
      titular: accountMeta.titular ?? null,
      documento: accountMeta.documento ?? null,
    };
    const a = await upsertMany(records, ctx);
    const accountRef = `${account.agencia}/${account.conta}`;
    const b = await upsertManyFromOFX(records, accountRef);
    setSavingDB(false);
    if (!a.ok) { toast.error(`Extrato: ${a.error}`); return; }
    if (!b.ok) toast.error(`Despesas: ${b.error}`);
    setSummary({ mode: "post", saved: a.count, expenses: b.ok ? b.count : 0 });
    toast.success(`Extrato salvo (${a.count} linhas).`);
  }, [records, account, accountMeta, fileName, upsertMany, upsertManyFromOFX]);

  /** Verifica duplicidade antes de gravar. */
  const confirmAndPersist = useCallback(async () => {
    setSummary(null);
    if (!account.agencia || !account.conta) { void doPersist(); return; }
    const dup = await checkExisting(records, { agencia: account.agencia, conta: account.conta });
    if (dup.existing > 0) { setDuplicate(dup); return; }
    void doPersist();
  }, [account, records, checkExisting, doPersist]);

  const saveToDatabase = () => {
    if (records.length === 0) return;
    setSummary({ mode: "pre" });
  };

  const [tab, setTab] = useState("analisar");

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">Extrato Financeiro</span>
          {fileName && <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">— {fileName}</span>}
        </div>
        <div className="flex items-center gap-1">
          {records.length > 0 && (
            <Button variant="ghost" size="sm" onClick={openFilePicker} className="mr-1 hidden gap-2 text-xs sm:flex">
              <FolderOpen className="h-4 w-4" /> Abrir OFX/PDF
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tela inicial</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-3 sm:p-5">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="analisar" className="gap-2 text-xs sm:text-sm">
              <FileSpreadsheet className="h-4 w-4" /> Analisar arquivo
            </TabsTrigger>
            <TabsTrigger value="consultar" className="gap-2 text-xs sm:text-sm">
              <Database className="h-4 w-4" /> Consultar base
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analisar" className="mt-0">
        {records.length === 0 ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-stretch justify-center gap-4 py-4">
            <div className="opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <FileUploader onFilesSelected={(files) => { void handleFiles(files); }} loading={loading} />
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
                    {(accountMeta.apelido || accountMeta.titular) && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1">
                        <UserRound className="h-3 w-3 text-primary" />
                        {accountMeta.apelido || accountMeta.titular}
                        {accountMeta.documento ? ` · ${maskDocument(accountMeta.documento)}` : ""}
                      </span>
                    )}
                    <span className="rounded-md border border-border/60 bg-card/70 px-2 py-1">
                      {records.length} lançamento{records.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-2">
                  <PencilLine className="h-4 w-4" /> Revisar / Editar
                </Button>
                <Button size="sm" onClick={saveToDatabase} disabled={savingDB} className="gap-2">
                  {savingDB ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Salvar na Base
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setRecords([]); setFileName(null); setAccount({}); setAccountMeta({}); }} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Novo Arquivo
                </Button>
              </div>
            </div>
            <DataTable records={records} />
          </div>
        )}
          </TabsContent>

          <TabsContent value="consultar" className="mt-0">
            <SavedStatementsTable />
          </TabsContent>
        </Tabs>
      </main>

      <OFXPreviewDialog
        open={!!pendingPreview}
        fileName={pendingPreview?.fileName}
        statements={pendingPreview?.statements ?? []}
        onCancel={() => setPendingPreview(null)}
        onConfirm={confirmPreview}
      />

      <PdfPreviewDialog
        open={!!pdfPreview}
        fileName={pdfPreview?.fileName}
        bank={pdfPreview?.bank}
        account={pdfPreview?.account ?? {}}
        titular={pdfPreview?.holder?.titular}
        strategy={pdfPreview?.strategy ?? "linhas"}
        columns={pdfPreview?.columns}
        records={pdfPreview?.records ?? []}
        identifying={identifyingLogo}
        onIdentifyLogo={pdfFile ? () => { void identifyLogoInPreview(); } : undefined}
        onColumnsChange={applyColumnFix}
        onRecordsChange={(recs) => setPdfPreview((prev) => (prev ? { ...prev, records: recs } : prev))}
        profileApplied={pdfPreview?.profileApplied}
        saveMapping={saveMapping}
        onSaveMappingChange={setSaveMapping}
        onForgetProfile={
          pdfPreview?.profileApplied
            ? () => {
                const sig = pdfPreview.signature;
                void removeProfile(sig);
                setPdfPreview((prev) => (prev ? { ...prev, profileApplied: false } : prev));
                toast.success("Mapeamento salvo removido.");
              }
            : undefined
        }
        onCancel={() => setPdfPreview(null)}
        onConfirm={confirmPdfPreview}
      />

      <PdfBatchImportDialog
        open={!!batch}
        items={batch ?? []}
        running={batchRunning}
        saving={batchSaving}
        finished={batchFinished}
        progress={batchProgress}
        onToggle={(i) => setBatch((prev) => prev?.map((it, k) => (k === i ? { ...it, selected: !it.selected } : it)) ?? prev)}
        onCancelRun={() => { cancelBatch.current = true; }}
        onClose={() => { cancelBatch.current = true; setBatch(null); setBatchFinished(false); }}
        onConfirm={() => { void confirmBatch(); }}
      />




      <AccountKeyDialog
        open={!!pendingParsed}
        defaultBanco={pendingParsed?.account.banco}
        defaultAgencia={pendingParsed?.account.agencia}
        defaultConta={pendingParsed?.account.conta}
        defaultTitular={pendingParsed?.holder?.titular}
        defaultDocumento={pendingParsed?.holder?.documento}
        defaultDocumentoTipo={pendingParsed?.holder?.documentoTipo}
        bankDetection={pendingParsed?.bank}
        knownAccounts={accounts}
        onIdentifyLogo={pdfFile ? identifyLogo : undefined}
        onCancel={() => setPendingParsed(null)}
        onConfirm={(res) => { void applyAccountKey(res); }}
      />

      <EditableRecordsDialog
        open={editing}
        records={records}
        onCancel={() => setEditing(false)}
        onConfirm={(edited) => {
          setRecords(edited);
          setEditing(false);
          toast.success(`${edited.length} lançamento(s) atualizado(s).`);
        }}
      />

      <ImportSummaryDialog
        open={!!summary}
        mode={summary?.mode ?? "pre"}
        banco={account.banco}
        agencia={account.agencia}
        conta={account.conta}
        fileName={fileName}
        totalRecords={records.length}
        savedCount={summary?.saved}
        expensesCount={summary?.expenses}
        onReview={() => { setSummary(null); setEditing(true); }}
        onConfirm={() => { void confirmAndPersist(); }}
        onClose={() => setSummary(null)}
      />

      <AlertDialog open={!!duplicate} onOpenChange={(o) => { if (!o) setDuplicate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extrato já importado</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicate?.existing === duplicate?.total
                ? `Todos os ${duplicate?.total} lançamentos deste arquivo já constam na base para a conta Ag ${account.agencia} / ${account.conta}. Regravar apenas atualizará os dados existentes.`
                : `${duplicate?.existing} de ${duplicate?.total} lançamentos deste arquivo já estão na base desta conta. Os repetidos serão atualizados e os novos incluídos, sem duplicar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicate(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDuplicate(null); void doPersist(); }}>
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pdfDiag} onOpenChange={(o) => { if (!o) setPdfDiag(null); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Nenhum lançamento reconhecido no PDF</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>{pdfDiag?.motivo}</p>
                <ul className="text-xs text-muted-foreground">
                  <li>Arquivo: {pdfDiag?.fileName}</li>
                  <li>Páginas: {pdfDiag?.pages} · Linhas extraídas: {pdfDiag?.linhas}</li>
                  <li>Camada de texto: {pdfDiag?.temTexto ? "sim" : "não"}</li>
                  <li>Cabeçalho da tabela: {pdfDiag?.cabecalhoDetectado ? "reconhecido" : "não reconhecido"}</li>
                </ul>
                {pdfDiag?.amostra?.length ? (
                  <details className="rounded-md border border-border bg-muted/40 p-2">
                    <summary className="cursor-pointer text-xs font-medium">
                      Ver primeiras linhas extraídas
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                      {pdfDiag.amostra.join("\n")}
                    </pre>
                  </details>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPdfDiag(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
    </div>
  );
}
