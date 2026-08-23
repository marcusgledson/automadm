import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Mail, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  onDone: () => void;
}

/** Primeiro acesso: troca obrigatória da senha padrão com confirmação do e-mail cadastrado. */
export default function ForcePasswordChange({ onDone }: Props) {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const registered = (user?.email ?? "").toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() !== registered) {
      toast.error("O e-mail informado não confere com o e-mail cadastrado.");
      return;
    }
    if (password.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { error: pe } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", user!.id);
    if (pe) {
      setBusy(false);
      toast.error("Senha alterada, mas não foi possível concluir o registro: " + pe.message);
      return;
    }
    await supabase.functions.invoke("manage-org-users", { body: { action: "self_password_changed" } });
    setBusy(false);
    toast.success("Senha atualizada com sucesso.");
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center app-surface p-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-primary" /> Troca de senha obrigatória
          </CardTitle>
          <CardDescription>
            Seu acesso foi criado com uma senha temporária de uso único. Para continuar, confirme o e-mail
            cadastrado e defina uma nova senha pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-email">Confirme seu e-mail cadastrado</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fp-email"
                  type="email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={registered}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-pass">Nova senha</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fp-pass"
                  type="password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-confirm">Repita a nova senha</Label>
              <Input
                id="fp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()} disabled={busy}>
              Sair da conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
