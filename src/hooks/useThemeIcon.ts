import { useCallback } from "react";
import * as Lucide from "lucide-react";
import { getThemeStyle } from "@/lib/appearance";
import { useAppSettings } from "@/hooks/useAppSettings";

type IconType = React.ElementType;

/**
 * Resolve o ícone do módulo conforme o tema/estilo escolhido pelo usuário.
 * Volta ao ícone padrão quando o tema não define um ícone para o módulo.
 */
export function useThemeIcon() {
  const { settings } = useAppSettings();
  const theme = getThemeStyle(settings?.theme_style);

  return useCallback(
    (moduleId: string, fallback: IconType): IconType => {
      const name = theme.icons[moduleId];
      if (!name) return fallback;
      const icon = (Lucide as unknown as Record<string, IconType>)[name];
      return icon ?? fallback;
    },
    [theme],
  );
}
