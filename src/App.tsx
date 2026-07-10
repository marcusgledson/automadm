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
import NotFound from "./pages/NotFound";
import FAQ from "./pages/FAQ";
import { Loader2 } from "lucide-react";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useMobileFullscreen } from "@/hooks/useMobileFullscreen";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useIdleLogout(15 * 60 * 1000);
  const { noticeOpen, dismissNotice } = useMobileFullscreen();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return (
    <>
      {children}
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
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/neoenergia"
              element={
                <ProtectedRoute>
                  <Neoenergia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/neoenergia/analytics"
              element={
                <ProtectedRoute>
                  <NeoenergiaAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas"
              element={
                <ProtectedRoute>
                  <ContasCentral />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;