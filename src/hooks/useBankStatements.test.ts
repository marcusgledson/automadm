import { describe, it, expect } from "vitest";
import { buildFitids } from "./useBankStatements";
import type { FinancialRecord } from "@/lib/fileParser";

function rec(partial: Partial<FinancialRecord>): FinancialRecord {
  return {
    data: "01/01/2025",
    lancamento: "",
    descricao: "Padaria",
    valor: -25,
    tipo: "D",
    tipoLancamento: "debito",
    categoria: "outros",
    ...partial,
  } as FinancialRecord;
}

describe("buildFitids", () => {
  it("mantém fitids distintos sem sufixo", () => {
    const out = buildFitids([rec({ fitid: "A1" }), rec({ fitid: "A2" })]);
    expect(out).toEqual(["A1", "A2"]);
  });

  it("sufixa ocorrências repetidas do mesmo fitid", () => {
    const out = buildFitids([rec({ fitid: "A1" }), rec({ fitid: "A1" }), rec({ fitid: "A1" })]);
    expect(out).toEqual(["A1", "A1#2", "A1#3"]);
  });

  it("sufixa lançamentos idênticos sem fitid/documento (fallback data|valor|descrição)", () => {
    const out = buildFitids([rec({}), rec({})]);
    expect(out[1]).toBe(`${out[0]}#2`);
  });

  it("é estável na reimportação do mesmo arquivo", () => {
    const file = [rec({ fitid: "X" }), rec({ fitid: "X" }), rec({ fitid: "Y" })];
    expect(buildFitids(file)).toEqual(buildFitids(file));
  });
});
