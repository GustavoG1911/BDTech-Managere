import { supabase } from "@/integrations/supabase/client";
import { Deal, PaymentStatus, MonthlyPresentations } from "./types";
import { UserRole } from "@/hooks/useAuth";
import { getPaymentDateInfo } from "./commission";
import { getCurrentUserContext } from "./supabase-env";

const dbToDeal = (db: any): Deal => ({
  id: db.id,
  clientName: db.client_name,
  operation: db.operation,
  closingDate: db.closing_date,
  implantationValue: db.implantation_value,
  monthlyValue: db.monthly_value,
  isImplantacaoPaid: db.is_implantacao_paid_by_client ?? db.is_implantacao_paid,
  isMensalidadePaid: db.is_mensalidade_paid,
  actualPaymentDate: db.actual_payment_date,
  mensalidadePaymentDate: db.mensalidade_payment_date ?? db.actual_payment_date,
  implantacaoPaymentDate: db.implantacao_payment_date,
  isMensalidadePaidByClient: db.is_mensalidade_paid_by_client,
  isPaidToUser: db.is_paid_to_user,
  isUserConfirmedPayment: db.is_user_confirmed_payment,
  userId: db.user_id,
  sdrUserId: db.sdr_user_id,
  implantationPaymentDate: db.implantation_payment_date,
  firstPaymentDate: db.first_payment_date,
  commissionRateSnapshot: db.commission_rate_snapshot,
  commissionAmountSnapshot: db.commission_amount_snapshot,
  isTestData: db.is_test_data,
  isInstallment: db.is_installment || false,
  installmentCount: db.installment_count || 0,
  installmentDates: db.installment_dates || [],
  paymentStatus: db.payment_status || "Pendente",
});

const dealToDb = (deal: Partial<Deal>) => {
  const base: Record<string, unknown> = {
    id: deal.id,
    client_name: deal.clientName,
    operation: deal.operation,
    closing_date: deal.closingDate,
    implantation_value: deal.implantationValue,
    monthly_value: deal.monthlyValue,
    is_implantacao_paid: deal.isImplantacaoPaid,
    is_implantacao_paid_by_client: deal.isImplantacaoPaid,
    is_mensalidade_paid: deal.isMensalidadePaid,
    is_paid_to_user: deal.isPaidToUser,
    is_user_confirmed_payment: deal.isUserConfirmedPayment,
    is_mensalidade_paid_by_client: deal.isMensalidadePaidByClient,
    is_installment: deal.isInstallment,
    installment_count: deal.installmentCount,
    installment_dates: deal.installmentDates,
    user_id: deal.userId,
    implantation_payment_date: deal.implantationPaymentDate,
    first_payment_date: deal.firstPaymentDate,
    actual_payment_date: deal.actualPaymentDate,
    mensalidade_payment_date: deal.mensalidadePaymentDate,
    implantacao_payment_date: deal.implantacaoPaymentDate,
    commission_amount_snapshot: deal.commissionAmountSnapshot,
    commission_rate_snapshot: deal.commissionRateSnapshot,
    payment_status: deal.paymentStatus,
    is_test_data: deal.isTestData,
  };
  // sdr_user_id requer coluna no banco — incluído apenas quando definido
  if (deal.sdrUserId !== undefined) {
    base.sdr_user_id = deal.sdrUserId || null;
  }
  return base;
};

