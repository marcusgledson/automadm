import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserRoundCog, SlidersHorizontal } from "lucide-react";
import ProfileUpdatePanel from "@/components/ProfileUpdatePanel";
import ModulePermissionsPanel from "@/components/ModulePermissionsPanel";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Minhas Informações — dados do perfil e, para o Máster, permissões de módulos. */
export default function MyInfoDialog({ open, onOpenChange }: Props) {
  const { isMaster } = useUserRole();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5" /> Minhas Informações
          </DialogTitle>
          <DialogDescription>
            Revise seus dados e use <strong>Atualiza Informações!</strong> — mostramos exatamente o que mudou
            antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="perfil">
          <TabsList className={isMaster ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            {isMaster && (
              <TabsTrigger value="modulos" className="gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Permissões de Módulos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="perfil" className="max-h-[65vh] overflow-y-auto pr-1">
            <ProfileUpdatePanel />
          </TabsContent>

          {isMaster && (
            <TabsContent value="modulos" className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                Habilite ou desabilite módulos por perfil de acesso ou individualmente por usuário.
              </p>
              <ModulePermissionsPanel />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
