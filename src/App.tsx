import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Neoenergia from "./pages/Neoenergia";
import NeoenergiaAnalytics from "./pages/NeoenergiaAnalytics";
import ContasCentral from "./pages/ContasCentral";
import Investimentos from "./pages/Investimentos";
import NotFound from "./pages/NotFound";
import FAQ from "./pages/FAQ";
import SmsConfig from "./pages/SmsConfig";
import SmsReview from "./pages/SmsReview";
import Onboarding from "./pages/Onboarding";
import Metas from "./pages/Metas";
import Usuarios from "./pages/Usuarios";
import { Loader2 } from "lucide-react";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useMobileFullscreen } from "@/hooks/useMobileFullscreen";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useProfile } from "@/hooks/useProfile";
import BiometricLockScreen from "@/components/BiometricLockScreen";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import ModuleGuard from "@/components/ModuleGuard";
import AppearanceProvider, { useAppearanceReady } from "@/components/AppearanceProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const queryClient = new QueryClient();

/** Falha cedo e com mensagem clara se o AppearanceProvider não estiver registrado. */
function RequireAppearance({ children }: { children: React.ReactNode }) {
  const ready = useAppearanceReady();
  if (!ready) {
    throw new Error(
      "AppearanceProvider não está registrado acima das rotas protegidas. Recarregue a página.",
    );
  }
  return <>{children}</>;
}

/** Redireciona para a apresentação inicial enquanto o modo de uso não for escolhido. */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useAppSettings();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!settings?.onboarding_done) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Cadastro associado a uma empresa e ainda não aprovado pelo Máster. */
function ApprovalGate({ children }: { children: React.ReactNode }) {
  const { isPending, organization, loading, refresh } = useOrganization();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isPending)
    return (
      <PendingApprovalScreen
        organizationName={organization?.razao_social ?? null}
        onRefresh={() => void refresh()}
      />
    );
  return <>{children}</>;
}

/** Primeiro acesso com a senha padrão: exige a troca antes de liberar o app. */
function PasswordGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, refresh } = useProfile();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (profile?.must_change_password)
    return (
      <ForcePasswordChange
        expiresAt={profile.temp_password_expires_at}
        onDone={() => void refresh()}
      />
    );
  return <>{children}</>;
}


function ProtectedRoute({ children, skipOnboarding }: { children: React.ReactNode; skipOnboarding?: boolean }) {
  const { user, loading } = useAuth();
  useIdleLogout(15 * 60 * 1000);
  const { noticeOpen, dismissNotice } = useMobileFullscreen();
  const {
    locked,
    checking,
    unlock,
    unlockWithPin,
    enabled: bioEnabled,
    pinEnabled,
    lockoutSeconds,
    attemptsLeft,
    verifyForPinReset,
    definePin,
  } = useBiometricLock();

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (locked)
    return (
      <BiometricLockScreen
        onUnlock={unlock}
        onUnlockWithPin={unlockWithPin}
        biometricEnabled={bioEnabled}
        pinEnabled={pinEnabled}
        lockoutSeconds={lockoutSeconds}
        attemptsLeft={attemptsLeft}
        onVerifyForPinReset={verifyForPinReset}
        onDefinePin={definePin}
      />
    );
  return (
    <>
      <RequireAppearance>
        <PasswordGate>{skipOnboarding ? children : <OnboardingGate>{children}</OnboardingGate>}</PasswordGate>
      </RequireAppearance>
      <AlertDialog open={noticeOpen} onOpenChange={(v) => !v && dismissNotice()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modo tela cheia ativado</AlertDialogTitle>
            <AlertDialogDescription>
              Em dispositivos móveis, o aplicativo abre em tela cheia para uma melhor experiência.
              Você pode sair da tela cheia a qualquer momento pelo menu do usuário (canto superior direito),
              na opção <strong>Restaurar tela</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissNotice}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppearanceProvider>
        <BrowserRouter>

          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute skipOnboarding>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/metas"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="metas">
                    <Metas />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/extrato"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="extrato">
                    <Index />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/neoenergia"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="energia">
                    <Neoenergia />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/neoenergia/analytics"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="energia">
                    <NeoenergiaAnalytics />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="contas">
                    <ContasCentral />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/investimentos"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="investimentos">
                    <Investimentos />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/faq"
              element={
                <ProtectedRoute>
                  <FAQ />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sms/config"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="sms">
                    <SmsConfig />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sms/revisao"
              element={
                <ProtectedRoute>
                  <ModuleGuard module="sms">
                    <SmsReview />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </AppearanceProvider>
      </AuthProvider>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;