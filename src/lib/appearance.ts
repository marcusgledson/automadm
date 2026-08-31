// Aparência do aplicativo: paleta de cores + tema/estilo visual.
// Fonte única usada pelo Onboarding, pelas Configurações e pelo provedor global.

export type PaletteId = "oliva" | "azul" | "grafite" | "terracota";
export type ThemeStyleId =
  | "neutro"
  | "escritorio"
  | "construcao"
  | "arquitetura"
  | "meioambiente"
  | "carros"
  | "aviacao";

export interface PaletteDef {
  id: PaletteId;
  label: string;
  /** Amostras exibidas na interface (hex apenas para preview). */
  swatch: string[];
  /** Tokens HSL aplicados em :root. */
  tokens: Record<string, string>;
  /** Tokens HSL aplicados em .dark. */
  darkTokens: Record<string, string>;
}

export const PALETTES: PaletteDef[] = [
  {
    id: "oliva",
    label: "Verde Oliva",
    swatch: ["#5c6b3c", "#8a9a5b", "#e8ecdd"],
    tokens: {
      background: "60 25% 97%",
      foreground: "80 20% 12%",
      card: "60 20% 99%",
      primary: "74 38% 32%",
      "primary-foreground": "60 30% 98%",
      secondary: "70 18% 92%",
      muted: "70 14% 91%",
      "muted-foreground": "80 10% 40%",
      accent: "36 55% 45%",
      "accent-foreground": "60 30% 98%",
      border: "70 14% 85%",
      input: "70 14% 85%",
      ring: "74 38% 32%",
      "auth-gradient-start": "74 32% 94%",
      "auth-gradient-end": "40 30% 95%",
    },
    darkTokens: {
      background: "80 12% 8%",
      foreground: "60 20% 94%",
      card: "80 12% 11%",
      primary: "74 42% 48%",
      "primary-foreground": "80 20% 10%",
      secondary: "80 10% 16%",
      muted: "80 10% 16%",
      "muted-foreground": "70 10% 60%",
      accent: "36 60% 55%",
      "accent-foreground": "80 20% 10%",
      border: "80 10% 20%",
      input: "80 10% 20%",
      ring: "74 42% 48%",
      "auth-gradient-start": "80 14% 10%",
      "auth-gradient-end": "80 10% 13%",
    },
  },
  {
    id: "azul",
    label: "Azul Corporativo",
    swatch: ["#1e3a5f", "#3b82a0", "#dfeaf2"],
    tokens: {
      background: "205 40% 97%",
      foreground: "212 35% 14%",
      card: "205 40% 99%",
      primary: "212 52% 26%",
      "primary-foreground": "205 45% 98%",
      secondary: "205 30% 92%",
      muted: "205 25% 91%",
      "muted-foreground": "212 14% 42%",
      accent: "192 46% 42%",
      "accent-foreground": "205 45% 98%",
      border: "205 22% 85%",
      input: "205 22% 85%",
      ring: "212 52% 26%",
      "auth-gradient-start": "205 45% 94%",
      "auth-gradient-end": "192 40% 95%",
    },
    darkTokens: {
      background: "212 30% 9%",
      foreground: "205 30% 94%",
      card: "212 28% 12%",
      primary: "204 62% 55%",
      "primary-foreground": "212 35% 10%",
      secondary: "212 22% 17%",
      muted: "212 22% 17%",
      "muted-foreground": "205 15% 62%",
      accent: "186 55% 50%",
      "accent-foreground": "212 35% 10%",
      border: "212 20% 21%",
      input: "212 20% 21%",
      ring: "204 62% 55%",
      "auth-gradient-start": "212 30% 11%",
      "auth-gradient-end": "212 26% 14%",
    },
  },
  {
    id: "grafite",
    label: "Grafite",
    swatch: ["#2b2d31", "#5c6169", "#e6e7e9"],
    tokens: {
      background: "220 12% 97%",
      foreground: "220 14% 13%",
      card: "220 12% 99%",
      primary: "222 10% 24%",
      "primary-foreground": "220 15% 98%",
      secondary: "220 10% 92%",
      muted: "220 9% 91%",
      "muted-foreground": "220 8% 42%",
      accent: "205 25% 45%",
      "accent-foreground": "220 15% 98%",
      border: "220 9% 85%",
      input: "220 9% 85%",
      ring: "222 10% 24%",
      "auth-gradient-start": "220 12% 94%",
      "auth-gradient-end": "210 12% 95%",
    },
    darkTokens: {
      background: "220 12% 9%",
      foreground: "220 12% 94%",
      card: "220 12% 12%",
      primary: "220 12% 72%",
      "primary-foreground": "220 14% 11%",
      secondary: "220 10% 17%",
      muted: "220 10% 17%",
      "muted-foreground": "220 8% 62%",
      accent: "205 32% 58%",
      "accent-foreground": "220 14% 11%",
      border: "220 10% 21%",
      input: "220 10% 21%",
      ring: "220 12% 72%",
      "auth-gradient-start": "220 12% 11%",
      "auth-gradient-end": "220 10% 14%",
    },
  },
  {
    id: "terracota",
    label: "Terracota",
    swatch: ["#8c4a2f", "#c97b58", "#f3e3da"],
    tokens: {
      background: "26 40% 97%",
      foreground: "18 30% 14%",
      card: "26 40% 99%",
      primary: "18 50% 36%",
      "primary-foreground": "26 45% 98%",
      secondary: "26 32% 92%",
      muted: "26 26% 91%",
      "muted-foreground": "18 14% 42%",
      accent: "36 60% 48%",
      "accent-foreground": "26 45% 98%",
      border: "26 24% 85%",
      input: "26 24% 85%",
      ring: "18 50% 36%",
      "auth-gradient-start": "26 45% 94%",
      "auth-gradient-end": "36 40% 95%",
    },
    darkTokens: {
      background: "18 18% 9%",
      foreground: "26 25% 94%",
      card: "18 18% 12%",
      primary: "18 58% 52%",
      "primary-foreground": "18 30% 10%",
      secondary: "18 14% 17%",
      muted: "18 14% 17%",
      "muted-foreground": "26 12% 62%",
      accent: "36 62% 55%",
      "accent-foreground": "18 30% 10%",
      border: "18 14% 21%",
      input: "18 14% 21%",
      ring: "18 58% 52%",
      "auth-gradient-start": "18 18% 11%",
      "auth-gradient-end": "18 16% 14%",
    },
  },
];

