import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Index from "./Index";

const upsertMany = vi.fn(async () => ({ ok: true as const, count: 1 }));
const upsertManyFromOFX = vi.fn(async () => ({ ok: true as const, count: 0 }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "x@y.com" } }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useBankStatements", () => ({
  useBankStatements: () => ({ upsertMany }),
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenses: () => ({ upsertManyFromOFX }),
}));

vi.mock("@/hooks/useDriveLinks", () => ({
  useDriveLinks: () => ({ links: [], addLink: vi.fn(), removeLink: vi.fn() }),
}));

vi.mock("@/components/UserMenu", () => ({ default: () => null }));
vi.mock("@/components/FileUploader", () => ({ default: () => null }));
vi.mock("@/components/DataTable", () => ({
  default: ({ records }: { records: unknown[] }) => (
    <div data-testid="data-table">rows:{records.length}</div>
  ),
}));

vi.mock("@/hooks/usePdfColumnProfiles", () => ({
  usePdfColumnProfiles: () => ({
    profiles: [],
    fetchAll: vi.fn(),
    findBySignature: () => undefined,
    saveProfile: vi.fn(async () => ({ ok: true })),
    removeProfile: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({

  supabase: {
    functions: {
      invoke: vi.fn(async (name: string) => {
        if (name === "list-drive-files") {
          return {
            data: {
              success: true,
              files: [{ id: "F1", name: "multi.ofx", size: 500, modifiedTime: null }],
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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), message: vi.fn(),
  },
}));

const MULTI_OFX = `<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>001</BANKID><BRANCHID>1234</BRANCHID><ACCTID>11111-1</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20250101</DTPOSTED><TRNAMT>-10.00</TRNAMT><FITID>A1</FITID><MEMO>Cafe</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20250102</DTPOSTED><TRNAMT>500.00</TRNAMT><FITID>A2</FITID><MEMO>Salario</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>001</BANKID><BRANCHID>5678</BRANCHID><ACCTID>22222-2</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20250103</DTPOSTED><TRNAMT>-25.00</TRNAMT><FITID>B1</FITID><MEMO>Padaria</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20250104</DTPOSTED><TRNAMT>-40.00</TRNAMT><FITID>B2</FITID><MEMO>Mercado</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("Index — fluxo completo Drive → preview → editar → confirmar", () => {
  beforeEach(() => {
    upsertMany.mockClear();
    upsertManyFromOFX.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, text: MULTI_OFX }),
    })));
  });

  it("baixa do Drive, escolhe a 2ª conta, edita/exclui linha e confirma persistência", async () => {
    render(<Index />);

    // 1) Listar arquivos do Drive
    fireEvent.change(screen.getByPlaceholderText(/drive.google.com/i), {
      target: { value: "https://drive.google.com/drive/folders/AAA" },
    });
    fireEvent.click(screen.getByRole("button", { name: /listar ofx/i }));

    // 2) Baixar o OFX
    fireEvent.click(await screen.findByRole("button", { name: /carregar/i }));

    // 3) Preview com 2 contas — seleciona a segunda
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/2 contas detectadas/i)).toBeInTheDocument();
    const radios = within(dialog).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    fireEvent.click(radios[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: /importar conta selecionada/i }));

    // 3b) Confirma a chave da conta (agência/conta) extraída do arquivo
    const keyDialog = await screen.findByRole("dialog");
    fireEvent.click(within(keyDialog).getByRole("button", { name: /confirmar e carregar/i }));

    // 4) Tela principal com a conta selecionada (5678 / 22222-2, 2 lançamentos)
    await waitFor(() =>
      expect(screen.getByText(/Análise do Extrato/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/5678/)).toBeInTheDocument();
    expect(screen.getByText(/22222-2/)).toBeInTheDocument();
    expect(screen.getByTestId("data-table")).toHaveTextContent("rows:2");

    // 5) Abre "Revisar / Editar" e exclui uma linha
    fireEvent.click(screen.getByRole("button", { name: /revisar \/ editar/i }));
    const editDialog = await screen.findByRole("dialog");
    const includeBoxes = within(editDialog).getAllByRole("checkbox", { name: /incluir/i });
    expect(includeBoxes).toHaveLength(2);
    fireEvent.click(includeBoxes[0]); // desmarca a primeira
    fireEvent.click(within(editDialog).getByRole("button", { name: /confirmar 1/i }));

    // Tabela agora tem apenas 1 registro
    await waitFor(() =>
      expect(screen.getByTestId("data-table")).toHaveTextContent("rows:1"),
    );

    // 6) Salvar na Base → resumo (pre) → Confirmar
    fireEvent.click(screen.getByRole("button", { name: /salvar na base/i }));
    const summary = await screen.findByRole("dialog");
    expect(within(summary).getByText(/resumo da importação/i)).toBeInTheDocument();
    expect(within(summary).getByText("5678")).toBeInTheDocument();
    expect(within(summary).getByText("22222-2")).toBeInTheDocument();
    fireEvent.click(within(summary).getByRole("button", { name: /confirmar e gravar/i }));

    // 7) Persistência chamada com o registro remanescente
    await waitFor(() => expect(upsertMany).toHaveBeenCalledTimes(1));
    const call = upsertMany.mock.calls[0] as unknown as [unknown[], Record<string, unknown>];
    expect(call[0]).toHaveLength(1);
    expect(call[1]).toMatchObject({ agencia: "5678", conta: "22222-2", fileName: "multi.ofx" });
    expect(upsertManyFromOFX).toHaveBeenCalledTimes(1);

    // 8) Resumo pós-importação aparece
    expect(await screen.findByText(/importação concluída/i)).toBeInTheDocument();
  });
});
