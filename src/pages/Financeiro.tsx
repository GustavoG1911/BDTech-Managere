import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { Navigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Upload, Download, ArrowRightLeft, Target, TrendingUp, BadgeDollarSign, Calendar, ChevronDown, ChevronUp, Clock, FileText, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Check, Loader2, Wallet, Plus, CalendarDays, FileDown, Printer, HelpCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getMonthKey, formatMonthLabel, getPaymentDateInfo, getCommissionTier, calculateCommission, getPresentationsForDeal } from "@/lib/commission";
import { createNotification, upsertCommissionPaymentRow, clearCommissionPaymentsForDeal, confirmCommissionPaymentsForDeal } from "@/lib/supabase-deals";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Deal } from "@/lib/types";

function FutureProjectionsAccumulatedCard({ projections, position, onSelectMonth }: { projections: any[], position: string, onSelectMonth: (m: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const totalIn = projections.reduce((acc, p) => acc + (p.projectedIn || 0), 0);
  const totalOut = projections.reduce((acc, p) => acc + (p.projectedOut || 0), 0);

  return (
    <div className="mb-6 bg-card rounded-xl border border-border/60 overflow-hidden transition-all">
      <div
        className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-[#242842]/40 gap-4 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Acumulado Lançamentos Futuros</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Previsão total de todos os meses após o atual</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {position !== "Diretor" ? (
             <span className="font-mono text-success font-bold text-sm">{formatCurrency(totalIn)}</span>
          ) : (
             <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-end md:items-center">
                <span className="font-mono text-primary text-xs font-semibold">Entradas (In): {formatCurrency(totalIn)}</span>
                <span className="font-mono text-warning text-xs font-semibold">Saídas (Out): {formatCurrency(totalOut)}</span>
             </div>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 p-5">
          {projections.length === 0 ? (
             <p className="text-center text-xs text-muted-foreground py-4">Nenhum lançamento previsto bloqueado em meses futuros.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
               {projections.map(proj => (
                 <div key={proj.monthKey} onClick={(e) => { e.stopPropagation(); onSelectMonth(proj.monthKey); }} className="p-3 bg-muted/20 rounded-lg border border-border/40 cursor-pointer hover:border-primary/50 hover:bg-[#242842]/40 transition-all">
                   <p className="font-semibold uppercase tracking-widest text-[10px] mb-1.5 text-muted-foreground">{formatMonthLabel(proj.monthKey)}</p>
                   {position !== "Diretor" ? (
                     <p className="font-mono text-success font-bold text-xs">{formatCurrency(proj.projectedIn)}</p>
                   ) : (
                     <div className="flex flex-col gap-1">
                       <p className="font-mono text-primary font-medium text-[10px] flex justify-between"><span>IN:</span> <span>{formatCurrency(proj.projectedIn)}</span></p>
                       <p className="font-mono text-warning font-medium text-[10px] flex justify-between"><span>OUT:</span> <span>{formatCurrency(proj.projectedOut)}</span></p>
                     </div>
                   )}
                 </div>
               ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Using Deal from @/lib/types.ts

interface SalaryRow {
  id: string;
  user_id: string;
  reference_month: string;
  amount: number;
  expected_payment_date: string;
  is_paid_by_gestor: boolean;
  user_confirmed_receipt: boolean;
  payment_date: string | null;
}

interface ProfileMap {
  [userId: string]: { full_name: string; display_name: string; commission_percent: number; fixed_salary: number; position?: string };
}

/** Formata datas sem lançar RangeError para datas inválidas. */
function formatSafeDate(date: any, fmt = "dd/MM/yyyy"): string {
  if (!date) return "—";
  const str = typeof date === "string" && !date.includes("T") ? date + "T12:00:00" : date;
  const d = new Date(str);
  if (isNaN(d.getTime())) return "—";
  return format(d, fmt, { locale: ptBR });
}

/**
 * Retorna os meses financeiros separados para mensalidade e implantação.
 * Mensalidade: firstPaymentDate → closingDate
 * Implantação: implantationPaymentDate → firstPaymentDate → closingDate
 * A Regra do Dia 07 é aplicada a cada data independentemente.
 */
function getDealMonthKeys(deal: Deal): { mensalidadeMonthKey: string | null; implantacaoMonthKey: string | null } {
  const mensalidadeBase = deal.firstPaymentDate || deal.closingDate;
  const implantacaoBase = deal.implantationPaymentDate || deal.firstPaymentDate || deal.closingDate;
  return {
    mensalidadeMonthKey: mensalidadeBase ? getPaymentDateInfo(mensalidadeBase).monthKey : null,
    implantacaoMonthKey: implantacaoBase ? getPaymentDateInfo(implantacaoBase).monthKey : null,
  };
}

type FinancePeriod = {
  filterType: "month" | "year";
  selectedMonth: string;
  selectedYear: string;
};

function monthKeyInPeriod(monthKey: string | null, period: FinancePeriod): boolean {
  if (!monthKey) return false;
  return period.filterType === "month"
    ? monthKey === period.selectedMonth
    : monthKey.startsWith(period.selectedYear);
}

function getCommissionPeriodParts(deal: Deal, presentations: any, settings: any, period: FinancePeriod) {
  const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
  const presCount = getPresentationsForDeal(deal, presentations);
  const comm = calculateCommission(deal, presCount, settings, false);
  const mensalidadeInPeriod = monthKeyInPeriod(mensalidadeMonthKey, period);
  const implantacaoInPeriod = monthKeyInPeriod(implantacaoMonthKey, period);
  const mensalidadeCommission = mensalidadeInPeriod ? comm.monthlyCommission + comm.superMetaBonus : 0;
  const implantacaoCommission = implantacaoInPeriod ? comm.implantationCommission : 0;
  const hasMensalidadeCommission = mensalidadeCommission > 0;
  const hasImplantacaoCommission = implantacaoCommission > 0;
  const labels = [
    mensalidadeCommission > 0 ? `Mensalidade: ${formatCurrency(mensalidadeCommission)}` : null,
    implantacaoCommission > 0 ? `Implantacao: ${formatCurrency(implantacaoCommission)}` : null,
  ].filter(Boolean) as string[];

  return {
    comm,
    mensalidadeMonthKey,
    implantacaoMonthKey,
    mensalidadeInPeriod,
    implantacaoInPeriod,
    mensalidadeCommission,
    implantacaoCommission,
    total: mensalidadeCommission + implantacaoCommission,
    labels,
    unlocked: (hasMensalidadeCommission || hasImplantacaoCommission)
      && (!hasMensalidadeCommission || !!deal.isMensalidadePaidByClient)
      && (!hasImplantacaoCommission || !!deal.isImplantacaoPaid),
  };
}

function getCommissionStatusForParts(deal: Deal, parts: ReturnType<typeof getCommissionPeriodParts>): "locked" | "ready" | "waiting" | "done" {
  if (parts.total <= 0 || !parts.unlocked) return "locked";
  if (deal.isUserConfirmedPayment) return "done";
  if (deal.isPaidToUser) return "waiting";
  return "ready";
}

function buildMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  // 24 meses atrás até 12 meses à frente
  for (let i = -24; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = getMonthKey(d);
    options.push({ value: key, label: formatMonthLabel(key) });
  }
  return options;
}

export default function Financeiro() {
  const { role, user, position, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (position !== "Diretor" && user) {
    return <UserFinanceiroContent userId={user.id} />;
  }

  return <FinanceiroContent />;
}

function ExpandableUserCommissionRow({ deal, selectedMonth, presentations, settings, onConfirm, inPendingSection, highlighted, autoExpand }: any) {
  const [expanded, setExpanded] = useState(!!autoExpand);
  const period = { filterType: "month" as const, selectedMonth, selectedYear: selectedMonth.slice(0, 4) };
  const parts = getCommissionPeriodParts(deal, presentations, settings, period);
  const { comm, mensalidadeMonthKey, implantacaoMonthKey } = parts;
  const presCount = getPresentationsForDeal(deal, presentations);
  const allMensalidadeCommission = comm.monthlyCommission + comm.superMetaBonus;
  const totalComm = inPendingSection ? comm.totalCommission : parts.total;
  const periodBaseCommission = (parts.mensalidadeInPeriod ? comm.monthlyCommission : 0) + (parts.implantacaoInPeriod ? comm.implantationCommission : 0);
  const periodSuperMetaBonus = parts.mensalidadeInPeriod ? comm.superMetaBonus : 0;
  const dealMonth = selectedMonth || mensalidadeMonthKey || implantacaoMonthKey;
  const isPendingAction = deal.isPaidToUser && !deal.isUserConfirmedPayment;
  const commissionStatus = getCommissionStatusForParts(deal, parts);
  const pendingPartLabels = [
    allMensalidadeCommission > 0 ? `Mensalidade${mensalidadeMonthKey ? ` (${formatMonthLabel(mensalidadeMonthKey)})` : ""}: ${formatCurrency(allMensalidadeCommission)}` : null,
    comm.implantationCommission > 0 ? `Implantacao${implantacaoMonthKey ? ` (${formatMonthLabel(implantacaoMonthKey)})` : ""}: ${formatCurrency(comm.implantationCommission)}` : null,
  ].filter(Boolean) as string[];
  const commissionParts = (inPendingSection ? pendingPartLabels : parts.labels).join(" + ");
  const periodLabel = inPendingSection && pendingPartLabels.length > 1
    ? [mensalidadeMonthKey, implantacaoMonthKey].filter(Boolean).map((monthKey) => formatMonthLabel(monthKey!)).join(" / ")
    : dealMonth ? formatMonthLabel(dealMonth) : "—";
  const colSpan = inPendingSection ? 6 : 6;

  return (
    <>
      <TableRow
        id={inPendingSection ? `pending-commission-${deal.id}` : undefined}
        onClick={() => setExpanded(!expanded)}
        className={`border-border/25 cursor-pointer transition-colors ${
          highlighted
            ? "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary"
            : deal.isUserConfirmedPayment
            ? "bg-success/5 hover:bg-success/10 border-l-2 border-l-success/40"
            : isPendingAction
            ? "bg-warning/10 hover:bg-warning/15 border-l-2 border-l-warning/60"
            : "hover:bg-[#242842]/40"
        }`}
      >
        <TableCell className="w-[30px] px-2 py-3">
          <div className="flex flex-col items-center gap-1">
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
            {isPendingAction && <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />}
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 text-sm font-medium">{deal.clientName}</TableCell>
        <TableCell className="px-4 py-3">
          <Badge variant="outline" className="text-[10px] border-border/40">{deal.operation}</Badge>
        </TableCell>
        {inPendingSection ? (
          <TableCell className="px-4 py-3 text-sm text-muted-foreground">
            {periodLabel}
          </TableCell>
        ) : (
          <TableCell className="px-4 py-3 text-right text-sm font-mono font-semibold text-foreground/90">
            {parts.mensalidadeCommission > 0 ? formatCurrency(parts.mensalidadeCommission) : "—"}
          </TableCell>
        )}
        {inPendingSection ? (
          <TableCell className="px-4 py-3 text-right">
            <div className="text-sm font-mono font-semibold text-warning">{formatCurrency(totalComm)}</div>
            <div className="text-[10px] text-warning/70 leading-tight mt-1">{commissionParts || "Comissao do fechamento"}</div>
          </TableCell>
        ) : (
          <TableCell className="px-4 py-3 text-right text-sm font-mono font-semibold text-foreground/90">
            {parts.implantacaoCommission > 0 ? formatCurrency(parts.implantacaoCommission) : "—"}
          </TableCell>
        )}
        <TableCell className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {commissionStatus === "done" ? (
            <span className="pill-green">Concluido</span>
          ) : commissionStatus === "waiting" ? (
            <Button size="sm" onClick={() => onConfirm(deal.id)} className="h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Confirmar Recebimento
            </Button>
          ) : commissionStatus === "ready" ? (
            <span className="pill-blue">Destravado</span>
          ) : (
            <span className="pill-yellow">A Receber</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="p-0">
            <div className="px-5 py-4 bg-[#242842]/60 border-t border-border/30 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Valor Mensalidade</p>
                <p className="font-mono font-semibold text-foreground/90">{formatCurrency(deal.monthlyValue || 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Valor Implantação</p>
                <p className="font-mono font-semibold text-foreground/90">{formatCurrency(deal.implantationValue || 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Comissão Base</p>
                <p className="font-mono font-semibold text-primary">{formatCurrency(periodBaseCommission)}</p>
              </div>
              {inPendingSection && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1 col-span-2">
                  <p className="text-warning/80">Pago pelo gestor</p>
                  <p className="font-mono font-semibold text-warning">{formatCurrency(totalComm)}</p>
                  <p className="text-[10px] text-warning/70">{commissionParts || "Comissao do fechamento"}</p>
                </div>
              )}
              {periodSuperMetaBonus > 0 ? (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1">
                  <p className="text-warning/80">Bônus Super Meta</p>
                  <p className="font-mono font-semibold text-warning">+{formatCurrency(periodSuperMetaBonus)}</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                  <p className="text-muted-foreground">Taxa de Comissão</p>
                  <p className="font-mono font-semibold text-foreground/90">{Math.round(comm.commissionRate * 100)}%</p>
                </div>
              )}
              {deal.firstPaymentDate && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                  <p className="text-muted-foreground">1º Pagamento</p>
                  <p className="font-mono font-semibold text-foreground/90">{formatSafeDate(deal.firstPaymentDate)}</p>
                </div>
              )}
              {deal.closingDate && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                  <p className="text-muted-foreground">Fechamento</p>
                  <p className="font-mono font-semibold text-foreground/90">{formatSafeDate(deal.closingDate)}</p>
                </div>
              )}
              {deal.mensalidadePaymentDate && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-1">
                  <p className="text-success/80">Mensalidade recebida em</p>
                  <p className="font-mono font-semibold text-success">{formatSafeDate(deal.mensalidadePaymentDate)}</p>
                </div>
              )}
              {deal.implantacaoPaymentDate && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-1">
                  <p className="text-success/80">Implantacao recebida em</p>
                  <p className="font-mono font-semibold text-success">{formatSafeDate(deal.implantacaoPaymentDate)}</p>
                </div>
              )}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Apresentações</p>
                <p className="font-mono font-semibold text-foreground/90">{presCount}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandableUserSalaryRow({ salary, profiles, userId, selectedMonth }: any) {
  const [expanded, setExpanded] = useState(false);
  const amount = salary?.amount ?? profiles?.[userId]?.fixed_salary ?? 0;
  const expectedDate = salary?.expected_payment_date;
  const isPaid = salary?.is_paid_by_gestor ?? false;
  const paymentDate = salary?.payment_date;
  const referenceMonth = salary?.reference_month;

  return (
    <>
      <TableRow
        onClick={() => setExpanded(!expanded)}
        className={`border-border/25 cursor-pointer transition-colors ${isPaid ? "bg-success/5 hover:bg-success/10" : "hover:bg-[#242842]/40"}`}
      >
        <TableCell className="w-[30px] px-2 py-3">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </TableCell>
        <TableCell className="px-4 py-3">
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40 uppercase tracking-wide">BDtech</span>
        </TableCell>
        <TableCell className="px-4 py-3 text-right text-sm font-mono font-semibold">{formatCurrency(amount)}</TableCell>
        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
          {expectedDate ? formatSafeDate(expectedDate) : `Recorrente (20/${selectedMonth.split("-")[1]})`}
        </TableCell>
        <TableCell className="px-4 py-3 text-center">
          {isPaid ? <span className="pill-green">Recebido</span> : <span className="pill-yellow">A Receber</span>}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="p-0">
            <div className="px-5 py-4 bg-[#242842]/60 border-t border-border/30 grid grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Mês de Referência</p>
                <p className="font-mono font-semibold text-foreground/90">
                  {referenceMonth ? formatSafeDate(referenceMonth.length === 7 ? referenceMonth + "-01" : referenceMonth, "MMMM yyyy") : formatMonthLabel(selectedMonth)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Valor</p>
                <p className="font-mono font-semibold text-primary">{formatCurrency(amount)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Vencimento Previsto</p>
                <p className="font-mono font-semibold text-foreground/90">
                  {expectedDate ? formatSafeDate(expectedDate) : `Dia 20 de ${formatMonthLabel(selectedMonth)}`}
                </p>
              </div>
              {paymentDate && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-1">
                  <p className="text-success/80">Data de Pagamento</p>
                  <p className="font-mono font-semibold text-success">{formatSafeDate(paymentDate)}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function UserFinanceiroContent({ userId }: { userId: string }) {
  const { role, user, position } = useAuth();
  const { deals = [], settings, presentations, loading: appLoading, updateAdjustment, removeDeal, addOrUpdateDeal, refreshDeals } = useAppData(role, user?.id, position);
  const queryClient = useQueryClient();
  const location = useLocation();
  const currentMonthKey = getMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [pendingScroll, setPendingScroll] = useState(false);
  const pendingScrollAttempts = useRef(0);
  const focusedDealId = (location.state as any)?.dealId as string | undefined;

  useEffect(() => {
    if ((location.state as any)?.scrollToPending) {
      pendingScrollAttempts.current = 0;
      setPendingScroll(true);
      void refreshDeals();
    }
  }, [location.state, refreshDeals]);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["user-finance-data", userId],
    queryFn: async () => {
      const [salariesRes, profilesRes] = await Promise.all([
        (supabase.from("salary_payments") as any).select("*").eq("user_id", userId),
        (supabase.from("profiles") as any).select("user_id, full_name, display_name, commission_percent, fixed_salary").eq("user_id", userId),
      ]);

      if (salariesRes.error) throw salariesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const map: ProfileMap = {};
      (profilesRes.data as any[]).forEach((p) => {
        map[p.user_id] = {
          full_name: p.full_name || p.display_name || "-",
          display_name: p.display_name || "",
          commission_percent: p.commission_percent || 0,
          fixed_salary: p.fixed_salary || 0,
        };
      });

      return {
        salaries: salariesRes.data as any[],
        profiles: map,
      };
    }
  });

  const querySalaries = data?.salaries || [];
  const profiles = data?.profiles || {};

  const activeDeals = deals; // fetchDeals já filtra por position (SDR vê Executivos, Executivo vê próprios)
  const activeSalaries = querySalaries.length > 0 ? querySalaries : [];

  // Deals onde mensalidade OU implantação têm competência financeira no mês selecionado
  const filteredDeals = useMemo(() => {
    return activeDeals.filter((d) => {
      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(d);
      return mensalidadeMonthKey === selectedMonth || implantacaoMonthKey === selectedMonth;
    });
  }, [activeDeals, selectedMonth]);

  const filteredSalaries = useMemo(() => {
    return activeSalaries.filter((s) => getMonthKey(s.reference_month) === selectedMonth);
  }, [activeSalaries, selectedMonth]);

  const pendingConfirmations = useMemo(
    () => activeDeals.filter((d) => d.isPaidToUser && !d.isUserConfirmedPayment),
    [activeDeals]
  );

  useEffect(() => {
    if (!pendingScroll) return;

    if (pendingConfirmations.length > 0) {
      const timer = setTimeout(() => {
        const target = focusedDealId ? document.getElementById(`pending-commission-${focusedDealId}`) : null;
        (target || document.getElementById("pending-confirmations"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        setPendingScroll(false);
      }, 400);
      return () => clearTimeout(timer);
    }

    if (appLoading) return;

    if (pendingScrollAttempts.current >= 15) {
      setPendingScroll(false);
      return;
    }

    const retryTimer = setTimeout(() => {
      pendingScrollAttempts.current += 1;
      void refreshDeals();
    }, 300);

    return () => clearTimeout(retryTimer);
  }, [pendingScroll, pendingConfirmations.length, appLoading, refreshDeals, focusedDealId]);

  const futureProjections = useMemo(() => {
    const projMap: Record<string, { projectedIn: number }> = {};
    activeDeals.forEach((deal) => {
      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
      const presCount = getPresentationsForDeal(deal, presentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      const mensalidadeComm = comm.monthlyCommission + comm.superMetaBonus;

      // Mensalidade futura
      if (mensalidadeMonthKey && mensalidadeMonthKey > selectedMonth) {
        if (!projMap[mensalidadeMonthKey]) projMap[mensalidadeMonthKey] = { projectedIn: 0 };
        projMap[mensalidadeMonthKey].projectedIn += mensalidadeComm;
      }
      // Implantação futura (apenas se em mês diferente da mensalidade)
      if (implantacaoMonthKey && implantacaoMonthKey > selectedMonth && implantacaoMonthKey !== mensalidadeMonthKey) {
        if (!projMap[implantacaoMonthKey]) projMap[implantacaoMonthKey] = { projectedIn: 0 };
        projMap[implantacaoMonthKey].projectedIn += comm.implantationCommission;
      }
      // Se ambas no mesmo mês futuro, a mensalidade já inclui tudo (totalCommission)
      if (mensalidadeMonthKey && mensalidadeMonthKey > selectedMonth && implantacaoMonthKey === mensalidadeMonthKey) {
        projMap[mensalidadeMonthKey].projectedIn += comm.implantationCommission;
      }
    });

    return Object.entries(projMap)
      .map(([key, vals]) => ({ monthKey: key, ...vals }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [activeDeals, selectedMonth, presentations, settings]);

  const kpis = useMemo(() => {
    let projected = 0;
    let paid = 0;
    let volume = 0;
    filteredDeals.forEach((deal) => {
      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
      const mensalidadeInMonth = mensalidadeMonthKey === selectedMonth;
      const implantacaoInMonth = implantacaoMonthKey === selectedMonth;

      if (mensalidadeInMonth) volume += deal.monthlyValue || 0;
      if (implantacaoInMonth) volume += deal.implantationValue || 0;

      const presCount = getPresentationsForDeal(deal, presentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      const mensalidadeComm = comm.monthlyCommission + comm.superMetaBonus;
      const commInMonth = (mensalidadeInMonth ? mensalidadeComm : 0) + (implantacaoInMonth ? comm.implantationCommission : 0);

      if (deal.isUserConfirmedPayment) paid += commInMonth;
      else projected += commInMonth;
    });

    const totalFixo = filteredSalaries.length > 0 ? filteredSalaries.reduce((acc, s) => acc + s.amount, 0) : (profiles[userId]?.fixed_salary || 0);

    return { projected, paid, volume, fixed: totalFixo };
  }, [filteredDeals, filteredSalaries, userId, selectedMonth, presentations, settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSDRConfirm = async (dealId: string) => {
    const { data: updatedDeal, error } = await (supabase.from("deals") as any)
      .update({ is_user_confirmed_payment: true })
      .eq("id", dealId)
      .eq("user_id", userId)
      .eq("is_paid_to_user", true)
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    if (!updatedDeal) {
      toast.error("Pagamento não encontrado ou ainda não liberado para confirmação.");
      return;
    }
    await confirmCommissionPaymentsForDeal(dealId).catch(console.error);
    toast.success("Recebimento confirmado e ciclo encerrado!");
    await refreshDeals();
    queryClient.invalidateQueries({ queryKey: ["user-finance-data", userId] });
  };

  const getUserName = (id: string) => profiles[id]?.full_name || "-";

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Meu Fluxo Individual</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Comissões e salário do período selecionado</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] h-9 text-sm bg-card border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Comissão Paga" value={formatCurrency(kpis.paid)} icon={BadgeDollarSign} variant="success" subtitle="Já confirmada e recebida" />
        <KpiCard title="Comissão Prevista" value={formatCurrency(kpis.projected)} icon={TrendingUp} variant="primary" subtitle="Esperado receber neste mês pela Regra do Dia 07" />
        <KpiCard title="Volume de Vendas" value={formatCurrency(kpis.volume)} icon={BarChart3} variant="warning" subtitle="Valor bruto dos contratos do período" />
        <KpiCard title="Salário Fixo" value={formatCurrency(kpis.fixed)} icon={DollarSign} variant="default" subtitle="Remuneração fixa mensal" />
      </div>

      {(() => {
        const pendingPayment = filteredDeals.filter((d) => !d.isPaidToUser).length;
        if (pendingConfirmations.length === 0 && pendingPayment === 0) return null;
        return (
          <div className="flex flex-wrap gap-3 mb-5">
            {pendingConfirmations.length > 0 && (
              <button
                onClick={() => document.getElementById("pending-confirmations")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 hover:bg-warning/20 hover:border-warning/50 transition-colors cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                <span className="text-xs font-semibold text-warning">
                  {pendingConfirmations.length} comissão{pendingConfirmations.length > 1 ? "ões" : ""} aguardando sua confirmação
                </span>
                <ChevronDown className="h-3 w-3 text-warning/70" />
              </button>
            )}
            {pendingPayment > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/40 border border-border/40">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">
                  {pendingPayment} comissão{pendingPayment > 1 ? "ões" : ""} pendente{pendingPayment > 1 ? "s" : ""} de pagamento
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {pendingConfirmations.length > 0 && (
        <div id="pending-confirmations" className="mb-5 bg-card rounded-xl border-2 border-warning/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-warning/30 flex items-center gap-2 bg-warning/5">
            <span className="h-2 w-2 rounded-full bg-warning animate-pulse shrink-0" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-warning flex-1">
              {pendingConfirmations.length} Pagamento{pendingConfirmations.length > 1 ? "s" : ""} Aguardando Confirmação
            </span>
            <span className="text-[10px] text-warning/60">Clique em confirmar para encerrar o ciclo</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-warning/20 hover:bg-transparent">
                <TableHead className="w-[30px] px-2"></TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Mês</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Comissão Total</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingConfirmations.map((deal) => {
                const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
                const dealMonth = mensalidadeMonthKey || implantacaoMonthKey;
                return (
                  <ExpandableUserCommissionRow
                    key={deal.id}
                    deal={deal}
                    selectedMonth={dealMonth || selectedMonth}
                    presentations={presentations}
                    settings={settings}
                    onConfirm={handleSDRConfirm}
                    highlighted={deal.id === focusedDealId}
                    autoExpand={deal.id === focusedDealId}
                    inPendingSection
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FutureProjectionsAccumulatedCard projections={futureProjections} position={position} onSelectMonth={setSelectedMonth} />

      <div className="space-y-5">
        <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Comissões do Período</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-[30px] px-2"></TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Com. Mensalidade</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Com. Implantação</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma comissão prevista para este período.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <ExpandableUserCommissionRow
                    key={deal.id}
                    deal={deal}
                    selectedMonth={selectedMonth}
                    presentations={presentations}
                    settings={settings}
                    onConfirm={handleSDRConfirm}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Meu Salário Fixo</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-[30px] px-2"></TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Origem</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Valor</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vencimento</TableHead>
                <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalaries.length === 0 ? (
                <ExpandableUserSalaryRow
                  salary={null}
                  profiles={profiles}
                  userId={userId}
                  selectedMonth={selectedMonth}
                />
              ) : (
                filteredSalaries.map((s) => (
                  <ExpandableUserSalaryRow
                    key={s.id}
                    salary={s}
                    profiles={profiles}
                    userId={userId}
                    selectedMonth={selectedMonth}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function FinanceiroContent() {
  const queryClient = useQueryClient();
  const { role, user, position } = useAuth();
  const { deals = [], settings, presentations, loading: appLoading, updateAdjustment, removeDeal, addOrUpdateDeal, refreshDeals } = useAppData(role, user?.id, position);

  const currentMonthKey = getMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [filtroOperacao, setFiltroOperacao] = useState("Todas");
  const [filtroFuncionario, setFiltroFuncionario] = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState("Todos Status");
  
  const [filterType, setFilterType] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [kpiModalType, setKpiModalType] = useState<"volume" | "pago" | "projetado" | "fixo" | null>(null);
  
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["finance-data", role, user?.id, filterType, selectedYear],
    queryFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const isTestEnv = currentUser?.email?.endsWith("@teste.com") || false;

      // profiles filtrado por is_test_data para isolamento test/prod
      let profilesRes = await (supabase.from("profiles") as any)
        .select("user_id, full_name, display_name, commission_percent, fixed_salary, position")
        .eq("is_test_data", isTestEnv);
      if (profilesRes.error && (profilesRes.error.message?.includes("is_test_data") || profilesRes.error.message?.includes("column"))) {
        profilesRes = await (supabase.from("profiles") as any)
          .select("user_id, full_name, display_name, commission_percent, fixed_salary, position");
      }
      const salariesRes = await (supabase.from("salary_payments") as any).select("*");

      if (profilesRes.error) throw profilesRes.error;
      if (salariesRes.error) throw salariesRes.error;

      const map: ProfileMap = {};
      (profilesRes.data as any[]).forEach((p) => {
        map[p.user_id] = {
          full_name: p.full_name || p.display_name || "-",
          display_name: p.display_name || "",
          commission_percent: p.commission_percent || 0,
          fixed_salary: p.fixed_salary || 0,
        };
      });

      return {
        salaries: salariesRes.data as any[],
        profiles: map,
      };
    }
  });

  const querySalaries = data?.salaries || [];
  const profiles = data?.profiles || {};


  const activeDeals = deals;
  const activeSalaries = querySalaries.length > 0 ? querySalaries : [];

  const filteredDeals = useMemo(() => {
    return activeDeals.filter((d) => {
      // Time filtering: deal entra no mês se mensalidade OU implantação cai nele
      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(d);
      let passTime = false;
      if (filterType === "month") {
        passTime = mensalidadeMonthKey === selectedMonth || implantacaoMonthKey === selectedMonth;
      } else {
        passTime = (mensalidadeMonthKey?.startsWith(selectedYear) ?? false) || (implantacaoMonthKey?.startsWith(selectedYear) ?? false);
      }

      // Operation
      const passOp = filtroOperacao === "Todas" || d.operation === filtroOperacao;

      // User
      const passUser = filtroFuncionario === "Todos" || d.userId === filtroFuncionario;

      // Status
      let passStatus = true;
      if (filtroStatus === "Finalizados") {
        const parts = getCommissionPeriodParts(d, presentations, settings, { filterType, selectedMonth, selectedYear });
        passStatus = parts.total > 0 && getCommissionStatusForParts(d, parts) === "done";
      } else if (filtroStatus === "Pendentes") {
        const parts = getCommissionPeriodParts(d, presentations, settings, { filterType, selectedMonth, selectedYear });
        passStatus = parts.total > 0 && getCommissionStatusForParts(d, parts) !== "done";
      }

      return passTime && passOp && passUser && passStatus;
    });
  }, [activeDeals, selectedMonth, filterType, selectedYear, filtroOperacao, filtroFuncionario, filtroStatus, presentations, settings]);

  const filteredSalaries = useMemo(() => {
    return activeSalaries.filter((s) => {
      const salaryMonthKey = getMonthKey(s.reference_month);
      let passTime = false;
      if (filterType === "month") {
        passTime = salaryMonthKey === selectedMonth;
      } else {
        passTime = salaryMonthKey.startsWith(selectedYear);
      }

      const passUser = filtroFuncionario === "Todos" || s.user_id === filtroFuncionario;
      let passStatus = true;
      if (filtroStatus === "Finalizados") passStatus = s.is_paid_by_gestor === true;
      if (filtroStatus === "Pendentes") passStatus = !s.is_paid_by_gestor;
      return passTime && passUser && passStatus;
    });
  }, [activeSalaries, selectedMonth, filterType, selectedYear, filtroFuncionario, filtroStatus]);

  const kpis = useMemo(() => {
    // Soma pagamentos explícitos de salary_payments
    const usersWithPayments = new Set(filteredSalaries.map((s: any) => s.user_id));
    const explicitFixo = filteredSalaries.reduce((acc: number, s: any) => acc + (s.amount || 0), 0);
    // Fallback: para usuários sem registro de pagamento no período, usa fixed_salary do perfil
    let fallbackFixo = 0;
    Object.entries(profiles).forEach(([uid, profile]) => {
      if (usersWithPayments.has(uid)) return;
      const fixedSal = (profile as any).fixed_salary || 0;
      if (fixedSal <= 0) return;
      if (filtroFuncionario !== "Todos" && filtroFuncionario !== uid) return;
      fallbackFixo += fixedSal;
    });
    const totalFixo = explicitFixo + fallbackFixo;

    let totalProjetado = 0;
    let totalPago = 0;
    let volumeTotal = 0;

    filteredDeals.forEach((deal) => {
      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
      const presCount = getPresentationsForDeal(deal, presentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      const mensalidadeComm = comm.monthlyCommission + comm.superMetaBonus;

      // Conta apenas a parte que pertence ao período filtrado
      let commInPeriod = 0;
      if (filterType === "month") {
        const mensalidadeInMonth = mensalidadeMonthKey === selectedMonth;
        const implantacaoInMonth = implantacaoMonthKey === selectedMonth;
        if (mensalidadeInMonth) { volumeTotal += deal.monthlyValue || 0; commInPeriod += mensalidadeComm; }
        if (implantacaoInMonth) { volumeTotal += deal.implantationValue || 0; commInPeriod += comm.implantationCommission; }
      } else {
        const mensalidadeInYear = mensalidadeMonthKey?.startsWith(selectedYear) ?? false;
        const implantacaoInYear = implantacaoMonthKey?.startsWith(selectedYear) ?? false;
        if (mensalidadeInYear) { volumeTotal += deal.monthlyValue || 0; commInPeriod += mensalidadeComm; }
        if (implantacaoInYear && implantacaoMonthKey !== mensalidadeMonthKey) { volumeTotal += deal.implantationValue || 0; commInPeriod += comm.implantationCommission; }
        if (implantacaoInYear && implantacaoMonthKey === mensalidadeMonthKey && !mensalidadeInYear) { volumeTotal += deal.implantationValue || 0; commInPeriod += comm.implantationCommission; }
      }

      if (deal.isUserConfirmedPayment) totalPago += commInPeriod;
      else totalProjetado += commInPeriod;
    });

    return { totalFixo, totalProjetado, totalPago, volumeTotal };
  }, [filteredDeals, filteredSalaries, filterType, selectedMonth, selectedYear, presentations, settings]);

  // Rows para modal e Contas a Pagar: salary_payments explícitos + fallback de profiles
  const salaryModalRows = useMemo(() => {
    const rows: Array<SalaryRow & { isFallback?: boolean }> = [...filteredSalaries];
    const usersWithPayments = new Set(filteredSalaries.map((s: any) => s.user_id));
    Object.entries(profiles).forEach(([uid, profile]) => {
      if (usersWithPayments.has(uid)) return;
      const fixedSal = (profile as any).fixed_salary || 0;
      if (fixedSal <= 0) return;
      if (filtroFuncionario !== "Todos" && filtroFuncionario !== uid) return;
      rows.push({
        id: `fallback-${uid}`,
        user_id: uid,
        reference_month: filterType === "month" ? selectedMonth + "-01" : selectedYear + "-01-01",
        amount: fixedSal,
        expected_payment_date: (filterType === "month" ? selectedMonth : selectedYear + "-01") + "-20",
        is_paid_by_gestor: false,
        user_confirmed_receipt: false,
        payment_date: null,
        isFallback: true,
      });
    });
    return rows;
  }, [filteredSalaries, profiles, filtroFuncionario, filterType, selectedMonth, selectedYear]);

  const futureProjections = useMemo(() => {
    const projMap: Record<string, { projectedIn: number, projectedOut: number }> = {};
    const addToMap = (monthKey: string, volume: number, commission: number) => {
      if (!projMap[monthKey]) projMap[monthKey] = { projectedIn: 0, projectedOut: 0 };
      projMap[monthKey].projectedIn += volume;
      projMap[monthKey].projectedOut += commission;
    };

    activeDeals.forEach((deal) => {
      if (filtroOperacao !== "Todas" && deal.operation !== filtroOperacao) return;
      if (filtroFuncionario !== "Todos" && deal.userId !== filtroFuncionario) return;

      const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
      const presCount = getPresentationsForDeal(deal, presentations);
      const comm = calculateCommission(deal, presCount, settings, false);
      const mensalidadeComm = comm.monthlyCommission + comm.superMetaBonus;

      const isFutureMes = (mk: string | null) => mk && (filterType === "month" ? mk > selectedMonth : mk.split("-")[0] > selectedYear);

      if (isFutureMes(mensalidadeMonthKey)) {
        addToMap(mensalidadeMonthKey!, deal.monthlyValue || 0, mensalidadeComm);
      }
      if (isFutureMes(implantacaoMonthKey) && implantacaoMonthKey !== mensalidadeMonthKey) {
        addToMap(implantacaoMonthKey!, deal.implantationValue || 0, comm.implantationCommission);
      }
      // Se ambas no mesmo mês futuro, adiciona implantação junto
      if (isFutureMes(implantacaoMonthKey) && implantacaoMonthKey === mensalidadeMonthKey) {
        projMap[mensalidadeMonthKey!].projectedIn += deal.implantationValue || 0;
        projMap[mensalidadeMonthKey!].projectedOut += comm.implantationCommission;
      }
    });

    return Object.entries(projMap)
      .map(([key, vals]) => ({ monthKey: key, ...vals }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(0, 6);
  }, [activeDeals, selectedMonth, filterType, selectedYear, filtroOperacao, filtroFuncionario, presentations, settings]);

  const handleToggleMensalidade = async (dealId: string, currentStatus: boolean) => {
    if (currentStatus) {
      if (!confirm("Confirma o cancelamento deste recebimento revertendo-o para Pendente?")) return;
    }
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from("deals")
      .update({ 
        is_mensalidade_paid_by_client: newStatus,
        actual_payment_date: newStatus ? new Date().toISOString() : null,
        mensalidade_payment_date: newStatus ? new Date().toISOString() : null
      } as any)
      .eq("id", dealId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(newStatus ? "Recebimento confirmado!" : "Revertido para Pendente");
    await refreshDeals();
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const handleToggleImplantacao = async (dealId: string, currentStatus: boolean) => {
    if (currentStatus) {
      if (!confirm("Confirma o cancelamento deste recebimento revertendo-o para Pendente?")) return;
    }
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from("deals")
      .update({
        is_implantacao_paid_by_client: newStatus,
        is_implantacao_paid: newStatus,
        implantacao_payment_date: newStatus ? new Date().toISOString() : null
      } as any)
      .eq("id", dealId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(newStatus ? "Recebimento confirmado!" : "Revertido para Pendente");
    await refreshDeals();
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const handleConfirmInstallment = async (dealId: string, index: number, checked: boolean) => {
    const deal = activeDeals.find((d) => d.id === dealId);
    if (!deal) return;
    const dates = Array.isArray(deal.installmentDates) ? [...deal.installmentDates] : [];
    if (dates[index]) {
      dates[index] = { ...dates[index], paid: checked };
    }
    const { error } = await supabase
      .from("deals")
      .update({ installment_dates: dates } as any)
      .eq("id", dealId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(checked ? "Parcela confirmada!" : "Parcela desmarcada");
    await refreshDeals();
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const handleToggleCommissionPayment = async (dealId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    if (!newStatus) {
      if (!confirm("Confirma o cancelamento do pagamento desta comissão revertendo-a para Pendente?")) return;
    }
    const { error } = await supabase
      .from("deals")
      .update({
        is_paid_to_user: newStatus,
        is_user_confirmed_payment: newStatus ? false : null,
      } as any)
      .eq("id", dealId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(newStatus ? "Comissão paga com sucesso!" : "Baixa de comissão desmarcada");
    const deal = activeDeals.find((d) => d.id === dealId);
    if (newStatus && deal) {
      const parts = getCommissionPeriodParts(deal, presentations, settings, { filterType, selectedMonth, selectedYear });
      // Upsert commission_payments para cada componente com valor no período
      if (parts.mensalidadeInPeriod && parts.mensalidadeCommission > 0 && parts.mensalidadeMonthKey) {
        await upsertCommissionPaymentRow(dealId, "mensalidade", parts.mensalidadeMonthKey, parts.mensalidadeCommission, deal.isTestData || false).catch(console.error);
      }
      if (parts.implantacaoInPeriod && parts.implantacaoCommission > 0 && parts.implantacaoMonthKey) {
        await upsertCommissionPaymentRow(dealId, "implantacao", parts.implantacaoMonthKey, parts.implantacaoCommission, deal.isTestData || false).catch(console.error);
      }
      if (deal.userId) {
        const details = parts.labels.length > 0 ? ` (${parts.labels.join(" + ")})` : "";
        await createNotification(
          deal.userId,
          "Comissão disponível 💰",
          `Sua comissão${details} referente ao cliente ${deal.clientName} foi marcada como paga pelo gestor. Acesse o Financeiro para confirmar o recebimento.`,
          deal.id
        );
      }
    } else if (!newStatus) {
      await clearCommissionPaymentsForDeal(dealId).catch(console.error);
    }
    await refreshDeals();
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const handleToggleSalaryPayment = async (salaryId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from("salary_payments")
      .update({ is_paid_by_gestor: newStatus, payment_date: newStatus ? new Date().toISOString() : null } as any)
      .eq("id", salaryId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(newStatus ? "Salário marcado como pago com sucesso!" : "Baixa de salário desmarcada");
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const handleCreateAndToggleSalaryPayment = async (userId: string, amount: number, referenceMonth: string) => {
    const dateStr = referenceMonth.slice(0, 7) + "-20";
    const { data, error } = await (supabase as any)
      .from("salary_payments")
      .insert({
        user_id: userId,
        amount,
        reference_month: referenceMonth.slice(0, 7) + "-01",
        expected_payment_date: dateStr,
        is_paid_by_gestor: true,
        payment_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) { toast.error("Erro ao registrar salário: " + error.message); return; }
    toast.success("Salário registrado e marcado como pago!");
    queryClient.invalidateQueries({ queryKey: ["finance-data"] });
  };

  const getUserName = (userId: string) => profiles[userId]?.full_name || "-";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap">Torre de Controle</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Visão consolidada de receitas e pagamentos</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-2 w-full md:w-auto">
          <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Operação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas Operações</SelectItem>
              <SelectItem value="BluePex">BluePex</SelectItem>
              <SelectItem value="Opus Tech">Opus Tech</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroFuncionario} onValueChange={setFiltroFuncionario}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Funcionário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos Funcionários</SelectItem>
              {Object.entries(profiles).map(([id, p]) => (
                <SelectItem key={id} value={id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[100px] h-8 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
            </SelectContent>
          </Select>

          {filterType === "month" ? (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] md:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Mês Referência" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos Status</SelectItem>
              <SelectItem value="Pendentes">🟡 Pendentes</SelectItem>
              <SelectItem value="Finalizados">✅ Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title={`Volume Bruto (${filterType === "month" ? "Mês" : "Ano"})`}
          value={formatCurrency(kpis.volumeTotal)}
          icon={BarChart3}
          variant="default"
          subtitle="Valor bruto total dos contratos"
          onClick={() => setKpiModalType("volume")}
        />
        <KpiCard
          title="Comissão Paga"
          value={formatCurrency(kpis.totalPago)}
          icon={CheckCircle2}
          variant="success"
          subtitle="Já confirmada e recebida"
          onClick={() => setKpiModalType("pago")}
        />
        <KpiCard
          title="Comissão Prevista"
          value={formatCurrency(kpis.totalProjetado)}
          icon={ArrowDownToLine}
          variant="warning"
          subtitle="Esperado receber neste mês pela Regra do Dia 07"
          onClick={() => setKpiModalType("projetado")}
        />
        <KpiCard
          title="Salários Fixos"
          value={formatCurrency(kpis.totalFixo)}
          icon={Wallet}
          variant="default"
          subtitle="Remuneração fixa consolidada do período"
          onClick={() => setKpiModalType("fixo")}
        />
      </div>

      <FutureProjectionsAccumulatedCard projections={futureProjections} position={position} onSelectMonth={setSelectedMonth} />

      <Tabs defaultValue="receivables">
        <TabsList className="h-9 mb-5 bg-muted/40 border border-border/40">
          <TabsTrigger value="receivables" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Contas a Receber
          </TabsTrigger>
          <TabsTrigger value="payables" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Contas a Pagar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="mt-0">
          <ReceivablesTab
            deals={filteredDeals}
            selectedMonth={selectedMonth}
            getUserName={getUserName}
            onToggleMensalidade={handleToggleMensalidade}
            onToggleImplantacao={handleToggleImplantacao}
            onConfirmInstallment={handleConfirmInstallment}
          />
        </TabsContent>

        <TabsContent value="payables" className="mt-0">
          <PayablesTab
            deals={filteredDeals}
            salaries={salaryModalRows}
            profiles={profiles}
            getUserName={getUserName}
            presentations={presentations}
            settings={settings}
            period={{ filterType, selectedMonth, selectedYear }}
            onToggleCommissionPayment={handleToggleCommissionPayment}
            onToggleSalaryPayment={handleToggleSalaryPayment}
            onCreateAndToggleSalaryPayment={handleCreateAndToggleSalaryPayment}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={kpiModalType !== null} onOpenChange={(open) => !open && setKpiModalType(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight">
              {kpiModalType === "volume" && "Detalhamento: Volume Bruto"}
              {kpiModalType === "pago" && "Detalhamento: Comissão Paga"}
              {kpiModalType === "projetado" && "Detalhamento: Comissão Projetada"}
              {kpiModalType === "fixo" && "Detalhamento: Salários Fixos"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {kpiModalType === "fixo" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Funcionário</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Salário</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryModalRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">Nenhum salário fixo cadastrado.</TableCell>
                    </TableRow>
                  ) : (
                    salaryModalRows.map((s) => (
                      <TableRow key={s.id} className="border-border/25 hover:bg-[#242842]/40">
                        <TableCell className="text-sm font-medium">{getUserName(s.user_id)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(s.amount)}</TableCell>
                        <TableCell className="text-center">
                          {s.is_paid_by_gestor ? (
                            <span className="pill-green">Pago</span>
                          ) : (
                            <span className="pill-yellow">Pendente</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : kpiModalType === "volume" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Executivo</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Mensalidade</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Implantação</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Total Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((d) => (
                    <TableRow key={d.id} className="border-border/25 hover:bg-[#242842]/40">
                      <TableCell className="text-sm font-medium">{d.clientName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] border-border/40">{d.operation}</Badge></TableCell>
                      <TableCell className="text-sm">{getUserName(d.userId)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{d.monthlyValue > 0 ? formatCurrency(d.monthlyValue) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{d.implantationValue > 0 ? formatCurrency(d.implantationValue) : "—"}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">{formatCurrency((d.monthlyValue || 0) + (d.implantationValue || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Executivo</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Comissão</TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals
                    .filter((d) => {
                      if (kpiModalType === "pago") return d.isUserConfirmedPayment === true;
                      if (kpiModalType === "projetado") return d.isUserConfirmedPayment !== true;
                      return false;
                    })
                    .map((d) => {
                      const parts = getCommissionPeriodParts(d, presentations, settings, { filterType, selectedMonth, selectedYear });
                      return (
                        <TableRow key={d.id} className="border-border/25 hover:bg-[#242842]/40">
                          <TableCell className="text-sm font-medium">{d.clientName}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] border-border/40">{d.operation}</Badge></TableCell>
                          <TableCell className="text-sm">{getUserName(d.userId)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">{formatCurrency(parts.total)}</TableCell>
                          <TableCell className="text-center">
                            {d.isUserConfirmedPayment ? (
                              <span className="pill-green">Recebido</span>
                            ) : d.isPaidToUser ? (
                              <span className="pill-blue">Aguardando Confirmação</span>
                            ) : (
                              <span className="pill-yellow">Pendente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Contas a Receber ── */

interface ReceivablesTabProps {
  deals: Deal[];
  selectedMonth: string;
  getUserName: (id: string) => string;
  onToggleMensalidade: (id: string, currentStatus: boolean) => void;
  onToggleImplantacao: (id: string, currentStatus: boolean) => void;
  onConfirmInstallment: (id: string, index: number, checked: boolean) => void;
}

function ExpandableReceivablesRow({ deal, selectedMonth, getUserName, onToggleMensalidade, onToggleImplantacao, onConfirmInstallment }: any) {
  const [expanded, setExpanded] = useState(false);
  const { mensalidadeMonthKey, implantacaoMonthKey } = getDealMonthKeys(deal);
  
  const expectMensalidade = deal.monthlyValue > 0 && mensalidadeMonthKey === selectedMonth;
  const expectImplantacao = deal.implantationValue > 0 && !deal.isInstallment && implantacaoMonthKey === selectedMonth;
  const expectedDateParts = [
    expectMensalidade && deal.firstPaymentDate ? `Mens.: ${formatSafeDate(getPaymentDateInfo(deal.firstPaymentDate).expectedPaymentDate)}` : null,
    expectImplantacao && deal.implantationPaymentDate ? `Impl.: ${formatSafeDate(getPaymentDateInfo(deal.implantationPaymentDate).expectedPaymentDate)}` : null,
  ].filter(Boolean) as string[];
  const fallbackDate = deal.firstPaymentDate || deal.implantationPaymentDate || deal.closingDate;
  if (!fallbackDate) return null;
  const expectedPaymentDateStr = expectedDateParts.length > 0
    ? expectedDateParts.join(" / ")
    : formatSafeDate(getPaymentDateInfo(fallbackDate).expectedPaymentDate);

  // isPaid só é true quando o usuário clicou explicitamente no botão de confirmação
  let isPaid = false;
  if (expectMensalidade && deal.isMensalidadePaidByClient) isPaid = true;
  if (expectImplantacao && deal.isImplantacaoPaid) isPaid = true;
  if (deal.isInstallment && Array.isArray(deal.installmentDates)) {
    const hasAnyPaidThisMonth = deal.installmentDates.some((inst: any) => {
      const dateStr = inst?.date || inst;
      return dateStr && getPaymentDateInfo(dateStr).monthKey === selectedMonth && inst?.paid === true;
    });
    if (hasAnyPaidThisMonth) isPaid = true;
  }

  const totalValue = (expectMensalidade ? deal.monthlyValue : 0) + (expectImplantacao ? deal.implantationValue : 0);

  return (
    <>
      <TableRow onClick={() => setExpanded(!expanded)} className="border-border/25 cursor-pointer hover:bg-[#242842]/40 transition-colors">
        <TableCell className="w-[30px] px-2 py-3">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm font-medium">{deal.clientName}</TableCell>
        <TableCell className="px-3 py-3">
          <Badge variant="outline" className="text-[10px] border-border/40">{deal.operation}</Badge>
        </TableCell>
        <TableCell className="px-3 py-3 text-sm text-muted-foreground">{getUserName(deal.userId)}</TableCell>
        <TableCell className="px-3 py-3 text-sm text-muted-foreground">{deal.sdrUserId ? getUserName(deal.sdrUserId) : "—"}</TableCell>
        <TableCell className="px-3 py-3 text-right text-sm font-mono font-semibold text-foreground/90">
          {expectMensalidade && deal.monthlyValue > 0 ? formatCurrency(deal.monthlyValue) : "—"}
        </TableCell>
        <TableCell className="px-3 py-3 text-right text-sm font-mono font-semibold text-foreground/90">
          {expectImplantacao && deal.implantationValue > 0 ? formatCurrency(deal.implantationValue) : "—"}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm text-muted-foreground text-center tabular-nums font-mono">
          {expectedPaymentDateStr}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm text-center">
          {isPaid ? (
            <span className="text-success text-xs font-semibold">Rec. Mês Atual</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 italic">A aguardar</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {isPaid ? (
            <span className="pill-green">Baixa Concluída</span>
          ) : (
            <span className="pill-yellow">A Receber</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="p-0">
            <div className="px-5 py-4 bg-[#242842]/60 border-t border-border/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {expectMensalidade && (
                <div className="p-3 rounded-lg border border-border/30 bg-muted/30 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Mensalidade (Ref)</p>
                      <p className="text-base font-bold mt-0.5">{formatCurrency(deal.monthlyValue)}</p>
                    </div>
                    {deal.isMensalidadePaidByClient ? (
                      <span className="pill-green">Recebido</span>
                    ) : (
                      <span className="pill-yellow">A Receber</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground/60">Venc: {formatSafeDate(deal.firstPaymentDate)}</p>
                    <Button size="sm" variant={deal.isMensalidadePaidByClient ? "destructive" : "outline"} className="h-6 text-[10px]" onClick={() => onToggleMensalidade(deal.id, deal.isMensalidadePaidByClient || false)}>
                      {deal.isMensalidadePaidByClient ? "Reverter Baixa" : "Confirmar Recebimento"}
                    </Button>
                  </div>
                </div>
              )}

              {expectImplantacao && (
                <div className="p-3 rounded-lg border border-border/30 bg-muted/30 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Implantação Única</p>
                      <p className="text-base font-bold mt-0.5">{formatCurrency(deal.implantationValue)}</p>
                    </div>
                    {deal.isImplantacaoPaid ? (
                      <span className="pill-green">Recebido</span>
                    ) : (
                      <span className="pill-yellow">A Receber</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground/60">Venc: {formatSafeDate(deal.implantationPaymentDate)}</p>
                    <Button size="sm" variant={deal.isImplantacaoPaid ? "destructive" : "outline"} className="h-6 text-[10px]" onClick={() => onToggleImplantacao(deal.id, deal.isImplantacaoPaid || false)}>
                      {deal.isImplantacaoPaid ? "Reverter Baixa" : "Confirmar Recebimento"}
                    </Button>
                  </div>
                </div>
              )}

              {deal.isInstallment && deal.implantationValue > 0 && Array.isArray(deal.installmentDates) && (
                <div className="p-3 rounded-lg border border-border/30 bg-muted/30 space-y-2 col-span-full md:col-span-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Parcelas de Implantação ({deal.installmentCount}x)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {deal.installmentDates.map((inst: any, idx: number) => {
                      const dateStr = inst?.date || inst;
                      if (!dateStr || getPaymentDateInfo(dateStr).monthKey !== selectedMonth) return null;
                      const isPaidInst = inst?.paid === true;
                      const parcelValue = deal.implantationValue / deal.installmentCount;
                      return (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-background/40 border border-border/30">
                          <div>
                            <p className="text-xs font-medium">Parcela {idx+1}/{deal.installmentCount}</p>
                            <p className="text-sm font-bold">{formatCurrency(parcelValue)}</p>
                            <p className="text-[10px] text-muted-foreground">Venc: {formatSafeDate(dateStr)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isPaidInst ? (
                              <span className="pill-green" style={{ fontSize: "9px" }}>Recebido</span>
                            ) : (
                              <span className="pill-yellow" style={{ fontSize: "9px" }}>Pendente</span>
                            )}
                            <Checkbox checked={isPaidInst} onCheckedChange={(checked) => onConfirmInstallment(deal.id, idx, !!checked)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ReceivablesTab({ deals, selectedMonth, getUserName, onToggleMensalidade, onToggleImplantacao, onConfirmInstallment }: ReceivablesTabProps) {
  if (deals.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/60 py-12 text-center text-muted-foreground text-sm">
        Nenhum recebimento previsto para este mês.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Contas a Receber (Previsto Mês)</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="w-[30px] px-2"></TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Executivo</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">SDR</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Mensalidade</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Implantação</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Data Prevista</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Baixa</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => (
              <ExpandableReceivablesRow
                key={deal.id}
                deal={deal}
                selectedMonth={selectedMonth}
                getUserName={getUserName}
                onToggleMensalidade={onToggleMensalidade}
                onToggleImplantacao={onToggleImplantacao}
                onConfirmInstallment={onConfirmInstallment}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ── Contas a Pagar ── */

interface PayablesTabProps {
  deals: Deal[];
  salaries: Array<SalaryRow & { isFallback?: boolean }>;
  profiles: ProfileMap;
  getUserName: (id: string) => string;
  presentations: any;
  settings: any;
  period: FinancePeriod;
  onToggleCommissionPayment: (dealId: string, currentStatus: boolean) => void;
  onToggleSalaryPayment: (salaryId: string, currentStatus: boolean) => void;
  onCreateAndToggleSalaryPayment: (userId: string, amount: number, referenceMonth: string) => void;
}

function ExpandableCommissionRow({ deal, settings, getUserName, presentations, period, onToggleCommissionPayment }: any) {
  const [expanded, setExpanded] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const parts = getCommissionPeriodParts(deal, presentations, settings, period);
  const commissionStatus = getCommissionStatusForParts(deal, parts);

  const baseDate = parts.mensalidadeInPeriod ? deal.firstPaymentDate : parts.implantacaoInPeriod ? deal.implantationPaymentDate : deal.firstPaymentDate || deal.implantationPaymentDate;
  let expectedPaymentDateStr = "Data Pendente";

  if (baseDate) {
    const info = getPaymentDateInfo(baseDate);
    expectedPaymentDateStr = formatSafeDate(info.expectedPaymentDate);
  }

  const comm = parts.comm;
  const dealComiss = parts.total;
  const periodBaseCommission = (parts.mensalidadeInPeriod ? comm.monthlyCommission : 0) + (parts.implantacaoInPeriod ? comm.implantationCommission : 0);
  const periodSuperMetaBonus = parts.mensalidadeInPeriod ? comm.superMetaBonus : 0;

  return (
    <>
      <TableRow
        onClick={() => setExpanded(!expanded)}
        className={`border-border/25 cursor-pointer transition-colors ${
          deal.isUserConfirmedPayment
            ? "bg-success/5 hover:bg-success/10 border-l-2 border-l-success/40"
            : deal.isPaidToUser
            ? "bg-warning/5 hover:bg-warning/10 border-l-2 border-l-warning/40"
            : "hover:bg-[#242842]/40"
        }`}
      >
        <TableCell className="w-[30px] px-2 py-3">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm font-medium">{getUserName(deal.userId)}</TableCell>
        <TableCell className="px-3 py-3 text-sm">{deal.clientName}</TableCell>
        <TableCell className="px-3 py-3">
          <Badge variant="outline" className="text-[10px] border-border/40">{deal.operation}</Badge>
        </TableCell>
        <TableCell className="px-3 py-3 text-right text-sm font-mono font-bold text-primary">
          {formatCurrency(dealComiss)}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm text-muted-foreground text-center tabular-nums font-mono">
          {expectedPaymentDateStr}
        </TableCell>
        <TableCell className="px-3 py-3 text-sm text-center">
          {commissionStatus === "done" ? (
            <span className="text-success text-xs font-semibold">Confirmado</span>
          ) : commissionStatus === "waiting" ? (
            <span className="text-warning text-xs font-semibold">Baixa enviada</span>
          ) : commissionStatus === "ready" ? (
            <span className="text-primary text-xs font-semibold">Liberada</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 italic">A aguardar</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                disabled={commissionStatus === "locked" || dealComiss <= 0}
                variant={deal.isUserConfirmedPayment ? "outline" : "default"}
                className={`h-7 text-xs ${
                  deal.isUserConfirmedPayment
                    ? "text-success border-success/30 bg-success/10 hover:bg-success/20"
                    : deal.isPaidToUser
                    ? "bg-warning/20 border-warning/30 text-warning hover:bg-warning/30"
                    : "bg-success hover:bg-success/90 text-success-foreground"
                }`}
              >
                {commissionStatus === "done" ? "Concluido" : commissionStatus === "waiting" ? "Aguardando Confirmacao" : commissionStatus === "ready" ? "Dar Baixa" : "Aguardando Recebimento"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 shadow-lg bg-card border-border/60" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {deal.isPaidToUser ? "Remover baixa de comissao" : "Enviar baixa de comissao"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  O funcionario recebera uma notificacao para confirmar o recebimento.
                </p>
                <Button
                  size="sm"
                  className={`w-full h-8 text-xs ${deal.isPaidToUser ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "bg-success hover:bg-success/90 text-success-foreground"}`}
                  onClick={() => { onToggleCommissionPayment(deal.id, deal.isPaidToUser || false); setPopoverOpen(false); }}
                >
                  {deal.isPaidToUser ? "Remover Baixa" : "Dar Baixa"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={8} className="p-0">
            <div className="px-5 py-4 bg-[#242842]/60 border-t border-border/30 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Valor Mensalidade</p>
                <p className="font-mono font-semibold text-foreground/90">{formatCurrency(deal.monthlyValue)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Valor Implantação</p>
                <p className="font-mono font-semibold text-foreground/90">{formatCurrency(deal.implantationValue)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                <p className="text-muted-foreground">Comissão Base</p>
                <p className="font-mono font-semibold text-primary">{formatCurrency(periodBaseCommission)}</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-1">
                <p className="text-warning/80">Bônus Super Meta</p>
                <p className="font-mono font-semibold text-warning">{periodSuperMetaBonus > 0 ? "+" + formatCurrency(periodSuperMetaBonus) : "—"}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PayablesTab({ deals, salaries, profiles, getUserName, presentations, settings, period, onToggleCommissionPayment, onToggleSalaryPayment, onCreateAndToggleSalaryPayment }: PayablesTabProps) {
  return (
    <div className="space-y-5">
      {/* Commissions */}
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Comissões a Pagar</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="w-[30px] px-2"></TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">SDR</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Operação</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Comissão do Período</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Data Prevista</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Baixa</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma comissão contabilizada para este mês.
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <ExpandableCommissionRow
                  key={deal.id}
                  deal={deal}
                  settings={settings}
                  getUserName={getUserName}
                  presentations={presentations}
                  period={period}
                  onToggleCommissionPayment={onToggleCommissionPayment}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Salaries */}
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">Salários Fixos</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Funcionário</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right">Valor</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Vencimento</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-center">Transferido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum salário registrado para este mês.
                </TableCell>
              </TableRow>
            ) : (
              salaries.map((s) => (
                <TableRow key={s.id} className={`border-border/25 hover:bg-[#242842]/40 ${s.is_paid_by_gestor ? "bg-success/5" : ""}`}>
                  <TableCell className="px-4 py-3 text-sm font-medium">
                    {getUserName(s.user_id)}
                    {(s as any).isFallback && (
                      <span className="ml-2 text-[9px] text-muted-foreground/50 italic">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm font-mono font-semibold">{formatCurrency(s.amount)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{formatSafeDate(s.expected_payment_date)}</TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    {(s as any).isFallback ? (
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => onCreateAndToggleSalaryPayment(s.user_id, s.amount, s.reference_month)}
                        title="Clique para registrar e marcar como pago"
                      />
                    ) : (
                      <Checkbox
                        checked={s.is_paid_by_gestor || false}
                        onCheckedChange={() => onToggleSalaryPayment(s.id, s.is_paid_by_gestor || false)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
