import React, { useState, Fragment } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Deal, PaymentStatus, AppSettings, MonthlyPresentations } from "@/lib/types";
import { calculateCommission, formatCurrency, getPresentationsForDeal } from "@/lib/commission";
import { Pencil, Trash2, ChevronDown, ChevronRight, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface DealsTableProps {
  deals: Deal[];
  presentations: MonthlyPresentations;
  settings: AppSettings;
  superMetaActive: boolean;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (deal: Deal, status: PaymentStatus) => void;
}

function OperationBadge({ op }: { op: string }) {
  return op === "BluePex" ? (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4F8EF7]/15 text-[#4F8EF7] border border-[#4F8EF7]/25">
      BluePex
    </span>
  ) : (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00D084]/15 text-[#00D084] border border-[#00D084]/25">
      Opus Tech
    </span>
  );
}

function StatusPill({ deal, isDirector }: { deal: Deal; isDirector: boolean }) {
  if (deal.paymentStatus === "Cancelado") {
    return <span className="pill-red">Cancelado</span>;
  }
  if (deal.isUserConfirmedPayment) {
    return <span className="pill-green">Recebida</span>;
  }
  if (deal.isPaidToUser) {
    return <span className="pill-blue">Aguardando</span>;
  }
  if (deal.isMensalidadePaidByClient || deal.isImplantacaoPaid) {
    return <span className="pill-yellow">Liberar</span>;
  }
  return <span className="pill-yellow">Pendente</span>;
}

function CommissionDetail({ deal, comm }: { deal: Deal; comm: ReturnType<typeof calculateCommission> }) {
  const basePercent = comm.monthlyBaseRate === 1 ? "100%" : "70%";
  const ratePercent = (comm.commissionRate * 100).toFixed(0) + "%";
  return (
    <div className="px-5 py-4 bg-[#242842]/60 border-t border-border/30 text-xs space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
        Detalhamento do Cálculo
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <span className="text-muted-foreground">Mensalidade: </span>
          <span className="text-foreground font-mono">{formatCurrency(deal.monthlyValue)}</span>
          <span className="text-muted-foreground"> × {basePercent} × {ratePercent} = </span>
          <span className="font-bold text-primary">{formatCurrency(comm.monthlyCommission)}</span>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <span className="text-muted-foreground">Implantação: </span>
          <span className="text-foreground font-mono">{formatCurrency(deal.implantationValue)}</span>
          <span className="text-muted-foreground"> × 40% × {ratePercent} = </span>
          <span className="font-bold text-primary">{formatCurrency(comm.implantationCommission)}</span>
        </div>
      </div>
      {comm.superMetaBonus > 0 && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
          <span className="text-warning font-bold">⚡ Bônus Super Meta:</span>
          <span className="font-bold text-warning font-mono">{formatCurrency(comm.superMetaBonus)}</span>
        </div>
      )}
      <div className="pt-2 border-t border-border/30 flex items-center gap-2">
        <span className="text-muted-foreground">Total Comissão:</span>
        <span className="font-bold text-primary text-sm font-mono">{formatCurrency(comm.totalCommission)}</span>
      </div>
    </div>
  );
}

export function DealsTable({ deals, presentations, settings, superMetaActive, onEdit, onDelete, onStatusChange }: DealsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { position } = useAuth();
  const isDirector = position === "Diretor";

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          Fechamentos do Período
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
        </span>
      </div>

      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-muted/30 flex items-center justify-center">
            <PackageOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Nenhum fechamento no período</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Ajuste o filtro de período ou registre um novo fechamento.</p>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="px-2 py-3 w-8" />
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[72px]">Data</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cliente</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase w-[96px]">Operação</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[110px]">Mensal</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[110px]">Implant.</TableHead>
              <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[120px]">Comissão</TableHead>
              {isDirector ? (
                <>
                  <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[120px]">Status</TableHead>
                  <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[110px]">Comissão</TableHead>
                </>
              ) : (
                <TableHead className="px-3 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase text-right w-[110px]">Status</TableHead>
              )}
              <TableHead className="px-2 py-3 w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((deal) => {
              const presCount = getPresentationsForDeal(deal, presentations);
              const comm = calculateCommission(deal, presCount, settings, superMetaActive);
              const isExpanded = expandedId === deal.id;
              const isCancelled = deal.paymentStatus === "Cancelado";

              return (
                <Fragment key={deal.id}>
                  <TableRow
                    className={`border-border/25 cursor-pointer transition-colors duration-100 ${isCancelled ? "opacity-50" : "hover:bg-[#242842]/40"}`}
                    onClick={() => toggleExpand(deal.id)}
                  >
                    <TableCell className="px-2 py-3">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      }
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs tabular-nums text-muted-foreground font-mono">
                      {format(new Date(deal.closingDate), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-sm font-medium truncate max-w-[180px]">
                      {deal.clientName}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <OperationBadge op={deal.operation} />
                    </TableCell>
                    <TableCell className="px-3 py-3 text-sm text-right font-mono font-semibold text-foreground/90">
                      {formatCurrency(deal.monthlyValue)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-sm text-right font-mono font-semibold text-foreground/90">
                      {formatCurrency(deal.implantationValue)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-sm text-right font-mono font-bold text-primary">
                      {formatCurrency(comm.totalCommission)}
                      {comm.superMetaBonus > 0 && (
                        <span className="block text-[10px] text-warning font-semibold">
                          +{formatCurrency(comm.superMetaBonus)} ⚡
                        </span>
                      )}
                    </TableCell>

                    {isDirector ? (
                      <>
                        <TableCell className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Select value={deal.paymentStatus || "Pendente"} onValueChange={(v) => onStatusChange(deal, v as PaymentStatus)}>
                            <SelectTrigger className="h-7 w-[110px] text-xs ml-auto bg-muted/40 border-border/40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Pago">Pago</SelectItem>
                              <SelectItem value="Cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <StatusPill deal={deal} isDirector={isDirector} />
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="px-3 py-3 text-right">
                        <StatusPill deal={deal} isDirector={isDirector} />
                      </TableCell>
                    )}

                    <TableCell className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      {position !== "SDR" && (
                        <div className="flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary/15 hover:text-primary" onClick={() => onEdit(deal)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/15 hover:text-destructive" onClick={() => onDelete(deal.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${deal.id}-detail`} className="hover:bg-transparent">
                      <TableCell colSpan={isDirector ? 10 : 9} className="p-0">
                        <CommissionDetail deal={deal} comm={comm} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
