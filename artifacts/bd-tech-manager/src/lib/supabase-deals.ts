import { Deal, MonthlyPresentations } from "./types";
import { UserRole } from "@/hooks/useAuth";
import { getPaymentDateInfo } from "./commission";

const dbToDeal = (db: any): Deal => ({
  id: db.id,
  clientName: db.clientName ?? db.client_name,
  operation: db.operation,
  closingDate: db.closingDate ?? db.closing_date,
  implantationValue: db.implantationValue ?? db.implantation_value,
  monthlyValue: db.monthlyValue ?? db.monthly_value,
  isImplantacaoPaid: db.isImplantacaoPaidByClient ?? db.is_implantacao_paid_by_client ?? db.isImplantacaoPaid ?? db.is_implantacao_paid,
  isMensalidadePaid: db.isMensalidadePaid ?? db.is_mensalidade_paid,
  actualPaymentDate: db.actualPaymentDate ?? db.actual_payment_date,
  mensalidadePaymentDate: db.mensalidadePaymentDate ?? db.mensalidade_payment_date ?? db.actualPaymentDate ?? db.actual_payment_date,
  implantacaoPaymentDate: db.implantacaoPaymentDate ?? db.implantacao_payment_date,
  isMensalidadePaidByClient: db.isMensalidadePaidByClient ?? db.is_mensalidade_paid_by_client,
  isPaidToUser: db.isPaidToUser ?? db.is_paid_to_user,
  isUserConfirmedPayment: db.isUserConfirmedPayment ?? db.is_user_confirmed_payment,
  userId: db.userId ?? db.user_id,
  sdrUserId: db.sdrUserId ?? db.sdr_user_id,
  implantationPaymentDate: db.implantationPaymentDate ?? db.implantation_payment_date,
  firstPaymentDate: db.firstPaymentDate ?? db.first_payment_date,
  commissionRateSnapshot: db.commissionRateSnapshot ?? db.commission_rate_snapshot,
  commissionAmountSnapshot: db.commissionAmountSnapshot ?? db.commission_amount_snapshot,
  isTestData: db.isTestData ?? db.is_test_data,
  isInstallment: db.isInstallment ?? db.is_installment ?? false,
  installmentCount: db.installmentCount ?? db.installment_count ?? 0,
  installmentDates: db.installmentDates ?? db.installment_dates ?? [],
  paymentStatus: db.paymentStatus ?? db.payment_status ?? "Pendente",
});

const dealToDb = (deal: Partial<Deal>) => {
  const base: Record<string, unknown> = {
    clientName: deal.clientName,
    operation: deal.operation,
    closingDate: deal.closingDate,
    implantationValue: deal.implantationValue,
    monthlyValue: deal.monthlyValue,
    isImplantacaoPaid: deal.isImplantacaoPaid,
    isImplantacaoPaidByClient: deal.isImplantacaoPaid,
    isMensalidadePaid: deal.isMensalidadePaid,
    isPaidToUser: deal.isPaidToUser,
    isUserConfirmedPayment: deal.isUserConfirmedPayment,
    isMensalidadePaidByClient: deal.isMensalidadePaidByClient,
    isInstallment: deal.isInstallment,
    installmentCount: deal.installmentCount,
    installmentDates: deal.installmentDates,
    userId: deal.userId,
    implantationPaymentDate: deal.implantationPaymentDate,
    firstPaymentDate: deal.firstPaymentDate,
    actualPaymentDate: deal.actualPaymentDate,
    mensalidadePaymentDate: deal.mensalidadePaymentDate,
    implantacaoPaymentDate: deal.implantacaoPaymentDate,
    commissionAmountSnapshot: deal.commissionAmountSnapshot,
    commissionRateSnapshot: deal.commissionRateSnapshot,
    paymentStatus: deal.paymentStatus,
    isTestData: deal.isTestData,
  };
  if (deal.sdrUserId !== undefined) {
    base.sdrUserId = deal.sdrUserId || null;
  }
  return base;
};

export async function fetchDeals(_role: UserRole, _userId?: string, _position?: string): Promise<Deal[]> {
  try {
    const res = await fetch("/api/deals");
    if (!res.ok) {
      console.error("[fetchDeals] API error:", res.status);
      return [];
    }
    const data: any[] = await res.json();
    console.log(`[fetchDeals] Negócios encontrados: ${data?.length || 0}`);
    return (data || []).map(dbToDeal);
  } catch (err) {
    console.error("[fetchDeals] Erro:", err);
    return [];
  }
}

