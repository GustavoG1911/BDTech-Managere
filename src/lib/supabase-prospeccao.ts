import { supabase } from "@/integrations/supabase/client";
import { Prospect, ProspectNote, ProspectStatus } from "./types";

export const fetchProspects = async (userId: string): Promise<Prospect[]> => {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching prospects:", error);
    throw error;
  }

  return data as Prospect[];
};

export const createProspect = async (prospect: Partial<Prospect>): Promise<Prospect> => {
  const { data, error } = await supabase
    .from("prospects")
    .insert([prospect])
    .select()
    .single();

  if (error) {
    console.error("Error creating prospect:", error);
    throw error;
  }

  return data as Prospect;
};

export const updateProspectStatus = async (id: string, status: ProspectStatus): Promise<void> => {
  const { error } = await supabase
    .from("prospects")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating prospect status:", error);
    throw error;
  }
};

export const updateProspect = async (id: string, updates: Partial<Prospect>): Promise<void> => {
  const { error } = await supabase
    .from("prospects")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating prospect:", error);
    throw error;
  }
};

export const fetchProspectNotes = async (prospectId: string): Promise<ProspectNote[]> => {
  const { data, error } = await supabase
    .from("prospect_notes")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }

  return data as ProspectNote[];
};

export const createProspectNote = async (prospectId: string, text: string): Promise<ProspectNote> => {
  const { data, error } = await supabase
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
