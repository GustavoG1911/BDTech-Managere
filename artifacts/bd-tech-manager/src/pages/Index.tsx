import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { fetchAvailableYears } from "@/lib/supabase-deals";
import { KpiCard } from "@/components/KpiCard";
import { PresentationsCard } from "@/components/PresentationsCard";
import { DashboardCharts } from "@/components/DashboardCharts";
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
import { supabase } from "@/integrations/supabase/client";
import { Plus, DollarSign, TrendingUp, BadgeDollarSign, FileDown, Printer, BarChart3, AlertTriangle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoHint } from "@/components/InfoHint";

export default function Index() {
  const queryClient = useQueryClient();
  const { role, user, position } = useAuth();
  const isDirector = position === "Diretor";
  const { deals = [], loading, presentations, updatePresentations, settings, updateSettings, superMeta, toggleSuperMeta, addOrUpdateDeal, removeDeal } = useAppData(role, user?.id, position);

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

  const isSingleMonth = dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear();
  const [optimisticPresentations, setOptimisticPresentations] = useState(presentations);
  useEffect(() => { setOptimisticPresentations(presentations); }, [presentations]);

  const currentMonthPres = optimisticPresentations?.[selectedMonthKey] || { bluepex: 0, opus: 0 };

  const handlePeriodChange = (range: DateRange, label: string, type: PeriodType) => {
    setDateRange(range);
    setPeriodLabel(label);
    setPeriodType(type);
    if (range.from) setSelectedMonth(range.from);
  };

  useEffect(() => {
    if (!position || position === "SDR") return;
    supabase.auth.getUser().then(({ data: authData }) => {
      const isTestEnv = authData.user?.email?.endsWith("@teste.com") || false;
      (supabase as any)
        .from("profiles")
        .select("user_id, full_name, display_name, position")
        .eq("is_test_data", isTestEnv)
        .then(({ data }: { data: any[] | null }) => {
          if (data) {
            const map: any = {};
            data.forEach(p => map[p.user_id] = p.full_name || p.display_name || "-");
            setProfiles(map);
            setSdrs(
              data
                .filter(p => p.position === "SDR")
                .map(p => ({ id: p.user_id, name: p.full_name || p.display_name || "SDR" }))
            );
            if (position === "Diretor") {
              setExecutivos(
                data
                  .filter(p => p.position === "Executivo de Negócios")
                  .map(p => ({ id: p.user_id, name: p.full_name || p.display_name || "Executivo" }))
              );
            }
          }
        });
    });
  }, [position]);

  useEffect(() => { fetchAvailableYears().then(setAvailableYears); }, []);

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
      return passDate;
    }),
    [deals, selectedMonthKey, isSingleMonth, dateRange, isDirector, filtroOperacao, filtroFuncionario, user?.id]
  );

  const filteredDeals = closedDeals;

  const chartTimeline = useMemo(() => {
    const data: any[] = [];
    let start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
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
        name: mLabel, monthKey: mKey,
        bluepexVolume: bpVol, opusVolume: opVol,
        bluepexPres: p.bluepex, opusPres: p.opus,
        totalVolume: bpVol + opVol,
        totalPres: p.bluepex + p.opus,
      });
      start.setMonth(start.getMonth() + 1);
    }
    return data;
  }, [dateRange, closedDeals, presentations]);

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
        title: "Fechamentos",
        subtitle: "Contratos assinados no período",
        value: closedDeals.length,
        type: "number" as const,
        icon: BarChart3,
        variant: "success" as const,
        modalType: "deals" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Conta os contratos assinados no período selecionado, pela data de fechamento."
      },
      {
        title: "Comissão Gerada",
        subtitle: "Resultado dos fechamentos",
        value: comissaoFechamentos,
        type: "currency" as const,
        icon: TrendingUp,
        variant: "primary" as const,
        modalType: "projected" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Soma a comissão dos contratos assinados no período, usando metas, apresentações e percentuais configurados."
      },
      {
        title: "Volume Bruto",
        subtitle: "Mensalidades + implantações",
        value: volumeFechamentos,
        type: "currency" as const,
        icon: DollarSign,
        variant: "default" as const,
        modalType: "volume" as "projected" | "paid" | "deals" | "volume" | null,
        tooltip: "Soma mensalidade e implantação dos contratos assinados no período."
      },
      {
        title: "Receita Prevista",
        subtitle: "Comissões pela Regra do Dia 07",
        value: receitaPrevista,
        type: "currency" as const,
        icon: BadgeDollarSign,
        variant: "warning" as const,
        modalType: null,
        tooltip: "Comissão com competência financeira no mês selecionado. Pagamentos após o dia 07 entram no mês seguinte."
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

  const handleEdit = (deal: Deal) => { setEditingDeal(deal); setFormOpen(true); };
  const handleNewDeal = () => { setEditingDeal(null); setFormOpen(true); };

  const handleDownloadReport = () => {
    downloadReportPDF({ deals: filteredDeals, presentations: optimisticPresentations, salary: settings.fixedSalary, periodLabel, settings, superMeta });
  };
  const handlePrintReport = () => {
    printReport({ deals: filteredDeals, presentations: optimisticPresentations, salary: settings.fixedSalary, periodLabel, settings, superMeta });
  };


  return (
    <TooltipProvider>
      <div className="px-5 py-5 max-w-[1400px] mx-auto space-y-4">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Dashboard de Vendas</h1>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {periodLabel} · {closedDeals.length} fechamento{closedDeals.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {position !== "SDR" && (
              <Button
                onClick={handleNewDeal}
                size="sm"
                className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Fechamento
              </Button>
            )}
            <Button onClick={handleDownloadReport} size="sm" variant="outline" className="h-9 text-xs gap-1.5 border-border/60 hover:bg-muted/60">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button onClick={handlePrintReport} size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-muted/60">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Filters bar ── */}
        <div className="bg-card rounded-xl border border-border/60 px-4 py-3 flex flex-wrap items-center gap-3">
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
                  <SelectItem value="Todos">Todos</SelectItem>
                  {Object.entries(profiles).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
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

        {/* ── Competência financeira warning ── */}
        {closedDealsFinancialMonth && (
          <div className="px-4 py-3 rounded-xl border border-warning/25 bg-warning/10 text-xs text-warning flex items-start gap-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Os fechamentos deste mês têm competência financeira em{" "}
              <strong>{formatMonthLabel(closedDealsFinancialMonth)}</strong> pela Regra do Dia 07.
              Navegue até este mês no seletor de período para ver os KPIs financeiros correspondentes.
            </span>
          </div>
        )}

        {/* ── KPI Detail Dialog ── */}
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
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs py-8 text-muted-foreground">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
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

        {/* ── Apresentações (modo mês único) ── */}
        {isSingleMonth && (
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
        )}

        {/* ── Charts ── */}
        <DashboardCharts
          chartTimeline={chartTimeline}
          isSingleMonth={isSingleMonth}
          superMetaThreshold={settings.superMetaThreshold ?? 30}
        />

        {/* ── Deals Table ── */}
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
    </TooltipProvider>
  );
}
