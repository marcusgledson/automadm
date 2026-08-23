import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Cliente do backend mockado: sem chamadas de rede no teste de smoke.
vi.mock("@/integrations/supabase/client", () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
      },
      from: () => query,
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});

describe("smoke: rota /auth", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.pushState({}, "", "/auth");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("carrega a tela de login sem erros e com os providers registrados", async () => {
    const { default: App } = await import("@/App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/e-?mail/i)).toBeInTheDocument();
    });

    // Nenhum erro de provider ausente / boundary acionado.
    const messages = errorSpy.mock.calls.map((c) => String(c[0] ?? ""));
    expect(messages.some((m) => m.includes("AppErrorBoundary"))).toBe(false);
    expect(messages.some((m) => m.includes("is not defined"))).toBe(false);
  });
});
