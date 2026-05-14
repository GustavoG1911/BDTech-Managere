import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "./supabase-env";

export type PaymentDueSettings = {
  salaryDueDay: number;
  commissionDueDay: number;
};

export const DEFAULT_PAYMENT_DUE_SETTINGS: PaymentDueSettings = {
  salaryDueDay: 1,
  commissionDueDay: 20,
};

const SETTINGS_ID_PROD = "00000000-0000-0000-0000-000000000010";
const SETTINGS_ID_TEST = "00000000-0000-0000-0000-000000000011";

const clampDay = (value: number) => Math.min(31, Math.max(1, Math.round(Number(value || 1))));

const normalizeSettings = (settings: PaymentDueSettings): PaymentDueSettings => ({
  salaryDueDay: clampDay(settings.salaryDueDay),
  commissionDueDay: clampDay(settings.commissionDueDay),
});

export const fetchPaymentDueSettings = async (): Promise<PaymentDueSettings> => {
  const { isTestEnv } = await getCurrentUserContext();
  const { data, error } = await (supabase as any)
    .from("payment_due_settings")
    .select("salary_due_day, commission_due_day")
    .eq("is_test_data", isTestEnv)
    .maybeSingle();

  if (error) {
    console.error("Error fetching payment due settings:", error);
    return DEFAULT_PAYMENT_DUE_SETTINGS;
  }

  if (!data) return DEFAULT_PAYMENT_DUE_SETTINGS;
  return normalizeSettings({
    salaryDueDay: Number(data.salary_due_day ?? DEFAULT_PAYMENT_DUE_SETTINGS.salaryDueDay),
    commissionDueDay: Number(data.commission_due_day ?? DEFAULT_PAYMENT_DUE_SETTINGS.commissionDueDay),
  });
};

export const savePaymentDueSettings = async (settings: PaymentDueSettings): Promise<PaymentDueSettings> => {
  const { isTestEnv } = await getCurrentUserContext();
  const normalized = normalizeSettings(settings);
  const { error } = await (supabase as any)
    .from("payment_due_settings")
    .upsert(
      {
        id: isTestEnv ? SETTINGS_ID_TEST : SETTINGS_ID_PROD,
        salary_due_day: normalized.salaryDueDay,
        commission_due_day: normalized.commissionDueDay,
        is_test_data: isTestEnv,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "is_test_data" },
    );

  if (error) {
    console.error("Error saving payment due settings:", error);
    throw error;
  }

  return normalized;
};
