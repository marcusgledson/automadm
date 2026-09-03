import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDriveDownload, Cloud, Loader2, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { isDriveBackupConfigured, uploadBackupToDrive } from "@/lib/googleDriveBackup";
import { isOneDriveConfigured, uploadToOneDrive } from "@/lib/oneDriveBackup";

interface Props {
  /** Gera o arquivo a ser salvo (JSON/XLSX/CSV, conforme o módulo). */
  buildFile: () => Promise<{ blob: Blob; fileName: string }> | { blob: Blob; fileName: string };
  title?: string;
  description?: string;
  disabled?: boolean;
}

/** Painel de destino do arquivo gerado: local, Google Drive ou OneDrive. */
export default function SaveDestinationPanel({
  buildFile, title = "Salvar cópia do que foi gravado", description, disabled,
}: Props) {
  const [busy, setBusy] = useState<null | "local" | "gdrive" | "onedrive">(null);

  const run = async (dest: "local" | "gdrive" | "onedrive") => {
    setBusy(dest);
    try {
      const { blob, fileName } = await buildFile();
      if (dest === "local") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Arquivo salvo no dispositivo.");
      } else if (dest === "gdrive") {
        const res = await uploadBackupToDrive(blob, fileName);
        toast.success(`Enviado ao Google Drive: ${res.name}`);
      } else {
        const res = await uploadToOneDrive(blob, fileName);
        toast.success(`Enviado ao OneDrive: ${res.name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o arquivo.");
    } finally {
      setBusy(null);
    }
  };

  const icon = (d: "local" | "gdrive" | "onedrive", Fallback: typeof Cloud) =>
    busy === d ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fallback className="h-4 w-4" />;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudUpload className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
        <CardDescription>
          {description ?? "Escolha onde guardar uma cópia dos dados capturados."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled || !!busy}
          onClick={() => void run("local")}>
          {icon("local", HardDriveDownload)} Salvar no dispositivo
        </Button>
        <Button variant="outline" size="sm" className="gap-2"
          disabled={disabled || !!busy || !isDriveBackupConfigured()}
          title={isDriveBackupConfigured() ? undefined : "Configure VITE_GOOGLE_CLIENT_ID para habilitar."}
          onClick={() => void run("gdrive")}>
          {icon("gdrive", Cloud)} Google Drive
        </Button>
        <Button variant="outline" size="sm" className="gap-2"
          disabled={disabled || !!busy || !isOneDriveConfigured()}
          title={isOneDriveConfigured() ? undefined : "Configure VITE_MS_CLIENT_ID para habilitar."}
          onClick={() => void run("onedrive")}>
          {icon("onedrive", Cloud)} OneDrive
        </Button>
      </CardContent>
    </Card>
  );
}
