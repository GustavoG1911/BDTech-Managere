import { supabase } from "@/integrations/supabase/client";
import { CalendarEvent, Operation } from "./types";
import { fetchProspects } from "./supabase-prospeccao";

export const classifyOperation = (link?: string, description?: string): Operation | undefined => {
  const content = `${link || ""} ${description || ""}`.toLowerCase();
  if (content.includes("meet.google.com") || content.includes("google meet")) {
    return "BluePex";
  }
  if (content.includes("teams.microsoft.com") || content.includes("microsoft teams")) {
    return "Opus Tech";
  }
  return undefined;
};

// Heuristic linking: Finds if there's a prospect with a matching company name in the event title.
export const autoLinkEventToProspect = async (title: string, userId: string): Promise<string | undefined> => {
  try {
    const prospects = await fetchProspects(userId);
    const titleLower = title.toLowerCase();

    const matchedProspect = prospects.find(p =>
      titleLower.includes(p.company.toLowerCase())
    );

    if (matchedProspect) {
      await (supabase as any)
        .from("prospects")
        .update({ has_scheduled_meeting: true })
        .eq("id", matchedProspect.id);

      return matchedProspect.id;
    }
  } catch (err) {
    console.error("[autoLinkEventToProspect]", err);
  }
  return undefined;
};

export const fetchCalendarEvents = async (userId: string): Promise<CalendarEvent[]> => {
  const { data, error } = await (supabase as any)
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }

  return (data || []) as CalendarEvent[];
};

export const createCalendarEvent = async (event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
  const payload: Partial<CalendarEvent> = { ...event };

  if (!payload.operation) {
    payload.operation = classifyOperation(payload.meeting_link, payload.description);
  }

  if (!payload.prospect_id && payload.title && payload.user_id) {
    payload.prospect_id = await autoLinkEventToProspect(payload.title, payload.user_id);
  }

  const { data, error } = await (supabase as any)
    .from("calendar_events")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }

  return data as CalendarEvent;
};

export const updateCalendarEvent = async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
  const patch: Partial<CalendarEvent> = { ...updates };

  if (patch.meeting_link !== undefined || patch.description !== undefined) {
    const newOp = classifyOperation(patch.meeting_link, patch.description);
    if (newOp) patch.operation = newOp;
  }

  const { error } = await (supabase as any)
    .from("calendar_events")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("Error updating calendar event:", error);
    throw error;
  }
};

export const deleteCalendarEvent = async (id: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting calendar event:", error);
    throw error;
  }
};
