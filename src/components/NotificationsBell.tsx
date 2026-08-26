import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODULES } from "@/hooks/useAppSettings";
import { ROLE_DESCRIPTION, ROLE_LABEL, useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useOrgRequests, type OrgRequest } from "@/hooks/useOrgRequests";

const ROLES: AppRole[] = ["master", "operador", "colaborador", "leitor"];

/** Sino de notificações do Máster: pedidos de acesso pendentes com aprovação direta. */
export default function NotificationsBell() {
  const { isMaster } = useUserRole();
  const { requests, loading, approve, reject } = useOrgRequests(isMaster);
  const [selected, setSelected] = useState<OrgRequest | null>(null);
  const [role, setRole] = useState<AppRole>("leitor");
  const [modules, setModules] = useState<string[]>(MODULES.map((m) => m.id));
  const [busy, setBusy] = useState(false);

  if (!isMaster) return null;

  const openRequest = (r: OrgRequest) => {
    setSelected(r);
    setRole(r.requested_role ?? "leitor");
    setModules(MODULES.map((m) => m.id));
  };

  const toggleModule = (id: string) =>
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleApprove = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await approve(selected.id, role, modules);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cadastro aprovado e perfil designado.");
    setSelected(null);
  };

  const handleReject = async () => {
    if (!selected) return;
    setBusy(true);
    const res = await reject(selected.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pedido recusado.");
    setSelected(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative h-8 px-2" aria-label="Notificações">
            <Bell className="h-4 w-4" />
            {requests.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {requests.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Nenhum pedido pendente.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto p-1">
              {requests.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openRequest(r)}
                  className="w-full rounded-md border border-border/60 px-2 py-2 text-left text-xs hover:bg-accent/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.requester_name || r.requester_email}</span>
                    <Badge variant="outline">Pendente</Badge>
                  </div>
                  <p className="truncate text-muted-foreground">{r.requester_email}</p>
                  <p className="text-muted-foreground">
                    Solicitado em {new Date(r.created_at).toLocaleString("pt-BR")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar cadastro</DialogTitle>
            <DialogDescription>
              Defina o perfil e os módulos liberados para{" "}
              <strong>{selected?.requester_name || selected?.requester_email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</p>
            </div>

            <div className="space-y-2">
              <Label>Módulos liberados</Label>
              <div className="flex flex-wrap gap-3">
                {MODULES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={modules.includes(m.id)} onCheckedChange={() => toggleModule(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleReject} disabled={busy}>
              Recusar
            </Button>
            <Button onClick={handleApprove} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
