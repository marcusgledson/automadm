import { CheckCircle2, FileSearch, Loader2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadStage = "idle" | "validating" | "scanning" | "rejected" | "accepted";

export interface UploadStatusInfo {
  stage: UploadStage;
  fileName?: string;
  fileSize?: number;
  reason?: string;
  engine?: string;
  cached?: boolean;
  hash?: string;
}

const STEPS: { id: Exclude<UploadStage, "idle">; label: string }[] = [
  { id: "validating", label: "Validando arquivo" },
  { id: "scanning", label: "Varredura de segurança" },
  { id: "accepted", label: "Aceito para processamento" },
];

function order(stage: UploadStage) {
  return { idle: 0, validating: 1, scanning: 2, rejected: 3, accepted: 3 }[stage];
}

function formatSize(bytes?: number) {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Painel de acompanhamento do upload: validação, varredura, aceite ou rejeição com motivo. */
export default function UploadStatusPanel({ status }: { status: UploadStatusInfo }) {
  if (status.stage === "idle") return null;

  const rejected = status.stage === "rejected";
  const current = order(status.stage);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full rounded-xl border p-4 text-left",
        rejected ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/70",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            rejected ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          {rejected ? (
            <ShieldAlert className="h-5 w-5" />
          ) : status.stage === "accepted" ? (
            <ShieldCheck className="h-5 w-5" />
          ) : status.stage === "scanning" ? (
            <FileSearch className="h-5 w-5" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-foreground">
              {status.fileName ?? "Arquivo selecionado"}
            </span>
            {formatSize(status.fileSize) && (
              <span className="text-xs text-muted-foreground">{formatSize(status.fileSize)}</span>
            )}
            {status.cached && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                resultado em cache
              </span>
            )}
          </div>

          <ol className="space-y-1.5">
            {STEPS.map((step, i) => {
              const stepIndex = i + 1;
              const done = current > stepIndex || status.stage === "accepted";
              const active = current === stepIndex && !rejected;
              const failed = rejected && stepIndex >= current - 1 && stepIndex === 3;
              return (
                <li key={step.id} className="flex items-center gap-2 text-xs">
                  {failed ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-border" />
                  )}
                  <span
                    className={cn(
                      failed
                        ? "text-destructive"
                        : done || active
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {failed ? "Rejeitado" : step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {rejected && status.reason && (
            <p className="text-xs text-destructive">
              <strong>Motivo:</strong> {status.reason}
            </p>
          )}
          {status.stage === "accepted" && (
            <p className="text-xs text-muted-foreground">
              Nenhuma ameaça encontrada{status.engine ? ` (${status.engine})` : ""}. Processando os lançamentos.
            </p>
          )}
          {status.hash && (
            <p className="font-mono text-[10px] text-muted-foreground">SHA-256: {status.hash.slice(0, 16)}…</p>
          )}
        </div>
      </div>
    </div>
  );
}
