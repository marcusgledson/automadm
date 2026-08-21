import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, KeyRound, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserMenu from "@/components/UserMenu";
import PhoneField, { type PhoneValue } from "@/components/PhoneField";
import { MODULES } from "@/hooks/useAppSettings";
import { ROLE_DESCRIPTION, ROLE_LABEL, useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useOrgUsers, type OrgUser } from "@/hooks/useOrgUsers";

const ROLES: AppRole[] = ["master", "operador", "colaborador", "leitor"];
const EMPTY_PHONE: PhoneValue = { country: "+55", area: "", number: "", whatsapp: false };

export default function Usuarios() {
  const navigate = useNavigate();
  const { isMaster, loading: roleLoading } = useUserRole();
  const { users, loading, error, createUser, updateUser, deleteUser, resetPassword } = useOrgUsers(isMaster);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("leitor");
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE);
  const [modules, setModules] = useState<string[]>(MODULES.map((m) => m.id));
  const [toDelete, setToDelete] = useState<OrgUser | null>(null);

  const sorted = useMemo(
    () => [...users].sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")),
    [users],
  );

  const toggleModule = (id: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(id) ? list.filter((m) => m !== id) : [...list, id]);

  const handleCreate = async () => {
    if (!email.trim()) {
      toast.error("Informe o e-mail do usuário.");
      return;
    }
    setSaving(true);
    const res = await createUser({
      email: email.trim(),
      full_name: fullName.trim(),
      role,
      phone_country_code: phone.country,
      phone_area_code: phone.area,
      phone_number: phone.number,
      phone_is_whatsapp: phone.whatsapp,
      allowed_modules: modules,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível criar o usuário.");
      return;
    }
    toast.success("Usuário criado. Senha inicial: senha1010 (troca obrigatória no 1º acesso).");
    setOpen(false);
    setEmail("");
    setFullName("");
    setRole("leitor");
    setPhone(EMPTY_PHONE);
    setModules(MODULES.map((m) => m.id));
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col app-surface">
      <header className="safe-top sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/60 bg-card/70 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <span className="truncate text-sm font-semibold">Perfis e Usuários</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tela inicial</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="safe-bottom mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-8">
        {!isMaster ? (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Acesso restrito</CardTitle>
              <CardDescription>
                Este painel é exclusivo do perfil Máster da organização. Solicite acesso ao responsável.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")}>Voltar à tela inicial</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold">
                  <Users className="h-5 w-5 text-primary" /> Perfis e Usuários
                </h1>
                <p className="text-sm text-muted-foreground">
                  Cadastre membros, defina o perfil de acesso e libere módulos individualmente.
                </p>
              </div>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" /> Novo usuário
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r) => (
                <Card key={r} className="card-elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{ROLE_LABEL[r]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {sorted.map((u) => (
                  <Card key={u.user_id} className="card-elevated">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                          <span className="truncate">{u.full_name || u.display_name || u.email}</span>
                          {u.is_self && <Badge variant="secondary">Você</Badge>}
                          {u.must_change_password && <Badge variant="outline">Troca de senha pendente</Badge>}
                        </CardTitle>
                        <CardDescription className="truncate">{u.email}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={u.role}
                          disabled={u.is_self}
                          onValueChange={async (v) => {
                            const res = await updateUser(u.user_id, { role: v as AppRole });
                            if (res.ok) toast.success("Perfil atualizado.");
                            else toast.error(res.error ?? "Falha ao atualizar perfil.");
                          }}
                        >
                          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          disabled={u.is_self}
                          onClick={async () => {
                            const res = await resetPassword(u.user_id);
                            if (res.ok) toast.success("Senha redefinida para senha1010.");
                            else toast.error(res.error ?? "Falha ao redefinir a senha.");
                          }}
                        >
                          <KeyRound className="h-4 w-4" /> Redefinir senha
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive"
                          disabled={u.is_self}
                          onClick={() => setToDelete(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Label className="text-xs text-muted-foreground">Módulos liberados</Label>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {MODULES.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={u.allowed_modules?.includes(m.id) ?? false}
                              onCheckedChange={async () => {
                                const current = u.allowed_modules ?? [];
                                const next = current.includes(m.id)
                                  ? current.filter((x) => x !== m.id)
                                  : [...current, m.id];
                                const res = await updateUser(u.user_id, { allowed_modules: next });
                                if (!res.ok) toast.error(res.error ?? "Falha ao salvar módulos.");
                              }}
                            />
                            {m.label}
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              O acesso é criado com a senha padrão <strong>senha1010</strong> e troca obrigatória no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome completo</Label>
              <Input id="novo-nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-email">E-mail</Label>
              <Input
                id="novo-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
              />
            </div>
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
            <PhoneField value={phone} onChange={setPhone} idPrefix="novo" />
            <div className="space-y-2">
              <Label>Módulos liberados</Label>
              <div className="flex flex-wrap gap-3">
                {MODULES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={modules.includes(m.id)}
                      onCheckedChange={() => toggleModule(m.id, modules, setModules)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{toDelete?.full_name || toDelete?.email}</strong> será removido definitivamente,
              junto com os dados vinculados a ele. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                const res = await deleteUser(toDelete.user_id);
                setToDelete(null);
                if (res.ok) toast.success("Usuário excluído.");
                else toast.error(res.error ?? "Falha ao excluir usuário.");
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
