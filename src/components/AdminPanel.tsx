import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Download, Trash2, Loader2, Database, AlertTriangle, FileJson, ShieldCheck, Upload, Cloud, Settings, Palette, Fingerprint } from "lucide-react";
import { encryptBackup, decryptBackup, envelopeToBlob, defaultFileName, type BackupEnvelope } from "@/lib/backupCrypto";
import { isDriveBackupConfigured, uploadBackupToDrive } from "@/lib/googleDriveBackup";
import { useNavigate } from "react-router-dom";
import DeleteImpactDialog from "@/components/DeleteImpactDialog";
import AppearancePanel from "@/components/AppearancePanel";
import SecuritySettingsPanel from "@/components/SecuritySettingsPanel";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import { executeImpactPlan, type ImpactPlan, type ImpactTableKey } from "@/lib/deleteImpact";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type TableKey = ImpactTableKey;

const TABLES: { key: TableKey; label: string }[] = [
  { key: "bank_statements", label: "Extratos Bancários" },
  { key: "consumption_bills", label: "Faturas / Contas de Consumo" },
  { key: "expenses", label: "Despesas / Boletos" },
  { key: "drive_links", label: "Links do Google Drive" },
  { key: "sms_bank_configs", label: "Bancos configurados (SMS)" },
  { key: "sms_review_queue", label: "Fila de revisão de SMS" },
];

interface ExportSummaryItem {
  label: string;
  count: number;
}

