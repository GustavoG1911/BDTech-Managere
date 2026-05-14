import { supabase } from "@/integrations/supabase/client";
import { Prospect, ProspectNote, ProspectStatus } from "./types";
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

  return (data || []) as Prospect[];
};

export const createProspect = async (prospect: Partial<Prospect>): Promise<Prospect> => {
  const isTestEnv = await getIsTestEnv();
  const { data, error } = await (supabase as any)
    .from("prospects")
    .insert([{ operation: "A definir", ...prospect, is_test_data: isTestEnv }])
    .select()
    .single();

  if (error) {
    console.error("Error creating prospect:", error);
    throw error;
  }

  return data as Prospect;
};

export const bulkCreateProspects = async (prospects: Partial<Prospect>[]): Promise<Prospect[]> => {
  const isTestEnv = await getIsTestEnv();
  const rows = prospects.map((prospect) => ({ operation: "A definir", ...prospect, is_test_data: isTestEnv }));
  const { data, error } = await (supabase as any)
    .from("prospects")
    .insert(rows)
    .select();

  if (error) {
    console.error("Error bulk creating prospects:", error);
    throw error;
  }

  return (data || []) as Prospect[];
};

export const importProspectsWithReport = async (prospects: ProspectImportItem[]): Promise<ProspectImportReport> => {
  const isTestEnv = await getIsTestEnv();
  const created: Prospect[] = [];
  const errors: ProspectImportError[] = [];

  for (const item of prospects) {
    const { importRowNumber, ...prospect } = item;
    const { data, error } = await (supabase as any)
      .from("prospects")
      .insert([{ operation: "A definir", ...prospect, is_test_data: isTestEnv }])
      .select()
      .single();

    if (error) {
      console.error("Error importing prospect row:", error);
      errors.push({
        rowNumber: importRowNumber,
        company: prospect.company,
        contactName: prospect.contact_name,
        message: error.message || "Erro ao salvar esta linha.",
      });
      continue;
    }

    created.push(data as Prospect);
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
  const { error } = await (supabase as any)
    .from("prospects")
    .update(updates)
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