export async function fetchDeals(role: UserRole, userId?: string, position?: string): Promise<Deal[]> {
  const { user, isTestEnv } = await getCurrentUserContext();

  console.log(`[fetchDeals] Buscando dados para ambiente: ${isTestEnv ? "TESTE 🧪" : "PRODUÇÃO 🚀"} (User: ${user?.email}, Role: ${role}, Position: ${position})`);

  // Pré-buscar UUIDs de executivos se o usuário for SDR
  // profiles tem is_test_data → filtra pelo mesmo ambiente do SDR para não cruzar prod/teste
  let executivoIds: string[] = [];
  if (position === "SDR") {
    const { data: executivos, error: execErr } = await (supabase as any)
      .from("profiles")
      .select("user_id")
      .eq("position", "Executivo de Negócios")
      .eq("is_test_data", isTestEnv);
    if (execErr) {
      console.error("[fetchDeals] Erro ao buscar executivos para SDR:", execErr.message);
    }
    executivoIds = (executivos || []).map((p: any) => p.user_id);
    console.log(`[fetchDeals] SDR — executivos encontrados (is_test_data=${isTestEnv}): ${executivoIds.length}`, executivoIds);
  }

  let query = (supabase as any)
    .from("deals")
    .select("*")
    .eq("is_test_data", isTestEnv);

  // Filtro de visibilidade baseado em cargo (position)
  if (position === "Diretor") {
    // Diretor vê todos os deals — sem filtro de user_id
  } else if (position === "SDR") {
    // SDR vê deals de todos os Executivos de Negócios
    query = executivoIds.length > 0
      ? query.in("user_id", executivoIds)
      : query.eq("user_id", "no-access-placeholder");
  } else {
    // Executivo de Negócios ou fallback — vê apenas os próprios deals
    query = query.eq("user_id", userId || "no-access-placeholder");
  }

  let res = await query.order("closing_date", { ascending: false });

  if (res.error) {
    console.error("[fetchDeals] Erro na busca principal:", res.error);
    // Fallback: busca sem filtro de colunas extras mas mantém is_test_data
    let fallbackQuery = (supabase as any).from("deals").select("*").eq("is_test_data", isTestEnv);
    if (position === "Diretor") {
      // Diretor vê tudo
    } else if (position === "SDR") {
      fallbackQuery = executivoIds.length > 0
        ? fallbackQuery.in("user_id", executivoIds)
        : fallbackQuery.eq("user_id", "no-access-placeholder");
    } else {
      fallbackQuery = fallbackQuery.eq("user_id", userId || "no-access-placeholder");
    }
    res = await fallbackQuery.order("closing_date", { ascending: false });
  }

  console.log(`[fetchDeals] Negócios encontrados: ${res.data?.length || 0}`);
  return (res.data || []).map(dbToDeal);
}

export async function upsertDeal(deal: Deal): Promise<Deal> {
  const { user, isTestEnv } = await getCurrentUserContext();

  const payload = {
    ...dealToDb(deal),
    is_test_data: isTestEnv,
    // Garante user_id: usa o do deal (Diretor pode atribuir a Executivo) ou o usuário atual
    // ?? em vez de || para não substituir string vazia acidentalmente
    user_id: deal.userId ?? user?.id,
  };
  const { data, error } = await (supabase as any).from("deals").upsert(payload).select().single();

  if (error) {
    console.error("Error upserting deal:", error);
    if (error.message?.includes("sdr_user_id")) {
      throw new Error("O campo SDR ainda não existe no banco. Execute a migration add_sdr_user_id_to_deals no Supabase antes de salvar um SDR no fechamento.");
    }
    throw error;
  }
  return dbToDeal(data);
}

