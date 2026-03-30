import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, ArrowLeft, Minimize2, Maximize2, X, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Neoenergia() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

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

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleConsultar = async () => {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      toast.error("CPF inválido. Informe os 11 dígitos.");
      return;
    }
    if (!senha.trim()) {
      toast.error("Informe a senha do portal Neoenergia.");
      return;
    }

    setLoading(true);
    // Simulação — integração real requer scraping do portal
    setTimeout(() => {
      setLoading(false);
      toast.warning(
        "Funcionalidade em desenvolvimento. A Neoenergia não disponibiliza API pública para download de faturas. Esta integração requer engenharia reversa do portal do cliente.",
        { duration: 8000 }
      );
    }, 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Title bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Zap className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">Faturas Neoenergia</span>
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
        <div className="w-full max-w-md space-y-4 opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <Alert className="border-accent/30 bg-accent/5">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Aviso:</strong> A Neoenergia não disponibiliza API pública. Esta funcionalidade utiliza
              acesso ao portal do cliente e pode apresentar instabilidades. Suas credenciais são usadas
              apenas para consulta e não são armazenadas.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-accent" />
                Consultar Faturas
              </CardTitle>
              <CardDescription>
                Informe suas credenciais do portal Neoenergia para consultar faturas disponíveis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF / CNPJ</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  maxLength={14}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Senha do portal"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleConsultar}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Consultar Faturas
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
