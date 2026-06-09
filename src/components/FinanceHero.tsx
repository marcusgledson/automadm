import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useHeroImage } from "@/hooks/useHeroImage";

interface Props {
  className?: string;
  priority?: boolean;
  editable?: boolean;
}

/**
 * Decorative finance illustration with subtle interactive hover/tilt.
 * Used on Auth and Dashboard to harmonize the financial theme.
 * When `editable`, the user can replace the image with their own.
 */
export default function FinanceHero({ className = "", priority = false, editable = false }: Props) {
  const { src, setCustom, reset, isCustom } = useHeroImage();
  const inputRef = useRef<HTMLInputElement>(null);

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
      <img
        src={src}
        alt="Ilustração de gestão financeira"
        loading={priority ? "eager" : "lazy"}
        className="relative h-full w-full object-cover p-2 transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03] group-hover:-rotate-[0.4deg] motion-safe:animate-fade-up"
      />
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