export async function deleteDealFromDb(id: string): Promise<void> {
  const { error } = await (supabase as any).from("deals").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAvailableYears(): Promise<number[]> {
  const { isTestEnv } = await getCurrentUserContext();
  const { data, error } = await (supabase as any)
    .from("deals")
    .select("closing_date, first_payment_date, implantation_payment_date")
    .eq("is_test_data", isTestEnv);

  if (error) {
    console.error("Error fetching available years:", error);
    return [new Date().getFullYear()];
  }

  const years = new Set<number>();
  data?.forEach((d) => {
    const dates = [d.first_payment_date || d.closing_date, d.implantation_payment_date || d.first_payment_date || d.closing_date];
    dates.forEach((baseDate) => {
      if (baseDate) {
        years.add(Number(getPaymentDateInfo(baseDate).monthKey.slice(0, 4)));
      }
    });
  });

  // Fallback to current year if empty
  if (years.size === 0) {
    years.add(new Date().getFullYear());
  }

  return Array.from(years).sort((a, b) => b - a);
}

// Schema real da tabela presentations:
// id, user_id, operation ("BluePex" | "Opus Tech"), count, date ("YYYY-MM-DD"), is_test_data
// Uma linha por operação por mês — contador global compartilhado entre todos os cargos.

export async function fetchPresentations(role: UserRole, userId?: string, position?: string): Promise<MonthlyPresentations> {
  const { isTestEnv } = await getCurrentUserContext();

  // Apresentações são globais: todos os cargos veem o mesmo contador.
  const { data, error } = await (supabase as any)
    .from("presentations")
    .select("operation, count, date")
    .eq("is_test_data", isTestEnv);

  if (error) {
    console.error("[fetchPresentations] Erro:", error);
    return {};
  }

  const result: MonthlyPresentations = {};
  data?.forEach((p: any) => {
    // date = "YYYY-MM-DD" → monthKey = "YYYY-MM"
    const key = (p.date as string).slice(0, 7);
    if (!result[key]) result[key] = { bluepex: 0, opus: 0 };
    // Deve existir apenas uma linha por mes/operacao. Se houver duplicatas antigas,
    // nao somamos, porque isso infla o contador na UI.
    if (p.operation === "BluePex") result[key].bluepex = p.count ?? 0;
    else result[key].opus = p.count ?? 0;
  });

  return result;
}

export async function savePresentationToDb(monthKey: string, operation: "bluepex" | "opus", count: number, userId: string) {
  const { isTestEnv } = await getCurrentUserContext();

  // Mapeia o campo frontend para o valor da coluna operation no banco
  const dbOperation = operation === "bluepex" ? "BluePex" : "Opus Tech";
  // Usa o primeiro dia do mês como data canônica
  const dateStr = monthKey + "-01";

  const { error } = await (supabase as any)
    .from("presentations")
    .upsert(
      {
        user_id: userId,
        operation: dbOperation,
        count,
        date: dateStr,
        is_test_data: isTestEnv,
      },
      { onConflict: "date,operation,is_test_data" }
    );

  if (error) throw error;
}

export async function fetchUserCommissionRate(userId: string): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("commission_percent")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.commission_percent == null) return null;
  return data.commission_percent / 100;
}

export async function saveUserCommissionRate(userId: string, rate: number): Promise<void> {
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ commission_percent: Math.round(rate * 100) })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchUserFixedSalary(userId: string): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("fixed_salary")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[fetchUserFixedSalary] Erro:", error.message);
    return null;
  }
  return data?.fixed_salary ?? null;
}

export async function saveUserFixedSalary(userId: string, amount: number): Promise<void> {
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ fixed_salary: amount })
    .eq("user_id", userId);
  if (error) {
    console.error("[saveUserFixedSalary] Erro:", error.message);
    throw error;
  }
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
  const { isTestEnv: isTestData } = await getCurrentUserContext();
  const payload: Record<string, unknown> = { user_id: userId, title, message, is_test_data: isTestData, is_read: false };
  if (dealId) payload.deal_id = dealId;
  const { error } = await (supabase as any).from("notifications").insert(payload);
  if (error) {
    console.error("[createNotification] Erro:", error.message);
  }
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { isTestEnv: isTestData } = await getCurrentUserContext();
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("is_test_data", isTestData)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[fetchNotifications] Erro:", error.message);
    return [];
  }
  return (data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    title: n.title,
    message: n.message,
    isRead: n.is_read ?? false,
    isTestData: n.is_test_data,
    createdAt: n.created_at,
    dealId: n.deal_id ?? undefined,
  }));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await (supabase as any)
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await (supabase as any)
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
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
    dealId: cp.deal_id,
    component: cp.component,
    competenceMonth: cp.competence_month,
    installmentIndex: cp.installment_index ?? null,
    amount: Number(cp.amount ?? 0),
    recipientUserId: cp.recipient_user_id ?? null,
    paidByDirectorAt: cp.paid_by_director_at ?? null,
    confirmedByUserAt: cp.confirmed_by_user_at ?? null,
    rejectedByUserAt: cp.rejected_by_user_at ?? null,
    isTestData: cp.is_test_data,
    createdAt: cp.created_at,
    updatedAt: cp.updated_at,
  };
}

