import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Captura falhas de carregamento da árvore do app (por exemplo, um provider que
 * não foi registrado) e mostra uma mensagem amigável em vez de tela em branco.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="card-elevated w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h1 className="text-base font-semibold">Não foi possível carregar o aplicativo</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Um componente essencial de configuração visual não pôde ser iniciado. Isso costuma
            acontecer após uma atualização; recarregar a página normalmente resolve.
          </p>
          <details className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">Detalhe técnico</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
          <button
            type="button"
            onClick={this.reload}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Recarregar agora
          </button>
        </div>
      </div>
    );
  }
}
