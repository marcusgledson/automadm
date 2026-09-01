import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Plus, Pencil, Trash2, Download, Smartphone, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/UserMenu";
import SmsBankConfigDialog from "@/components/SmsBankConfigDialog";
import SmsPasteDialog from "@/components/SmsPasteDialog";
import { useSmsBankConfigs, type SmsBankConfigRow } from "@/hooks/useSmsBankConfigs";
import { useSmsReviewQueue } from "@/hooks/useSmsReviewQueue";
import {
  isSmsAvailable, readRecentSms, requestSmsPermission,
} from "@/lib/smsListener";
import { parseSms } from "@/lib/smsParser";
import { toast } from "@/hooks/use-toast";

export default function SmsConfig() {
  const navigate = useNavigate();
  const { items, loading, upsert, remove, loadPresets } = useSmsBankConfigs();
  const { insertMany } = useSmsReviewQueue();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SmsBankConfigRow | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const handleAdd = () => { setEditing(null); setDialogOpen(true); };
  const handleEdit = (row: SmsBankConfigRow) => { setEditing(row); setDialogOpen(true); };

  const handleScan = async () => {
    if (!(await isSmsAvailable())) {
      toast({
        title: "Recurso disponível apenas no Android",
        description: "A leitura de SMS só funciona no app Android exportado com Capacitor.",
      });
      return;
    }
    setScanning(true);
    const granted = await requestSmsPermission();
    if (!granted) {
      toast({ title: "Permissão negada", variant: "destructive" });
      setScanning(false);
      return;
    }
    const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const messages = await readRecentSms(sinceMs);
    const rows: any[] = [];
    for (const m of messages) {
      const cfg = items.find((c) =>
        c.is_active && c.senders.some((s) => m.address?.toLowerCase().includes(s.toLowerCase())),
      );
      if (!cfg) continue;
      const parsed = parseSms(m.address, m.body, cfg, m.date ? new Date(m.date) : undefined);
      rows.push({
        bank_config_id: cfg.id,
        bank_name: cfg.bank_name,
        sender: m.address,
        raw_message: m.body,
        received_at: parsed.received_at,
        kind: parsed.kind,
        amount: parsed.amount,
        descricao: parsed.descricao,
        agencia: cfg.agencia,
        conta: cfg.conta,
      });
    }
    if (rows.length) {
      await insertMany(rows);
      toast({ title: `${rows.length} SMS enviados para revisão` });
    } else {
      toast({
        title: "Nenhum SMS reconhecido",
        description:
          messages.length === 0
            ? "Não há mensagens recentes acessíveis no aparelho."
            : "As mensagens encontradas não casaram com os remetentes cadastrados. Ajuste os remetentes do banco ou use 'Colar SMS'.",
      });
    }
    setScanning(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Configurações → SMS bancário</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")} title="Tela inicial">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Tela inicial</span>
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bancos configurados</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadPresets}>
                <Download className="mr-2 h-4 w-4" /> Carregar presets
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
                <ClipboardPaste className="mr-2 h-4 w-4" /> Colar SMS
              </Button>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
                <Smartphone className="mr-2 h-4 w-4" />
                {scanning ? "Lendo..." : "Ler SMS (Android)"}
              </Button>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar banco
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum banco configurado. Clique em <strong>Carregar presets</strong> para começar com os 7 bancos suportados.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.bank_name}</span>
                        {row.is_preset && <Badge variant="secondary">preset</Badge>}
                        {!row.is_active && <Badge variant="outline">inativo</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        Remetentes: {row.senders.join(", ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Débito: {row.debit_keywords.join(", ") || "—"} · Crédito: {row.credit_keywords.join(", ") || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(row.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Para ler SMS automaticamente, exporte para GitHub e rode <code>npx cap add android</code> e <code>npx cap run android</code>. iOS e Web não suportam leitura de SMS.
        </p>
      </main>

      <SmsPasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        configs={items}
        onQueue={insertMany}
      />

      <SmsBankConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={upsert}
      />
    </div>
  );
}
