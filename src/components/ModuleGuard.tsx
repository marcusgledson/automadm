import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULES } from "@/hooks/useAppSettings";
import { useModuleAccess } from "@/hooks/useModuleAccess";

interface Props {
  module: string;
  children: React.ReactNode;
}

/** Bloqueia o módulo quando o usuário não tem permissão, com mensagem clara. */
export default function ModuleGuard({ module, children }: Props) {
  const navigate = useNavigate();
  const { canAccess, loading } = useModuleAccess();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (canAccess(module)) return <>{children}</>;

  const label = MODULES.find((m) => m.id === module)?.label ?? "este módulo";

  return (
    <div className="flex min-h-screen items-center justify-center app-surface p-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5 text-destructive" /> Acesso não liberado
          </CardTitle>
          <CardDescription>
            Você não tem permissão para acessar <strong>{label}</strong>. Peça ao perfil Máster da sua organização
            para liberar este módulo no Menu Gerencial &gt; Permissões de módulos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => navigate("/")}>Ir para a tela inicial</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
