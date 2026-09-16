import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Building2, ClipboardList, Download, FileDown, Home, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserMenu from "@/components/UserMenu";
import { MODULES, useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import {
  REPORT_FORMATS,
  STATUS_LABEL,
  useReportRequests,
  type RequestStatus,
} from "@/hooks/useReportRequests";
import { useCorporateRequests } from "@/hooks/useCorporateRequests";
import { generateReport } from "@/lib/reportGenerator";

const statusVariant = (s: RequestStatus) =>
  s === "aprovada" ? "default" : s === "recusada" ? "destructive" : "outline";

const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;

const formatLabel = (id: string) =>
  REPORT_FORMATS.find((f) => f.id === id)?.label ?? id.toUpperCase();

export default function Solicitacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { settings } = useAppSettings();
  const { isMaster } = useUserRole();
  const reports = useReportRequests();
  const corporate = useCorporateRequests();

  const [modulo, setModulo] = useState<string>(MODULES[0].id);
  const [formato, setFormato] = useState<string>(REPORT_FORMATS[0].id);
  const [justificativa, setJustificativa] = useState("");
  const [sending, setSending] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState(settings?.org_name ?? "");
  const [demanda, setDemanda] = useState("");
  const [desejados, setDesejados] = useState<string[]>([]);
  const [sendingCorp, setSendingCorp] = useState(false);

  const corporateMode = (settings?.usage_mode ?? "pessoal") !== "pessoal";
  const myRequests = reports.mine;
  const inbox = reports.inbox;
  const pendentes = useMemo(() => inbox.filter((r) => r.status === "pendente"), [inbox]);

  const submitReport = async () => {
    if (!modulo || !formato) return toast.error("Escolha o módulo e o formato do relatório.");
    setSending(true);
    const res = await reports.create({
      modulo,
      formato,
      justificativa: justificativa.trim() || null,
    });
    setSending(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Solicitação enviada ao Máster da organização.");
    setJustificativa("");
  };

  const decide = async (id: string, status: "aprovada" | "recusada") => {
    const res = await reports.decide(id, status);
    if (!res.ok) return toast.error(res.error);
    toast.success(status === "aprovada" ? "Solicitação aprovada." : "Solicitação recusada.");
  };

  /** Gera e baixa o relatório de um pedido já aprovado. */
  const baixar = async (r: { id: string; modulo: string; formato: string }) => {
    setGerando(r.id);
    try {
      const res = await generateReport(r.modulo, r.formato, {
        titulo: `${moduleLabel(r.modulo)} · ${formatLabel(r.formato)}`,
      });
      toast.success(`Relatório gerado (${res.total} registro(s)): ${res.fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setGerando(null);
    }
  };


  const submitCorporate = async () => {
    if (demanda.trim().length < 10)
      return toast.error("Descreva a demanda com pelo menos 10 caracteres.");
    setSendingCorp(true);
    const res = await corporate.create({
      nome_solicitante: profile?.display_name || profile?.full_name || user?.email || "Usuário",
      email: user?.email ?? "",
      empresa: empresa.trim() || null,
      demanda: demanda.trim(),
      modulos_desejados: desejados,
    });
    setSendingCorp(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Demanda registrada. O desenvolvedor será notificado.");
    setDemanda("");
    setDesejados([]);
  };

  const toggleDesejado = (id: string) =>
    setDesejados((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  return (
    <div className="app-surface flex min-h-screen flex-col">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
          </Button>
          <ClipboardList className="h-5 w-5 text-primary" />
          <span className="truncate text-sm font-semibold">Solicitações e Relatórios</span>
        </div>
        <UserMenu />
      </header>

      <main className="safe-bottom mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6">
        <Tabs defaultValue={isMaster ? "caixa" : "relatorio"}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="relatorio">Pedir relatório</TabsTrigger>
            {isMaster && (
              <TabsTrigger value="caixa">
                Aprovações
                {pendentes.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendentes.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="historico">Meus pedidos</TabsTrigger>
            {corporateMode && <TabsTrigger value="corporativa">Demanda corporativa</TabsTrigger>}
          </TabsList>

          <TabsContent value="relatorio" className="mt-4 space-y-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Nova solicitação de relatório</CardTitle>
                <CardDescription>
                  Escolha o módulo e o formato desejados. A liberação da exportação depende da
                  aprovação do Máster da organização.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Módulo</Label>
                  <Select value={modulo} onValueChange={setModulo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Formato</Label>
                  <Select value={formato} onValueChange={setFormato}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_FORMATS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="justificativa">Justificativa (opcional)</Label>
                  <Textarea
                    id="justificativa"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    maxLength={500}
                    placeholder="Explique para que o relatório será utilizado."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={submitReport} disabled={sending}>
                    {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <FileDown className="mr-2 h-4 w-4" />
                    Enviar solicitação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isMaster && (
            <TabsContent value="caixa" className="mt-4 space-y-3">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-base">Caixa de aprovações</CardTitle>
                  <CardDescription>
                    Pedidos de relatório enviados pelos usuários da sua organização.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reports.loading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : inbox.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma solicitação recebida.
                    </p>
                  ) : (
                    inbox.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5 text-sm">
                          <p className="font-medium">
                            {moduleLabel(r.modulo)} · {formatLabel(r.formato)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Solicitante: {reports.requesterLabel(r.requester_id)}
                          </p>
                          {r.justificativa && (
                            <p className="text-xs text-muted-foreground">{r.justificativa}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Enviado em {new Date(r.created_at).toLocaleString("pt-BR")}
                            {r.decided_at &&
                              ` · decidido em ${new Date(r.decided_at).toLocaleString("pt-BR")}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                          {r.status === "aprovada" && (
                            <Button size="sm" variant="outline" disabled={gerando === r.id} onClick={() => baixar(r)}>
                              {gerando === r.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              Baixar
                            </Button>
                          )}
                          {r.status === "pendente" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => decide(r.id, "recusada")}>
                                Recusar
                              </Button>
                              <Button size="sm" onClick={() => decide(r.id, "aprovada")}>
                                Aprovar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="historico" className="mt-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Meus pedidos</CardTitle>
                <CardDescription>Acompanhe a situação das suas solicitações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {myRequests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Você ainda não enviou solicitações.
                  </p>
                ) : (
                  myRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {moduleLabel(r.modulo)} · {formatLabel(r.formato)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                        {r.status === "aprovada" && (
                          <Button size="sm" disabled={gerando === r.id} onClick={() => baixar(r)}>
                            {gerando === r.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Baixar relatório
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {corporateMode && (
            <TabsContent value="corporativa" className="mt-4 space-y-4">
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    Demanda corporativa
                  </CardTitle>
                  <CardDescription>
                    Peça novos módulos ou adaptações para a sua organização.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa">Empresa</Label>
                    <Input
                      id="empresa"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demanda">Descrição da demanda</Label>
                    <Textarea
                      id="demanda"
                      value={demanda}
                      onChange={(e) => setDemanda(e.target.value)}
                      maxLength={1000}
                      placeholder="Descreva o que a sua organização precisa."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Módulos de interesse</Label>
                    <div className="flex flex-wrap gap-3">
                      {MODULES.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={desejados.includes(m.id)}
                            onCheckedChange={() => toggleDesejado(m.id)}
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Button onClick={submitCorporate} disabled={sendingCorp}>
                      {sendingCorp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar demanda
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-base">Demandas enviadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {corporate.requests.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma demanda registrada.
                    </p>
                  ) : (
                    corporate.requests.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.empresa || r.nome_solicitante}</p>
                          <p className="text-xs text-muted-foreground">{r.demanda}</p>
                          {r.modulos_desejados?.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Módulos: {r.modulos_desejados.map(moduleLabel).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                          {r.status === "pendente" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              title="Cancelar demanda"
                              onClick={async () => {
                                const res = await corporate.remove(r.id);
                                if (!res.ok) toast.error(res.error);
                                else toast.success("Demanda cancelada.");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