export default function AdminPanel({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);


  const [confirmOpen, setConfirmOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactTarget, setImpactTarget] = useState<TableKey | "all" | null>(null);
  const [pendingPlan, setPendingPlan] = useState<ImpactPlan | null>(null);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummaryItem[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState<string>("");
  const [exportError, setExportError] = useState<string | null>(null);

  // ===== Backup criptografado =====
  type EncDest = "download" | "drive";
  const [encOpen, setEncOpen] = useState(false);
  const [encDest, setEncDest] = useState<EncDest>("download");
  const [encPwd, setEncPwd] = useState("");
  const [encBusy, setEncBusy] = useState(false);
  const [encError, setEncError] = useState<string | null>(null);

  // Restore
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreEnv, setRestoreEnv] = useState<BackupEnvelope | null>(null);
  const [restorePwd, setRestorePwd] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [postRestoreOpen, setPostRestoreOpen] = useState(false);

  const prepareExport = async () => {
    if (!user) return;
    setBusy("export");
    try {
      const summary: ExportSummaryItem[] = [];
      for (const t of TABLES) {
        const { count, error } = await supabase
          .from(t.key)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (error) throw error;
        summary.push({ label: t.label, count: count ?? 0 });
      }
      setExportSummary(summary);
      setExportConfirmOpen(true);
    } catch (e) {
      toast.error("Falha ao preparar exportação: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doExport = async () => {
    if (!user) return;
    setExportBusy(true);
    setExportError(null);
    setExportProgress(0);
    setExportStage("Iniciando...");
    try {
      const dump: Record<string, unknown[]> = {};
      const total = TABLES.length + 1; // +1 for file generation step
      for (let i = 0; i < TABLES.length; i++) {
        const t = TABLES[i];
        setExportStage(`Lendo ${t.label}...`);
        const { data, error } = await supabase.from(t.key).select("*").eq("user_id", user.id);
        if (error) throw new Error(`Falha ao ler "${t.label}": ${error.message}`);
        dump[t.key] = data ?? [];
        setExportProgress(Math.round(((i + 1) / total) * 100));
      }
      setExportStage("Gerando arquivo JSON...");
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      if (blob.size === 0) throw new Error("Arquivo gerado está vazio.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportProgress(100);
      setExportStage("Concluído");
      toast.success("Backup exportado com sucesso.");
      setExportConfirmOpen(false);
      setExportSummary([]);
    } catch (e) {
      const msg = (e as Error).message || "Erro desconhecido";
      setExportError(msg);
      toast.error("Falha ao exportar backup: " + msg);
    } finally {
      setExportBusy(false);
    }
  };

  const requestDelete = (target: TableKey | "all") => {
    setImpactTarget(target);
    setPendingPlan(null);
    setImpactOpen(true);
  };

  const onImpactConfirmed = (plan: ImpactPlan) => {
    setPendingPlan(plan);
    setImpactOpen(false);
    setPassword("");
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!user || !pendingPlan) return;
    if (!password) {
      toast.error("Digite sua senha para confirmar.");
      return;
    }

    setVerifying(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (authError) {
      setVerifying(false);
      toast.error("Senha incorreta. Exclusão cancelada.");
      return;
    }

    setBusy(impactTarget ?? "all");
    try {
      await executeImpactPlan(pendingPlan, user.id);
      toast.success(
        `${pendingPlan.targetLabel}: ${pendingPlan.totalRows} registro(s) excluído(s). Recarregue para atualizar.`,
      );
    } catch (e) {
      toast.error("Falha na exclusão: " + (e as Error).message);
    } finally {
      setBusy(null);
    }

    setVerifying(false);
    setConfirmOpen(false);
    setPendingPlan(null);
    setImpactTarget(null);
    setPassword("");
  };



  // === Backup criptografado ===
  const openEncBackup = (dest: EncDest) => {
    setEncDest(dest);
    setEncPwd("");
    setEncError(null);
    setEncOpen(true);
  };

  const runEncryptedBackup = async () => {
    if (!user || !user.email) return;
    if (!encPwd) { setEncError("Informe sua senha de login."); return; }
    setEncBusy(true);
    setEncError(null);
    try {
      // 1) Valida senha
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: encPwd });
      if (authErr) throw new Error("Senha incorreta.");

      // 2) Coleta dados de todas as tabelas do usuário
      const dump: Record<string, unknown[]> = {};
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t.key).select("*").eq("user_id", user.id);
        if (error) throw new Error(`Falha ao ler "${t.label}": ${error.message}`);
        dump[t.key] = data ?? [];
      }

      // 3) Criptografa
      const envelope = await encryptBackup(
        { app: "automadm", userEmail: user.email, data: dump },
        encPwd,
        user.id,
      );
      const blob = envelopeToBlob(envelope);
      const fname = defaultFileName(user.id);

      // 4) Destino
      if (encDest === "download") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Backup criptografado salvo no seu dispositivo.");
      } else {
        if (!isDriveBackupConfigured()) {
          throw new Error("Google Drive não configurado. Defina VITE_GOOGLE_CLIENT_ID.");
        }
        const result = await uploadBackupToDrive(blob, fname);
        toast.success(`Enviado ao Google Drive: ${result.name}`);
      }
      setEncOpen(false);
    } catch (e) {
      setEncError((e as Error).message);
    } finally {
      setEncBusy(false);
    }
  };

  // === Restore ===
  const onRestoreFileChosen = async (file: File) => {
    setRestoreError(null);
    setRestorePwd("");
    setRestoreFile(file);
    try {
      const text = await file.text();
      const env = JSON.parse(text) as BackupEnvelope;
      if (env.app !== "automadm" || env.v !== 1) throw new Error("Arquivo de backup inválido.");
      if (!user || env.ownerUserId !== user.id) {
        throw new Error("Este backup não pertence à conta logada. Restore bloqueado.");
      }
      setRestoreEnv(env);
      setRestoreOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
      setRestoreFile(null);
    }
  };

  const runRestore = async () => {
    if (!user || !restoreEnv) return;
    if (!restorePwd) { setRestoreError("Informe sua senha de login."); return; }
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const payload = await decryptBackup<{ data: Record<string, Record<string, unknown>[]> }>(
        restoreEnv, restorePwd, user.id,
      );
      // Limpa tabelas e reinsere — chaves primárias preservadas garantem unicidade
      for (const t of TABLES) {
        const { error: delErr } = await supabase.from(t.key).delete().eq("user_id", user.id);
        if (delErr) throw new Error(`Limpando ${t.label}: ${delErr.message}`);
        const rows = (payload.data?.[t.key] ?? []).map((r) => ({ ...r, user_id: user.id }));
        if (rows.length === 0) continue;
        const { error: insErr } = await supabase.from(t.key).insert(rows as never);
        if (insErr) throw new Error(`Restaurando ${t.label}: ${insErr.message}`);
      }
      toast.success("Backup restaurado com sucesso.");
      setRestoreOpen(false);
      setRestoreEnv(null);
      setRestoreFile(null);
      setRestorePwd("");
      setPostRestoreOpen(true);
    } catch (e) {
      setRestoreError((e as Error).message);
    } finally {
      setRestoreBusy(false);
    }
  };

  const openRestorePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.enc,application/json,application/octet-stream";
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) onRestoreFileChosen(f);
    };
    input.click();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Configurações
            </DialogTitle>
            <DialogDescription>
              Aparência, segurança do aparelho, backups e limpeza da base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Palette className="h-4 w-4 text-primary" /> Aparência
              </h4>
              <AppearancePanel />
            </section>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Fingerprint className="h-4 w-4 text-primary" /> Segurança de acesso
              </h4>
              <SecuritySettingsPanel />
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Exportação</h4>

              <Button variant="outline" className="w-full justify-start" onClick={prepareExport} disabled={busy !== null}>
                {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar backup completo (JSON)
              </Button>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Backup criptografado (estilo WhatsApp)
              </h4>
              <p className="text-xs text-muted-foreground">
                AES-GCM 256 com chave derivada da sua senha de login. Apenas o dono do login conseguirá restaurar.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start" onClick={() => openEncBackup("download")} disabled={encBusy}>
                  <Download className="h-4 w-4" /> Baixar .enc local
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => openEncBackup("drive")}
                  disabled={encBusy || !isDriveBackupConfigured()}
                  title={isDriveBackupConfigured() ? "" : "Defina VITE_GOOGLE_CLIENT_ID para habilitar"}
                >
                  <Cloud className="h-4 w-4" /> Salvar no Google Drive
                </Button>
              </div>
              <Button variant="outline" className="w-full justify-start" onClick={openRestorePicker} disabled={restoreBusy}>
                <Upload className="h-4 w-4" /> Restaurar backup criptografado
              </Button>
              {!isDriveBackupConfigured() && (
                <p className="text-[11px] text-muted-foreground">
                  Para habilitar o envio direto ao Google Drive, configure <code>VITE_GOOGLE_CLIENT_ID</code> (OAuth Web Client ID com escopo <code>drive.file</code>) e adicione a origem do app nas URLs autorizadas.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Limpeza por tipo de dado</h4>
              <div className="space-y-2">
                {TABLES.map((t) => (
                  <div
                    key={t.key}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm truncate">{t.label}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => requestDelete(t.key)}
                      disabled={busy !== null}
                    >
                      {busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Excluir
                    </Button>
                  </div>
                ))}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => requestDelete("all")}
                  disabled={busy !== null}
                >
                  {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Limpar toda a base
                </Button>
              </div>
            </section>

            <section className="space-y-2 rounded-lg border border-destructive/40 p-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> Excluir minha conta
              </h4>
              <p className="text-xs text-muted-foreground">
                Remove definitivamente seu acesso e todos os seus dados. Exige senha e, se configurados,
                também biometria e PIN.
              </p>
              <Button variant="destructive" className="w-full" onClick={() => setDeleteAccountOpen(true)}>
                <Trash2 className="h-4 w-4" /> Excluir conta
              </Button>
            </section>

          </div>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />



      <DeleteImpactDialog
        open={impactOpen}
        onOpenChange={setImpactOpen}
        target={impactTarget}
        userId={user?.id}
        onConfirm={onImpactConfirmed}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              {`Você está prestes a apagar ${pendingPlan?.totalRows ?? 0} registro(s) de "${pendingPlan?.targetLabel ?? ""}"${pendingPlan?.hasDependents ? ", incluindo toda a cadeia de dados relacionados" : ""}.`}
              <br />
              Digite sua senha para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") executeDelete();
              }}
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={verifying}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={executeDelete} disabled={verifying || !password}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirmar exclusão
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportConfirmOpen}
        onOpenChange={(v) => {
          if (!v && !exportBusy) {
            setExportConfirmOpen(false);
            setExportError(null);
            setExportProgress(0);
            setExportStage("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Confirmar exportação de backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              Resumo do que será exportado:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            {exportSummary.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
              >
                <span className="text-sm">{item.label}</span>
                <span className="text-sm font-semibold">
                  {item.count} {item.count === 1 ? "registro" : "registros"}
                </span>
              </div>
            ))}
          </div>

          {(exportBusy || exportProgress > 0) && !exportError && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{exportStage || "Processando..."}</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}

          {exportError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Não foi possível concluir a exportação.</p>
                  <p className="mt-1 text-xs opacity-90">{exportError}</p>
                  <p className="mt-2 text-xs opacity-80">
                    Verifique sua conexão e tente novamente. Se o problema persistir, contate o suporte.
                  </p>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExportConfirmOpen(false)} disabled={exportBusy}>
              {exportError ? "Fechar" : "Cancelar"}
            </Button>
            <Button onClick={doExport} disabled={exportBusy}>
              {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exportError ? "Tentar novamente" : "Confirmar e exportar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup criptografado - senha */}
      <AlertDialog open={encOpen} onOpenChange={(v) => !encBusy && setEncOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {encDest === "drive" ? "Backup criptografado → Google Drive" : "Backup criptografado → Download"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Digite sua senha de login. Ela é usada para derivar a chave AES-GCM 256-bit que protege o arquivo.
              {encDest === "drive" && " Em seguida será aberto o consentimento do Google para enviar ao seu Drive."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            placeholder="Sua senha"
            value={encPwd}
            onChange={(e) => setEncPwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runEncryptedBackup(); }}
            autoFocus
          />
          {encError && (
            <p className="text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {encError}
            </p>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setEncOpen(false)} disabled={encBusy}>Cancelar</Button>
            <Button onClick={runEncryptedBackup} disabled={encBusy || !encPwd}>
              {encBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : encDest === "drive" ? <Cloud className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {encDest === "drive" ? "Criptografar e enviar" : "Criptografar e baixar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore */}
      <AlertDialog open={restoreOpen} onOpenChange={(v) => !restoreBusy && setRestoreOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Restaurar backup criptografado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Arquivo: <strong>{restoreFile?.name}</strong>
              <br />
              Esta operação substitui os dados atuais da sua conta pelos do backup. Digite sua senha de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            placeholder="Sua senha"
            value={restorePwd}
            onChange={(e) => setRestorePwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runRestore(); }}
            autoFocus
          />
          {restoreError && (
            <p className="text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {restoreError}
            </p>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoreBusy}>Cancelar</Button>
            <Button onClick={runRestore} disabled={restoreBusy || !restorePwd}>
              {restoreBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Validar e restaurar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pós-restauração */}
      <AlertDialog open={postRestoreOpen} onOpenChange={setPostRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Restauração concluída
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os dados do backup foram aplicados à sua conta. Deseja revisar/alterar suas credenciais agora
              (e-mail e nome de exibição)? Esta etapa é opcional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPostRestoreOpen(false)}>Manter como está</Button>
            <Button
              onClick={() => {
                setPostRestoreOpen(false);
                onOpenChange(false);
                navigate("/dashboard");
                toast.info("Acesse o menu do usuário para alterar e-mail/senha.");
              }}
            >
              <Settings className="h-4 w-4" /> Alterar credenciais
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
