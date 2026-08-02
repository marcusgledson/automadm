import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Calculator, Filter, Loader2, TrendingUp, PiggyBank, Percent, Lightbulb } from "lucide-react";

const fmtBRL = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)}%`;

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))",
  "hsl(160 60% 45%)", "hsl(40 80% 55%)", "hsl(220 60% 55%)", "hsl(280 50% 55%)",
];

type SourceKey = "expenses" | "bank_statements" | "consumption_bills";

interface Movement {
  id: string;
  source: SourceKey;
  date: string;      // YYYY-MM-DD
  month: string;     // YYYY-MM
  label: string;
  category: string;
  origin: string;
  value: number;     // positivo = saída (custo); negativo = entrada
}

const SOURCE_LABELS: Record<SourceKey, string> = {
  expenses: "Despesas / Boletos",
  bank_statements: "Extrato bancário",
  consumption_bills: "Contas de consumo",
};

/** Taxa mensal implícita de um financiamento (bisseção sobre a fórmula Price). */
export function impliedMonthlyRate(pv: number, pmt: number, n: number): number {
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;
  if (pmt * n <= pv) return 0;
  const f = (i: number) => (i === 0 ? pmt * n - pv : (pmt * (1 - Math.pow(1 + i, -n))) / i - pv);
  let lo = 1e-9, hi = 2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Saldo devedor após p parcelas pagas (sistema Price). */
export function outstandingBalance(pmt: number, i: number, remaining: number): number {
  if (remaining <= 0) return 0;
  if (i <= 0) return pmt * remaining;
  return (pmt * (1 - Math.pow(1 + i, -remaining))) / i;
}

export default function AdvancedFinanceAnalysis() {
  const [loading, setLoading] = useState(true);
  const [movs, setMovs] = useState<Movement[]>([]);

  // Filtros
  const [sources, setSources] = useState<SourceKey[]>(["expenses", "bank_statements", "consumption_bills"]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("__all__");
  const [minValue, setMinValue] = useState("");
  const [onlyOutflow, setOnlyOutflow] = useState(true);

  // Projeção
  const [projMonths, setProjMonths] = useState(12);
  const [inflation, setInflation] = useState(0.5); // % a.m.

  // Simulador de dívida
  const [loanPv, setLoanPv] = useState("20000");
  const [loanPmt, setLoanPmt] = useState("850");
  const [loanN, setLoanN] = useState("36");
  const [loanPaid, setLoanPaid] = useState("6");

  // Investimento
  const [invInitial, setInvInitial] = useState("1000");
  const [invMonthly, setInvMonthly] = useState("500");
  const [invRate, setInvRate] = useState("0.9");
  const [invMonths, setInvMonths] = useState(60);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [exp, bank, bills] = await Promise.all([
        supabase.from("expenses").select("*"),
        supabase.from("bank_statements").select("*"),
        supabase.from("consumption_bills").select("*"),
      ]);
      const out: Movement[] = [];

      for (const e of exp.data ?? []) {
        const d = (e.data_pagamento || e.data_vencimento || e.created_at.slice(0, 10)) as string;
        out.push({
          id: `e-${e.id}`, source: "expenses", date: d, month: d.slice(0, 7),
          label: e.detalhes || e.categoria || "Despesa",
          category: e.categoria || "Outros",
          origin: e.origem || "manual",
          value: Math.abs(Number(e.valor) || 0),
        });
      }
      for (const b of bank.data ?? []) {
        const d = (b.data || b.created_at.slice(0, 10)) as string;
        const v = Number(b.valor) || 0;
        out.push({
          id: `b-${b.id}`, source: "bank_statements", date: d, month: d.slice(0, 7),
          label: b.descricao || b.lancamento || "Lançamento",
          category: b.categoria || "Extrato",
          origin: b.tipo_lancamento || b.tipo || "—",
          value: v < 0 ? Math.abs(v) : -v,
        });
      }
      for (const c of bills.data ?? []) {
        const d = c.data_vencimento as string;
        out.push({
          id: `c-${c.id}`, source: "consumption_bills", date: d, month: d.slice(0, 7),
          label: `${c.tipo_conta} · ${c.fornecedor || c.codigo_instalacao}`,
          category: String(c.tipo_conta),
          origin: "fatura",
          value: Number(c.valor_total) || 0,
        });
      }
      out.sort((a, b) => a.date.localeCompare(b.date));
      setMovs(out);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(movs.map((m) => m.category))).sort(),
    [movs],
  );

  const filtered = useMemo(() => {
    const min = parseFloat(minValue.replace(",", ".")) || 0;
    return movs.filter((m) => {
      if (!sources.includes(m.source)) return false;
      if (from && m.date < from) return false;
      if (to && m.date > to) return false;
      if (category !== "__all__" && m.category !== category) return false;
      if (onlyOutflow && m.value <= 0) return false;
      if (min && Math.abs(m.value) < min) return false;
      return true;
    });
  }, [movs, sources, from, to, category, onlyOutflow, minValue]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; saida: number; entrada: number; count: number }>();
    for (const m of filtered) {
      const cur = map.get(m.month) || { month: m.month, saida: 0, entrada: 0, count: 0 };
      if (m.value >= 0) cur.saida += m.value; else cur.entrada += Math.abs(m.value);
      cur.count += 1;
      map.set(m.month, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) if (m.value > 0) map.set(m.category, (map.get(m.category) || 0) + m.value);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const kpi = useMemo(() => {
    const saida = filtered.filter((m) => m.value > 0).reduce((s, m) => s + m.value, 0);
    const entrada = filtered.filter((m) => m.value < 0).reduce((s, m) => s + Math.abs(m.value), 0);
    const meses = monthly.length || 1;
    const mediaMensal = saida / meses;
    // custo fixo = categorias presentes em >=70% dos meses
    const catMonths = new Map<string, Set<string>>();
    for (const m of filtered) {
      if (m.value <= 0) continue;
      if (!catMonths.has(m.category)) catMonths.set(m.category, new Set());
      catMonths.get(m.category)!.add(m.month);
    }
    let fixos = 0;
    for (const [cat, set] of catMonths) {
      if (set.size / meses >= 0.7) {
        fixos += filtered.filter((m) => m.category === cat && m.value > 0).reduce((s, m) => s + m.value, 0);
      }
    }
    const first = monthly[0]?.saida ?? 0;
    const last = monthly[monthly.length - 1]?.saida ?? 0;
    const variacao = first > 0 ? ((last - first) / first) * 100 : 0;
    return { saida, entrada, meses, mediaMensal, fixos, fixosMensal: fixos / meses, variacao, saldo: entrada - saida };
  }, [filtered, monthly]);

  const projection = useMemo(() => {
    const base = kpi.mediaMensal;
    const g = inflation / 100;
    const rows: { label: string; projetado: number; acumulado: number }[] = [];
    let acc = 0;
    const start = monthly[monthly.length - 1]?.month;
    const d = start ? new Date(`${start}-01T00:00:00`) : new Date();
    for (let i = 1; i <= projMonths; i++) {
      const v = base * Math.pow(1 + g, i);
      acc += v;
      const dt = new Date(d.getFullYear(), d.getMonth() + i, 1);
      rows.push({
        label: `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getFullYear()).slice(2)}`,
        projetado: v,
        acumulado: acc,
      });
    }
    return rows;
  }, [kpi.mediaMensal, inflation, projMonths, monthly]);

  const loan = useMemo(() => {
    const pv = parseFloat(loanPv.replace(",", ".")) || 0;
    const pmt = parseFloat(loanPmt.replace(",", ".")) || 0;
    const n = parseInt(loanN, 10) || 0;
    const paid = Math.min(parseInt(loanPaid, 10) || 0, n);
    const i = impliedMonthlyRate(pv, pmt, n);
    const anual = Math.pow(1 + i, 12) - 1;
    const totalPago = pmt * n;
    const jurosTotais = totalPago - pv;
    const remaining = n - paid;
    const saldo = outstandingBalance(pmt, i, remaining);
    const economiaQuitacao = pmt * remaining - saldo;
    return { pv, pmt, n, paid, i, anual, totalPago, jurosTotais, remaining, saldo, economiaQuitacao };
  }, [loanPv, loanPmt, loanN, loanPaid]);

  const invest = useMemo(() => {
    const p0 = parseFloat(invInitial.replace(",", ".")) || 0;
    const ap = parseFloat(invMonthly.replace(",", ".")) || 0;
    const i = (parseFloat(invRate.replace(",", ".")) || 0) / 100;
    const rows: { label: string; investido: number; montante: number }[] = [];
    let saldo = p0;
    let investido = p0;
    for (let m = 1; m <= invMonths; m++) {
      saldo = saldo * (1 + i) + ap;
      investido += ap;
      if (m % Math.max(1, Math.round(invMonths / 24)) === 0 || m === invMonths) {
        rows.push({ label: `${m}m`, investido, montante: saldo });
      }
    }
    return { rows, saldo, investido, juros: saldo - investido };
  }, [invInitial, invMonthly, invRate, invMonths]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (kpi.fixosMensal > 0) {
      list.push(
        `Seus custos recorrentes somam ~${fmtBRL(kpi.fixosMensal)}/mês. Reduzir 10% libera ${fmtBRL(kpi.fixosMensal * 0.1)}/mês (${fmtBRL(kpi.fixosMensal * 1.2)}/ano).`,
      );
    }
    if (byCategory[0]) {
      list.push(
        `Maior concentração de custo: "${byCategory[0].name}" com ${fmtBRL(byCategory[0].value)} (${pct((byCategory[0].value / (kpi.saida || 1)) * 100)} do total). É o melhor alvo para renegociação.`,
      );
    }
    if (loan.i > 0) {
      const taxaMes = loan.i * 100;
      list.push(
        `A taxa implícita do financiamento simulado é ${pct(taxaMes)} a.m. (${pct(loan.anual * 100)} a.a.). Quitar agora economiza ${fmtBRL(loan.economiaQuitacao)} em juros futuros.`,
      );
      if (loan.i * 100 > parseFloat(invRate.replace(",", ".") || "0")) {
        list.push(
          "A taxa da dívida é maior que o rendimento do investimento simulado — matematicamente, amortizar a dívida rende mais do que investir.",
        );
      } else {
        list.push(
          "O rendimento do investimento supera a taxa da dívida — manter o financiamento e investir a sobra é vantajoso.",
        );
      }
    }
    if (kpi.variacao !== 0) {
      list.push(
        `Tendência de gastos: ${kpi.variacao > 0 ? "alta" : "queda"} de ${pct(Math.abs(kpi.variacao))} entre o primeiro e o último mês analisado.`,
      );
    }
    return list;
  }, [kpi, byCategory, loan, invRate]);

  const toggleSource = (k: SourceKey) =>
    setSources((prev) => (prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]));

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando base financeira...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-accent" /> Filtros avançados
          </CardTitle>
          <CardDescription>Escolha quais informações entram na análise, comparação e projeção.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={sources.includes(k)} onCheckedChange={() => toggleSource(k)} />
                {SOURCE_LABELS[k]}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyOutflow} onCheckedChange={(v) => setOnlyOutflow(!!v)} />
              Somente saídas (custos)
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor mínimo (R$)</Label>
              <Input value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setFrom(""); setTo(""); setCategory("__all__"); setMinValue("");
                  setSources(["expenses", "bank_statements", "consumption_bills"]);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
          <Badge variant="secondary">{filtered.length} lançamentos selecionados</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Saídas" value={fmtBRL(kpi.saida)} tone="destructive" />
        <Kpi label="Entradas" value={fmtBRL(kpi.entrada)} tone="primary" />
        <Kpi label="Média mensal" value={fmtBRL(kpi.mediaMensal)} />
        <Kpi label="Custos fixos/mês" value={fmtBRL(kpi.fixosMensal)} />
        <Kpi label="Tendência" value={pct(kpi.variacao)} tone={kpi.variacao > 0 ? "destructive" : "primary"} />
      </div>

      <Tabs defaultValue="comparar">
        <TabsList className="flex-wrap">
          <TabsTrigger value="comparar">Comparar</TabsTrigger>
          <TabsTrigger value="projecao">Projeção</TabsTrigger>
          <TabsTrigger value="juros">Juros & Dívidas</TabsTrigger>
          <TabsTrigger value="investimento">Investimentos</TabsTrigger>
          <TabsTrigger value="insights">Inteligência</TabsTrigger>
        </TabsList>

        <TabsContent value="comparar" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Entradas x Saídas por mês</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer>
                  <ComposedChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Legend />
                    <Bar dataKey="saida" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="entrada" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line dataKey="saida" name="Tendência" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Concentração por categoria</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={110} label>
                      {byCategory.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projecao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-accent" /> Projeção de custos
              </CardTitle>
              <CardDescription>Baseada na média mensal filtrada e no reajuste esperado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Horizonte: {projMonths} meses</Label>
                  <Slider value={[projMonths]} onValueChange={(v) => setProjMonths(v[0])} min={3} max={60} step={3} className="mt-3" />
                </div>
                <div>
                  <Label className="text-xs">Reajuste mensal esperado: {inflation.toFixed(2)}%</Label>
                  <Slider value={[inflation]} onValueChange={(v) => setInflation(v[0])} min={-2} max={3} step={0.05} className="mt-3" />
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <ComposedChart data={projection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Legend />
                    <Bar dataKey="projetado" name="Custo mensal" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line dataKey="acumulado" name="Acumulado" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted-foreground">
                Custo acumulado projetado em {projMonths} meses:{" "}
                <strong className="text-foreground">{fmtBRL(projection[projection.length - 1]?.acumulado ?? 0)}</strong>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="juros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="h-4 w-4 text-accent" /> Taxa de juros implícita & quitação
              </CardTitle>
              <CardDescription>Descubra a taxa real do seu empréstimo/financiamento (Tabela Price).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field label="Valor financiado (R$)" value={loanPv} onChange={setLoanPv} />
                <Field label="Parcela mensal (R$)" value={loanPmt} onChange={setLoanPmt} />
                <Field label="Nº de parcelas" value={loanN} onChange={setLoanN} />
                <Field label="Parcelas já pagas" value={loanPaid} onChange={setLoanPaid} />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Taxa mensal" value={pct(loan.i * 100)} tone="destructive" />
                <Kpi label="Taxa anual" value={pct(loan.anual * 100)} tone="destructive" />
                <Kpi label="Juros totais" value={fmtBRL(loan.jurosTotais)} />
                <Kpi label="Saldo devedor hoje" value={fmtBRL(loan.saldo)} />
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                Quitando as {loan.remaining} parcelas restantes agora por {fmtBRL(loan.saldo)}, você economiza{" "}
                <strong>{fmtBRL(loan.economiaQuitacao)}</strong> em juros futuros.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investimento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PiggyBank className="h-4 w-4 text-accent" /> Projeção de investimentos
              </CardTitle>
              <CardDescription>Simule o que a economia de custos fixos rende ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Field label="Aporte inicial (R$)" value={invInitial} onChange={setInvInitial} />
                <Field label="Aporte mensal (R$)" value={invMonthly} onChange={setInvMonthly} />
                <Field label="Rendimento mensal (%)" value={invRate} onChange={setInvRate} />
                <div>
                  <Label className="text-xs">Prazo: {invMonths} meses</Label>
                  <Slider value={[invMonths]} onValueChange={(v) => setInvMonths(v[0])} min={6} max={240} step={6} className="mt-3" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Total investido" value={fmtBRL(invest.investido)} />
                <Kpi label="Montante final" value={fmtBRL(invest.saldo)} tone="primary" />
                <Kpi label="Juros ganhos" value={fmtBRL(invest.juros)} tone="primary" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <ComposedChart data={invest.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => fmtBRL(v)}
                    />
                    <Legend />
                    <Bar dataKey="investido" name="Investido" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Line dataKey="montante" name="Montante" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Button
                variant="outline"
                onClick={() => setInvMonthly(String(Math.round(kpi.fixosMensal * 0.1)))}
              >
                <Calculator className="h-4 w-4" /> Usar 10% dos custos fixos como aporte
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-accent" /> Inteligência financeira
              </CardTitle>
              <CardDescription>Leitura empírica dos dados capturados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar recomendações.</p>
              ) : (
                insights.map((t, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                    {t}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "primary" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-1 truncate text-lg font-semibold ${
            tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
    </div>
  );
}
