import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { FinancialRecord } from "./fileParser";

interface SummaryOptions {
  records: FinancialRecord[];
  filterTipo: string;
  filterCategoria: string;
  format: "pdf" | "image";
}

function buildSummaryData(records: FinancialRecord[]) {
  const categorias = [...new Set(records.map((r) => r.categoria))].sort();
  const rows = categorias.map((cat) => {
    const items = records.filter((r) => r.categoria === cat);
    const creditos = items.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
    const debitos = items.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
    return {
      categoria: cat,
      qtd: items.length,
      creditos,
      debitos,
      total: creditos + debitos,
    };
  });
  const totalCreditos = records.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
  const totalDebitos = records.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
  return { rows, totalCreditos, totalDebitos, saldo: totalCreditos + totalDebitos };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function exportSummary({ records, filterTipo, filterCategoria, format }: SummaryOptions) {
  let filtered = records;
  if (filterTipo !== "todos") filtered = filtered.filter((r) => r.tipo === filterTipo);
  if (filterCategoria !== "todos") filtered = filtered.filter((r) => r.categoria === filterCategoria);

  const { rows, totalCreditos, totalDebitos, saldo } = buildSummaryData(filtered);

  if (format === "pdf") {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Resumo Financeiro", 14, 20);

    doc.setFontSize(10);
    const filters: string[] = [];
    if (filterTipo !== "todos") filters.push(`Tipo: ${filterTipo}`);
    if (filterCategoria !== "todos") filters.push(`Categoria: ${filterCategoria}`);
    doc.text(filters.length > 0 ? `Filtros: ${filters.join(" | ")}` : "Sem filtros aplicados", 14, 28);

    doc.setFontSize(11);
    doc.text(`Créditos: ${fmt(totalCreditos)}`, 14, 38);
    doc.text(`Débitos: ${fmt(totalDebitos)}`, 14, 45);
    doc.text(`Saldo: ${fmt(saldo)}`, 14, 52);

    autoTable(doc, {
      startY: 60,
      head: [["Categoria", "Qtd", "Créditos", "Débitos", "Total"]],
      body: rows.map((r) => [r.categoria, r.qtd, fmt(r.creditos), fmt(r.debitos), fmt(r.total)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 105] },
    });

    doc.save("resumo-financeiro.pdf");
  } else {
    // Gerar imagem via canvas offscreen
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;padding:32px;background:#fff;font-family:sans-serif;color:#1a1a1a;";

    let html = `<h2 style="margin:0 0 8px;font-size:20px;color:#298069;">Resumo Financeiro</h2>`;
    const filters: string[] = [];
    if (filterTipo !== "todos") filters.push(`Tipo: ${filterTipo}`);
    if (filterCategoria !== "todos") filters.push(`Categoria: ${filterCategoria}`);
    html += `<p style="margin:0 0 16px;font-size:12px;color:#666;">${filters.length > 0 ? `Filtros: ${filters.join(" | ")}` : "Sem filtros aplicados"}</p>`;

    html += `<div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="flex:1;padding:12px;background:#f0fdf4;border-radius:8px;"><span style="font-size:11px;color:#666;">Créditos</span><br/><strong style="font-size:18px;color:#298069;">${fmt(totalCreditos)}</strong></div>
      <div style="flex:1;padding:12px;background:#fef2f2;border-radius:8px;"><span style="font-size:11px;color:#666;">Débitos</span><br/><strong style="font-size:18px;color:#dc2626;">${fmt(totalDebitos)}</strong></div>
      <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;"><span style="font-size:11px;color:#666;">Saldo</span><br/><strong style="font-size:18px;color:${saldo >= 0 ? '#298069' : '#dc2626'};">${fmt(saldo)}</strong></div>
    </div>`;

    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#298069;color:#fff;">
        <th style="padding:8px;text-align:left;">Categoria</th>
        <th style="padding:8px;text-align:center;">Qtd</th>
        <th style="padding:8px;text-align:right;">Créditos</th>
        <th style="padding:8px;text-align:right;">Débitos</th>
        <th style="padding:8px;text-align:right;">Total</th>
      </tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const bg = i % 2 === 0 ? "#f9fafb" : "#fff";
      html += `<tr style="background:${bg};">
        <td style="padding:6px 8px;">${r.categoria}</td>
        <td style="padding:6px 8px;text-align:center;">${r.qtd}</td>
        <td style="padding:6px 8px;text-align:right;">${fmt(r.creditos)}</td>
        <td style="padding:6px 8px;text-align:right;">${fmt(r.debitos)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;">${fmt(r.total)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    container.innerHTML = html;
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    document.body.removeChild(container);

    const link = document.createElement("a");
    link.download = "resumo-financeiro.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
