import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Ban, Building2, CheckCircle2, Home, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserMenu from "@/components/UserMenu";
import { useAppOwner } from "@/hooks/useAppOwner";
import { ACCESS_LABEL, useCompanies, type AccessStatus, type Company } from "@/hooks/useCompanies";
import { isCnpjValid, maskCnpj, TIPOS_INSTITUICAO, tipoInstituicaoLabel, UFS } from "@/lib/cnpj";

const statusVariant = (s: AccessStatus) =>
  s === "liberado" ? "default" : s === "bloqueado" ? "destructive" : "outline";

export default function Empresas() {
  const navigate = useNavigate();
  const { isAppOwner, loading: ownerLoading } = useAppOwner();
  const { companies, notifications, loading, createCompany, setAccess, updateNotifyEmail } =
    useCompanies(isAppOwner);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [tipo, setTipo] = useState("empresa_privada");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [status, setStatus] = useState<AccessStatus>("liberado");

  const [decide, setDecide] = useState<{ company: Company; status: AccessStatus } | null>(null);
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const lastNotification = useMemo(() => {
    const map: Record<string, (typeof notifications)[number]> = {};
    for (const n of notifications) if (!map[n.organization_id]) map[n.organization_id] = n;
    return map;
  }, [notifications]);

  const handleCreate = async () => {
    if (!isCnpjValid(cnpj)) return toast.error("CNPJ inválido. Confira os números digitados.");
    if (!razao.trim()) return toast.error("Informe a razão social.");
    setSaving(true);
    const res = await createCompany({
      cnpj,
      razao_social: razao.trim(),
      nome_fantasia: fantasia.trim(),
      tipo_instituicao: tipo,
      email: email.trim(),
      cidade: cidade.trim(),
      uf,
      access_status: status,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Empresa cadastrada.");
    setOpen(false);
    setCnpj("");
    setRazao("");
    setFantasia("");
    setEmail("");
    setCidade("");
    setUf("");
    setStatus("liberado");
  };

  const confirmDecision = async () => {
    if (!decide) return;
    setDeciding(true);
    const res = await setAccess(decide.company, decide.status, note.trim() || null);
    setDeciding(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(decide.status === "liberado" ? "Acesso liberado." : "Acesso bloqueado.");
    setDecide(null);
    setNote("");
  };

  if (ownerLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" /> Início
          </Button>
        </div>
        <UserMenu />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre empresas e libere ou bloqueie o acesso delas ao aplicativo.
            </p>
          </div>
          {isAppOwner && (
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <Building2 className="h-4 w-4" /> Nova empresa
            </Button>
          )}
        </div>

        {!isAppOwner ? (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Área restrita</CardTitle>
              <CardDescription>
                Somente a administração do aplicativo pode liberar ou bloquear empresas.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : companies.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {companies.map((c) => {
              const last = lastNotification[c.id];
              return (
                <Card key={c.id} className="card-elevated">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {c.nome_fantasia || c.razao_social}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {maskCnpj(c.cnpj)} · {tipoInstituicaoLabel(c.tipo_instituicao)}
                          {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ""}` : ""}
                        </CardDescription>
                      </div>
                      <Badge variant={statusVariant(c.access_status)}>{ACCESS_LABEL[c.access_status]}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">E-mail para avisos</Label>
                        <Input
                          defaultValue={c.notify_email ?? c.email ?? ""}
                          placeholder="contato@empresa.com.br"
                          onBlur={async (e) => {
                            const v = e.target.value;
                            if (v.trim() === (c.notify_email ?? c.email ?? "")) return;
                            const res = await updateNotifyEmail(c, v);
                            if (!res.ok) toast.error(res.error);
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={c.access_status === "liberado"}
                          onClick={() => {
                            setDecide({ company: c, status: "liberado" });
                            setNote("");
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Liberar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive"
                          disabled={c.access_status === "bloqueado"}
                          onClick={() => {
                            setDecide({ company: c, status: "bloqueado" });
                            setNote("");
                          }}
                        >
                          <Ban className="h-4 w-4" /> Bloquear
                        </Button>
                      </div>
                    </div>
                    {c.access_note && (
                      <p className="text-xs text-muted-foreground">Observação: {c.access_note}</p>
                    )}
                    {last && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {last.sent_at
                          ? `Aviso enviado para ${last.recipient_email}.`
                          : `Aviso para ${last.recipient_email} ainda não enviado (envio de e-mails indisponível).`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
            <DialogDescription>Cadastre a empresa e defina a situação do acesso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input value={maskCnpj(cnpj)} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_INSTITUICAO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Razão social</Label>
              <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome fantasia</Label>
              <Input value={fantasia} onChange={(e) => setFantasia(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>E-mail para avisos</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com.br" />
            </div>
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Situação do acesso</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AccessStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="liberado">Liberado</SelectItem>
                  <SelectItem value="pendente">Aguardando análise</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!decide} onOpenChange={(v) => !v && setDecide(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decide?.status === "liberado" ? "Liberar acesso" : "Bloquear acesso"}
            </DialogTitle>
            <DialogDescription>
              Um aviso será enviado para o e-mail cadastrado da empresa informando a decisão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecide(null)}>Cancelar</Button>
            <Button onClick={confirmDecision} disabled={deciding} className="gap-2">
              {deciding && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
