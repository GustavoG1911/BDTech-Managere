import { supabase } from "@/integrations/supabase/client";
import { Prospect, ProspectNote, ProspectPersona, ProspectStatus } from "./types";
import { getCurrentUserContext } from "./supabase-env";

export type ProspectImportItem = Partial<Prospect> & {
  importRowNumber: number;
};

export type ProspectImportError = {
  rowNumber: number;
  company?: string;
  contactName?: string;
  message: string;
};

export type ProspectImportReport = {
  created: Prospect[];
  errors: ProspectImportError[];
};

const getIsTestEnv = async () => {
  const { isTestEnv } = await getCurrentUserContext();
  return isTestEnv;
};

const buildPersonaId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizePersona = (persona: Partial<ProspectPersona>): ProspectPersona | null => {
  const name = (persona.name || "").trim();
  if (!name) return null;

  return {
    id: persona.id || buildPersonaId(),
    name,
    role: persona.role?.trim() || undefined,
    linkedin_url: persona.linkedin_url?.trim() || undefined,
    email: persona.email?.trim() || undefined,
    phone: persona.phone?.trim() || undefined,
  };
};

export const getProspectPersonas = (prospect: Partial<Prospect>): ProspectPersona[] => {
  if (Array.isArray(prospect.personas)) {
    return prospect.personas.map((persona) => normalizePersona(persona)).filter(Boolean) as ProspectPersona[];
  }

  const legacyPersona = normalizePersona({
    name: prospect.contact_name,
    role: prospect.role,
    linkedin_url: prospect.linkedin_url,
    email: prospect.contact_email,
    phone: prospect.contact_phone,
  });

  return legacyPersona ? [legacyPersona] : [];
};

const normalizeProspectForStorage = (prospect: Partial<Prospect>): Partial<Prospect> => {
  const hasPersonaPayload =
    "personas" in prospect ||
    "contact_name" in prospect ||
    "role" in prospect ||
    "linkedin_url" in prospect ||
    "contact_email" in prospect ||
    "contact_phone" in prospect;

  if (!hasPersonaPayload) return prospect;

  const personas = getProspectPersonas(prospect);
  const primaryPersona = personas[0];

  return {
    ...prospect,
    personas,
    contact_name: primaryPersona?.name || prospect.contact_name || "",
    role: primaryPersona?.role || null,
    linkedin_url: primaryPersona?.linkedin_url || null,
    contact_email: primaryPersona?.email || null,
    contact_phone: primaryPersona?.phone || null,
  };
};

export const normalizeProspectForDisplay = (prospect: Prospect): Prospect => {
  const personas = getProspectPersonas(prospect);
  const displayPersonas = personas.length > 0
    ? personas
    : getProspectPersonas({ ...prospect, personas: undefined });
  const primaryPersona = displayPersonas[0];

  return {
    ...prospect,
    personas: displayPersonas,
    contact_name: primaryPersona?.name || prospect.contact_name,
    role: primaryPersona?.role || prospect.role,
    linkedin_url: primaryPersona?.linkedin_url || prospect.linkedin_url,
    contact_email: primaryPersona?.email || prospect.contact_email,
    contact_phone: primaryPersona?.phone || prospect.contact_phone,
  };
};

export const fetchProspects = async (_userId: string, _position?: string): Promise<Prospect[]> => {
  const isTestEnv = await getIsTestEnv();
  const query = (supabase as any)
    .from("prospects")
    .select("*")
    .eq("is_test_data", isTestEnv)
    .order("created_at", { ascending: false });
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching prospects:", error);
    throw error;
  }

  return ((data || []) as Prospect[]).map(normalizeProspectForDisplay);
};

export const createProspect = async (prospect: Partial<Prospect>): Promise<Prospect> => {
  const isTestEnv = await getIsTestEnv();
  const prospectForStorage = normalizeProspectForStorage(prospect);
  const { data, error } = await (supabase as any)
    .from("prospects")
    .insert([{ operation: "A definir", ...prospectForStorage, is_test_data: isTestEnv }])
    .select()
    .single();

  if (error) {
    console.error("Error creating prospect:", error);
    throw error;
  }

  return normalizeProspectForDisplay(data as Prospect);
};

export const bulkCreateProspects = async (prospects: Partial<Prospect>[]): Promise<Prospect[]> => {
  const isTestEnv = await getIsTestEnv();
  const rows = prospects.map((prospect) => ({ operation: "A definir", ...normalizeProspectForStorage(prospect), is_test_data: isTestEnv }));
  const { data, error } = await (supabase as any)
    .from("prospects")
    .insert(rows)
    .select();

  if (error) {
    console.error("Error bulk creating prospects:", error);
    throw error;
  }

  return ((data || []) as Prospect[]).map(normalizeProspectForDisplay);
};

export const importProspectsWithReport = async (prospects: ProspectImportItem[]): Promise<ProspectImportReport> => {
  const isTestEnv = await getIsTestEnv();
  const created: Prospect[] = [];
  const errors: ProspectImportError[] = [];

  for (const item of prospects) {
    const { importRowNumber, ...prospect } = item;
    const prospectForStorage = normalizeProspectForStorage(prospect);
    const { data, error } = await (supabase as any)
      .from("prospects")
      .insert([{ operation: "A definir", ...prospectForStorage, is_test_data: isTestEnv }])
      .select()
      .single();

    if (error) {
      console.error("Error importing prospect row:", error);
      errors.push({
        rowNumber: importRowNumber,
        company: prospectForStorage.company,
        contactName: prospectForStorage.contact_name,
        message: error.message || "Erro ao salvar esta linha.",
      });
      continue;
    }

    created.push(normalizeProspectForDisplay(data as Prospect));
  }

  return { created, errors };
};

export const deleteProspectsByIds = async (ids: string[]): Promise<void> => {
  if (!ids.length) return;

  const isTestEnv = await getIsTestEnv();
  const { error } = await (supabase as any)
    .from("prospects")
    .delete()
    .in("id", ids)
    .eq("is_test_data", isTestEnv);

  if (error) {
    console.error("Error deleting imported prospects:", error);
    throw error;
  }
};

export const updateProspectStatus = async (id: string, status: ProspectStatus): Promise<void> => {
  const { error } = await (supabase as any)
    .from("prospects")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating prospect status:", error);
    throw error;
  }
};

export const updateProspect = async (id: string, updates: Partial<Prospect>): Promise<void> => {
  const updatesForStorage = normalizeProspectForStorage(updates);
  const { error } = await (supabase as any)
    .from("prospects")
    .update(updatesForStorage)
    .eq("id", id);

  if (error) {
    console.error("Error updating prospect:", error);
    throw error;
  }
};

export const fetchProspectNotes = async (prospectId: string): Promise<ProspectNote[]> => {
  const { data, error } = await (supabase as any)
    .from("prospect_notes")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }

  return (data || []) as ProspectNote[];
};

export const createProspectNote = async (prospectId: string, text: string): Promise<ProspectNote> => {
  const { data, error } = await (supabase as any)
    .from("prospect_notes")
    .insert([{ prospect_id: prospectId, note_text: text }])
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw error;
  }

  return data as ProspectNote;
};