import heroEscritorio from "@/assets/theme-escritorio.jpg";
import heroConstrucao from "@/assets/theme-construcao.jpg";
import heroArquitetura from "@/assets/theme-arquitetura.jpg";
import heroMeioAmbiente from "@/assets/theme-meioambiente.jpg";
import heroCarros from "@/assets/theme-carros.jpg";
import heroAviacao from "@/assets/theme-aviacao.jpg";

export interface ThemeStyleDef {
  id: ThemeStyleId;
  label: string;
  description: string;
  /** Ícone (nome lucide) usado na arte da tela inicial e no logo. */
  icon: string;
  /** Ângulos/tons decorativos da arte gerada. */
  art: { from: string; to: string };
  /** Imagem de destaque da tela inicial (nulo = fotografia padrão). */
  image: string | null;
  /** Fonte de destaque (Google Fonts). Nulo mantém a fonte padrão. */
  font: { family: string; googleQuery: string } | null;
  /** Ícones dos cards do painel, por módulo (nomes lucide). */
  icons: Record<string, string>;
}

export const THEME_STYLES: ThemeStyleDef[] = [
  {
    id: "neutro",
    label: "Neutro",
    description: "Visual padrão, sem referências de segmento.",
    icon: "Sparkles",
    art: { from: "primary", to: "accent" },
    image: null,
    font: null,
    icons: {},
  },
  {
    id: "escritorio",
    label: "Escritório",
    description: "Ambiente administrativo, relatórios e planilhas.",
    icon: "Briefcase",
    art: { from: "primary", to: "accent" },
    image: heroEscritorio,
    font: { family: "Italianno", googleQuery: "Italianno" },
    icons: {
      extrato: "FileSpreadsheet",
      contas: "Files",
      investimentos: "LineChart",
      metas: "ClipboardList",
    },
  },
  {
    id: "construcao",
    label: "Construção",
    description: "Obras, medições e controle de materiais.",
    icon: "HardHat",
    art: { from: "accent", to: "primary" },
    image: heroConstrucao,
    font: { family: "Tangerine", googleQuery: "Tangerine:wght@700" },
    icons: {
      extrato: "Blocks",
      contas: "Hammer",
      investimentos: "Wrench",
      metas: "Construction",
    },
  },
  {
    id: "arquitetura",
    label: "Arquitetura",
    description: "Projetos, plantas e composição de custos.",
    icon: "Ruler",
    art: { from: "primary", to: "accent" },
    image: heroArquitetura,
    font: { family: "Bungee", googleQuery: "Bungee" },
    icons: {
      extrato: "PencilRuler",
      contas: "Presentation",
      investimentos: "DraftingCompass",
      metas: "PenTool",
    },
  },
  {
    id: "meioambiente",
    label: "Meio Ambiente",
    description: "Sustentabilidade, consumo e eficiência.",
    icon: "Leaf",
    art: { from: "accent", to: "primary" },
    image: heroMeioAmbiente,
    font: { family: "Tinos", googleQuery: "Tinos:wght@400;700" },
    icons: {
      extrato: "Sprout",
      contas: "Apple",
      investimentos: "TreeDeciduous",
      metas: "Recycle",
    },
  },
  {
    id: "carros",
    label: "Carros",
    description: "Frota, combustível e manutenção.",
    icon: "Car",
    art: { from: "primary", to: "accent" },
    image: heroCarros,
    font: { family: "Bungee Shade", googleQuery: "Bungee+Shade" },
    icons: {
      extrato: "Gauge",
      contas: "Fuel",
      investimentos: "CircleGauge",
      metas: "CarFront",
    },
  },
  {
    id: "aviacao",
    label: "Aviação",
    description: "Operações aéreas, rotas e custos de voo.",
    icon: "Plane",
    art: { from: "accent", to: "primary" },
    image: heroAviacao,
    font: { family: "Tangerine", googleQuery: "Tangerine:wght@700" },
    icons: {
      extrato: "PlaneTakeoff",
      contas: "Ticket",
      investimentos: "Radar",
      metas: "Navigation",
    },
  },
];


