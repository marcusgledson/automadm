import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Zap, LogOut, Minimize2, Maximize2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (confirm("Deseja realmente sair do aplicativo?")) {
      signOut();
    }
  }, [signOut]);

  const modules = [
    {
      title: "Análise de Extrato",
      description: "Importe arquivos OFX e analise seus extratos bancários com filtros, resumos e exportação.",
      icon: FileSpreadsheet,
      path: "/extrato",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Faturas Neoenergia",
      description: "Consulte e baixe suas faturas de energia elétrica da Neoenergia.",
      icon: Zap,
      path: "/neoenergia",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Title bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Painel Financeiro</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-3 flex items-center gap-2 text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Aplicativo minimizado")} title="Minimizar">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title={isFullscreen ? "Restaurar" : "Maximizar"}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground" onClick={handleClose} title="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-8">
          <div className="text-center space-y-2 opacity-0 animate-fade-up" style={{ animationDelay: "50ms" }}>
            <h1 className="text-3xl font-bold text-foreground">Bem-vindo ao Painel Financeiro</h1>
            <p className="text-muted-foreground">Selecione um módulo para começar</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((mod, i) => (
              <Card
                key={mod.path}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] opacity-0 animate-fade-up"
                style={{ animationDelay: `${150 + i * 100}ms` }}
                onClick={() => navigate(mod.path)}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={`rounded-lg p-3 ${mod.bgColor}`}>
                    <mod.icon className={`h-6 w-6 ${mod.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{mod.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{mod.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
