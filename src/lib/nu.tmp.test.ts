import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { parsePdfStatementLines } from "./pdfStatementParser";
describe("nu", () => { it("lê", () => {
  const p = parsePdfStatementLines(readFileSync("/tmp/nu.txt","utf8").split(/\r?\n/));
  console.log("strategy", p.strategy, "records", p.records.length, p.account, p.holder);
  console.log(JSON.stringify(p.records.slice(0,6), null, 1));
  console.log("entradas", p.records.filter(r=>r.valor>0).reduce((s,r)=>s+r.valor,0).toFixed(2));
  console.log("saidas", p.records.filter(r=>r.valor<0).reduce((s,r)=>s+r.valor,0).toFixed(2));
}); });