export const DEFAULT_PALETTE: PaletteId = "oliva";
export const DEFAULT_THEME_STYLE: ThemeStyleId = "neutro";

export const CACHE_KEY = "app_appearance";

export function getPalette(id?: string | null): PaletteDef {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function getThemeStyle(id?: string | null): ThemeStyleDef {
  return THEME_STYLES.find((t) => t.id === id) ?? THEME_STYLES[0];
}

const STYLE_EL_ID = "app-appearance-tokens";
const FONT_LINK_ID = "app-theme-font";

function toCssBlock(selector: string, tokens: Record<string, string>) {
  const body = Object.entries(tokens)
    .map(([k, v]) => `--${k}: ${v};`)
    .join("");
  return `${selector}{${body}}`;
}

/** Carrega (uma vez) a fonte de destaque do tema no Google Fonts. */
function applyThemeFont(theme: ThemeStyleDef) {
  const link =
    (document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null) ??
    (() => {
      const l = document.createElement("link");
      l.id = FONT_LINK_ID;
      l.rel = "stylesheet";
      document.head.appendChild(l);
      return l;
    })();

  if (!theme.font) {
    link.removeAttribute("href");
    document.documentElement.style.removeProperty("--font-display");
    return;
  }
  const href = `https://fonts.googleapis.com/css2?family=${theme.font.googleQuery}&display=swap`;
  if (link.getAttribute("href") !== href) link.href = href;
  document.documentElement.style.setProperty(
    "--font-display",
    `"${theme.font.family}", "DM Sans", system-ui, sans-serif`,
  );
}

/** Aplica a paleta escolhida escrevendo as variáveis CSS no documento. */
export function applyAppearance(paletteId?: string | null, themeStyleId?: string | null) {
  if (typeof document === "undefined") return;
  const palette = getPalette(paletteId);
  const theme = getThemeStyle(themeStyleId);

  let el = document.getElementById(STYLE_EL_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_EL_ID;
    document.head.appendChild(el);
  }
  el.textContent =
    toCssBlock(":root", palette.tokens) + toCssBlock(".dark", palette.darkTokens);

  applyThemeFont(theme);

  document.documentElement.dataset.palette = palette.id;
  document.documentElement.dataset.themeStyle = theme.id;
}


export function readCachedAppearance(): { palette: string; theme_style: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as { palette: string; theme_style: string }) : null;
  } catch {
    return null;
  }
}

export function cacheAppearance(palette: string, theme_style: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ palette, theme_style }));
  } catch {
    /* ignora */
  }
}
