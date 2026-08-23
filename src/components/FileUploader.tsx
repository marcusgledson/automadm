import { useCallback, useRef } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export default function FileUploader({ onFileSelected, loading }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const accepted = (name: string) =>
    name.toLowerCase().endsWith(".ofx") || name.toLowerCase().endsWith(".pdf");

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && accepted(file.name)) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-card/50 p-12 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">
          Arraste seu extrato (OFX ou PDF) aqui
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Formatos aceitos: OFX (Open Financial Exchange) e PDF do extrato bancário
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {loading ? "Processando..." : "Selecionar OFX ou PDF"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".ofx,.pdf"
        onChange={handleChange}
        className="hidden"
      />

    </div>
  );
}
