import { CommissionBreakdown, Deal, AppSettings, MonthlyPresentations, GlobalParameters } from "./types";

const DEFAULT_COMMISSION_RATE = 0.20;

/**
 * Get the commission tier rate based on presentations vs thresholds.
 * Returns 0.7, 1.0, or 2.0
 */
export function getCommissionTier(
  presentations: number,
  metaThreshold: number,
  superMetaThreshold: number
): { rate: number; label: string } {
  if (presentations >= superMetaThreshold) {
    return { rate: 2.0, label: "Super Meta (200%)" };
  }
  if (presentations >= metaThreshold) {
    return { rate: 1.0, label: "Meta (100%)" };
  }
  return { rate: 0.7, label: "70%" };
}

/**
 * Calculate commission for a deal using 3-tier independent logic.
 */
export function calculateCommission(
  deal: Deal,
  presentationsForOperation: number,
  settings?: AppSettings,
  _superMetaActive?: boolean // kept for backward compat, now ignored
): CommissionBreakdown {
  const rate = settings?.commissionRate ?? DEFAULT_COMMISSION_RATE;

  // Use strict fixed volumetry as requested
  const metaThreshold = 15;
  const superMetaThreshold = 30;

  const tier = getCommissionTier(presentationsForOperation, metaThreshold, superMetaThreshold);
  const baseRate = Math.min(tier.rate, 1.0); // base is capped at 1.0 for the monthly calc
  const monthlyBase = deal.monthlyValue * baseRate;
  const monthlyCommission = monthlyBase * rate;

  const implantationBase = deal.implantationValue * 0.4;
  const implantationCommission = implantationBase * rate;

  // Super meta bonus: when tier is 2.0, the commission doubles (add another 1x)
  let superMetaBonus = 0;
  if (tier.rate >= 2.0) {
    superMetaBonus = monthlyCommission; // doubles the monthly commission
  }

  return {
    monthlyBase,
    monthlyBaseRate: baseRate,
    monthlyCommission,
    implantationBase,
    implantationCommission,
    superMetaBonus,
    totalCommission: monthlyCommission + implantationCommission + superMetaBonus,
    commissionRate: rate,
  };
}

/**
 * Get the presentations count for a specific deal based on its CLOSING month.
 * The commission tier is determined by the month the deal was signed —
 * the month where the SDR's presentations effort happened.
 * The Regra do Dia 07 controls when money is received, not which goal tier applies.
 */
export function getPresentationsForDeal(
  deal: Deal,
  presentations: MonthlyPresentations
): number {
  const monthKey = getMonthKey(deal.closingDate);
  const monthData = presentations[monthKey] || { bluepex: 0, opus: 0 };
  return deal.operation === "BluePex" ? monthData.bluepex : monthData.opus;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getMonthKey(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

/**
 * Given a deal's closing month, returns the month key when its commission is payable.
 */
export function getPayableMonthKey(closingDate: string): string {
  const d = new Date(closingDate);
  d.setMonth(d.getMonth() + 1);
  return getMonthKey(d);
}

/**
 * Rule of the 7th (Baseado no Vencimento):
 * If paymentDate day <= 7 -> payable in the SAME month, on the 20th.
 * If paymentDate day > 7 -> payable in the NEXT month, on the 20th.
 */
export function getPaymentDateInfo(paymentDateStr: string): { monthKey: string, expectedPaymentDate: string } {
  const d = new Date(paymentDateStr + "T12:00:00");
  const day = d.getDate();
  const targetDate = new Date(paymentDateStr + "T12:00:00");
  
  if (day > 7) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  }
  
  const monthKey = getMonthKey(targetDate);
  const expectedPaymentDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-20`;
  
  return { monthKey, expectedPaymentDate };
}
