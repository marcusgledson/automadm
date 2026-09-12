import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import FinanceHero from "@/components/FinanceHero";
import {
  LogIn,
  LayoutDashboard,
  FileSpreadsheet,
  FolderOpen,
  Landmark,
  PencilLine,
  Database,
  CheckCircle2,
  LogOut,
  Lightbulb,
  Zap,
  Receipt,
  Download,
  FileText,
  BookOpen,
  ArrowRight,
  Leaf,
  Loader2,
  TrendingUp,
  Target,
  ShieldCheck,
  Search,
} from "lucide-react";

const MANUAL_UPDATED = "Setembro de 2026";
const MANUAL_URL = "/manual-do-usuario.pdf?v=2026-09";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = {
  id: string;
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
  tip?: string;
  jumpTo?: { label: string; path: string };
};

const steps: Step[] = [
  {
    id: "login",
    icon: LogIn,
    title: "1. Fazer login",
    body: (
      <>
        Acesse a tela inicial e informe seu <strong>e-mail</strong> e <strong>senha</strong>.
        Se ainda não tiver conta, use a aba <em>Cadastrar</em> para criar uma nova.
      </>
    ),
    tip: "Após 15 minutos sem atividade, o sistema encerra a sessão automaticamente por segurança.",
  },
  {
    id: "painel",
    icon: LayoutDashboard,
    title: "2. Escolher o módulo no Painel",
    body: (
      <>
        No painel principal você verá os módulos disponíveis:
        <ul className="mt-2 space-y-1 pl-4">
          <li className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> <strong>Análise de Extrato Bancário</strong> — importar, revisar e consultar extratos.</li>
          <li className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-accent" /> <strong>Central de Contas e Despesas</strong> — contas, boletos e faturas de energia.</li>
          <li className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-primary" /> <strong>Meus Investimentos</strong> — importar ou incluir aplicações manualmente.</li>
          <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-accent" /> <strong>Metas e Orçamento</strong> — acompanhar limites e alertas de custo.</li>
        </ul>
      </>
    ),
    jumpTo: { label: "Ir para o Painel", path: "/" },
  },
  {
    id: "ofx",
    icon: FolderOpen,
    title: "3. Analisar um extrato",
    body: (
      <>
        Na aba <strong>Analisar arquivo</strong> do módulo de Extrato, você pode:
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          <li>Carregar arquivos <code>.ofx</code> ou <code>.pdf</code> do dispositivo;</li>
          <li>Buscar arquivos OFX em uma pasta pública do <strong>Google Drive</strong>;</li>
          <li>Escolher o modo <strong>Apenas leitura</strong> ou <strong>Gravação</strong>.</li>
        </ul>
      </>
    ),
    tip: "Se o download do Drive travar, use o botão Cancelar e Tentar novamente.",
    jumpTo: { label: "Abrir Análise de Extrato", path: "/extrato" },
  },
  {
    id: "conta",
    icon: Landmark,
    title: "4. Confirmar Agência e Conta",
    body: (
      <>
        O sistema detecta automaticamente <strong>Banco, Agência e Conta</strong> do OFX.
        Quando o arquivo contém <strong>mais de uma conta</strong>, uma pré-visualização permite
        escolher qual bloco importar. Se faltarem dados, você pode informá-los manualmente.
      </>
    ),
    jumpTo: { label: "Ir para importação", path: "/extrato" },
  },
  {
    id: "revisar",
    icon: PencilLine,
    title: "5. Revisar e editar lançamentos",
    body: (
      <>
        Antes de salvar, clique em <strong>Revisar / Editar</strong> para:
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          <li>Ajustar <strong>descrição</strong> e <strong>categoria</strong>;</li>
          <li>Marcar linhas para <strong>ignorar</strong> na importação;</li>
          <li>Conferir valores e datas.</li>
        </ul>
      </>
    ),
    jumpTo: { label: "Ir para revisão", path: "/extrato" },
  },
  {
    id: "salvar",
    icon: Database,
    title: "6. Gravar e consultar extratos",
    body: (
      <>
        No modo <strong>Gravação</strong>, confirme banco, agência, conta, titular e documento antes de salvar.
        Use a aba <strong>Consultar base</strong> para filtrar os lançamentos por banco, conta,
        titular ou período e exportar o resultado. Débitos também podem alimentar a Central de Despesas.
      </>
    ),
    jumpTo: { label: "Ir para salvamento", path: "/extrato" },
  },
  {
    id: "resumo",
    icon: CheckCircle2,
    title: "7. Importar contas e boletos",
    body: (
      <>
        Na <strong>Central de Contas e Despesas</strong>, carregue PDFs de contas, tributos e boletos,
        ou faça um lançamento manual. Revise os campos encontrados antes de confirmar. Em Faturas de
        Energia, cada PDF protegido é validado separadamente e o status aparece por arquivo.
      </>
    ),
    jumpTo: { label: "Ver Central de Contas", path: "/contas" },
  },
  {
    id: "investimentos",
    icon: TrendingUp,
    title: "8. Registrar investimentos",
    body: (
      <>
        Em <strong>Meus Investimentos</strong>, carregue um extrato em PDF, TXT ou CSV. Quando houver
        vários investimentos, marque quais deseja salvar. Também é possível usar <strong>Inclusão manual</strong>.
        Abra um item salvo para entender taxa, liquidez, carência, impostos e rendimento em linguagem simples.
      </>
    ),
    jumpTo: { label: "Abrir Meus Investimentos", path: "/investimentos" },
  },
  {
    id: "metas",
    icon: Target,
    title: "9. Acompanhar metas e orçamento",
    body: (
      <>
        Defina o valor planejado, a economia desejada e o prazo no módulo <strong>Metas e Orçamento</strong>.
        O painel compara o custo realizado com o limite e avisa quando o orçamento é ultrapassado.
      </>
    ),
    jumpTo: { label: "Abrir Metas e Orçamento", path: "/metas" },
  },
  {
    id: "seguranca",
    icon: ShieldCheck,
    title: "10. Segurança, PIN e perfil",
    body: (
      <>
        Pelo menu do usuário, atualize seus dados, aparência e opções de segurança. Quando configurados,
        PIN ou biometria desbloqueiam o aplicativo sem pedir novamente o e-mail. Use <strong>Sair da conta</strong>
        ao terminar em um aparelho compartilhado.
      </>
    ),
    tip: "Nunca compartilhe senha, PIN ou arquivos financeiros por mensagens.",
  },
  {
    id: "links",
    icon: Search,
    title: "11. Links e arquivos salvos",
    body: (
      <>
        Os links do Google Drive são separados por módulo e tipo de arquivo. Assim, pastas de PDFs de contas
        aparecem apenas no importador de contas, enquanto pastas de OFX ficam no módulo de Extrato.
      </>
    ),
  },
  {
    id: "sair",
    icon: LogOut,
    title: "12. Sair com segurança",
    body: (
      <>
        No menu de usuário (canto superior direito), use <strong>Sair da conta</strong> para
        encerrar a sessão. Em dispositivos móveis, é possível também restaurar a tela cheia
        pelo mesmo menu.
      </>
    ),
  },
];

