import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Indica se o usuário logado é o dono do aplicativo (administração de empresas). */
export function useAppOwner() {
  const { user } = useAuth();
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user) {
        if (active) {
          setIsAppOwner(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data } = await supabase.rpc("is_app_owner", { _user_id: user.id });
      if (!active) return;
      setIsAppOwner(data === true);
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [user]);

  return { isAppOwner, loading };
}
