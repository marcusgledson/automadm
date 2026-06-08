import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;

/**
 * Logs the user out automatically after `timeoutMs` of inactivity.
 * Default: 15 minutes. Shows a warning 60s before logout.
 */
export function useIdleLogout(timeoutMs = 15 * 60 * 1000) {
  const { user, signOut } = useAuth();
  const timerRef = useRef<number | null>(null);
  const warnRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (warnRef.current) window.clearTimeout(warnRef.current);
      warnRef.current = window.setTimeout(() => {
        toast.warning("Você será desconectado em 1 minuto por inatividade.");
      }, Math.max(0, timeoutMs - 60_000));
      timerRef.current = window.setTimeout(async () => {
        toast.info("Sessão encerrada por inatividade.");
        await signOut();
      }, timeoutMs);
    };

    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (warnRef.current) window.clearTimeout(warnRef.current);
    };
  }, [user, signOut, timeoutMs]);
}
