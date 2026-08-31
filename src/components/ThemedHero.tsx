import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, RotateCcw, Sparkles, Briefcase, HardHat, Ruler, Leaf, Car, Plane } from "lucide-react";
import { toast } from "sonner";
import { useHeroImage } from "@/hooks/useHeroImage";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getThemeStyle, type ThemeStyleId } from "@/lib/appearance";

const ICONS: Record<string, React.ElementType> = {
  Sparkles,
  Briefcase,
  HardHat,
  Ruler,
  Leaf,
  Car,
  Plane,
};

interface Props {
  className?: string;
  priority?: boolean;
  editable?: boolean;
  /** Força um tema específico (usado na pré-visualização das Configurações). */
  themeStyle?: ThemeStyleId;
}

/**
 * Arte da tela inicial de acordo com o tema escolhido pelo usuário.
 * No tema "Neutro" mantém a fotografia; nos demais gera uma composição
 * com as cores da paleta ativa e o ícone do segmento.
 */
export default function ThemedHero({ className = "", priority = false, editable = false, themeStyle }: Props) {
  const { settings } = useAppSettings();
  const { src, setCustom, reset, isCustom } = useHeroImage();
  const inputRef = useRef<HTMLInputElement>(null);

  const theme = getThemeStyle(themeStyle ?? settings?.theme_style);
  const Icon = ICONS[theme.icon] ?? Sparkles;
  const useArt = theme.id !== "neutro" && !isCustom;

  const onPick = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande. Use até 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustom(String(reader.result));
      toast.success("Imagem da tela inicial atualizada.");
    };
    reader.onerror = () => toast.error("Falha ao ler a imagem.");
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
      />

      {useArt && theme.image ? (
        <div
          role="img"
          aria-label={`Ilustração do tema ${theme.label}`}
          className="relative h-full w-full overflow-hidden rounded-xl"
        >
          <img
            src={theme.image}
            alt=""
            aria-hidden
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-safe:animate-fade-up"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
            <span className="rounded-xl bg-primary/15 p-2 text-primary shadow-sm">
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl leading-none text-foreground">{theme.label}</span>
          </div>
        </div>
      ) : useArt ? (
        <div
          role="img"
          aria-label={`Ilustração do tema ${theme.label}`}
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl"
          style={{
            background: `radial-gradient(120% 120% at 0% 0%, hsl(var(--${theme.art.from}) / 0.35), transparent 60%),
              radial-gradient(120% 120% at 100% 100%, hsl(var(--${theme.art.to}) / 0.35), transparent 60%),
              linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary)))`,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(to right, hsl(var(--foreground) / 0.25) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.25) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative flex flex-col items-center gap-2 motion-safe:animate-fade-up">
            <span className="rounded-2xl bg-primary/15 p-4 text-primary shadow-sm transition-transform duration-500 group-hover:scale-105">
              <Icon className="h-9 w-9" />
            </span>
            <span className="font-display text-xl tracking-wide text-muted-foreground">
              {theme.label}
            </span>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt="Ilustração de gestão financeira"
          loading={priority ? "eager" : "lazy"}
          className="relative h-full w-full object-cover p-2 transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03] group-hover:-rotate-[0.4deg] motion-safe:animate-fade-up"
        />
      )}

      {editable && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1 px-2 text-xs shadow"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" /> Trocar
          </Button>
          {isCustom && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1 px-2 text-xs shadow"
              onClick={() => {
                reset();
                toast.success("Imagem padrão restaurada.");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Padrão
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
