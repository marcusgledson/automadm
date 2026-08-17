import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Check, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import UserMenu from "@/components/UserMenu";
import { useSmsReviewQueue, type SmsReviewRow } from "@/hooks/useSmsReviewQueue";
import { toast } from "@/hooks/use-toast";

export default function SmsReview() {
  const navigate = useNavigate();
  const { items, loading, approve, reject, update } = useSmsReviewQueue();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Partial<SmsReviewRow>>>({});
  const [busy, setBusy] = useState(false);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) => (s.size === pending.length ? new Set() : new Set(pending.map((p) => p.id))));
  };

  const setField = (id: string, patch: Partial<SmsReviewRow>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  const merged = (r: SmsReviewRow): SmsReviewRow => ({ ...r, ...drafts[r.id] });

  const persistDraft = async (r: SmsReviewRow) => {
    const patch = drafts[r.id];
    if (!patch) return;
    await update(r.id, patch);
    setDrafts((d) => { const n = { ...d }; delete n[r.id]; return n; });
    toast({ title: "Alterações salvas" });
  };

  const doApprove = async () => {
    const rows = pending.filter((p) => selected.has(p.id)).map(merged);
    if (!rows.length) return;
    setBusy(true);
    // persist drafts first
    for (const r of rows) {
      if (drafts[r.id]) await update(r.id, drafts[r.id]);
    }
    const res = await approve(rows);
    setBusy(false);
    setSelected(new Set());
    setDrafts({});
    toast({ title: `Aprovados: ${res.ok} · Falhas: ${res.fail}` });
  };

  const doReject = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    await reject(ids);
    setBusy(false);
    setSelected(new Set());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Revisão de SMS bancário</h1>
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Pendentes <Badge variant="secondary" className="ml-2">{pending.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll} disabled={!pending.length}>
                {selected.size === pending.length && pending.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button variant="destructive" size="sm" onClick={doReject} disabled={busy || !selected.size}>
                <X className="mr-1 h-4 w-4" /> Rejeitar ({selected.size})
              </Button>
              <Button size="sm" onClick={doApprove} disabled={busy || !selected.size}>
                <Check className="mr-1 h-4 w-4" /> Aprovar e gravar ({selected.size})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum SMS pendente. Vá em <Link to="/sms/config" className="underline">Configurações → SMS bancário</Link> para escanear.
              </p>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => {
                  const v = merged(r);
                  return (
                    <div key={r.id} className="rounded border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                        <span className="text-sm font-medium">{r.bank_name ?? "—"}</span>
                        <Badge variant="outline">{r.sender ?? "—"}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {r.received_at ? new Date(r.received_at).toLocaleString("pt-BR") : "sem data"}
                        </span>
                      </div>
                      <p className="mb-3 rounded bg-muted/50 p-2 text-xs italic">{r.raw_message}</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                        <div className="col-span-2 md:col-span-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={v.kind} onValueChange={(val) => setField(r.id, { kind: val as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit">Débito</SelectItem>
                              <SelectItem value="credit">Crédito</SelectItem>
                              <SelectItem value="unknown">Desconhecido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Valor</Label>
                          <Input
                            type="number" step="0.01"
                            value={v.amount ?? ""}
                            onChange={(e) => setField(r.id, { amount: e.target.value ? Number(e.target.value) : null })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Data</Label>
                          <Input
                            type="datetime-local"
                            value={v.received_at ? v.received_at.slice(0, 16) : ""}
                            onChange={(e) => setField(r.id, { received_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Favorecido / Estabelecimento</Label>
                          <Input
                            value={v.descricao ?? ""}
                            onChange={(e) => setField(r.id, { descricao: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Últimos dígitos</Label>
                          <Input
                            value={v.conta ?? ""}
                            maxLength={8}
                            onChange={(e) => setField(r.id, { conta: e.target.value })}
                          />
                        </div>
                      </div>
                      {drafts[r.id] && (
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => persistDraft(r)}>
                            <Save className="mr-1 h-4 w-4" /> Salvar edição
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
