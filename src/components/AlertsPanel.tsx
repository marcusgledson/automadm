import { useNavigate } from "react-router-dom";
import { AlertTriangle, BellRing, ChevronRight, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlerts, type AlertSeverity } from "@/hooks/useAlerts";

const STYLES: Record<AlertSeverity, { card: string; icon: string; badge: "destructive" | "secondary" | "outline" }> = {
  critical: { card: "border-destructive/60 bg-destructive/5", icon: "text-destructive", badge: "destructive" },
  warning: { card: "border-amber-500/50 bg-amber-500/5", icon: "text-amber-600 dark:text-amber-400", badge: "secondary" },
  info: { card: "border-border/60", icon: "text-muted-foreground", badge: "outline" },
};

/** Bloco de alertas e pendências exibido no topo do painel inicial. */
export default function AlertsPanel() {
  const navigate = useNavigate();
  const { alerts, loading } = useAlerts();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando pendências...
      </div>
    );
  }

  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3 opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold">Alertas e pendências</h2>
        <Badge variant="outline">{alerts.length}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((a) => {
          const s = STYLES[a.severity];
          const Icon = a.severity === "info" ? Info : AlertTriangle;
          return (
            <Card key={a.id} className={`card-elevated ${s.card}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${s.icon}`} />
                  <CardTitle className="truncate text-sm">{a.title}</CardTitle>
                </div>
                <Badge variant={s.badge}>{a.count}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{a.description}</p>
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => navigate(a.path)}>
                  {a.actionLabel}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
