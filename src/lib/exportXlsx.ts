import * as XLSX from "xlsx";
import { FinancialRecord } from "./fileParser";

export function exportToXlsx(records: FinancialRecord[], fileName: string) {
  const wb = XLSX.utils.book_new();

  // Aba principal com todos os registros
  const mainData = records.map((r) => ({
    Data: r.data,
    Descrição: r.descricao,
    Valor: r.valor,
    Tipo: r.tipo,
    Categoria: r.categoria,
    Documento: r.documento || "",
  }));
  const wsAll = XLSX.utils.json_to_sheet(mainData);
  wsAll["!cols"] = [
    { wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, "Todos");

  // Aba por Tipo
  const tipos = [...new Set(records.map((r) => r.tipo))];
  for (const tipo of tipos) {
    const filtered = records.filter((r) => r.tipo === tipo);
    const data = filtered.map((r) => ({
      Data: r.data,
      Descrição: r.descricao,
      Valor: r.valor,
      Categoria: r.categoria,
      Documento: r.documento || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, tipo.substring(0, 31));
  }

  // Aba por Categoria
  const categorias = [...new Set(records.map((r) => r.categoria))].sort();
  for (const cat of categorias) {
    const filtered = records.filter((r) => r.categoria === cat);
    const data = filtered.map((r) => ({
      Data: r.data,
      Descrição: r.descricao,
      Valor: r.valor,
      Tipo: r.tipo,
      Documento: r.documento || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 20 }];
    const sheetName = `Cat_${cat}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Aba Resumo
  const resumoData = categorias.map((cat) => {
    const items = records.filter((r) => r.categoria === cat);
    const total = items.reduce((s, r) => s + r.valor, 0);
    const creditos = items.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
    const debitos = items.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
    return { Categoria: cat, Quantidade: items.length, Créditos: creditos, Débitos: debitos, Total: total };
  });
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  XLSX.writeFile(wb, fileName);
}
