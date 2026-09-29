import { describe, it, expect } from "vitest";
import { detectBankFromText } from "@/lib/bankDetect";
import { bankByAlias, bankByCode } from "@/lib/bankRegistry";

describe("bankRegistry", () => {
  it("resolve banco por código COMPE", () => {
    expect(bankByCode("001")?.name).toBe("Banco do Brasil");
    expect(bankByCode("341")?.name).toContain("Itaú");
    expect(bankByCode("999")).toBeUndefined();
  });

  it("resolve banco por apelido, ignorando acentos", () => {
    expect(bankByAlias("Extrato ITAU UNIBANCO S.A.")?.code).toBe("341");
    expect(bankByAlias("conta caixa economica federal")?.code).toBe("104");
  });
});

describe("detectBankFromText", () => {
  it("prioriza o BANKID do OFX", () => {
    const d = detectBankFromText("<FI><ORG>X</ORG></FI><BANKID>033</BANKID>");
    expect(d?.code).toBe("033");
    expect(d?.source).toBe("codigo");
  });

  it("identifica por código no cabeçalho do PDF", () => {
    const d = detectBankFromText("Banco: 237  Extrato de conta corrente");
    expect(d?.name).toBe("Bradesco");
    expect(d?.source).toBe("codigo");
  });

  it("identifica por nome quando não há código", () => {
    const d = detectBankFromText("Extrato Sicoob - agência 3010");
    expect(d?.code).toBe("756");
    expect(d?.source).toBe("nome");
  });

  it("retorna undefined para texto sem banco", () => {
    expect(detectBankFromText("lista de compras")).toBeUndefined();
  });
});

describe("detectBankFromText — contrapartes", () => {
  it("não confunde Nubank com banco de contraparte Pix", () => {
    const t = [
      "EMPRESA X", "Agência", "0001", "Conta", "48639989-1",
      "FULANO - •••.720.638-•• - ITAÚ", "UNIBANCO S.A. (0341) Agência: 7480 Conta: 8066-",
      "ITAÚ UNIBANCO S.A. (0341) Agência: 368 Conta:",
      "fale com a Ouvidoria em 0800 887 0463", "disponíveis em nubank.com.br/contatos#ouvidoria .",
    ].join("\n");
    expect(detectBankFromText(t)?.code).toBe("260");
  });
});
