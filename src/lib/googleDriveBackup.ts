/**
 * Upload de backup criptografado para o Google Drive do próprio usuário
 * usando Google Identity Services (per-user OAuth, escopo `drive.file`).
 *
 * Requer VITE_GOOGLE_CLIENT_ID configurado no .env (OAuth Client ID do tipo "Web").
 *  - Origens autorizadas devem incluir a URL do app (preview + publicada).
 *
 * Escopo `drive.file`: o app só enxerga arquivos que ele mesmo criou — não tem
 * acesso ao restante do Drive do usuário. Mais seguro para backup.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
let scriptPromise: Promise<void> | null = null;

export function getDriveClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
}

export function isDriveBackupConfigured(): boolean {
  return !!getDriveClientId();
}

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("window indisponível"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Identity Services."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function getAccessToken(): Promise<string> {
  const clientId = getDriveClientId();
  if (!clientId) {
    throw new Error("Google Drive não configurado. Defina VITE_GOOGLE_CLIENT_ID no .env.");
  }
  await loadGisScript();
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(`Permissão negada: ${resp.error}`));
          return;
        }
        if (!resp.access_token) {
          reject(new Error("Token de acesso não retornado pelo Google."));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink?: string;
}

export async function uploadBackupToDrive(blob: Blob, fileName: string): Promise<DriveUploadResult> {
  const token = await getAccessToken();
  const metadata = { name: fileName, mimeType: blob.type || "application/octet-stream" };

  const boundary = "automadm-" + Math.random().toString(36).slice(2);
  const delim = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;

  const buf = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

  const body =
    delim +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delim +
    `Content-Type: ${metadata.mimeType}\r\n` +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    b64 +
    close;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Drive upload falhou (${res.status}): ${errTxt.slice(0, 200)}`);
  }
  return (await res.json()) as DriveUploadResult;
}
