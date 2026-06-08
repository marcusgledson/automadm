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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Trash2, Loader2, Database, FlaskConical, Copy } from "lucide-react";

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

export default function AdminPanel({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const previewUrl = typeof window !== "undefined" ? window.location.origin : "";

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

  const wipeTable = async (key: TableKey, label: string) => {
    if (!user) return;
    if (!confirm(`Tem certeza? Isto apagará TODOS os registros de "${label}" da sua conta.`)) return;
    setBusy(key);
    const { error } = await supabase.from(key).delete().eq("user_id", user.id);
    setBusy(null);
    if (error) toast.error("Falha: " + error.message);
    else toast.success(`${label} limpo. Recarregue para atualizar.`);
  };

  const wipeAll = async () => {
    if (!user) return;
    if (!confirm("ATENÇÃO: Isto apagará TODOS os seus dados de TODAS as bases. Continuar?")) return;
    setBusy("all");
    for (const t of TABLES) {
      await supabase.from(t.key).delete().eq("user_id", user.id);
    }
    setBusy(null);
    toast.success("Base limpa. Recarregue a página.");
  };

  const copyPreview = async () => {
    await navigator.clipboard.writeText(previewUrl);
    toast.success("Link copiado. Compartilhe com sua equipe de testes.");
  };

  return (
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
                <div key={t.key} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="text-sm">{t.label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => wipeTable(t.key, t.label)}
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
                onClick={wipeAll}
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
  );
}
