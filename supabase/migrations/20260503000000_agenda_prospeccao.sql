-- Migration for Agenda & Prospecção

-- Create prospects table first
CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    role TEXT,
    linkedin_url TEXT,
    qualification_notes TEXT,
    status TEXT NOT NULL DEFAULT 'Mapeamento' CHECK (status IN ('Mapeamento', 'Em Contato', 'Em Qualificação', 'Agendado', 'Perdido')),
    owner_id UUID REFERENCES auth.users(id) NOT NULL,
    has_scheduled_meeting BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create prospect_notes table
CREATE TABLE IF NOT EXISTS public.prospect_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_link TEXT,
    description TEXT,
    operation TEXT CHECK (operation IN ('BluePex', 'Opus Tech') OR operation IS NULL),
    status TEXT NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Realizado', 'Cancelado')),
    prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for prospects
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all prospects" ON public.prospects FOR SELECT USING (true);
CREATE POLICY "Users can insert prospects" ON public.prospects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own prospects" ON public.prospects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own prospects" ON public.prospects FOR DELETE USING (auth.uid() = owner_id);
-- Allow managers/directors full update/delete later if needed, but SDRs usually own them

-- RLS for prospect_notes
ALTER TABLE public.prospect_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all prospect notes" ON public.prospect_notes FOR SELECT USING (true);
CREATE POLICY "Users can insert prospect notes" ON public.prospect_notes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.prospects WHERE id = prospect_id AND owner_id = auth.uid())
);

-- RLS for calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Users can insert their own events" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_prospects_updated
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospects_owner_id ON public.prospects(owner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_prospect_id ON public.calendar_events(prospect_id);
