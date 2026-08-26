import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroAuth } from "@/lib/authErrors";
import { validarSenha, SENHA_MAX, SENHA_MIN } from "@/lib/password";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Página pública de redefinição de senha (link de recuperação por e-mail). */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPronto(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setPronto(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const erro = validarSenha(senha);
    if (erro) return toast.error(erro);
    if (senha !== confirma) return toast.error("A confirmação da senha não confere.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) return toast.error(traduzirErroAuth(error));
    toast.success("Senha redefinida com sucesso.");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center auth-gradient p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-primary" /> Redefinir senha
          </CardTitle>
          <CardDescription>
            {pronto
              ? `Escolha uma nova senha de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`
              : "Abra esta página pelo link enviado ao seu e-mail para redefinir a senha."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rp-senha">Nova senha</Label>
              <Input
                id="rp-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                maxLength={SENHA_MAX}
                required
                disabled={!pronto}
              />
              <PasswordStrengthMeter value={senha} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-confirma">Confirmar nova senha</Label>
              <Input
                id="rp-confirma"
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                maxLength={SENHA_MAX}
                required
                disabled={!pronto}
              />
              {confirma && confirma !== senha && (
                <p className="text-xs text-destructive">As senhas não conferem.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={busy || !pronto}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
              Voltar para o login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
