import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_OFX_BYTES,
  MAX_PDF_BYTES,
  UploadRateLimiter,
  guardStatementUpload,
} from "@/lib/uploadGuard";
import { getCachedScan, setCachedScan, sha256Hex } from "@/lib/scanCache";
import UploadStatusPanel, { type UploadStatusInfo } from "@/components/UploadStatusPanel";

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export default function FileUploader({ onFileSelected, loading }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const limiterRef = useRef(new UploadRateLimiter());
  const [status, setStatus] = useState<UploadStatusInfo>({ stage: "idle" });
  const [checking, setChecking] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setChecking(true);
      const base = { fileName: file.name, fileSize: file.size };
      setStatus({ stage: "validating", ...base });

      const reject = (reason: string, extra: Partial<UploadStatusInfo> = {}) => {
        setStatus({ stage: "rejected", ...base, reason, ...extra });
        toast.error(reason);
      };

      try {
        const result = await guardStatementUpload(file, limiterRef.current);
        if (!result.ok) {
          reject(result.error ?? "Arquivo inválido.");
          return;
        }

        setStatus({ stage: "scanning", ...base });

        // Cache por hash SHA-256: evita reenviar e reprocessar arquivos repetidos.
        const hash = await sha256Hex(file);
        const cached = getCachedScan(hash);
        if (cached) {
          if (cached.verdict === "rejected") {
            reject(cached.reason ?? "Arquivo rejeitado pela varredura de segurança.", { cached: true, hash });
            return;
          }
          setStatus({ stage: "accepted", ...base, cached: true, hash, engine: cached.engine });
          onFileSelected(file);
          return;
        }

        // Validação/varredura no backend antes de processar o arquivo
        const { data, error: fnError } = await supabase.functions.invoke("scan-upload", {
          body: file,
          headers: {
            "Content-Type": result.kind === "pdf" ? "application/pdf" : "text/plain",
            "x-file-kind": result.kind!,
            "x-file-name": encodeURIComponent(file.name),
          },
        });

        const payload = data as
          | { ok?: boolean; error?: string; engine?: string; cached?: boolean }
          | null;

        if (fnError || !payload?.ok) {
          const msg =
            payload?.error ?? "Não foi possível validar o arquivo no servidor. Tente novamente.";
          if (payload?.error) setCachedScan(hash, { verdict: "rejected", reason: msg });
          reject(msg, { hash, cached: payload?.cached });
          return;
        }

        setCachedScan(hash, { verdict: "accepted", engine: payload.engine });
        setStatus({ stage: "accepted", ...base, hash, engine: payload.engine, cached: payload.cached });
        onFileSelected(file);
      } finally {
        setChecking(false);
      }
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const busy = loading || checking;

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
        <p className="mt-1 text-xs text-muted-foreground">
          Limites: PDF até {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB · OFX até{" "}
          {Math.round(MAX_OFX_BYTES / 1024 / 1024)} MB
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {busy ? "Processando..." : "Selecionar OFX ou PDF"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".ofx,.pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
      />

      <div className="w-full max-w-xl">
        <UploadStatusPanel status={status} />
      </div>
    </div>
  );
}
