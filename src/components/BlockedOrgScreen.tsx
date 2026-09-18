import { Ban, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  organizationName?: string | null;
  note?: string | null;
  onRefresh?: () => void;
}

/** Tela exibida quando o acesso da empresa está bloqueado pela administração. */
export default function BlockedOrgScreen({ organizationName, note, onRefresh }: Props) {
  const { signOut } = useAuth();
  return (
    <div className="app-surface flex min-h-screen items-center justify-center px-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <div className="mb-2 w-fit rounded-xl bg-destructive/12 p-2.5 text-destructive">
            <Ban className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Acesso bloqueado</CardTitle>
          <CardDescription>
            O acesso {organizationName ? `da empresa ${organizationName}` : "da sua empresa"} está
            bloqueado no momento. {note ? `Motivo informado: ${note}` : "Fale com a administração para liberar."}
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