export async function upsertDeal(deal: Deal): Promise<Deal> {
  const payload = dealToDb(deal);
  const method = deal.id ? "PATCH" : "POST";
  const url = deal.id ? `/api/deals/${deal.id}` : "/api/deals";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro ao salvar" }));
    throw new Error(err.error || "Erro ao salvar fechamento");
  }
  const data = await res.json();
  return dbToDeal(data);
}

export async function deleteDealFromDb(id: string): Promise<void> {
  const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete deal");
}

export async function fetchAvailableYears(): Promise<number[]> {
  try {
    const res = await fetch("/api/deals");
    if (!res.ok) return [new Date().getFullYear()];
    const data: any[] = await res.json();

    const years = new Set<number>();
    data?.forEach((d) => {
      const firstDate = d.firstPaymentDate ?? d.first_payment_date;
      const closingDate = d.closingDate ?? d.closing_date;
      const implDate = d.implantationPaymentDate ?? d.implantation_payment_date ?? firstDate ?? closingDate;
      const dates = [firstDate ?? closingDate, implDate];
      dates.forEach((baseDate) => {
        if (baseDate) {
          years.add(Number(getPaymentDateInfo(baseDate).monthKey.slice(0, 4)));
        }
      });
    });

    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  } catch {
    return [new Date().getFullYear()];
  }
}

export async function fetchPresentations(_role: UserRole, _userId?: string, _position?: string): Promise<MonthlyPresentations> {
  try {
    const res = await fetch("/api/presentations");
    if (!res.ok) return {};
    const data: any[] = await res.json();

    const result: MonthlyPresentations = {};
    data?.forEach((p: any) => {
      const key = (p.date as string).slice(0, 7);
      if (!result[key]) result[key] = { bluepex: 0, opus: 0 };
      if (p.operation === "BluePex") result[key].bluepex = p.count ?? 0;
      else result[key].opus = p.count ?? 0;
    });
    return result;
  } catch {
    return {};
  }
}

