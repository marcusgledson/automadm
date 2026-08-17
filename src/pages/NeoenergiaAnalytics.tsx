import { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ComposedChart,
} from "recharts";
import { ArrowLeft, BarChart3, Minimize2, Maximize2, X, TrendingUp, Filter, Calculator, Loader2 } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdvancedFinanceAnalysis from "@/components/AdvancedFinanceAnalysis";
import { loadInvoices, parseMesReferencia, formatMesLabel, type StoredInvoice } from "@/lib/invoiceStore";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(220 70% 60%)",
  "hsl(160 60% 50%)",
  "hsl(40 80% 55%)",
  "hsl(280 60% 60%)",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtKwh = (v: number) => `${Math.round(v).toLocaleString("pt-BR")} kWh`;

export default function NeoenergiaAnalytics() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<"simples" | "avancado">("simples");
  const [dbInvoices, setDbInvoices] = useState<StoredInvoice[]>([]);
  const allInvoices = useMemo<StoredInvoice[]>(() => {
    const local = loadInvoices();
    // Mescla por chave fileName+instalação+mes para evitar duplicidade
    const seen = new Set(local.map((i) => `${i.numero_instalacao || ""}|${i.mes_referencia || ""}|${i.fileName || ""}`));
    const merged = [...local];
    for (const inv of dbInvoices) {
      const k = `${inv.numero_instalacao || ""}|${inv.mes_referencia || ""}|${inv.fileName || ""}`;
      if (!seen.has(k)) merged.push(inv);
    }
    return merged;
  }, [dbInvoices]);

  // Busca faturas de energia da base unificada (consumption_bills)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("consumption_bills")
        .select("*")
        .eq("tipo_conta", "energia")
        .order("data_vencimento", { ascending: true });
      if (error || !data) return;
      const mapped: StoredInvoice[] = data.map((b: Record<string, unknown>) => {
        const raw = (b.raw_data as Record<string, unknown>) || {};
        const imp = (b.impostos as Record<string, number>) || {};
        return {
          fileName: (b.file_name as string) || `${b.codigo_instalacao}-${b.data_vencimento}.pdf`,
          titular: b.titular as string | undefined,
          cpf_cnpj: b.cpf_cnpj as string | undefined,
          endereco: b.endereco as string | undefined,
          numero_instalacao: b.codigo_instalacao as string,
          mes_referencia: (b.mes_referencia as string) || undefined,
          data_vencimento: b.data_vencimento as string,
          consumo_kwh: b.consumo as number | undefined,
          valor_total: b.valor_total as number | undefined,
          icms: imp.icms,
          pis: imp.pis,
          cofins: imp.cofins,
          contrib_iluminacao: imp.contrib_iluminacao,
          valor_energia: (raw.valor_energia as number) || undefined,
          valor_distribuicao: (raw.valor_distribuicao as number) || undefined,
          bandeira_tarifaria: raw.bandeira_tarifaria as string | undefined,
          valor_bandeira: raw.valor_bandeira as number | undefined,
        };
      });
      setDbInvoices(mapped);
    })();
  }, []);

  // ----- Filters -----
  const [installation, setInstallation] = useState<string>("__all__");
  const [bandeira, setBandeira] = useState<string>("__all__");
  const [periodFrom, setPeriodFrom] = useState<string>(""); // YYYY-MM
  const [periodTo, setPeriodTo] = useState<string>("");
  const [windowYears, setWindowYears] = useState<number>(5); // 1-5 anos

  // Projection
  const [projMonths, setProjMonths] = useState<number>(6);
  const [projMode, setProjMode] = useState<"percent" | "valor">("percent");
  const [projDelta, setProjDelta] = useState<number>(0);

  // Tax research
  const [taxes, setTaxes] = useState<Array<{ ano: number; icms_pct: number; pis_pct: number; cofins_pct: number; iss_pct?: number; outros_pct?: number; total_pct: number; observacao?: string }>>([]);
  const [taxesFontes, setTaxesFontes] = useState<string>("");
  const [taxesLoading, setTaxesLoading] = useState(false);

  const installations = useMemo(
    () => Array.from(new Set(allInvoices.map((i) => i.numero_instalacao).filter(Boolean))) as string[],
    [allInvoices],
  );
  const bandeiras = useMemo(
    () => Array.from(new Set(allInvoices.map((i) => i.bandeira_tarifaria).filter(Boolean))) as string[],
    [allInvoices],
  );

  const filtered = useMemo(() => {
    const minYear = new Date().getFullYear() - (windowYears - 1);
    return allInvoices.filter((inv) => {
      if (installation !== "__all__" && inv.numero_instalacao !== installation) return false;
      if (bandeira !== "__all__" && inv.bandeira_tarifaria !== bandeira) return false;
      const ym = parseMesReferencia(inv.mes_referencia);
      if (periodFrom && (!ym || ym < periodFrom)) return false;
      if (periodTo && (!ym || ym > periodTo)) return false;
      if (ym) {
        const y = parseInt(ym.slice(0, 4), 10);
        if (y < minYear) return false;
      }
      return true;
    });
  }, [allInvoices, installation, bandeira, periodFrom, periodTo, windowYears]);

  // Anos disponíveis nas faturas filtradas
  const yearsAvailable = useMemo(() => {
    const ys = new Set<number>();
    for (const inv of filtered) {
      const ym = parseMesReferencia(inv.mes_referencia);
      if (ym) ys.add(parseInt(ym.slice(0, 4), 10));
    }
    return Array.from(ys).sort((a, b) => a - b);
  }, [filtered]);

  const fetchTaxes = useCallback(async () => {
    if (yearsAvailable.length === 0) {
      toast.warning("Não há faturas no período selecionado.");
      return;
    }
    setTaxesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tax-research", {
        body: { tipo_conta: "energia", anos: yearsAvailable },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro na pesquisa");
      setTaxes(data.data.anos || []);
      setTaxesFontes(data.data.fontes || "");
      toast.success("Tributos pesquisados via IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTaxesLoading(false);
    }
  }, [yearsAvailable]);

  // ----- KPIs -----
  const kpi = useMemo(() => {
    const tot = filtered.reduce((s, i) => s + (i.valor_total || 0), 0);
    const cons = filtered.reduce((s, i) => s + (i.consumo_kwh || 0), 0);
    return {
      count: filtered.length,
      total: tot,
      consumo: cons,
      media: filtered.length ? tot / filtered.length : 0,
      mediaKwh: filtered.length ? cons / filtered.length : 0,
      precoMedioKwh: cons ? tot / cons : 0,
    };
  }, [filtered]);

  // ----- Series by month -----
  const serieMensal = useMemo(() => {
    const map = new Map<string, { ym: string; consumo: number; valor: number; count: number }>();
    for (const inv of filtered) {
      const ym = parseMesReferencia(inv.mes_referencia);
      if (!ym) continue;
      const cur = map.get(ym) || { ym, consumo: 0, valor: 0, count: 0 };
      cur.consumo += inv.consumo_kwh || 0;
      cur.valor += inv.valor_total || 0;
      cur.count += 1;
      map.set(ym, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .map((d) => ({ ...d, label: formatMesLabel(d.ym) }));
  }, [filtered]);

  // ----- By installation -----
  const porInstalacao = useMemo(() => {
    const map = new Map<string, { name: string; valor: number; consumo: number }>();
    for (const inv of filtered) {
      const k = inv.numero_instalacao || "Sem instalação";
      const cur = map.get(k) || { name: k, valor: 0, consumo: 0 };
      cur.valor += inv.valor_total || 0;
      cur.consumo += inv.consumo_kwh || 0;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  // ----- Composition (taxes / fees) -----
  const composicao = useMemo(() => {
    const sum = (k: keyof StoredInvoice) =>
      filtered.reduce((s, i) => s + ((i[k] as number) || 0), 0);
    const data = [
      { name: "Energia", value: sum("valor_energia") },
      { name: "Distribuição", value: sum("valor_distribuicao") },
      { name: "ICMS", value: sum("icms") },
      { name: "PIS", value: sum("pis") },
      { name: "COFINS", value: sum("cofins") },
      { name: "Iluminação", value: sum("contrib_iluminacao") },
      { name: "Bandeira", value: sum("valor_bandeira") },
    ].filter((d) => d.value > 0);
    return data;
  }, [filtered]);

  // ----- Projection -----
  const projecao = useMemo(() => {
    if (serieMensal.length === 0) return [];
    const last = serieMensal[serieMensal.length - 1];
    const baseValor = serieMensal.slice(-3).reduce((s, d) => s + d.valor, 0) / Math.min(3, serieMensal.length);
    const baseConsumo = serieMensal.slice(-3).reduce((s, d) => s + d.consumo, 0) / Math.min(3, serieMensal.length);
    const out: Array<{ label: string; ym: string; valor: number; valorProjetado: number; consumo: number; tipo: "real" | "projecao" }> = [];
    for (const d of serieMensal) out.push({ label: d.label, ym: d.ym, valor: d.valor, valorProjetado: 0, consumo: d.consumo, tipo: "real" });
    const [yStr, mStr] = last.ym.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    for (let i = 1; i <= projMonths; i++) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      const valorProj =
        projMode === "percent"
          ? baseValor * (1 + projDelta / 100)
          : baseValor + projDelta;
      out.push({ label: formatMesLabel(ym), ym, valor: 0, valorProjetado: valorProj, consumo: baseConsumo, tipo: "projecao" });
    }
    return out;
  }, [serieMensal, projMonths, projMode, projDelta]);

  const projTotal = useMemo(
    () => projecao.filter((p) => p.tipo === "projecao").reduce((s, p) => s + p.valorProjetado, 0),
    [projecao],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (confirm("Deseja realmente sair do aplicativo?")) signOut();
  }, [signOut]);

  const exportCsv = () => {
    const rows = [
      ["Mês", "Faturas", "Consumo (kWh)", "Valor (R$)"],
      ...serieMensal.map((d) => [d.label, d.count, d.consumo, d.valor]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "neoenergia-analytics.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BarChart3 className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">Neoenergia · Análises</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => navigate("/")} title="Tela inicial">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Tela inicial</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border p-1">
              <Button
                size="sm"
                variant={mode === "simples" ? "default" : "ghost"}
                onClick={() => setMode("simples")}
              >
                Análise simples
              </Button>
              <Button
                size="sm"
                variant={mode === "avancado" ? "default" : "ghost"}
                onClick={() => setMode("avancado")}
              >
                <Calculator className="h-4 w-4" /> Análise avançada
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {mode === "simples"
                ? "Visão direta das faturas de energia."
                : "Filtros, comparações, projeções e simuladores sobre toda a base financeira."}
            </span>
          </div>

          {mode === "avancado" ? (
            <AdvancedFinanceAnalysis />
          ) : allInvoices.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sem dados disponíveis</CardTitle>
                <CardDescription>Importe faturas na tela principal para visualizar análises.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/neoenergia")}>Ir para Faturas</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Filter className="h-5 w-5 text-accent" /> Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <Label className="text-xs">Instalação</Label>
                      <Select value={installation} onValueChange={setInstallation}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas</SelectItem>
                          {installations.map((i) => (<SelectItem key={i} value={i}>{i}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Bandeira</Label>
                      <Select value={bandeira} onValueChange={setBandeira}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas</SelectItem>
                          {bandeiras.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Período de</Label>
                      <Input type="month" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Período até</Label>
                      <Input type="month" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                    </div>
                    <div className="lg:col-span-2">
                      <Label className="text-xs">Janela de análise: últimos {windowYears} {windowYears === 1 ? "ano" : "anos"}</Label>
                      <Slider
                        value={[windowYears]}
                        onValueChange={(v) => setWindowYears(v[0])}
                        min={1} max={5} step={1}
                        className="mt-3"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => {
                        setInstallation("__all__"); setBandeira("__all__"); setPeriodFrom(""); setPeriodTo("");
                      }}>Limpar</Button>
                      <Button variant="default" className="flex-1" onClick={exportCsv}>Exportar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <KpiCard label="Faturas" value={String(kpi.count)} />
                <KpiCard label="Consumo Total" value={fmtKwh(kpi.consumo)} accent="primary" />
                <KpiCard label="Valor Total" value={fmtBRL(kpi.total)} accent="destructive" />
                <KpiCard label="Média/Fatura" value={fmtBRL(kpi.media)} />
                <KpiCard label="Média kWh" value={fmtKwh(kpi.mediaKwh)} />
                <KpiCard label="Preço médio kWh" value={fmtBRL(kpi.precoMedioKwh)} />
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Visão geral</TabsTrigger>
                  <TabsTrigger value="instalacao">Por instalação</TabsTrigger>
                  <TabsTrigger value="composicao">Composição</TabsTrigger>
                  <TabsTrigger value="projecao">Projeção</TabsTrigger>
                  <TabsTrigger value="tributos">Tributos por Ano</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Consumo & Gasto por mês</CardTitle>
                      <CardDescription>Série mensal das faturas filtradas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[360px]">
                        <ResponsiveContainer>
                          <ComposedChart data={serieMensal}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis yAxisId="l" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                              formatter={(v: number, n: string) => n === "Valor (R$)" ? fmtBRL(v) : fmtKwh(v)}
                            />
                            <Legend />
                            <Bar yAxisId="l" dataKey="consumo" name="Consumo (kWh)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="r" dataKey="valor" name="Valor (R$)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="instalacao" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Gastos por código de instalação</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[360px]">
                        <ResponsiveContainer>
                          <BarChart data={porInstalacao} layout="vertical" margin={{ left: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                              formatter={(v: number) => fmtBRL(v)}
                            />
                            <Bar dataKey="valor" name="Valor (R$)" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Instalação</TableHead>
                              <TableHead>Consumo</TableHead>
                              <TableHead>Valor Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {porInstalacao.map((r) => (
                              <TableRow key={r.name}>
                                <TableCell className="text-sm">{r.name}</TableCell>
                                <TableCell className="text-sm">{fmtKwh(r.consumo)}</TableCell>
                                <TableCell className="text-sm font-medium text-destructive">{fmtBRL(r.valor)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="composicao" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Composição dos gastos</CardTitle>
                      <CardDescription>Tributos, encargos e energia</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[360px]">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={composicao} dataKey="value" nameKey="name" outerRadius={130} label={(d) => d.name}>
                              {composicao.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(v: number) => fmtBRL(v)}
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                            <Legend />
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
                        <TrendingUp className="h-4 w-4 text-accent" /> Projeção de gastos futuros
                      </CardTitle>
                      <CardDescription>Baseada na média dos 3 últimos meses, ajustada por % ou valor fixo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-4">
                        <div>
                          <Label className="text-xs">Meses futuros</Label>
                          <Input type="number" min={1} max={24} value={projMonths}
                            onChange={(e) => setProjMonths(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))} />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo de ajuste</Label>
                          <Select value={projMode} onValueChange={(v: "percent" | "valor") => setProjMode(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">Percentual (%)</SelectItem>
                              <SelectItem value="valor">Valor fixo (R$)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">{projMode === "percent" ? "Aumento (%)" : "Aumento (R$)"}</Label>
                          <Input type="number" step={projMode === "percent" ? 0.5 : 10} value={projDelta}
                            onChange={(e) => setProjDelta(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="flex items-end">
                          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 w-full">
                            <p className="text-xs text-muted-foreground">Total projetado</p>
                            <p className="text-lg font-bold text-foreground">{fmtBRL(projTotal)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="h-[360px]">
                        <ResponsiveContainer>
                          <LineChart data={projecao}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                              formatter={(v: number) => fmtBRL(v)}
                            />
                            <Legend />
                            <Line dataKey="valor" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                            <Line dataKey="valorProjetado" name="Projetado" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-4 rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Mês</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projecao.map((p) => (
                              <TableRow key={p.ym}>
                                <TableCell className="text-sm">{p.label}</TableCell>
                                <TableCell>
                                  <Badge variant={p.tipo === "real" ? "outline" : "secondary"}>
                                    {p.tipo === "real" ? "Realizado" : "Projeção"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {fmtBRL(p.tipo === "real" ? p.valor : p.valorProjetado)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tributos" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Calculator className="h-4 w-4 text-accent" /> Impostos embutidos por ano
                          </CardTitle>
                          <CardDescription>
                            Carga tributária estimada (ICMS, PIS, COFINS) sobre energia elétrica residencial — pesquisada via IA com base nos anos das faturas filtradas ({yearsAvailable.join(", ") || "—"}).
                          </CardDescription>
                        </div>
                        <Button size="sm" onClick={fetchTaxes} disabled={taxesLoading || yearsAvailable.length === 0}>
                          {taxesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                          {taxesLoading ? "Pesquisando…" : "Pesquisar tributos"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {taxes.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Clique em "Pesquisar tributos" para carregar a estimativa por ano.
                        </p>
                      ) : (
                        <>
                          <div className="h-[300px]">
                            <ResponsiveContainer>
                              <BarChart data={taxes}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="ano" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                                  formatter={(v: number) => `${v.toFixed(2)}%`}
                                />
                                <Legend />
                                <Bar dataKey="icms_pct" name="ICMS" stackId="a" fill={COLORS[0]} />
                                <Bar dataKey="pis_pct" name="PIS" stackId="a" fill={COLORS[1]} />
                                <Bar dataKey="cofins_pct" name="COFINS" stackId="a" fill={COLORS[2]} />
                                <Bar dataKey="outros_pct" name="Outros" stackId="a" fill={COLORS[3]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ano</TableHead>
                                  <TableHead>ICMS</TableHead>
                                  <TableHead>PIS</TableHead>
                                  <TableHead>COFINS</TableHead>
                                  <TableHead>Outros</TableHead>
                                  <TableHead>Total</TableHead>
                                  <TableHead>Estimativa de imposto pago</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {taxes.map((t) => {
                                  const gastoAno = filtered
                                    .filter((inv) => {
                                      const ym = parseMesReferencia(inv.mes_referencia);
                                      return ym && parseInt(ym.slice(0, 4), 10) === t.ano;
                                    })
                                    .reduce((s, i) => s + (i.valor_total || 0), 0);
                                  const imposto = gastoAno * (t.total_pct / 100);
                                  return (
                                    <TableRow key={t.ano}>
                                      <TableCell className="text-sm font-medium">{t.ano}</TableCell>
                                      <TableCell className="text-sm">{t.icms_pct?.toFixed(2)}%</TableCell>
                                      <TableCell className="text-sm">{t.pis_pct?.toFixed(2)}%</TableCell>
                                      <TableCell className="text-sm">{t.cofins_pct?.toFixed(2)}%</TableCell>
                                      <TableCell className="text-sm">{(t.outros_pct || 0).toFixed(2)}%</TableCell>
                                      <TableCell className="text-sm font-semibold">{t.total_pct?.toFixed(2)}%</TableCell>
                                      <TableCell className="text-sm font-medium text-destructive">{fmtBRL(imposto)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          {taxesFontes && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Fontes:</strong> {taxesFontes}
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "primary" | "destructive" }) {
  const cls = accent === "primary" ? "text-primary" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
