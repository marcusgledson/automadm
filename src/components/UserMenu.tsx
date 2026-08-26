import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HelpCircle,
  LogOut,
  Maximize2,
  Minimize2,
  Settings,
  UserRound,
  UserRoundCog,
  Users,
} from "lucide-react";
import AdminPanel from "@/components/AdminPanel";
import HelpDialog from "@/components/HelpDialog";
import MyInfoDialog from "@/components/MyInfoDialog";
import { useAppSettings } from "@/hooks/useAppSettings";


export default function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isMaster } = useUserRole();
  const { settings } = useAppSettings();
  const multiUser = (settings?.usage_mode ?? "pessoal") !== "pessoal";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);


  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const handleSignOut = useCallback(() => {
    if (confirm("Deseja realmente sair da conta?")) signOut();
  }, [signOut]);

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {initials}
            </span>
            <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:inline">
              {user?.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            <span className="truncate text-xs">{user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
            {isFullscreen ? "Restaurar tela" : "Tela cheia"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Ajuda / Passo a passo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAdminOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </DropdownMenuItem>
          {isMaster && multiUser && (
            <DropdownMenuItem onClick={() => navigate("/usuarios")}>
              <Users className="mr-2 h-4 w-4" />
              Perfis e Usuários
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => setInfoOpen(true)}>
            <UserRoundCog className="mr-2 h-4 w-4" />
            Minhas Informações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <MyInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </>
  );
}
