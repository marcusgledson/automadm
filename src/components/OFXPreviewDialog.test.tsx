import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import OFXPreviewDialog from "./OFXPreviewDialog";
import type { ParsedOFXStatement } from "@/lib/fileParser";

const stmts: ParsedOFXStatement[] = [
  {
    account: { banco: "Itaú", agencia: "1234", conta: "56789-0" },
    records: Array.from({ length: 3 }).map((_, i) => ({
      data: "01/01/2025", lancamento: "PIX", descricao: `t${i}`,
      valor: -10, tipo: "Débito", tipoLancamento: "DEBIT", categoria: "PIX", raw: {},
    })),
  },
  {
    account: { banco: "Itaú", agencia: "1234", conta: "99999-9" },
    records: Array.from({ length: 5 }).map((_, i) => ({
      data: "02/01/2025", lancamento: "TED", descricao: `t${i}`,
      valor: 20, tipo: "Crédito", tipoLancamento: "CREDIT", categoria: "Transferência", raw: {},
    })),
  },
];

describe("OFXPreviewDialog", () => {
  it("lista múltiplas contas e permite selecionar antes de importar", () => {
    const onConfirm = vi.fn();
    render(
      <OFXPreviewDialog
        open
        fileName="extrato.ofx"
        statements={stmts}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/2 contas detectadas/i)).toBeInTheDocument();
    // Seleciona segunda conta
    const items = screen.getAllByRole("radio");
    expect(items).toHaveLength(2);
    fireEvent.click(items[1]);
    fireEvent.click(screen.getByRole("button", { name: /importar conta selecionada/i }));
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it("mostra badge de incompleto quando falta agência/conta", () => {
    render(
      <OFXPreviewDialog
        open
        statements={[{ account: {}, records: stmts[0].records }]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/incompleto/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: /continuar e completar/i }),
    ).toBeInTheDocument();
  });
});
