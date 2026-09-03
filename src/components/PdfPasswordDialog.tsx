import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, FileWarning } from "lucide-react";

export interface PdfPasswordRequest {
  /** Nomes dos arquivos que continuam bloqueados. */
  fileNames: string[];
  /** Dica de senha declarada pelo emissor, quando o PDF traz. */
  hint?: string;
  /** Indica que uma senha já foi tentada e recusada. */
  wrong?: boolean;
}

interface Props {
  request: PdfPasswordRequest | null;
  onSubmit: (password: string) => void;
  /** Desiste dos arquivos ainda bloqueados. */
  onSkip: () => void;
}

/**
 * Pop-up de senha de documento. O campo é exibido SEM máscara, pois trata-se de
 * senha de visualização do arquivo (normalmente CPF/CNPJ), não de credencial.
 */
export default function PdfPasswordDialog({ request, onSubmit, onSkip }: Props) {
  const [value, setValue] = useState("");

  useEffect(() => { if (request) setValue(""); }, [request]);

  const open = !!request;
  const files = request?.fileNames ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Senha do documento
          </DialogTitle>
          <DialogDescription>
            {request?.wrong
              ? "A senha informada não abriu os arquivos abaixo. Informe a senha correta para eles."
              : "Os arquivos abaixo estão protegidos. Informe a senha de visualização."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2">
            <ul className="space-y-1 text-xs">
              {files.map((f) => (
                <li key={f} className="flex items-center gap-2 truncate text-foreground">
                  <FileWarning className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate" title={f}>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {request?.hint ? (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs text-foreground">
              Dica do arquivo: <span className="font-medium">{request.hint}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este arquivo não apresenta dica de senha. Normalmente é o CPF/CNPJ do titular (somente números).
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pdf-password" className="text-xs">Senha (visível)</Label>
            <Input
              id="pdf-password"
              type="text"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              value={value}
              placeholder="Ex.: 12345678900"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onSkip}>Pular estes arquivos</Button>
          <Button disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
            Testar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
