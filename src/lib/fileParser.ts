export interface FinancialRecord {
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  categoria: string;
  documento?: string;
  raw: Record<string, unknown>;
}

function classifyType(valor: number): string {
  if (valor > 0) return "Crédito";
  if (valor < 0) return "Débito";
  return "Neutro";
}

function classifyCategory(descricao: string): string {
  const d = descricao.toLowerCase();
  if (d.includes("saldo") && d.includes("dia")) return "Saldo do Dia";
  if (d.includes("pix")) return "PIX";
  if (d.includes("ted") || d.includes("doc")) return "Transferência";
  if (d.includes("boleto")) return "Boleto";
  if (d.includes("tarifa") || d.includes("taxa") || d.includes("iof")) return "Tarifa";
  if (d.includes("salario") || d.includes("salário") || d.includes("pagamento")) return "Pagamento";
  if (d.includes("saque")) return "Saque";
  if (d.includes("deposito") || d.includes("depósito")) return "Depósito";
  if (d.includes("compra") || d.includes("debito automatico")) return "Compra";
  if (d.includes("juros") || d.includes("rendimento")) return "Rendimento";
  if (d.includes("estorno")) return "Estorno";
  return "Outros";
}

export function parseOFX(text: string): FinancialRecord[] {
  const records: FinancialRecord[] = [];
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const valor = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    const descricao = get("MEMO") || get("NAME") || "";
    const dtStr = get("DTPOSTED");
    const data = dtStr.length >= 8
      ? `${dtStr.slice(6, 8)}/${dtStr.slice(4, 6)}/${dtStr.slice(0, 4)}`
      : "";

    records.push({
      data,
      descricao,
      valor,
      tipo: classifyType(valor),
      categoria: classifyCategory(descricao),
      documento: get("FITID") || undefined,
      raw: { DTPOSTED: dtStr, TRNAMT: get("TRNAMT"), MEMO: descricao },
    });
  }
  return records;
}

export async function parseFile(file: File): Promise<FinancialRecord[]> {
  const text = await file.text();
  return parseOFX(text);
}
