import { describe, it, expect } from "vitest";
import { extractHolder, maskDocument, matchAccount, type KnownAccount } from "@/lib/accountHolder";

describe("extractHolder", () => {
  it("extrai CPF e titular com rótulo", () => {
    const info = extractHolder([
      "Extrato de Conta Corrente",
      "Cliente: MARIA DA SILVA SOUZA",
      "CPF: 123.456.789-09",
    ]);
    expect(info.titular).toBe("MARIA DA SILVA SOUZA");
    expect(info.documento).toBe("123.456.789-09");
    expect(info.documentoTipo).toBe("CPF");
  });

  it("extrai CNPJ e razão social pela linha anterior", () => {
    const info = extractHolder([
      "Banco Exemplo",
      "AUTOMADM SERVICOS LTDA",
      "12.345.678/0001-90",
    ]);
    expect(info.documentoTipo).toBe("CNPJ");
    expect(info.titular).toBe("AUTOMADM SERVICOS LTDA");
  });

  it("não inventa dados quando não há titular", () => {
    expect(extractHolder(["Saldo anterior 100,00"]).documento).toBeUndefined();
  });
});

describe("maskDocument", () => {
  it("mascara CPF e CNPJ", () => {
    expect(maskDocument("123.456.789-09")).toBe("123.***.***-09");
    expect(maskDocument("12.345.678/0001-90")).toBe("12.***.***/0001-90");
  });
});

describe("matchAccount", () => {
  const known: KnownAccount[] = [
    { id: "a", apelido: "Empresa", agencia: "1234", conta: "56789-0", documento: "12.345.678/0001-90", titular: "AUTOMADM LTDA" },
    { id: "b", apelido: "Pessoal", agencia: "4321", conta: "11111-1", documento: "123.456.789-09", titular: "MARIA" },
  ];

  it("reconhece pela agência/conta", () => {
    const m = matchAccount({ agencia: "1234", conta: "567890" }, known);
    expect(m?.account.id).toBe("a");
    expect(m?.reason).toBe("agencia_conta");
  });

  it("reconhece pelo documento em conta diferente e aponta conflito", () => {
    const m = matchAccount({ agencia: "9999", conta: "88888-8", documento: "123.456.789-09" }, known);
    expect(m?.account.id).toBe("b");
    expect(m?.reason).toBe("documento");
    expect(m?.conflicts.length).toBeGreaterThan(0);
  });

  it("aponta conflito de titular na mesma conta", () => {
    const m = matchAccount({ agencia: "4321", conta: "11111-1", titular: "JOAO" }, known);
    expect(m?.conflicts.some((c) => c.includes("titular"))).toBe(true);
  });

  it("retorna undefined sem correspondência", () => {
    expect(matchAccount({ agencia: "0000", conta: "0000-0" }, known)).toBeUndefined();
  });
});
