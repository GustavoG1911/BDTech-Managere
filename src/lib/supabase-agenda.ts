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
    
    // Find the first prospect whose company name is contained in the event title
    const matchedProspect = prospects.find(p => 
      titleLower.includes(p.company.toLowerCase())
    );

    if (matchedProspect) {
      // Mark the prospect as having a scheduled meeting
      await supabase
        .from("prospects")
        .update({ has_scheduled_meeting: true })
        .eq("id", matchedProspect.id);
        
      return matchedProspect.id;
    }
  } catch (err) {
    console.error("Failed to auto-link prospect:", err);
  }
  return undefined;
};

export const fetchCalendarEvents = async (userId: string): Promise<CalendarEvent[]> => {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }

  return data as CalendarEvent[];
};

export const createCalendarEvent = async (event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
  // Classify operation automatically
  if (!event.operation) {
    event.operation = classifyOperation(event.meeting_link, event.description);
  }

  // Auto-link to prospect if not explicitly linked
  if (!event.prospect_id && event.title && event.user_id) {
    event.prospect_id = await autoLinkEventToProspect(event.title, event.user_id);
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert([event])
    .select()
    .single();

  if (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }

  return data as CalendarEvent;
};

export const updateCalendarEvent = async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
  // Re-classify if link or description changes
  if (updates.meeting_link !== undefined || updates.description !== undefined) {
    const newOp = classifyOperation(updates.meeting_link, updates.description);
    if (newOp) updates.operation = newOp;
  }

  const { error } = await supabase
    .from("calendar_events")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating calendar event:", error);
    throw error;
  }
};

export const deleteCalendarEvent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting calendar event:", error);
    throw error;
  }
};
