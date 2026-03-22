import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle } from "lucide-react";

export default function Index() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-lg font-semibold text-foreground">Meu App</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-4 w-4" />
              {user?.email}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="active:scale-[0.97]">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-16">
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <h1
            className="text-4xl font-bold tracking-tight text-foreground"
            style={{ lineHeight: "1.1" }}
          >
            Bem-vindo de volta
          </h1>
          <p className="mt-3 text-lg text-muted-foreground" style={{ textWrap: "pretty" }}>
            Você está conectado e pronto para começar. Construa algo incrível.
          </p>
        </div>
      </main>
    </div>
  );
}
