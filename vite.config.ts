import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Arquivos que definem providers globais: uma atualização parcial (HMR) neles
 * deixa estados antigos em memória e pode gerar tela em branco no preview.
 * Nesses casos forçamos a recarga completa da página.
 */
const PROVIDER_FILES = [
  "src/App.tsx",
  "src/main.tsx",
  "src/components/AppearanceProvider.tsx",
  "src/components/AppErrorBoundary.tsx",
  "src/hooks/useAuth.tsx",
  "src/lib/appearance.ts",
];

function fullReloadOnProviderChange(): Plugin {
  const targets = PROVIDER_FILES.map((f) => path.resolve(__dirname, f));
  return {
    name: "full-reload-on-provider-change",
    handleHotUpdate({ file, server }) {
      if (!targets.includes(path.resolve(file))) return;
      server.ws.send({ type: "full-reload", path: "*" });
      return [];
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    fullReloadOnProviderChange(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
