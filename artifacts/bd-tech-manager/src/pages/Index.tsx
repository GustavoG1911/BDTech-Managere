import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { fetchAvailableYears } from "@/lib/api-client";
import { KpiCard } from "@/components/KpiCard";
import { PresentationsCard } from "@/components/PresentationsCard";
import { OperationsChart } from "@/components/OperationsChart";
import { DealsTable } from "@/components/DealsTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { DealFormDialog } from "@/components/DealFormDialog";

import { PeriodFilter, DateRange, PeriodType } from "@/components/PeriodFilter";
import { calculateCommission, formatCurrency, getMonthKey, formatMonthLabel, getPresentationsForDeal, getPaymentDateInfo } from "@/lib/commission";
import { downloadReportPDF, printReport } from "@/lib/report";
import { Deal, PaymentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, DollarSign, TrendingUp, BadgeDollarSign, CalendarDays, FileDown, Printer, BarChart3, HelpCircle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { InfoHint } from "@/components/InfoHint";

export default function Index() {
  const queryClient = useQueryClient();
  const { role, user, position } = useAuth();
  const isDirector = position === "Diretor";
  const { deals = [], loading, presentations, updatePresentations, settings, updateSettings, superMeta, toggleSuperMeta, addOrUpdateDeal, removeDeal } = useAppData(role, user?.id, position);

  // ESTADOS E DATAS (Devem vir antes de qualquer useMemo)
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const selectedMonthKey = getMonthKey(selectedMonth);
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [filtroFuncionario, setFiltroFuncionario] = useState("Todos");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  const currentMonthKey = getMonthKey(new Date());
  const now = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  });
  const [periodLabel, setPeriodLabel] = useState(formatMonthLabel(currentMonthKey));
  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [kpiModalType, setKpiModalType] = useState<"projected" | "paid" | "deals" | "volume" | null>(null);
  const [filtroOperacao, setFiltroOperacao] = useState("Todas");
  const [profiles, setProfiles] = useState<any>({});
  const [executivos, setExecutivos] = useState<{id: string, name: string}[]>([]);
  const [sdrs, setSdrs] = useState<{id: string, name: string}[]>([]);

  const periodSuffix = periodType === "month" ? "do Mês" : periodType === "quarter" ? "do Trimestre" : periodType === "year" ? "do Ano" : "do Período";

  // LOGICA DERIVADA (Somente após os estados)
  const isSingleMonth = dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear();
  // Optimistic presentations: updates immediately on PresentationsCard change, syncs from DB on round-trip
  const [optimisticPresentations, setOptimisticPresentations] = useState(presentations);
  useEffect(() => {
    setOptimisticPresentations(presentations);
  }, [presentations]);

  const currentMonthPres = optimisticPresentations?.[selectedMonthKey] || { bluepex: 0, opus: 0 };

  const handlePeriodChange = (range: DateRange, label: string, type: PeriodType) => {
    setDateRange(range);
    setPeriodLabel(label);
    setPeriodType(type);
    if (range.from) setSelectedMonth(range.from);
  };

  useEffect(() => {
    if (!position || position === "SDR") return;
    fetch("/api/profiles")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        if (data) {
          const map: any = {};
          data.forEach(p => map[p.userId] = p.fullName || p.displayName || "-");
          setProfiles(map);
          setSdrs(
            data
              .filter(p => p.position === "SDR")
              .map(p => ({ id: p.userId, name: p.fullName || p.displayName || "SDR" }))
          );
          if (position === "Diretor") {
            setExecutivos(
              data
                .filter(p => p.position === "Executivo de Negócios")
                .map(p => ({ id: p.userId, name: p.fullName || p.displayName || "Executivo" }))
            );
          }
        }
      });
  }, [position]);

  useEffect(() => {
    fetchAvailableYears().then(setAvailableYears);
  }, []);

  // Deals filtered by CLOSING DATE (for Counts and Volume)
  const closedDeals = useMemo(
    () => deals.filter((d) => {
      const date = new Date(d.closingDate);
      const passDate = date >= dateRange.from && date <= dateRange.to;

      if (position === "Diretor") {
        const passOp = filtroOperacao === "Todas" || d.operation === filtroOperacao;
        const passUser = filtroFuncionario === "Todos" || d.userId === filtroFuncionario || d.sdrUserId === filtroFuncionario;
        return passDate && passOp && passUser;
      }
      return passDate;
    }),
    [deals, dateRange, filtroOperacao, filtroFuncionario, position]
  );

  const financialDeals = useMemo(
    () => deals.filter((d) => {
      const baseDate = d.actualPaymentDate || d.firstPaymentDate || d.implantationPaymentDate || d.closingDate;
      const { monthKey } = getPaymentDateInfo(baseDate);

      let passDate: boolean;
      if (isSingleMonth) {
        passDate = monthKey === selectedMonthKey;
      } else {
        const fromKey = getMonthKey(dateRange.from);
        const toKey = getMonthKey(dateRange.to);
        passDate = monthKey >= fromKey && monthKey <= toKey;
      }

      if (isDirector) {
        const passOp = filtroOperacao === "Todas" || d.operation === filtroOperacao;
        const passUser = filtroFuncionario === "Todos" || d.userId === filtroFuncionario || d.sdrUserId === filtroFuncionario;
        return passDate && passOp && passUser;
      }
      return passDate; // fetchDeals já filtra por position (SDR vê Executivos, Executivo vê próprios)
    }),
    [deals, selectedMonthKey, isSingleMonth, dateRange, isDirector, filtroOperacao, filtroFuncionario, user?.id]
  );

  // Tabela mostra fechamentos por data de assinatura (closingDate), igual ao KPI de Fechamentos
  const filteredDeals = closedDeals;

  // Timeline Data for Charts
  const chartTimeline = useMemo(() => {
    const data: any[] = [];
    let start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    
    // Safety to prevent infinite loop
    let iterations = 0;
    while (start <= end && iterations < 24) {
      iterations++;
      const mKey = getMonthKey(start);
      const mLabel = formatMonthLabel(mKey);
      
      const dealsInMonth = closedDeals.filter(d => getMonthKey(new Date(d.closingDate)) === mKey);
      const bpVol = dealsInMonth.filter(d => d.operation === "BluePex").reduce((acc, d) => acc + d.monthlyValue + d.implantationValue, 0);
      const opVol = dealsInMonth.filter(d => d.operation === "Opus Tech").reduce((acc, d) => acc + d.monthlyValue + d.implantationValue, 0);
      
      const p = presentations[mKey] || { bluepex: 0, opus: 0 };
      
      data.push({
        name: mLabel,
        monthKey: mKey,
        bluepexVolume: bpVol,
        opusVolume: opVol,
        bluepexPres: p.bluepex,
        opusPres: p.opus,
        totalVolume: bpVol + opVol,
        totalPres: p.bluepex + p.opus
      });
      
      start.setMonth(start.getMonth() + 1);
    }
    return data;
  }, [dateRange, closedDeals, presentations]);

  const volumeChartData = useMemo((): any[] => {
    if (isSingleMonth && chartTimeline.length > 0) {
      const d = chartTimeline[0];
      return [
        { name: "BluePex", value: d.bluepexVolume, fill: "#3b82f6" },
        { name: "Opus Tech", value: d.opusVolume, fill: "#10b981" }
      ];
    }
    return chartTimeline.map(d => ({
      name: d.name,
      "BluePex": d.bluepexVolume,
      "Opus Tech": d.opusVolume
    }));
  }, [isSingleMonth, chartTimeline]);

  const presChartData = useMemo((): any[] => {
    if (isSingleMonth && chartTimeline.length > 0) {
      const d = chartTimeline[0];
      return [
        { name: "BluePex", value: d.bluepexPres, fill: "#3b82f6" },
        { name: "Opus Tech", value: d.opusPres, fill: "#10b981" }
      ];
    }
    return chartTimeline.map(d => ({
      name: d.name,
      "BluePex": d.bluepexPres,
      "Opus Tech": d.opusPres
    }));
  }, [isSingleMonth, chartTimeline]);

  // Comissão gerada pelos contratos assinados no período (usa closedDeals)
  // Receita esperada NESTE MÊS pela Regra do Dia 07 (usa financialDeals)
  const kpis = useMemo(() => {
    let comissaoFechamentos = 0;
    let volumeFechamentos = 0;
    closedDeals.forEach(deal => {
      volumeFechamentos += (deal.monthlyValue || 0) + (deal.implantationValue || 0);
      const presCount = getPresentationsForDeal(deal, optimisticPresentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      comissaoFechamentos += comm.totalCommission;
    });
    const ticketMedio = closedDeals.length > 0 ? volumeFechamentos / closedDeals.length : 0;

    let receitaPrevista = 0;
    financialDeals.forEach(deal => {
      const presCount = getPresentationsForDeal(deal, optimisticPresentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      receitaPrevista += comm.totalCommission;
    });

    return [
      {
        title: "Fechamentos do Mês",
        subtitle: "Contratos assinados no período",
        value: closedDeals.length,
        type: "number" as const,
        icon: BarChart3,
        variant: "success" as const,
        modalType: "deals" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Conta os contratos assinados no período selecionado, pela data de fechamento."
      },
      {
        title: "Comissão dos Fechamentos",
        subtitle: "Resultado dos contratos assinados",
        value: comissaoFechamentos,
        type: "currency" as const,
        icon: TrendingUp,
        variant: "primary" as const,
        modalType: "projected" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Soma a comissão dos contratos assinados no período, usando metas, apresentações e percentuais configurados."
      },
      {
        title: "Volume Bruto do Mês",
        subtitle: "Valor dos contratos assinados",
        value: volumeFechamentos,
        type: "currency" as const,
        icon: DollarSign,
        variant: "default" as const,
        modalType: "volume" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Soma mensalidade e implantação dos contratos assinados no período."
      },
      {
        title: "Receita Prevista neste Mês",
        subtitle: "Comissões pela Regra do Dia 07",
        value: receitaPrevista,
        type: "currency" as const,
        icon: BadgeDollarSign,
        variant: "warning" as const,
        modalType: null,
        tooltip: "Mostra a comissão com competência financeira no mês selecionado. Pagamentos após o dia 07 entram no mês seguinte."
      },
      {
        title: "Ticket Médio",
        subtitle: "Volume médio por fechamento",
        value: ticketMedio,
        type: "currency" as const,
        icon: DollarSign,
        variant: "default" as const,
        modalType: null,
        tooltip: "Divide o volume bruto dos fechamentos pela quantidade de contratos assinados no período."
      }
    ];
  }, [closedDeals, financialDeals, optimisticPresentations, settings]);

  // Aviso: contratos assinados neste mês têm competência financeira em outro mês
  const closedDealsFinancialMonth = useMemo(() => {
    if (!isSingleMonth || closedDeals.length === 0 || financialDeals.length > 0) return null;
    const firstDeal = closedDeals[0];
    const baseDate = firstDeal.firstPaymentDate || firstDeal.implantationPaymentDate || firstDeal.closingDate;
    if (!baseDate) return null;
    const { monthKey } = getPaymentDateInfo(baseDate);
    return monthKey !== selectedMonthKey ? monthKey : null;
  }, [isSingleMonth, closedDeals, financialDeals, selectedMonthKey]);

  const handleStatusChange = async (deal: Deal, status: PaymentStatus) => {
    await addOrUpdateDeal({ ...deal, paymentStatus: status });
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const detailDeals = useMemo(() => {
    if (!kpiModalType) return [];
    return filteredDeals.filter(d => {
      if (kpiModalType === "paid") return d.paymentStatus === "Pago";
      if (kpiModalType === "projected") return d.paymentStatus !== "Pago";
      return true;
    });
  }, [filteredDeals, kpiModalType]);

  const kpiModalTitles = {
    projected: "Comissão Projetada (Pendente)",
    paid: "Comissão Destravada (Paga)",
    deals: `Fechamentos ${periodSuffix}`,
    volume: `Volume Total ${periodSuffix}`
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormOpen(true);
  };

  const handleNewDeal = () => {
    setEditingDeal(null);
    setFormOpen(true);
  };

  const handleDownloadReport = () => {
    downloadReportPDF({
      deals: filteredDeals,
      presentations: optimisticPresentations,
      salary: settings.fixedSalary,
      periodLabel,
      settings,
      superMeta,
    });
  };

  const handlePrintReport = () => {
    printReport({
      deals: filteredDeals,
      presentations: optimisticPresentations,
      salary: settings.fixedSalary,
      periodLabel,
      settings,
      superMeta,
    });
  };

  return (
    <div className="px-5 py-5 max-w-[1400px] mx-auto">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Dashboard de Vendas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} · {closedDeals.length} fechamento(s)</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {position !== "SDR" && (
            <Button onClick={handleNewDeal} size="sm" className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Plus className="h-3.5 w-3.5" />
              Novo Fechamento
            </Button>
          )}
          <Button onClick={handleDownloadReport} size="sm" variant="outline" className="h-9 text-xs gap-1.5 border-border/60 hover:bg-muted/60">
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button onClick={handlePrintReport} size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-muted/60">
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="mb-6 bg-card/60 rounded-xl border border-border/50 px-4 py-3 flex flex-wrap items-center gap-3">
        <PeriodFilter onPeriodChange={handlePeriodChange} availableYears={availableYears} />

        {position === "Diretor" && (
          <>
            <div className="h-5 w-px bg-border/60 hidden sm:block" />
            <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
              <SelectTrigger className="w-[150px] h-8 text-xs bg-muted/30 border-border/40">
                <SelectValue placeholder="Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas Operações</SelectItem>
                <SelectItem value="BluePex">BluePex</SelectItem>
                <SelectItem value="Opus Tech">Opus Tech</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroFuncionario} onValueChange={setFiltroFuncionario}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-border/40">
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Funcionários</SelectItem>
                {Object.entries(profiles).map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* ── LINHA 1: KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
        {kpis.map((kpi, idx) => (
          <KpiCard
            key={idx}
            title={kpi.title}
            subtitle={kpi.subtitle}
            value={kpi.type === "currency" ? formatCurrency(kpi.value) : kpi.value.toString()}
            icon={kpi.icon}
            variant={kpi.variant}
            tooltip={kpi.tooltip}
            onClick={kpi.modalType ? () => setKpiModalType(kpi.modalType) : undefined}
          />
        ))}
      </div>

      {/* ── Aviso de competência financeira em outro mês ── */}
      {closedDealsFinancialMonth && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-warning/30 bg-warning/8 text-xs text-warning flex items-center gap-2">
          <span className="shrink-0">⚠</span>
          <span>
            Os fechamentos deste mês têm competência financeira em{" "}
            <strong>{formatMonthLabel(closedDealsFinancialMonth)}</strong> pela Regra do Dia 07.
            Navegue até este mês no seletor de período para ver os KPIs financeiros correspondentes.
          </span>
        </div>
      )}

      {/* KPI detail modal */}
      <Dialog open={!!kpiModalType} onOpenChange={(open) => !open && setKpiModalType(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{kpiModalType ? kpiModalTitles[kpiModalType] : ""}</DialogTitle>
            <DialogDescription>Listagem detalhada dos negócios que compõem este KPI.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-xs text-right">Mensal</TableHead>
                  <TableHead className="text-xs text-right">Implantação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailDeals.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                ) : (
                  detailDeals.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(d.closingDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs font-medium">{d.clientName}</TableCell>
                      <TableCell className="text-xs">{d.operation}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{formatCurrency(d.monthlyValue)}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{formatCurrency(d.implantationValue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── LINHA 2: Apresentações (apenas modo mês) ── */}
      {isSingleMonth && (
        <div className="mb-6">
          <PresentationsCard
            presentations={currentMonthPres}
            onUpdate={(op, count) => {
              setOptimisticPresentations(prev => ({
                ...prev,
                [selectedMonthKey]: {
                  ...(prev[selectedMonthKey] || { bluepex: 0, opus: 0 }),
                  [op]: count,
                },
              }));
              updatePresentations(selectedMonthKey, op, count);
            }}
            settings={settings}
          />
        </div>
      )}

      {/* ── LINHA 3: Gráficos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Volume Chart */}
        <div className="bg-card rounded-xl border border-border/60 p-5 h-[300px] flex flex-col">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Volume Bruto por Operação
          </span>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A9' }} />
                <YAxis tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A9' }} />
                <RechartsTooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1A1D2E', border: '1px solid #2D3154', borderRadius: '8px', color: '#F0F2F8', fontSize: '11px' }}
                  labelStyle={{ color: '#F0F2F8' }}
                  itemStyle={{ color: '#4F8EF7' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                {isSingleMonth ? (
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" formatter={(v: number) => v > 0 ? formatCurrency(v) : ""} style={{ fill: '#8B92A9', fontSize: 10 }} />
                    {volumeChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                ) : (
                  <>
                    <Bar dataKey="BluePex" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Opus Tech" fill="#00D084" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Presentations Chart */}
        <div className="bg-card rounded-xl border border-border/60 p-5 h-[300px] flex flex-col">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Apresentações Realizadas {isSingleMonth ? periodSuffix : ""}
          </span>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={presChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A9' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A9' }} />
                <RechartsTooltip
                  formatter={(value: number) => [`${value} APs`, "Apresentações"]}
                  contentStyle={{ backgroundColor: '#1A1D2E', border: '1px solid #2D3154', borderRadius: '8px', color: '#F0F2F8', fontSize: '11px' }}
                  labelStyle={{ color: '#F0F2F8' }}
                  itemStyle={{ color: '#00D084' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                {isSingleMonth ? (
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" formatter={(v: number) => v > 0 ? `${v} APs` : ""} style={{ fill: '#8B92A9', fontSize: 10 }} />
                    {presChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                ) : (
                  <>
                    <Bar dataKey="BluePex" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Opus Tech" fill="#00D084" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── LINHA 4: Tabela de deals ── */}
      <DealsTable
        deals={filteredDeals}
        presentations={optimisticPresentations}
        settings={settings}
        superMetaActive={false}
        onEdit={handleEdit}
        onDelete={removeDeal}
        onStatusChange={handleStatusChange}
      />

      <DealFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={addOrUpdateDeal}
        editDeal={editingDeal}
        currentPosition={position}
        currentUserId={user?.id}
        executivos={executivos}
        sdrs={sdrs}
      />
    </div>
  );
}
