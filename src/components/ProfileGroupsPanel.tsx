import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/hooks/useAppSettings";
import { ROLE_DESCRIPTION, ROLE_LABEL, type AppRole } from "@/hooks/useUserRole";
import { useRoleModules } from "@/hooks/useRoleModules";
import type { OrgUser } from "@/hooks/useOrgUsers";

const ROLES: AppRole[] = ["master", "operador", "colaborador", "leitor"];

interface Props {
  users: OrgUser[];
  /** Aplica o grupo (perfil + módulos padrão) ao usuário. */
  onAssign: (userId: string, role: AppRole, modules: string[]) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Grupos de Perfis: módulos padrão por perfil e associação direta dos usuários ao grupo.
 * Disponível apenas nos modos co-participativo e corporativo.
 */
export default function ProfileGroupsPanel({ users, onAssign }: Props) {
  const { modulesFor, setModules, loading } = useRoleModules(true);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (role: AppRole, moduleId: string) => {
    const current = modulesFor(role);
    const next = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId];
    const res = await setModules(role, next);
    if (!res.ok) toast.error(res.error ?? "Falha ao salvar o grupo.");
  };

  const assign = async (user: OrgUser, role: AppRole) => {
    setBusy(user.user_id);
    const res = await onAssign(user.user_id, role, modulesFor(role));
    setBusy(null);
    if (res.ok) toast.success(`${user.full_name || user.email} associado ao grupo ${ROLE_LABEL[role]}.`);
    else toast.error(res.error ?? "Falha ao associar o usuário.");
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" /> Grupos de Perfis
        </CardTitle>
        <CardDescription>
          Defina os módulos padrão de cada perfil e associe os usuários diretamente ao grupo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          ROLES.map((r) => {
            const mods = modulesFor(r);
            const members = users.filter((u) => u.role === r);
            return (
              <div key={r} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{ROLE_LABEL[r]}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
                  </div>
                  <Badge variant="secondary">{members.length} usuário(s)</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={mods.includes(m.id)} onCheckedChange={() => void toggle(r, m.id)} />
                      {m.label}
                    </label>
                  ))}
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Associar usuário a este grupo</p>
                  <div className="flex flex-wrap gap-2">
                    {users
                      .filter((u) => !u.is_self && u.role !== r)
                      .map((u) => (
                        <Button
                          key={u.user_id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={busy === u.user_id}
                          onClick={() => void assign(u, r)}
                        >
                          {busy === u.user_id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          {u.full_name || u.email}
                        </Button>
                      ))}
                    {users.filter((u) => !u.is_self && u.role !== r).length === 0 && (
                      <span className="text-xs text-muted-foreground">Nenhum usuário disponível.</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
