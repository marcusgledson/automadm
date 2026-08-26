import { useState } from "react";
import { Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppSettings, type UsageMode } from "@/hooks/useAppSettings";
import { useOrganization } from "@/hooks/useOrganization";
import { useProfile } from "@/hooks/useProfile";
import OrganizationForm from "@/components/OrganizationForm";
import { tipoInstituicaoLabel } from "@/lib/cnpj";

const MODE_LABEL: Record<UsageMode, string> = {
  pessoal: "Pessoal",
  coparticipativo: "Co-participativo",
  corporativo: "Corporativo",
};

/** Bloco de Configurações: exibe o modo de uso atual, a empresa e permite migrar de modo. */
export default function UsageModePanel() {
  const { settings, save, refresh } = useAppSettings();
  const { organization, refresh: refreshOrg } = useOrganization();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<UsageMode>("coparticipativo");

  const mode = settings?.usage_mode ?? "pessoal";

  const startMigration = (next: UsageMode) => {
    setTarget(next);
    setOpen(true);
  };

  const finishMigration = async () => {
    const res = await save({ usage_mode: target });
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível migrar o modo de uso.");
      return;
    }
    await Promise.all([refresh(), refreshOrg()]);
    toast.success(`Modo de uso alterado para ${MODE_LABEL[target]}.`);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 px-3 py-2 text-sm">
        <p>
          Modo atual: <strong>{MODE_LABEL[mode]}</strong>
        </p>
        {organization ? (
          <p className="text-xs text-muted-foreground">
            {organization.razao_social} · {tipoInstituicaoLabel(organization.tipo_instituicao)}
            {organization.cidade ? ` · ${organization.cidade}` : ""}
            {organization.uf ? `/${organization.uf}` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</p>
        )}
      </div>

      {mode === "pessoal" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Migre para um modo com múltiplos usuários. Ao informar o CNPJ, verificamos se a empresa já existe:
            se existir, é enviado um pedido de acesso ao Máster responsável.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="justify-start gap-2" onClick={() => startMigration("coparticipativo")}>
              <Users className="h-4 w-4" /> Migrar para Co-participativo
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => startMigration("corporativo")}>
              <Building2 className="h-4 w-4" /> Migrar para Corporativo
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastro da empresa</DialogTitle>
            <DialogDescription>
              Para usar o modo {MODE_LABEL[target]} é necessário vincular uma empresa ou instituição.
            </DialogDescription>
          </DialogHeader>
          <OrganizationForm
            requesterName={profile?.full_name ?? profile?.display_name ?? null}
            onDone={(r) => {
              if (r.kind === "created") void finishMigration();
              else setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
