import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import GoogleDriveOFXImport from "./GoogleDriveOFXImport";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (name: string) => {
        if (name === "list-drive-files") {
          return {
            data: {
              success: true,
              files: [
                { id: "F1", name: "extrato.ofx", size: 1234, modifiedTime: null },
              ],
            },
            error: null,
          };
        }
        return { data: null, error: new Error("unknown fn") };
      }),
    },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "TOK" } } })),
    },
  },
}));

vi.mock("@/hooks/useDriveLinks", () => ({
  useDriveLinks: () => ({ links: [], addLink: vi.fn(), removeLink: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), message: vi.fn(),
  },
}));

describe("GoogleDriveOFXImport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra erro amigável e botão Tentar novamente ao falhar o download", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Sem permissão (403)" }),
    });

    const onOFXLoaded = vi.fn();
    render(<GoogleDriveOFXImport onOFXLoaded={onOFXLoaded} />);

    fireEvent.change(screen.getByPlaceholderText(/drive.google.com/i), {
      target: { value: "https://drive.google.com/drive/folders/AAA" },
    });
    fireEvent.click(screen.getByRole("button", { name: /listar ofx/i }));

    const carregar = await screen.findByRole("button", { name: /carregar/i });
    fireEvent.click(carregar);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/falha ao baixar/i)).toBeInTheDocument();
    expect(within(alert).getByText(/sem permiss/i)).toBeInTheDocument();

    // Retry: refaz a chamada
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, text: "<OFX></OFX>" }),
    });
    fireEvent.click(within(alert).getByRole("button", { name: /tentar novamente/i }));

    await waitFor(() => expect(onOFXLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "extrato.ofx" }),
    ));
  });

  it("mostra barra de progresso e permite cancelar", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener("abort", () => {
            const err = new DOMException("aborted", "AbortError");
            rej(err);
          });
        }),
    );

    render(<GoogleDriveOFXImport onOFXLoaded={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/drive.google.com/i), {
      target: { value: "https://drive.google.com/drive/folders/AAA" },
    });
    fireEvent.click(screen.getByRole("button", { name: /listar ofx/i }));
    fireEvent.click(await screen.findByRole("button", { name: /carregar/i }));

    // Painel de progresso aparece
    expect(await screen.findByTestId("drive-progress")).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    // Após cancelar, aparece alerta com mensagem apropriada
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/cancelad/i)).toBeInTheDocument();
  });
});
