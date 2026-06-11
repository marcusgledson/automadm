import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extracts folder ID from various Google Drive URL formats:
 * - https://drive.google.com/drive/folders/FOLDER_ID
 * - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 * - https://drive.google.com/drive/u/0/folders/FOLDER_ID
 * - Just the raw folder ID
 */
function extractFolderId(input: string): string | null {
  const trimmed = input.trim();

  // Direct folder ID (no slashes, no dots)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData, error: userErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const { folderLink, fileType } = await req.json();

    if (!folderLink || typeof folderLink !== "string") {
      return new Response(
        JSON.stringify({ error: "folderLink é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const folderId = extractFolderId(folderLink);
    if (!folderId) {
      return new Response(
        JSON.stringify({ error: "Link de pasta inválido. Cole o link de compartilhamento da pasta do Google Drive." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Google Drive API v3 to list files in the shared folder
    // This works for folders shared as "anyone with the link can view"
    const API_KEY = Deno.env.get("GOOGLE_API_KEY");

    // Tipo de arquivo a listar (default: pdf, p/ retrocompatibilidade)
    const type = (typeof fileType === "string" ? fileType : "pdf").toLowerCase();
    let typeFilter: string;
    if (type === "ofx") {
      // OFX raramente tem MIME registrado; filtramos por nome.
      typeFilter = `(name contains '.ofx' or name contains '.OFX')`;
    } else {
      typeFilter = `mimeType='application/pdf'`;
    }
    const query = `'${folderId}' in parents and ${typeFilter} and trashed=false`;

    let apiUrl: string;
    if (API_KEY) {
      apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&orderBy=name&key=${API_KEY}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    } else {
      apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    }

    const driveResponse = await fetch(apiUrl);

    if (!driveResponse.ok) {
      const errText = await driveResponse.text();
      console.error("Google Drive API error:", driveResponse.status, errText);

      // Detect invalid API key
      if (errText.includes("API_KEY_INVALID") || errText.includes("API key not valid")) {
        return new Response(
          JSON.stringify({
            error: "A chave da API do Google é inválida. Verifique se: 1) A chave está correta, 2) A Google Drive API está ativada no Google Cloud Console, 3) Não há restrições de IP/referrer bloqueando o acesso.",
            errorCode: "API_KEY_INVALID",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Detect API key service blocked (API restrictions on the key)
      if (errText.includes("API_KEY_SERVICE_BLOCKED")) {
        return new Response(
          JSON.stringify({
            error: "A chave da API do Google está bloqueada para o Google Drive API. No Google Cloud Console, edite a chave de API e em 'Restrições de API' selecione 'Não restringir chave' ou adicione 'Google Drive API' à lista de APIs permitidas.",
            errorCode: "API_KEY_SERVICE_BLOCKED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Detect expired or revoked key
      if (errText.includes("API_KEY_EXPIRED")) {
        return new Response(
          JSON.stringify({
            error: "A chave da API do Google expirou ou foi revogada. Gere uma nova chave no Google Cloud Console.",
            errorCode: "API_KEY_EXPIRED",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (driveResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: "Pasta não encontrada. Verifique se o link está correto e se a pasta é pública.", errorCode: "FOLDER_NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (driveResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: "Acesso negado. Verifique se a pasta está compartilhada como 'Qualquer pessoa com o link'.", errorCode: "ACCESS_DENIED" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro ao acessar o Google Drive (código ${driveResponse.status}).`, errorCode: "DRIVE_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driveData = await driveResponse.json();

    const files = (driveData.files || []).map((f: { id: string; name: string; size?: string; modifiedTime?: string }) => ({
      id: f.id,
      name: f.name,
      size: f.size ? parseInt(f.size) : null,
      modifiedTime: f.modifiedTime || null,
    }));


    return new Response(
      JSON.stringify({ success: true, files, folderId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-drive-files error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
