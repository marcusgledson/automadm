import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  try {
    const { folderLink } = await req.json();

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

    let apiUrl: string;
    const query = `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`;

    if (API_KEY) {
      apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&orderBy=name&key=${API_KEY}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    } else {
      // Fallback: use the public endpoint without API key (limited but works for public folders)
      apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    }

    const driveResponse = await fetch(apiUrl);

    if (!driveResponse.ok) {
      const errText = await driveResponse.text();
      console.error("Google Drive API error:", driveResponse.status, errText);

      if (driveResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: "Pasta não encontrada. Verifique se o link está correto e se a pasta é pública." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (driveResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: "Acesso negado. Verifique se a pasta está compartilhada como 'Qualquer pessoa com o link'." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao acessar o Google Drive." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driveData = await driveResponse.json();

    const files = (driveData.files || []).map((f: { id: string; name: string; size?: string; modifiedTime?: string }) => ({
      id: f.id,
      name: f.name,
      size: f.size ? parseInt(f.size) : null,
      modifiedTime: f.modifiedTime || null,
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media${API_KEY ? `&key=${API_KEY}` : ""}`,
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
