export type Operation = "BluePex" | "Opus Tech";

export type PaymentStatus = "Pendente" | "Pago" | "Cancelado";

export interface InstallmentDate {
  date: string; // ISO string
  paid?: boolean;
}

export interface Deal {
  id: string;
  closingDate: string;
  operation: Operation;
  clientName: string;
  monthlyValue: number;
  implantationValue: number;
  firstPaymentDate: string;
  implantationPaymentDate: string;
  isInstallment: boolean;
  installmentCount: number;
  installmentDates: InstallmentDate[];
  paymentStatus: PaymentStatus;
  userId?: string;
  sdrUserId?: string;
  commissionAmountSnapshot?: number;
  commissionRateSnapshot?: number;
  isUserConfirmedPayment?: boolean;
  isMensalidadePaidByClient?: boolean;
  isPaidToUser?: boolean;
  isTestData?: boolean;
  isImplantacaoPaid?: boolean;
  isMensalidadePaid?: boolean;
  actualPaymentDate?: string;
  mensalidadePaymentDate?: string;
  implantacaoPaymentDate?: string;
}

export interface OperationPresentations {
  bluepex: number;
  opus: number;
}

export interface MonthlyPresentationRow {
  month_key: string;
  user_id: string;
  bluepex_count: number;
  opus_count: number;
  is_test_data: boolean;
}

export interface MonthlyPresentations {
  [monthKey: string]: OperationPresentations;
}

export interface MonthlySuperMeta {
  [monthKey: string]: boolean;
}

export interface AppSettings {
  fixedSalary: number;
  commissionRate: number;
  superMetaThreshold: number;
  superMetaMultiplier: number;
  salaryDueDay: number;
  commissionDueDay: number;
}

export interface GlobalParameters {
  id: string;
  meta_apresentacoes_bluepex: number;
  meta_apresentacoes_opus: number;
  super_meta_bluepex: number;
  super_meta_opus: number;
  base_implantacao: number;
  acelerador_teto: number;
  acelerador_piso: number;
}

export interface CommissionBreakdown {
  monthlyBase: number;
  monthlyBaseRate: number; // 1.0 or 0.7
  monthlyCommission: number;
  implantationBase: number;
  implantationCommission: number;
  superMetaBonus: number;
  totalCommission: number;
  commissionRate: number; // e.g. 0.20
}

export interface ReceivableAdjustment {
  id: string;
  adjustment: number;
  reason: string;
  effectiveDate: string;
  salaryPaid?: boolean;
}

export interface ReceivableAdjustments {
  [entryId: string]: ReceivableAdjustment;
}

export type CalendarEventStatus = "Agendado" | "Realizado" | "Cancelado";

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meeting_link?: string;
  description?: string;
  operation?: Operation;
  status: CalendarEventStatus;
  prospect_id?: string;
  user_id?: string;
}

export type ProspectStatus = string;

export interface Prospect {
  id: string;
  company: string;
  contact_name: string;
  role?: string;
  linkedin_url?: string;
  qualification_notes?: string;
  company_email?: string;
  company_phone?: string;
  contact_email?: string;
  contact_phone?: string;
  status: ProspectStatus;
  owner_id: string;
  created_at?: string;
  updated_at?: string;
  has_scheduled_meeting?: boolean;
}

export interface ProspectNote {
  id: string;
  prospect_id: string;
  note_text: string;
  created_at: string;
}

