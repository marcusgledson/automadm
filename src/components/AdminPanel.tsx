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
import { toast } from "sonner";
import { Download, Trash2, Loader2, Database, FlaskConical, Copy, AlertTriangle, FileJson } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type TableKey = "bank_statements" | "consumption_bills" | "expenses" | "drive_links";

const TABLES: { key: TableKey; label: string }[] = [
  { key: "bank_statements", label: "Extratos Bancários" },
  { key: "consumption_bills", label: "Faturas / Contas de Consumo" },
  { key: "expenses", label: "Despesas / Boletos" },
  { key: "drive_links", label: "Links do Google Drive" },
];

interface PendingAction {
  type: "table" | "all";
  key?: TableKey;
  label?: string;
}

export default function AdminPanel({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [previewUrl] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const exportAll = async () => {
    if (!user) return;
    setBusy("export");
    try {
      const dump: Record<string, unknown[]> = {};
      for (const t of TABLES) {
        const { data } = await supabase.from(t.key).select("*");
        dump[t.key] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Backup exportado.");
    } catch (e) {
      toast.error("Falha ao exportar: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const requestDelete = (action: PendingAction) => {
    setPending(action);
    setPassword("");
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!user || !pending) return;
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

    if (pending.type === "table" && pending.key) {
      setBusy(pending.key);
      const { error } = await supabase.from(pending.key).delete().eq("user_id", user.id);
      setBusy(null);
      if (error) toast.error("Falha: " + error.message);
      else toast.success(`${pending.label} limpo. Recarregue para atualizar.`);
    } else if (pending.type === "all") {
      setBusy("all");
      for (const t of TABLES) {
        await supabase.from(t.key).delete().eq("user_id", user.id);
      }
      setBusy(null);
      toast.success("Base limpa. Recarregue a página.");
    }

    setVerifying(false);
    setConfirmOpen(false);
    setPending(null);
    setPassword("");
  };

  const copyPreview = async () => {
    await navigator.clipboard.writeText(previewUrl);
    toast.success("Link copiado. Compartilhe com sua equipe de testes.");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Menu Gerencial
            </DialogTitle>
            <DialogDescription>
              Decisões administrativas: exportação, limpeza por tipo e versão de testes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Exportação</h4>
              <Button variant="outline" className="w-full justify-start" onClick={exportAll} disabled={busy !== null}>
                {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar backup completo (JSON)
              </Button>
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
                      onClick={() => requestDelete({ type: "table", key: t.key, label: t.label })}
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
                  onClick={() => requestDelete({ type: "all" })}
                  disabled={busy !== null}
                >
                  {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Limpar toda a base
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Versão de testes
              </h4>
              <p className="text-xs text-muted-foreground">
                Compartilhe este link com outros desenvolvedores para colaborarem em melhorias.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">{previewUrl}</code>
                <Button size="sm" variant="outline" onClick={copyPreview}>
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === "all"
                ? "Você está prestes a apagar TODOS os seus dados de TODAS as bases."
                : `Você está prestes a apagar TODOS os registros de "${pending?.label}".`}
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
    </>
  );
}
