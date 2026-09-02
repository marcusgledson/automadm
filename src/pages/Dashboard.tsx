import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Receipt, TrendingUp, Sparkles, HelpCircle, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import UserMenu from "@/components/UserMenu";
import ThemedHero from "@/components/ThemedHero";
import { useThemeIcon } from "@/hooks/useThemeIcon";
import HelpDialog from "@/components/HelpDialog";
import { useModuleAccess } from "@/hooks/useModuleAccess";

export default function Dashboard() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const { canAccess } = useModuleAccess();
  const themeIcon = useThemeIcon();

  const modules = [
    {
      id: "extrato",
      title: "Análise de Extrato Bancário",
      description: "Importe OFX, analise transações e salve seu extrato bancário na base por agência e conta.",
      icon: themeIcon("extrato", FileSpreadsheet),
      path: "/extrato",
      gradient: "from-primary/15 to-primary/0",
      iconBg: "bg-primary/12 text-primary",
    },
    {
      id: "contas",
      title: "Central de Contas e Despesas",
      description: "Energia, Internet, Água, IPTU, IPVA, Taxas, Boletos. Carregue arquivos ou lance manualmente — inclui as Faturas de Energia.",
      icon: themeIcon("contas", Receipt),
      path: "/contas",
      gradient: "from-emerald-500/15 to-emerald-500/0",
      iconBg: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "investimentos",
      title: "Meus Investimentos",
      description: "Importe extratos de investimentos e entenda taxas, carência, resgate e rentabilidade em linguagem simples.",
      icon: themeIcon("investimentos", TrendingUp),
      path: "/investimentos",
      gradient: "from-amber-500/15 to-amber-500/0",
      iconBg: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    },
    {
      id: "metas",
      title: "Metas e Orçamento",
      description: "Defina objetivo de economia e prazo por modalidade de consumo e receba alerta quando o custo real ultrapassar o orçado.",
      icon: themeIcon("metas", Target),
      path: "/metas",
      gradient: "from-sky-500/15 to-sky-500/0",
      iconBg: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    },
  ].filter((m) => canAccess(m.id));

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display truncate text-sm font-semibold text-foreground">Painel Financeiro</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Ajuda</span>
          </Button>
          <UserMenu />
        </div>
      </header>



      <main className="safe-bottom flex flex-1 items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl space-y-6 sm:space-y-10">
          <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3 text-center md:text-left opacity-0 animate-fade-up" style={{ animationDelay: "50ms" }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Sparkles className="h-3 w-3 text-accent" /> Edição moderna · pronto para mobile
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight gradient-text sm:text-4xl">Bem-vindo ao Painel Financeiro</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Escolha um módulo para começar</p>
            </div>
            <ThemedHero editable className="aspect-[4/3] w-full max-w-md justify-self-center md:justify-self-end" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod, i) => (
              <Card
                key={mod.path}
                onClick={() => navigate(mod.path)}
                className={`card-elevated group relative cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl opacity-0 animate-fade-up bg-gradient-to-br ${mod.gradient}`}
                style={{ animationDelay: `${150 + i * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`rounded-xl p-3 ${mod.iconBg} transition-transform group-hover:scale-110`}>
                    <mod.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="font-display text-base sm:text-lg leading-tight">{mod.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{mod.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

