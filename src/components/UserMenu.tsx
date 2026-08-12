import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Fingerprint,
  HelpCircle,
  KeyRound,
  LogOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  ShieldCheck,
  Timer,
  UserRound,
} from "lucide-react";
import AdminPanel from "@/components/AdminPanel";
import HelpDialog from "@/components/HelpDialog";
import PinSetupDialog from "@/components/PinSetupDialog";
import PinVerifyDialog from "@/components/PinVerifyDialog";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { AUTOLOCK_OPTIONS, getAutoLockMinutes, setAutoLockMinutes } from "@/lib/autoLock";
import { toast } from "sonner";

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinResetOpen, setPinResetOpen] = useState(false);
  const [verifyRemoveOpen, setVerifyRemoveOpen] = useState(false);
  const [verifyChangeOpen, setVerifyChangeOpen] = useState(false);
  const [autoLock, setAutoLock] = useState(getAutoLockMinutes());
  const {
    available: bioAvailable,
    enabled: bioEnabled,
    pinEnabled,
    enable: bioEnable,
    disable: bioDisable,
    definePin,
    disablePinWithCurrent,
    verifyForPinReset,
    lock: bioLock,
  } = useBiometricLock();

  const toggleBiometric = useCallback(async () => {
    if (bioEnabled) {
      bioDisable();
      toast.success("Desbloqueio biométrico desativado.");
      return;
    }
    try {
      await bioEnable();
      toast.success("Desbloqueio biométrico ativado neste aparelho.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar a biometria.");
    }
  }, [bioEnabled, bioEnable, bioDisable]);

  const togglePin = useCallback(() => {
    if (pinEnabled) {
      setVerifyRemoveOpen(true);
      return;
    }
    setPinOpen(true);
  }, [pinEnabled]);

  const handleForgotPin = useCallback(async () => {
    if (!bioAvailable || !bioEnabled) {
      toast.error("Ative a biometria para poder redefinir o PIN sem informá-lo.");
      return;
    }
    const ok = await verifyForPinReset();
    if (!ok) {
      toast.error("Não foi possível confirmar sua identidade.");
      return;
    }
    setPinResetOpen(true);
  }, [bioAvailable, bioEnabled, verifyForPinReset]);

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
            Menu Gerencial
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleBiometric} disabled={!bioAvailable}>
            <Fingerprint className="mr-2 h-4 w-4" />
            {!bioAvailable
              ? "Biometria indisponível"
              : bioEnabled
                ? "Desativar biometria"
                : "Ativar biometria / Face ID"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={togglePin}>
            <KeyRound className="mr-2 h-4 w-4" />
            {pinEnabled ? "Desativar PIN de acesso" : "Ativar PIN de acesso"}
          </DropdownMenuItem>
          {pinEnabled && (
            <>
              <DropdownMenuItem onClick={() => setVerifyChangeOpen(true)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Alterar PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleForgotPin} disabled={!bioAvailable || !bioEnabled}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Esqueci o PIN (usar biometria)
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Timer className="mr-2 h-4 w-4" />
              Bloqueio automático: {autoLock} min
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={String(autoLock)}
                onValueChange={(v) => {
                  const m = Number(v);
                  setAutoLockMinutes(m);
                  setAutoLock(m);
                  toast.success(`O app será bloqueado após ${m} min de inatividade.`);
                }}
              >
                {AUTOLOCK_OPTIONS.map((m) => (
                  <DropdownMenuRadioItem key={m} value={String(m)}>
                    {m} minuto{m === 1 ? "" : "s"}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {((bioAvailable && bioEnabled) || pinEnabled) && (
            <DropdownMenuItem onClick={bioLock}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Bloquear agora
            </DropdownMenuItem>
          )}
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
      <PinSetupDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={definePin} />
      <PinSetupDialog open={pinResetOpen} onOpenChange={setPinResetOpen} onConfirm={definePin} />
      <PinVerifyDialog
        open={verifyRemoveOpen}
        onOpenChange={setVerifyRemoveOpen}
        title="Desativar PIN de acesso"
        description="Digite o PIN atual para remover o bloqueio por PIN deste aparelho."
        onVerify={disablePinWithCurrent}
        onSuccess={() => toast.success("PIN de acesso removido.")}
      />
      <PinVerifyDialog
        open={verifyChangeOpen}
        onOpenChange={setVerifyChangeOpen}
        title="Alterar PIN de acesso"
        description="Digite o PIN atual para em seguida cadastrar um novo."
        onVerify={disablePinWithCurrent}
        onSuccess={() => setPinResetOpen(true)}
      />
    </>
  );
}
