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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Quantidade máxima de arquivos por rodada de seleção. */
export const BATCH_CHUNK = 10;

interface FileUploaderProps {
  /** Recebe os arquivos já validados e liberados pela varredura. */
  onFilesSelected: (files: File[]) => void;
  loading: boolean;
}

export default function FileUploader({ onFilesSelected, loading }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const limiterRef = useRef(new UploadRateLimiter());
  const [status, setStatus] = useState<UploadStatusInfo>({ stage: "idle" });
  const [checking, setChecking] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const [askMore, setAskMore] = useState(false);

  /** Valida + varre um arquivo. Retorna true quando liberado. */
  const guardFile = useCallback(async (file: File): Promise<boolean> => {
    const base = { fileName: file.name, fileSize: file.size };
    setStatus({ stage: "validating", ...base });

    const reject = (reason: string, extra: Partial<UploadStatusInfo> = {}) => {
      setStatus({ stage: "rejected", ...base, reason, ...extra });
      toast.error(`${file.name}: ${reason}`);
      return false;
    };

    const result = await guardStatementUpload(file, limiterRef.current);
    if (!result.ok) return reject(result.error ?? "Arquivo inválido.");

    setStatus({ stage: "scanning", ...base });

    // Cache por hash SHA-256: evita reenviar e reprocessar arquivos repetidos.
    const hash = await sha256Hex(file);
    const cached = getCachedScan(hash);
    if (cached) {
      if (cached.verdict === "rejected") {
        return reject(cached.reason ?? "Arquivo rejeitado pela varredura de segurança.", { cached: true, hash });
      }
      setStatus({ stage: "accepted", ...base, cached: true, hash, engine: cached.engine });
      return true;
    }

    const { data, error: fnError } = await supabase.functions.invoke("scan-upload", {
      body: file,
      headers: {
        "Content-Type": result.kind === "pdf" ? "application/pdf" : "text/plain",
        "x-file-kind": result.kind!,
        "x-file-name": encodeURIComponent(file.name),
      },
    });

    const payload = data as { ok?: boolean; error?: string; engine?: string; cached?: boolean } | null;

    if (fnError || !payload?.ok) {
      const msg = payload?.error ?? "Não foi possível validar o arquivo no servidor. Tente novamente.";
      if (payload?.error) setCachedScan(hash, { verdict: "rejected", reason: msg });
      return reject(msg, { hash, cached: payload?.cached });
    }

    setCachedScan(hash, { verdict: "accepted", engine: payload.engine });
    setStatus({ stage: "accepted", ...base, hash, engine: payload.engine, cached: payload.cached });
    return true;
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setChecking(true);
      try {
        const approved: File[] = [];
        for (const file of files.slice(0, BATCH_CHUNK)) {
          // eslint-disable-next-line no-await-in-loop
          if (await guardFile(file)) approved.push(file);
        }
        if (files.length > BATCH_CHUNK) {
          toast.warning(`Selecione no máximo ${BATCH_CHUNK} arquivos por vez. Os demais foram ignorados.`);
        }
        if (approved.length === 0) return;
        setQueue((prev) => {
          const next = [...prev, ...approved];
          setAskMore(true);
          return next;
        });
      } finally {
        setChecking(false);
      }
    },
    [guardFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length) void handleFiles(files);
    },
    [handleFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length) void handleFiles(files);
    },
    [handleFiles],
  );

  const proceed = () => {
    const files = queue;
    setAskMore(false);
    setQueue([]);
    if (files.length) onFilesSelected(files);
  };

  const addMore = () => {
    setAskMore(false);
    inputRef.current?.click();
  };

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
          Arraste seus extratos (OFX ou PDF) aqui
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode selecionar vários PDFs de uma vez — a importação é feita em lote, sem duplicar lançamentos.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Limites: PDF até {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB · OFX até{" "}
          {Math.round(MAX_OFX_BYTES / 1024 / 1024)} MB · até {BATCH_CHUNK} arquivos por rodada
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
        multiple
        accept=".ofx,.pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
      />

      <div className="w-full max-w-xl">
        <UploadStatusPanel status={status} />
      </div>

      <AlertDialog open={askMore} onOpenChange={(o) => { if (!o) proceed(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar mais arquivos?</AlertDialogTitle>
            <AlertDialogDescription>
              {queue.length} arquivo{queue.length === 1 ? "" : "s"} liberado
              {queue.length === 1 ? "" : "s"} para importação. Deseja selecionar mais
              {" "}{BATCH_CHUNK} arquivos antes de prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={proceed}>Não, prosseguir</AlertDialogCancel>
            <AlertDialogAction onClick={addMore}>Sim, adicionar mais</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
