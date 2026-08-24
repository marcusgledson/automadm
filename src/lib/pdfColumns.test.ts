import { describe, it, expect } from "vitest";
import { detectColumns, parsePdfStatementLayout, type PdfLine } from "@/lib/pdfStatementParser";

function line(page: number, y: number, cells: [number, string][]): PdfLine {
  const mapped = cells.map(([x, text]) => ({ x, width: text.length * 5, text }));
  return { page, y, cells: mapped, text: mapped.map((c) => c.text).join(" ") };
}

describe("detectColumns", () => {
  it("detecta cabeçalho Data/Histórico/Documento/Valor", () => {
    const lines = [
      line(1, 700, [[40, "Data"], [110, "Histórico"], [300, "Documento"], [420, "Valor"]]),
    ];
    const res = detectColumns(lines);
    expect(res?.headerIndex).toBe(0);
    expect(res?.columns.map((c) => c.field)).toEqual(["data", "descricao", "documento", "valor"]);
  });

  it("ignora linhas que não são cabeçalho", () => {
    expect(detectColumns([line(1, 700, [[40, "Extrato mensal"]])])).toBeUndefined();
  });
});

describe("parsePdfStatementLayout", () => {
  it("lê extrato com colunas Débito e Crédito separadas", () => {
    const lines = [
      line(1, 760, [[40, "Banco Bradesco"]]),
      line(1, 745, [[40, "Cliente: JOAO DA SILVA"], [300, "CPF: 123.456.789-09"]]),
      line(1, 730, [[40, "Agência: 1234"], [200, "Conta: 56789-0"]]),
      line(1, 700, [[40, "Data"], [110, "Histórico"], [300, "Débito"], [400, "Crédito"]]),
      line(1, 680, [[40, "05/03/2026"], [110, "PIX RECEBIDO"], [400, "1.500,00"]]),
      line(1, 665, [[40, "06/03/2026"], [110, "TARIFA MENSAL"], [300, "35,90"]]),
      line(1, 650, [[110, "REF PACOTE SERVICOS"]]),
    ];
    const parsed = parsePdfStatementLayout(lines);

    expect(parsed.strategy).toBe("colunas");
    expect(parsed.account.agencia).toBe("1234");
    expect(parsed.account.conta).toBe("56789-0");
    expect(parsed.bank?.name).toBe("Bradesco");
    expect(parsed.holder.titular).toBe("JOAO DA SILVA");
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0].valor).toBe(1500);
    expect(parsed.records[1].valor).toBe(-35.9);
    expect(parsed.records[1].descricao).toContain("REF PACOTE SERVICOS");
  });

  it("usa fallback linha a linha quando não há cabeçalho reconhecido", () => {
    const lines = [
      line(1, 700, [[40, "10/04/2026 COMPRA CARTAO 250,00 D"]]),
      line(1, 690, [[40, "11/04/2026 SALARIO 3.000,00 C"]]),
    ];
    const parsed = parsePdfStatementLayout(lines);
    expect(parsed.strategy).toBe("linhas");
    expect(parsed.records.map((r) => r.valor)).toEqual([-250, 3000]);
  });
});

describe("layouts adicionais", () => {
  it("reconhece cabeçalho em célula única (Data Histórico Valor Saldo)", () => {
    const lines = [
      line(1, 700, [[40, "Data Histórico Valor Saldo"]]),
      line(1, 680, [[40, "01/05/2026"], [120, "PIX ENVIADO"], [330, "100,00-"], [430, "900,00"]]),
    ];
    const res = detectColumns(lines);
    expect(res?.columns.map((c) => c.field)).toEqual(["data", "descricao", "valor", "saldo"]);
    const parsed = parsePdfStatementLayout(lines);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].valor).toBe(-100);
  });

  it("herda a data do bloco anterior e ignora o saldo no fallback", () => {
    const lines = [
      line(1, 700, [[40, "02/06/2026 COMPRA MERCADO R$ 80,00 1.000,00"]]),
      line(1, 690, [[40, "PAGAMENTO BOLETO 120,00 880,00"]]),
    ];
    const parsed = parsePdfStatementLayout(lines);
    expect(parsed.strategy).toBe("linhas");
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records.map((r) => r.data)).toEqual(["02/06/2026", "02/06/2026"]);
    expect(parsed.records.map((r) => r.valor)).toEqual([80, 120]);
  });

  it("informa diagnóstico quando não há camada de texto", () => {
    const parsed = parsePdfStatementLayout([]);
    expect(parsed.records).toHaveLength(0);
    expect(parsed.diagnostics.temTexto).toBe(false);
    expect(parsed.diagnostics.motivo).toContain("camada de texto");
  });
});
