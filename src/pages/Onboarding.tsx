import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, Info, Loader2, ShieldCheck, User, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MODULES, PALETTES, THEME_STYLES, useAppSettings, type UsageMode } from "@/hooks/useAppSettings";
import PhoneField, { isPhoneValid, type PhoneValue } from "@/components/PhoneField";

const MODES: { id: UsageMode; title: string; icon: typeof User; text: string }[] = [
  {
    id: "pessoal",
    title: "Uso pessoal",
    icon: User,
    text: "Será de acesso exclusivo de (01) um único usuário.",
  },
  {
    id: "coparticipativo",
    title: "Uso co-participativo",
    icon: Users,
    text: "Acesso de um usuário proprietário e mais usuários apenas visualizam informações não sensíveis.",
  },
  {
    id: "corporativo",
    title: "Uso corporativo",
    icon: Building2,
    text: "Estrutura com Perfis e acessos de forma profissional.",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { save } = useAppSettings();

  const [mode, setMode] = useState<UsageMode | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [modules, setModules] = useState<string[]>(["extrato", "contas", "metas"]);
  const [palette, setPalette] = useState("oliva");
  const [themeStyle, setThemeStyle] = useState("neutro");
  const [orgName, setOrgName] = useState("");
  const [demanda, setDemanda] = useState("");
  const [nome, setNome] = useState("");
  const [phone, setPhone] = useState<PhoneValue>({ country: "+55", area: "", number: "", whatsapp: true });
  const [saving, setSaving] = useState(false);

  const needsCorporate = mode === "corporativo";

  const canFinish = useMemo(() => {
    if (!mode || modules.length === 0) return false;
    if (!needsCorporate) return true;
    return demanda.trim().length >= 20 && nome.trim().length >= 3 && isPhoneValid(phone);
  }, [mode, modules, needsCorporate, demanda, nome, phone]);

  const toggleModule = (id: string) =>
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const finish = async () => {
    if (!mode || !user) return;
    setSaving(true);
    try {
      const res = await save({
        usage_mode: mode,
        onboarding_done: true,
        enabled_modules: modules,
        palette,
        theme_style: themeStyle,
        org_name: orgName.trim() || null,
      });
      if (!res.ok) throw new Error(res.error);

      if (mode !== "pessoal") {
        // O primeiro usuário é automaticamente o Máster da organização.
        await supabase
          .from("user_roles")
          .upsert(
            { user_id: user.id, org_owner_id: user.id, role: "master" },
            { onConflict: "user_id,org_owner_id,role" },
          );
        await supabase.from("profiles").update({ org_owner_id: user.id }).eq("user_id", user.id);
      }

      if (needsCorporate) {
        const { error } = await supabase.from("corporate_requests").insert({
          user_id: user.id,
          nome_solicitante: nome.trim(),
          email: user.email ?? "",
          phone_country_code: phone.country,
          phone_area_code: phone.area,
          phone_number: phone.number,
          phone_is_whatsapp: phone.whatsapp,
          empresa: orgName.trim() || null,
          demanda: demanda.trim(),
          modulos_desejados: modules,
        });
        if (error) throw new Error(error.message);
        toast.success("Demanda corporativa registrada e enviada ao proprietário da aplicação.");
      }

      toast.success("Configuração inicial concluída.");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-surface min-h-screen px-4 py-8">
      <main className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="gradient-text text-2xl font-bold sm:text-3xl">
            A aplicação será de uso pessoal, co-participativo ou corporativo?
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha o modelo adequado. Você poderá revisar tudo depois no Menu Gerencial.
          </p>
        </header>

        {step === 1 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => (
                <Card
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`card-elevated cursor-pointer transition-all ${
                    mode === m.id ? "ring-2 ring-primary" : "hover:-translate-y-0.5"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="mb-2 w-fit rounded-xl bg-primary/12 p-2.5 text-primary">
                      <m.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{m.text}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Entenda cada modelo</AlertTitle>
              <AlertDescription className="space-y-1 text-sm">
                <p><strong>Uso pessoal</strong> — Será de acesso exclusivo de (01) um único usuário.</p>
                <p><strong>Uso co-participativo</strong> — Acesso de um usuário proprietário e mais usuários apenas visualizam informações não sensíveis.</p>
                <p><strong>Uso corporativo</strong> — Estrutura com Perfis e acessos de forma profissional.</p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button disabled={!mode} onClick={() => setStep(2)}>
                Selecionar modelo
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Módulos disponíveis no primeiro momento</CardTitle>
                <CardDescription>
                  Selecione o que deseja usar agora. Você pode habilitar/desabilitar qualquer módulo
                  futuramente pelo <strong>Menu Gerencial</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-sm">
                    <Checkbox checked={modules.includes(m.id)} onCheckedChange={() => toggleModule(m.id)} />
                    {m.label}
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Aparência</CardTitle>
                <CardDescription>Paleta de cores e tema visual da aplicação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPalette(p.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
                        palette === p.id ? "border-primary ring-1 ring-primary" : "border-border/60"
                      }`}
                    >
                      <span className="flex">
                        {p.colors.map((c) => (
                          <span key={c} className="h-4 w-4 rounded-sm" style={{ background: c }} />
                        ))}
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {THEME_STYLES.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      size="sm"
                      variant={themeStyle === t.id ? "default" : "outline"}
                      onClick={() => setThemeStyle(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {mode !== "pessoal" && (
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Empresa / Organização
                  </CardTitle>
                  <CardDescription>
                    Informe o CNPJ. Se a empresa ainda não existir, você a cadastra e se torna o{" "}
                    <strong>Máster</strong>. Se já existir, enviamos um pedido de acesso ao Máster responsável
                    e seu cadastro entra como <strong>Leitor</strong> até a aprovação.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {orgCreated ? (
                    <Alert>
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>Empresa cadastrada</AlertTitle>
                      <AlertDescription>
                        <strong>{orgCreated}</strong> — você é o Máster desta organização.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <OrganizationForm
                      requesterName={nome.trim() || null}
                      onDone={async (r) => {
                        if (r.kind === "created") {
                          setOrgCreated(orgName.trim() || "Empresa cadastrada");
                          return;
                        }
                        await save({
                          usage_mode: mode,
                          onboarding_done: true,
                          enabled_modules: modules,
                          palette,
                          theme_style: themeStyle,
                        });
                        navigate("/", { replace: true });
                      }}
                    />
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="org">Nome de exibição da organização (opcional)</Label>
                    <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={120} />
                  </div>
                </CardContent>
              </Card>
            )}


            {needsCorporate && (
              <Card className="card-elevated border-primary/40">
                <CardHeader>
                  <CardTitle className="text-base">Demanda Corporativa</CardTitle>
                  <CardDescription>
                    Descreva sua necessidade com riqueza de detalhes. O pedido vai para a caixa de demandas
                    do proprietário da aplicação, que será alertado sobre a customização.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo do responsável</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail de contato</Label>
                    <Input value={user?.email ?? ""} readOnly disabled />
                  </div>
                  <PhoneField value={phone} onChange={setPhone} />
                  <div className="space-y-2">
                    <Label htmlFor="demanda">Detalhe a demanda</Label>
                    <Textarea
                      id="demanda"
                      rows={6}
                      maxLength={4000}
                      value={demanda}
                      onChange={(e) => setDemanda(e.target.value)}
                      placeholder="Processos, volumes, integrações, perfis de acesso, relatórios necessários..."
                    />
                    <p className="text-xs text-muted-foreground">{demanda.trim().length}/20 caracteres mínimos</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button disabled={!canFinish || saving} onClick={finish}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Concluir configuração
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