type ViewId = "guia" | "pdf" | "downloads";

export default function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewId>("guia");
  const [activeStep, setActiveStep] = useState<string>(steps[0].id);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  const jump = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  // Preload PDF in background as soon as dialog opens (fetches into browser cache).
  useMemo(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = MANUAL_URL;
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch { /* noop */ }
    };
  }, [open]);

  const currentStep = steps.find((s) => s.id === activeStep) ?? steps[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 sm:h-[80vh] h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2 text-primary">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                Ajuda &amp; Manual do Usuário
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                 Guia passo a passo e manual em PDF · Atualizado em {MANUAL_UPDATED}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
          {/* Left sidebar (tabs à esquerda) */}
          <aside className="shrink-0 border-b border-border/60 bg-muted/30 sm:w-64 sm:border-b-0 sm:border-r">
            <div className="hidden sm:block px-3 pt-3">
              <FinanceHero className="aspect-[4/3] w-full" />
            </div>
            <nav className="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:overflow-visible sm:p-3">
              <SideButton
                icon={Lightbulb}
                label="Passo a passo"
                active={activeView === "guia"}
                onClick={() => setActiveView("guia")}
              />
              <SideButton
                icon={FileText}
                label="Manual em PDF"
                active={activeView === "pdf"}
                onClick={() => {
                  setActiveView("pdf");
                  setPdfLoaded(true);
                }}
              />
              <SideButton
                icon={Download}
                label="Downloads"
                active={activeView === "downloads"}
                onClick={() => setActiveView("downloads")}
              />
              <SideButton
                icon={BookOpen}
                label="FAQ & Problemas"
                onClick={() => jump("/faq")}
              />
            </nav>
          </aside>

          {/* Right pane */}
          <section className="flex-1 min-h-0 min-w-0 flex flex-col">
            {activeView === "guia" && (
              <>
                {/* Mobile: lista completa em acordeão, com rolagem */}
                <ScrollArea className="flex-1 min-h-0 sm:hidden">
                  <Accordion type="single" collapsible defaultValue={steps[0].id} className="p-3">
                    {steps.map((s) => {
                      const Icon = s.icon;
                      return (
                        <AccordionItem key={s.id} value={s.id}>
                          <AccordionTrigger className="gap-2 py-3 text-left text-xs">
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="truncate">{s.title}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="text-sm leading-relaxed text-muted-foreground">{s.body}</div>
                            {s.tip && (
                              <div className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground/80">
                                <strong className="text-accent">Dica: </strong>
                                {s.tip}
                              </div>
                            )}
                            {s.jumpTo && (
                              <Button size="sm" className="mt-4 gap-1" onClick={() => jump(s.jumpTo!.path)}>
                                {s.jumpTo.label}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>

                {/* Desktop: lista lateral + conteúdo */}
                <div className="hidden flex-1 min-h-0 sm:flex sm:flex-row">

                {/* Steps list */}
                <div className="shrink-0 border-b border-border/60 sm:w-56 sm:border-b-0 sm:border-r">
                  <ScrollArea className="max-h-40 sm:max-h-none sm:h-full">
                    <ul className="flex sm:flex-col gap-1 p-2">
                      {steps.map((s) => {
                        const Icon = s.icon;
                        const isActive = s.id === activeStep;
                        return (
                          <li key={s.id} className="shrink-0 sm:shrink">
                            <button
                              onClick={() => setActiveStep(s.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                                isActive
                                  ? "bg-primary/15 text-primary font-medium"
                                  : "hover:bg-muted text-foreground/80"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{s.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                </div>

                {/* Step content */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-5 sm:p-6 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/15 p-2.5 text-primary">
                        <currentStep.icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{currentStep.title}</h3>
                    </div>
                    <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {currentStep.body}
                    </div>
                    {currentStep.tip && (
                      <div className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground/80">
                        <strong className="text-accent">Dica: </strong>
                        {currentStep.tip}
                      </div>
                    )}
                    {currentStep.jumpTo && (
                      <Button
                        variant="default"
                        size="sm"
                        className="mt-5 gap-1"
                        onClick={() => jump(currentStep.jumpTo!.path)}
                      >
                        {currentStep.jumpTo.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </ScrollArea>
                </div>
              </>
            )}


            {activeView === "pdf" && (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                     Manual do Usuário · {MANUAL_UPDATED}
                    {!pdfReady && (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Loader2 className="h-3 w-3 animate-spin" /> carregando…
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                       <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer">
                        Abrir em nova aba
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                       <a href={MANUAL_URL} download="manual-do-usuario-setembro-2026.pdf">
                        <Download className="h-3 w-3" /> PDF
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="relative flex-1 min-h-0 bg-muted/20">
                  {pdfLoaded ? (
                    <iframe
                      title="Manual do Usuário"
                       src={`${MANUAL_URL}#view=FitH&zoom=page-width&pagemode=none&toolbar=1`}
                      className="absolute inset-0 h-full w-full border-0"
                      loading="lazy"
                      onLoad={() => setPdfReady(true)}
                      style={{ touchAction: "pan-x pan-y pinch-zoom" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === "downloads" && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-5 sm:p-6 space-y-3 max-w-xl">
                  <h3 className="text-sm font-semibold">Materiais para download</h3>
                  <DownloadRow
                    icon={FileText}
                     title={`Manual do Usuário — ${MANUAL_UPDATED}`}
                     desc="Guia atualizado dos módulos, importações, consultas e segurança."
                     href={MANUAL_URL}
                     file="manual-do-usuario-setembro-2026.pdf"
                  />

                </div>
              </ScrollArea>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SideButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors sm:w-full sm:justify-start ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/80 hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function DownloadRow({
  icon: Icon,
  title,
  desc,
  href,
  file,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  href: string;
  file: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Button asChild size="sm" variant="outline" className="h-8 gap-1">
        <a href={href} download={file}>
          <Download className="h-3.5 w-3.5" /> Baixar
        </a>
      </Button>
    </div>
  );
}
