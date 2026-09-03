/**
 * Upload de arquivos para o OneDrive do próprio usuário via Microsoft Graph.
 *
 * Usa o fluxo OAuth2 implícito (token) em popup, sem SDK. Requer o registro de
 * um app no Azure (Entra ID) do tipo SPA e a variável VITE_MS_CLIENT_ID.
 *  - Redirect URI (SPA): a mesma origem do app + "/" (preview e publicado).
 *  - Permissão delegada: Files.ReadWrite (o app só grava o que envia).
 */

const SCOPE = "Files.ReadWrite offline_access openid profile";
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

export function getOneDriveClientId(): string | undefined {
  return import.meta.env.VITE_MS_CLIENT_ID as string | undefined;
}

export function isOneDriveConfigured(): boolean {
  return !!getOneDriveClientId();
}

function randomState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getAccessToken(): Promise<string> {
  const clientId = getOneDriveClientId();
  if (!clientId) {
    throw new Error("OneDrive não configurado. Defina VITE_MS_CLIENT_ID no .env.");
  }
  const redirectUri = `${window.location.origin}/`;
  const state = randomState();
  const url =
    `${AUTH_URL}?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&response_mode=fragment` +
    `&state=${state}`;

  const popup = window.open(url, "onedrive-auth", "width=520,height=640");
  if (!popup) throw new Error("Não foi possível abrir a janela de autorização do OneDrive.");

  return new Promise<string>((resolve, reject) => {
    const timer = window.setInterval(() => {
      try {
        if (popup.closed) {
          window.clearInterval(timer);
          reject(new Error("Autorização do OneDrive cancelada."));
          return;
        }
        // Só é legível quando o popup volta para a nossa origem
        const hash = popup.location.hash;
        if (!hash) return;
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        if (params.get("state") !== state) return;
        const token = params.get("access_token");
        const err = params.get("error_description") || params.get("error");
        window.clearInterval(timer);
        popup.close();
        if (token) resolve(token);
        else reject(new Error(err || "Token do OneDrive não retornado."));
      } catch {
        /* cross-origin enquanto está no login da Microsoft — aguardar */
      }
    }, 400);
  });
}

export interface OneDriveUploadResult {
  id: string;
  name: string;
  webUrl?: string;
}

export async function uploadToOneDrive(blob: Blob, fileName: string): Promise<OneDriveUploadResult> {
  const token = await getAccessToken();
  const path = `AutomADM/${fileName}`;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": blob.type || "application/octet-stream",
      },
      body: blob,
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Envio ao OneDrive falhou (${res.status}): ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as OneDriveUploadResult;
}
