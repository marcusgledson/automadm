import { Button } from "@/components/ui/button";
import { Eye, Database } from "lucide-react";
import type { ImportMode } from "@/hooks/useImportMode";

interface Props {
  mode: ImportMode;
  onChange: (m: ImportMode) => void;
  className?: string;
}

/** Seletor "Apenas leitura" x "Gravação" usado nos módulos de importação. */
export default function ImportModeSelector({ mode, onChange, className }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur">
        <Button
          size="sm"
          variant={mode === "leitura" ? "default" : "ghost"}
          onClick={() => onChange("leitura")}
          className="gap-2"
        >
          <Eye className="h-4 w-4" /> Apenas leitura
        </Button>
        <Button
          size="sm"
          variant={mode === "gravacao" ? "default" : "ghost"}
          onClick={() => onChange("gravacao")}
          className="gap-2"
        >
          <Database className="h-4 w-4" /> Gravação
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "leitura"
          ? "Os dados serão apenas exibidos, sem gravar na base."
          : "Os dados serão gravados na base e poderão ser salvos localmente ou na nuvem."}
      </p>
    </div>
  );
}
