import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroAuth } from "@/lib/authErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Opcoes {
  found: boolean;
  email: string | null;
  phone: string | null;
}

/** Fluxo "Esqueci a senha": consulta opções mascaradas e envia o link por e-mail. */
export default function ForgotPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [enviado, setEnviado] = useState(false);

  const reset = () => {
    setEmail("");
    setOpcoes(null);
    setEnviado(false);
  };

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("recovery-options", {
      body: { email: email.trim().toLowerCase() },
    });
    setBusy(false);
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) {
      toast.error(msg ?? traduzirErroAuth(error));
      return;
    }
    setOpcoes(data as Opcoes);
  };

  const enviarPorEmail = async () => {
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error(traduzirErroAuth(error));
      return;
    }
    setEnviado(true);
    toast.success("Enviamos um link de redefinição para o seu e-mail.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esqueci minha senha</DialogTitle>
          <DialogDescription>
            Informe o e-mail cadastrado para ver as formas disponíveis de recuperação.
          </DialogDescription>
        </DialogHeader>

        {!opcoes ? (
          <form onSubmit={consultar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fgp-email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fgp-email"
                  type="email"
                  className="pl-10"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </form>
        ) : !opcoes.found ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se houver uma conta com este e-mail, enviaremos as instruções de recuperação. Verifique
              também a caixa de spam.
            </p>
            <Button variant="outline" className="w-full" onClick={reset}>
              Tentar outro e-mail
            </Button>
          </div>
        ) : enviado ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Link enviado para <span className="font-medium text-foreground">{opcoes.email}</span>. O
              link tem validade curta e uso único.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escolha por onde deseja receber o código:</p>
            <Button className="w-full justify-start" onClick={enviarPorEmail} disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar para {opcoes.email}
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <MessageCircle className="h-4 w-4" />
              {opcoes.phone ? `WhatsApp ${opcoes.phone}` : "WhatsApp não cadastrado"} — em breve...
            </Button>
            <Button variant="ghost" className="w-full" onClick={reset}>
              Usar outro e-mail
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