// Upsert por (deal_id, component, competence_month, recipient_user_id).
// Reseta confirmed_by_user_at ao reutilizar o registro num novo ciclo.
export async function upsertCommissionPaymentRow(
  dealId: string,
  component: "mensalidade" | "implantacao" | "implantacao_parcela",
  competenceMonth: string,
  amount: number,
  isTestData: boolean,
  recipientUserId: string,
  installmentIndex?: number | null
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from("commission_payments")
    .upsert(
      {
        deal_id: dealId,
        component,
        competence_month: competenceMonth,
        installment_index: installmentIndex ?? null,
        amount,
        recipient_user_id: recipientUserId,
        paid_by_director_at: now,
        confirmed_by_user_at: null,
        rejected_by_user_at: null,
        is_test_data: isTestData,
        updated_at: now,
      },
      { onConflict: "deal_id,component,competence_month,recipient_user_id,installment_index_key" }
    );
  if (error) throw error;
}

// Remove apenas o registro de um componente/mês específico (não apaga outros meses).
export async function clearCommissionPaymentForComponent(
  dealId: string,
  component: "mensalidade" | "implantacao" | "implantacao_parcela",
  competenceMonth: string,
  recipientUserId?: string,
  installmentIndex?: number | null
): Promise<void> {
  let query = (supabase as any)
    .from("commission_payments")
    .delete()
    .eq("deal_id", dealId)
    .eq("component", component)
    .eq("competence_month", competenceMonth);

  if (typeof installmentIndex === "number") {
    query = query.eq("installment_index", installmentIndex);
  }

  if (recipientUserId) {
    query = query.eq("recipient_user_id", recipientUserId);
  }

  const { error } = await query;
  if (error) throw error;
}

// Confirma apenas os registros do recipient atual — retorna quantos foram confirmados.
export async function confirmCommissionPaymentsByRecipient(
  dealId: string,
  recipientUserId: string
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("commission_payments")
    .update({ confirmed_by_user_at: now, updated_at: now })
    .eq("deal_id", dealId)
    .eq("recipient_user_id", recipientUserId)
    .not("paid_by_director_at", "is", null)
    .is("confirmed_by_user_at", null)
    .select("id");
  if (error) throw error;
  return (data || []).length;
}

export async function confirmCommissionPaymentById(
  paymentId: string,
  recipientUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("commission_payments")
    .update({ confirmed_by_user_at: now, rejected_by_user_at: null, updated_at: now })
    .eq("id", paymentId)
    .eq("recipient_user_id", recipientUserId)
    .not("paid_by_director_at", "is", null)
    .is("confirmed_by_user_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pagamento nao encontrado ou ja confirmado.");
}

export async function rejectCommissionPaymentById(
  paymentId: string,
  recipientUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("commission_payments")
    .update({ rejected_by_user_at: now, updated_at: now })
    .eq("id", paymentId)
    .eq("recipient_user_id", recipientUserId)
    .not("paid_by_director_at", "is", null)
    .is("confirmed_by_user_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Pagamento nao encontrado ou ja confirmado.");
}

// Busca todos os commission_payments do usuário (para KPIs e seção pendente).
export async function fetchCommissionPaymentsForUser(
  recipientUserId: string
): Promise<CommissionPayment[]> {
  const { isTestEnv } = await getCurrentUserContext();
  const { data, error } = await (supabase as any)
    .from("commission_payments")
    .select("*")
    .eq("recipient_user_id", recipientUserId)
    .eq("is_test_data", isTestEnv)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fetchCommissionPaymentsForUser]", error.message);
    return [];
  }
  return (data || []).map(dbToCommissionPayment);
}

export async function fetchCommissionPaymentsForEnvironment(): Promise<CommissionPayment[]> {
  const { isTestEnv } = await getCurrentUserContext();

  const { data, error } = await (supabase as any)
    .from("commission_payments")
    .select("*")
    .eq("is_test_data", isTestEnv)
    .order("competence_month", { ascending: false });
  if (error) {
    console.error("[fetchCommissionPaymentsForEnvironment]", error.message);
    return [];
  }
  return (data || []).map(dbToCommissionPayment);
}
