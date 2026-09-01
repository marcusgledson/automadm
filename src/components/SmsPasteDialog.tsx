import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { parseSms } from "@/lib/smsParser";
import type { SmsBankConfigRow } from "@/hooks/useSmsBankConfigs";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  configs: SmsBankConfigRow[];
  onQueue: (rows: Record<string, unknown>[]) => Promise<unknown>;
}

const BRL = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Alternativa ao leitor nativo (Android): permite colar uma ou várias mensagens
 * de SMS bancário e enviá-las para a fila de revisão em qualquer plataforma.
 * Formato aceito por linha: "REMETENTE: mensagem" ou apenas a mensagem.
 */
export default function SmsPasteDialog({ open, onOpenChange, configs, onQueue }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    const blocks = text
      .split(/\n{2,}|\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return blocks.map((line) => {
      const m = line.match(/^([A-Za-z0-9 .\-_]{2,24})\s*[:\-–]\s*(.+)$/);
      const sender = m ? m[1].trim() : "";
      const body = m ? m[2].trim() : line;
      const cfg =
        configs.find(
          (c) =>
            c.is_active &&
            (c.senders.some((s) => s && sender.toLowerCase().includes(s.toLowerCase())) ||
              c.senders.some((s) => s && body.toLowerCase().includes(s.toLowerCase())) ||
              body.toLowerCase().includes(c.bank_name.toLowerCase())),
        ) ?? null;
      const result = cfg ? parseSms(sender || cfg.bank_name, body, cfg, new Date()) : null;
      return { line, sender, body, cfg, result };
    });
  }, [text, configs]);

  const usable = parsed.filter((p) => p.cfg && p.result);

  const send = async () => {
    if (!usable.length) return;
    setSaving(true);
    const rows = usable.map(({ cfg, result, sender, body }) => ({
      bank_config_id: cfg!.id,
      bank_name: cfg!.bank_name,
      sender: sender || cfg!.bank_name,
      raw_message: body,
      received_at: result!.received_at,
      kind: result!.kind,
      amount: result!.amount,
      descricao: result!.descricao,
      agencia: cfg!.agencia,
      conta: cfg!.conta,
    }));
    await onQueue(rows);
    setSaving(false);
    setText("");
    onOpenChange(false);
    toast({ title: `${rows.length} SMS enviados para revisão` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Colar SMS bancário</DialogTitle>
          <DialogDescription>
            Funciona em qualquer plataforma (Web, iOS e Android). Cole uma mensagem por linha, no
            formato <code>BANCO: mensagem</code> ou apenas o texto da mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sms-text">Mensagens</Label>
          <Textarea
            id="sms-text"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"ITAU: Compra aprovada de R$ 129,90 em SUPERMERCADO XYZ em 12/08 as 14:32\nNUBANK: Pix recebido de R$ 250,00"}
          />
        </div>

        {parsed.length > 0 && (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded border p-2">
            {parsed.map((p, i) => (
              <div key={i} className="rounded border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {p.cfg ? (
                    <Badge variant="secondary">{p.cfg.bank_name}</Badge>
                  ) : (
                    <Badge variant="destructive">banco não identificado</Badge>
                  )}
                  {p.result && (
                    <>
                      <Badge variant="outline">
                        {p.result.kind === "debit"
                          ? "Débito"
                          : p.result.kind === "credit"
                            ? "Crédito"
                            : "Indefinido"}
                      </Badge>
                      <span className="font-medium">{BRL(p.result.amount)}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 truncate text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={saving || !usable.length}>
            Enviar {usable.length || ""} para revisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
