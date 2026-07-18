import { describe, expect, it } from "vitest";
import {
  BANK_PRESETS,
  detectKind,
  extractAmount,
  extractDate,
  extractLastDigits,
  extractMerchant,
  matchesSender,
  parseBrAmount,
  parseSms,
} from "./smsParser";

const itau = BANK_PRESETS.find((b) => b.bank_name === "Itaú")!;
const nubank = BANK_PRESETS.find((b) => b.bank_name === "Nubank")!;

describe("parseBrAmount", () => {
  it("parses BR formatted amounts", () => {
    expect(parseBrAmount("1.234,56")).toBe(1234.56);
    expect(parseBrAmount("89,90")).toBe(89.9);
    expect(parseBrAmount("100.00")).toBe(100);
  });
});

describe("extractAmount", () => {
  it("extracts R$ amount from Itaú-style SMS", () => {
    expect(
      extractAmount("ITAU: compra aprovada de R$ 129,90 em SUPERMERCADO XYZ"),
    ).toBe(129.9);
  });
  it("extracts amount without R$", () => {
    expect(extractAmount("Pix enviado 1.500,00 para Fulano")).toBe(1500);
  });
  it("returns null when no amount", () => {
    expect(extractAmount("mensagem sem valor")).toBeNull();
  });
});

describe("extractDate", () => {
  it("parses dd/mm/yyyy hh:mm", () => {
    const iso = extractDate("compra em 15/03/2026 14:22");
    expect(iso).not.toBeNull();
    expect(iso!.startsWith("2026-03-15")).toBe(true);
  });
  it("parses dd/mm falling back to current year", () => {
    const iso = extractDate("compra em 05/07", new Date(2026, 0, 1));
    expect(iso!.startsWith("2026-07-05")).toBe(true);
  });
});

describe("extractLastDigits", () => {
  it("extracts final 4 digits", () => {
    expect(extractLastDigits("cartao final 1234")).toBe("1234");
    expect(extractLastDigits("Conta terminada em 9876")).toBe("9876");
  });
});

describe("extractMerchant", () => {
  it("extracts merchant name", () => {
    expect(
      extractMerchant("compra aprovada em POSTO SHELL BR em 10/01"),
    ).toMatch(/POSTO SHELL/);
  });
});

describe("detectKind", () => {
  it("detects debit", () => {
    expect(detectKind("compra aprovada R$ 50,00", itau)).toBe("debit");
  });
  it("detects credit", () => {
    expect(detectKind("Pix recebido de Fulano R$ 200,00", itau)).toBe("credit");
  });
  it("returns unknown for ambiguous", () => {
    expect(detectKind("saldo disponível R$ 500,00", itau)).toBe("unknown");
  });
});

describe("matchesSender", () => {
  it("matches Itaú sender variations", () => {
    expect(matchesSender("ITAU", itau)).toBe(true);
    expect(matchesSender("Itaú", itau)).toBe(true);
    expect(matchesSender("BRADESCO", itau)).toBe(false);
  });
});

describe("parseSms end-to-end", () => {
  it("parses full Itaú debit SMS", () => {
    const r = parseSms(
      "ITAU",
      "ITAU: compra aprovada de R$ 129,90 em SUPERMERCADO XYZ no cartao final 4321 em 15/03/2026 14:22",
      itau,
    );
    expect(r.kind).toBe("debit");
    expect(r.amount).toBe(129.9);
    expect(r.last_digits).toBe("4321");
    expect(r.received_at!.startsWith("2026-03-15")).toBe(true);
    expect(r.merchant).toMatch(/SUPERMERCADO/);
  });
  it("parses full Nubank credit SMS", () => {
    const r = parseSms(
      "NUBANK",
      "Nubank: Pix recebido de R$ 500,00 em 01/02/2026",
      nubank,
    );
    expect(r.kind).toBe("credit");
    expect(r.amount).toBe(500);
    expect(r.received_at!.startsWith("2026-02-01")).toBe(true);
  });
});
