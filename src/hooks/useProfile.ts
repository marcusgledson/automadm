import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Gender = "masculino" | "feminino" | "nao_informar";

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  gender: Gender | null;
  phone_country_code: string | null;
  phone_area_code: string | null;
  phone_number: string | null;
  phone_is_whatsapp: boolean;
  must_change_password: boolean;
  allowed_modules: string[];
  org_owner_id: string | null;
}

export type ProfilePatch = Partial<
  Pick<
    UserProfile,
    | "full_name"
    | "display_name"
    | "gender"
    | "phone_country_code"
    | "phone_area_code"
    | "phone_number"
    | "phone_is_whatsapp"
  >
>;

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((data as unknown as UserProfile) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return { ok: false, error: "Não autenticado" };
      const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
      if (error) return { ok: false, error: error.message };
      await refresh();
      return { ok: true };
    },
    [user, refresh],
  );

  return { profile, loading, refresh, save };
}
