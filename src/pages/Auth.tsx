import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User } from "lucide-react";
import FinanceHero from "@/components/FinanceHero";
import { lovable } from "@/integrations/lovable";
import PinLogin from "@/components/PinLogin";
import { listPinUsers, type PinUser } from "@/lib/pinLock";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { traduzirErroAuth } from "@/lib/authErrors";
import { SENHA_MAX, SENHA_MIN, validarSenha } from "@/lib/password";



function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Falha ao entrar com Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
  };
  return (
    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 16.3 4.5 9.6 8.9 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 43.5c5.1 0 9.6-1.9 13-5.1l-6-5.1c-1.9 1.3-4.3 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.4 39 16.1 43.5 24 43.5z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6 5.1c3.5-3.2 6-7.9 6-14.3 0-1.2-.1-2.3-.4-4z"/>
        </svg>
      )}
      Continuar com Google
    </Button>
  );
}

export default function Auth() {
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [pinUser, setPinUser] = useState<PinUser | null>(() => listPinUsers()[0] ?? null);
  const [forgotOpen, setForgotOpen] = useState(false);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center auth-gradient">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;


  return (
    <div className="flex min-h-screen items-center justify-center auth-gradient px-4 py-8">
      <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-2">
        <FinanceHero priority className="hidden aspect-[4/3] md:block" />
        <div
          className="w-full max-w-[400px] justify-self-center opacity-0 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-bold tracking-tight text-foreground"
            style={{ lineHeight: "1.1" }}
          >
            {pinUser ? "Acesso rápido" : isSignUp ? "Criar conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {pinUser
              ? "Use seu PIN para entrar neste aparelho"
              : isSignUp
                ? "Cadastre-se para começar"
                : "Entre na sua conta"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg shadow-foreground/[0.03]">
          {pinUser ? (
            <PinLogin pinUser={pinUser} onUseEmail={() => setPinUser(null)} />
          ) : (
            <>
              <GoogleButton />
              <div className="my-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou continue com e-mail</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {isSignUp ? <SignUpForm /> : <SignInForm />}
            </>
          )}
        </div>

        {!pinUser && (
          <>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignUp ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
              >
                {isSignUp ? "Entrar" : "Cadastrar"}
              </button>
            </p>
            {!isSignUp && (
              <p className="mt-2 text-center text-sm">
                <button
                  onClick={() => setForgotOpen(true)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Esqueci a senha
                </button>
              </p>
            )}
            <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
          </>
        )}


        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(traduzirErroAuth(error));
    }
    setSubmitting(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="voce@exemplo.com"
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="pl-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={SENHA_MIN}
              maxLength={SENHA_MAX}
            />
          </div>
        </div>
        <Button type="submit" className="w-full active:scale-[0.97]" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Entrar
        </Button>
      </form>
    </>
  );
}



function SignUpForm() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailDivergente = !!confirmEmail && confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  const senhaDivergente = !!confirmPassword && confirmPassword !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailDivergente) return toast.error("A confirmação do e-mail não confere.");
    const erroSenha = validarSenha(password);
    if (erroSenha) return toast.error(erroSenha);
    if (senhaDivergente) return toast.error("A confirmação da senha não confere.");

    setSubmitting(true);
    const { error } = await signUp(email, password, displayName || undefined);
    if (error) {
      toast.error(traduzirErroAuth(error));
    } else {
      toast.success("Cadastro criado. Verifique seu e-mail para confirmar sua conta.");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display-name">Nome de exibição</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="display-name"
            type="text"
            placeholder="Seu nome"
            className="pl-10"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-email"
            type="email"
            placeholder="voce@exemplo.com"
            className="pl-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email-confirm">Confirmar e-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-email-confirm"
            type="email"
            placeholder="repita seu e-mail"
            className="pl-10"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            required
          />
        </div>
        {emailDivergente && <p className="text-xs text-destructive">Os e-mails não conferem.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-password"
            type="password"
            placeholder="••••••••"
            className="pl-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={SENHA_MIN}
            maxLength={SENHA_MAX}
          />
        </div>
        <PasswordStrengthMeter value={password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password-confirm">Confirmar senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-password-confirm"
            type="password"
            placeholder="••••••••"
            className="pl-10"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={SENHA_MIN}
            maxLength={SENHA_MAX}
          />
        </div>
        {senhaDivergente && <p className="text-xs text-destructive">As senhas não conferem.</p>}
      </div>
      <Button type="submit" className="w-full active:scale-[0.97]" disabled={submitting}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Criar conta
      </Button>
    </form>
  );
}

