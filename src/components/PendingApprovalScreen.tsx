import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  organizationName?: string | null;
  onRefresh?: () => void;
}

/** Tela informativa exibida enquanto o Máster não aprova o cadastro. */
export default function PendingApprovalScreen({ organizationName, onRefresh }: Props) {
  const { signOut } = useAuth();
  return (
    <div className="app-surface flex min-h-screen items-center justify-center px-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <div className="mb-2 w-fit rounded-xl bg-primary/12 p-2.5 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Cadastro aguardando aprovação</CardTitle>
          <CardDescription>
            Seu acesso {organizationName ? `à empresa ${organizationName}` : "à empresa informada"} foi
            solicitado e está pendente de aprovação do Máster. Assim que for liberado, o perfil e os módulos
            definidos por ele ficarão disponíveis aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="gap-2" onClick={() => onRefresh?.()}>
            <RefreshCw className="h-4 w-4" /> Verificar novamente
          </Button>
          <Button variant="ghost" className="gap-2 text-destructive" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
