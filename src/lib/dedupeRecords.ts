import type { FinancialRecord } from "@/lib/fileParser";

/** Chave lógica de um lançamento dentro de uma conta. */
export function recordKey(r: FinancialRecord): string {
  const desc = (r.descricao || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${r.data}|${r.valor.toFixed(2)}|${r.documento ?? ""}|${desc}`;
}

export interface DedupeResult {
  records: FinancialRecord[];
  removed: number;
}

/**
 * Remove lançamentos repetidos dentro de um mesmo lote (arquivos com períodos
 * sobrepostos), preservando a ordem original.
 */
export function dedupeRecords(
  records: FinancialRecord[],
  seen: Set<string> = new Set(),
): DedupeResult {
  const out: FinancialRecord[] = [];
  let removed = 0;
  for (const r of records) {
    const key = recordKey(r);
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    out.push(r);
  }
  return { records: out, removed };
}
