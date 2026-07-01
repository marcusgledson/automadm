import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EditableRecordsDialog from "./EditableRecordsDialog";
import type { FinancialRecord } from "@/lib/fileParser";

const recs: FinancialRecord[] = [
  { data: "01/01/2025", lancamento: "PIX", descricao: "Café", valor: -8, tipo: "Débito", tipoLancamento: "DEBIT", categoria: "PIX", fitid: "a", raw: {} },
  { data: "02/01/2025", lancamento: "PIX", descricao: "Salário", valor: 500, tipo: "Crédito", tipoLancamento: "CREDIT", categoria: "Pagamento", fitid: "b", raw: {} },
];

describe("EditableRecordsDialog", () => {
  it("permite editar descrição e excluir linhas antes de confirmar", () => {
    const onConfirm = vi.fn();
    render(<EditableRecordsDialog open records={recs} onCancel={vi.fn()} onConfirm={onConfirm} />);

    // Edita descrição da primeira linha
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Café gourmet" } });

    // Desmarca segunda linha
    const checkboxes = screen.getAllByRole("checkbox", { name: /incluir/i });
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: /confirmar 1/i }));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ descricao: "Café gourmet", fitid: "a" }),
    ]);
  });
});
