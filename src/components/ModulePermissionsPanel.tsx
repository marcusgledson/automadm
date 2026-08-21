import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MODULES } from "@/hooks/useAppSettings";
import { ROLE_LABEL, useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useRoleModules } from "@/hooks/useRoleModules";
import { useOrgUsers } from "@/hooks/useOrgUsers";

const ROLES: AppRole[] = ["master", "operador", "colaborador", "leitor"];

/** Habilita/desabilita módulos por perfil ou por usuário (somente Máster). */
export default function ModulePermissionsPanel() {
  const { isMaster, loading: roleLoading } = useUserRole();
  const { modulesFor, setModules, loading: rmLoading } = useRoleModules(isMaster);
  const { users, loading: usersLoading, updateUser } = useOrgUsers(isMaster);
  const [busy, setBusy] = useState<string | null>(null);

  if (roleLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!isMaster) {
    return (
      <p className="text-xs text-muted-foreground">
        Somente o perfil Máster da organização pode habilitar ou desabilitar módulos.
      </p>
    );
  }

  return (
    <Tabs defaultValue="perfil">
      <TabsList className="w-full">
        <TabsTrigger value="perfil" className="flex-1">
          Por perfil
        </TabsTrigger>
        <TabsTrigger value="usuario" className="flex-1">
          Por usuário
        </TabsTrigger>
      </TabsList>

      <TabsContent value="perfil" className="space-y-3 pt-3">
        {rmLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          ROLES.map((r) => {
            const current = modulesFor(r);
            return (
              <div key={r} className="rounded-md border border-border/60 p-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" /> {ROLE_LABEL[r]}
                </Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={current.includes(m.id)}
                        disabled={busy === `${r}-${m.id}`}
                        onCheckedChange={async () => {
                          const next = current.includes(m.id)
                            ? current.filter((x) => x !== m.id)
                            : [...current, m.id];
                          setBusy(`${r}-${m.id}`);
                          const res = await setModules(r, next);
                          setBusy(null);
                          if (!res.ok) toast.error(res.error ?? "Falha ao salvar permissões.");
                        }}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="usuario" className="space-y-3 pt-3">
        {usersLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum usuário disponível para configuração.</p>
        ) : (
          users.map((u) => {
            const current = u.allowed_modules ?? [];
            return (
              <div key={u.user_id} className="rounded-md border border-border/60 p-3">
                <Label className="text-sm font-semibold">{u.full_name || u.email}</Label>
                <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[u.role]}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={current.includes(m.id)}
                        onCheckedChange={async () => {
                          const next = current.includes(m.id)
                            ? current.filter((x) => x !== m.id)
                            : [...current, m.id];
                          const res = await updateUser(u.user_id, { allowed_modules: next });
                          if (!res.ok) toast.error(res.error ?? "Falha ao salvar permissões.");
                        }}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </TabsContent>
    </Tabs>
  );
}
