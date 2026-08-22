import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Palette, RotateCcw, Check } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import ThemedHero from "@/components/ThemedHero";
import {
  PALETTES,
  THEME_STYLES,
  DEFAULT_PALETTE,
  DEFAULT_THEME_STYLE,
  applyAppearance,
  cacheAppearance,
  type PaletteId,
  type ThemeStyleId,
} from "@/lib/appearance";

/** Escolha opcional da paleta de cores e do tema visual do aplicativo. */
export default function AppearancePanel() {
  const { settings, save, loading } = useAppSettings();
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const [themeStyle, setThemeStyle] = useState<ThemeStyleId>(DEFAULT_THEME_STYLE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setPalette((settings.palette as PaletteId) ?? DEFAULT_PALETTE);
    setThemeStyle((settings.theme_style as ThemeStyleId) ?? DEFAULT_THEME_STYLE);
  }, [settings?.palette, settings?.theme_style]);

  // Pré-visualização imediata enquanto o usuário escolhe.
  useEffect(() => {
    applyAppearance(palette, themeStyle);
  }, [palette, themeStyle]);

  const persist = async (p: PaletteId, t: ThemeStyleId) => {
    setSaving(true);
    const res = await save({ palette: p, theme_style: t });
    setSaving(false);
    if (!res.ok) {
      toast.error("Não foi possível salvar a aparência: " + res.error);
      return;
    }
    cacheAppearance(p, t);
    toast.success("Aparência salva. Ela será mantida nos próximos acessos.");
  };

  const restoreDefault = async () => {
    setPalette(DEFAULT_PALETTE);
    setThemeStyle(DEFAULT_THEME_STYLE);
    await persist(DEFAULT_PALETTE, DEFAULT_THEME_STYLE);
  };

  const cancelPreview = () => {
    const p = (settings?.palette as PaletteId) ?? DEFAULT_PALETTE;
    const t = (settings?.theme_style as ThemeStyleId) ?? DEFAULT_THEME_STYLE;
    setPalette(p);
    setThemeStyle(t);
    applyAppearance(p, t);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const dirty = palette !== settings?.palette || themeStyle !== settings?.theme_style;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-primary" /> Paleta de cores
        </h4>
        <p className="text-xs text-muted-foreground">
          A escolha é opcional — a mudança aparece na hora e é gravada na sua conta.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => {
            const active = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted"
                }`}
              >
                <span className="flex gap-1">
                  {p.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-5 w-5 rounded-full border border-border/50"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="flex-1 truncate text-xs font-medium">{p.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Tema / estilo</h4>
        <p className="text-xs text-muted-foreground">
          Define a arte da tela inicial, o logo e os detalhes visuais dos módulos.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {THEME_STYLES.map((t) => {
            const active = t.id === themeStyle;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeStyle(t.id)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  {t.label}
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{t.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Pré-visualização da tela inicial</h4>
        <ThemedHero className="aspect-[16/7] w-full" themeStyle={themeStyle} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => persist(palette, themeStyle)} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar aparência
        </Button>
        {dirty && (
          <Button variant="outline" onClick={cancelPreview} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button variant="ghost" onClick={restoreDefault} disabled={saving}>
          <RotateCcw className="h-4 w-4" /> Restaurar padrão
        </Button>
      </div>
    </div>
  );
}