export async function savePresentationToDb(monthKey: string, operation: "bluepex" | "opus", count: number, userId: string) {
  const dbOperation = operation === "bluepex" ? "BluePex" : "Opus Tech";
  const dateStr = monthKey + "-01";

  const existingRes = await fetch("/api/presentations");
  if (!existingRes.ok) throw new Error("Failed to fetch presentations");
  const existing: any[] = await existingRes.json();
  const match = existing.find((p) => p.date === dateStr && p.operation === dbOperation);

  if (match) {
    const res = await fetch(`/api/presentations/${match.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (!res.ok) throw new Error("Failed to update presentation");
  } else {
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, operation: dbOperation, count, date: dateStr }),
    });
    if (!res.ok) throw new Error("Failed to create presentation");
  }
}

export async function fetchUserCommissionRate(_userId: string): Promise<number | null> {
  try {
    const res = await fetch("/api/profiles/me");
    if (!res.ok) return null;
    const data = await res.json();
    if (data.commissionPercent == null) return null;
    return Number(data.commissionPercent) / 100;
  } catch {
    return null;
  }
}

export async function saveUserCommissionRate(_userId: string, rate: number): Promise<void> {
  const res = await fetch("/api/profiles/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commissionPercent: String(Math.round(rate * 100)) }),
  });
  if (!res.ok) throw new Error("Failed to save commission rate");
}

export async function fetchUserFixedSalary(_userId: string): Promise<number | null> {
  try {
    const res = await fetch("/api/profiles/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.fixedSalary != null ? Number(data.fixedSalary) : null;
  } catch {
    return null;
  }
}

export async function saveUserFixedSalary(_userId: string, amount: number): Promise<void> {
  const res = await fetch("/api/profiles/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixedSalary: String(amount) }),
  });
  if (!res.ok) throw new Error("Failed to save fixed salary");
}

// ─── Notificações ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  isTestData: boolean;
  createdAt: string;
  dealId?: string;
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  dealId?: string
): Promise<void> {
  try {
    const body: Record<string, unknown> = { userId, title, message };
    if (dealId) body.dealId = dealId;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("[createNotification] Erro:", e);
  }
}

export async function fetchNotifications(_userId: string): Promise<AppNotification[]> {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return (data || []).map((n: any) => ({
      id: n.id,
      userId: n.userId ?? n.user_id,
      title: n.title,
      message: n.message,
      isRead: n.isRead ?? n.is_read ?? false,
      isTestData: n.isTestData ?? n.is_test_data ?? false,
      createdAt: n.createdAt ?? n.created_at,
      dealId: n.dealId ?? n.deal_id ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(_userId: string): Promise<void> {
  await fetch("/api/notifications/read-all", { method: "PATCH" });
}

// ─── commission_payments ───────────────────────────────────────────────────────

export interface CommissionPayment {
  id: string;
  dealId: string;
  component: "mensalidade" | "implantacao" | "implantacao_parcela";
  competenceMonth: string;
  installmentIndex: number | null;
  amount: number;
  recipientUserId: string | null;
  paidByDirectorAt: string | null;
  confirmedByUserAt: string | null;
  rejectedByUserAt: string | null;
  isTestData: boolean;
  createdAt: string;
  updatedAt: string;
}

function dbToCommissionPayment(cp: any): CommissionPayment {
  return {
    id: cp.id,
    dealId: cp.dealId ?? cp.deal_id,
    component: cp.component,
    competenceMonth: cp.competenceMonth ?? cp.competence_month,
    installmentIndex: cp.installmentIndex ?? cp.installment_index ?? null,
    amount: cp.amount,
    recipientUserId: cp.recipientUserId ?? cp.recipient_user_id ?? null,
    paidByDirectorAt: cp.paidByDirectorAt ?? cp.paid_by_director_at ?? null,
    confirmedByUserAt: cp.confirmedByUserAt ?? cp.confirmed_by_user_at ?? null,
    rejectedByUserAt: cp.rejectedByUserAt ?? cp.rejected_by_user_at ?? null,
    isTestData: cp.isTestData ?? cp.is_test_data ?? false,
    createdAt: cp.createdAt ?? cp.created_at,
    updatedAt: cp.updatedAt ?? cp.updated_at,
  };
}

export async function upsertCommissionPaymentRow(
  dealId: string,
  component: "mensalidade" | "implantacao" | "implantacao_parcela",
  competenceMonth: string,
  amount: number,
  _isTestData: boolean,
  recipientUserId: string,
  installmentIndex?: number | null
): Promise<void> {
  const res = await fetch("/api/commission-payments/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, component, competenceMonth, amount, recipientUserId, installmentIndex: installmentIndex ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro" }));
    throw new Error(err.error || "Failed to upsert commission payment");
  }
}

export async function clearCommissionPaymentForComponent(
  dealId: string,
  component: "mensalidade" | "implantacao" | "implantacao_parcela",
  competenceMonth: string,
  recipientUserId?: string,
  installmentIndex?: number | null
): Promise<void> {
  const res = await fetch("/api/commission-payments/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, component, competenceMonth, recipientUserId, installmentIndex: installmentIndex ?? null }),
  });
  if (!res.ok) throw new Error("Failed to clear commission payment");
}

export async function confirmCommissionPaymentsByRecipient(
  dealId: string,
  recipientUserId: string
): Promise<number> {
  const res = await fetch("/api/commission-payments/confirm-by-recipient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, recipientUserId }),
  });
  if (!res.ok) throw new Error("Failed to confirm commission payments");
  const data = await res.json();
  return data.count ?? 0;
}

export async function confirmCommissionPaymentById(
  paymentId: string,
  recipientUserId: string
): Promise<void> {
  const res = await fetch(`/api/commission-payments/${paymentId}/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientUserId }),
  });
  if (!res.ok) throw new Error("Pagamento nao encontrado ou ja confirmado.");
}

export async function rejectCommissionPaymentById(
  paymentId: string,
  recipientUserId: string
): Promise<void> {
  const res = await fetch(`/api/commission-payments/${paymentId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientUserId }),
  });
  if (!res.ok) throw new Error("Pagamento nao encontrado ou ja confirmado.");
}

export async function fetchCommissionPaymentsForUser(
  _recipientUserId: string
): Promise<CommissionPayment[]> {
  try {
    const res = await fetch("/api/commission-payments");
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return (data || []).map(dbToCommissionPayment);
  } catch {
    return [];
  }
}

export async function fetchCommissionPaymentsForEnvironment(): Promise<CommissionPayment[]> {
  try {
    const res = await fetch("/api/commission-payments/all");
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return (data || []).map(dbToCommissionPayment);
  } catch {
    return [];
  }
}
