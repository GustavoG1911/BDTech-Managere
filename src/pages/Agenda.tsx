import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/supabase-agenda";
import { useAuth } from "@/hooks/useAuth";
import { fetchAdminCalendarStatus, startGoogleCalendarConnection } from "@/lib/google-calendar";
import { supabase } from "@/integrations/supabase/client";
import { CalendarEvent, CalendarEventStatus } from "@/lib/types";

type MappedCalendarEvent = CalendarEvent & { start: Date; end: Date };
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit, Video, Users, Link as LinkIcon, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function getSmartDefaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getMinutes() > 0 || d.getSeconds() > 0) {
    d.setHours(d.getHours() + 1);
  }
  d.setMinutes(0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function addMinutes(dateStr: string, mins: number): string {
  const d = new Date(dateStr);
  d.setMinutes(d.getMinutes() + mins);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

const locales = {
  "pt-BR": ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function Agenda() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [slotDates, setSlotDates] = useState<{ start: string; end: string } | null>(null);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  // Check centralized Google connection status and handle OAuth callback result
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const data = await fetchAdminCalendarStatus();
      if (data?.sync_enabled) {
        setGoogleConnected(true);
        setGoogleEmail(data.google_email ?? null);
      }
    })();

    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "1") {
      toast.success("Conta Google conectada com sucesso!");
      window.history.replaceState({}, "", "/agenda");
      setGoogleConnected(true);
    } else if (params.get("google_error")) {
      toast.error("Erro ao conectar conta Google. Tente novamente.");
      window.history.replaceState({}, "", "/agenda");
    }
  }, [user?.id]);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      await startGoogleCalendarConnection("/agenda");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar conexão";
      toast.error(msg);
      setIsConnecting(false);
    }
  };

  const handleSyncNow = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na sincronização");
      if (!silent) toast.success(`Sincronizado! ${data.created} novo(s), ${data.updated} atualizado(s).`);
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar";
      if (!silent) toast.error(msg);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [queryClient]);

  // Auto-sync on page mount and every 15 minutes when the centralized calendar is connected
  useEffect(() => {
    if (!googleConnected) return;
    handleSyncNow(true);
    const interval = setInterval(() => handleSyncNow(true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleConnected, handleSyncNow]);

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => fetchCalendarEvents(user!.id),
    enabled: !!user?.id,
  });

  const saveEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEvent>) => {
      if (editingEvent) {
        return updateCalendarEvent(editingEvent.id, eventData);
      }
      return createCalendarEvent({ ...eventData, user_id: user!.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsDialogOpen(false);
      setEditingEvent(null);
      toast.success("Reunião salva com sucesso!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao salvar reunião: ${msg}`);
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsDialogOpen(false);
      setEditingEvent(null);
      toast.success("Reunião excluída!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao excluir reunião: ${msg}`);
    }
  });

  const handleOpenDialog = (event?: CalendarEvent) => {
    setEditingEvent(event || null);
    setSlotDates(null);
    if (event) {
      setFormStart(new Date(event.start_time).toISOString().slice(0, 16));
      setFormEnd(new Date(event.end_time).toISOString().slice(0, 16));
    } else {
      const defaultStart = getSmartDefaultStart();
      setFormStart(defaultStart);
      setFormEnd(addMinutes(defaultStart, 90));
    }
    setIsDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const operation = formData.get("operation") as string;

    saveEventMutation.mutate({
      title: formData.get("title") as string,
      start_time: new Date(formStart).toISOString(),
      end_time: new Date(formEnd).toISOString(),
      meeting_link: formData.get("meeting_link") as string,
      description: formData.get("description") as string,
      status: (formData.get("status") || "Agendado") as CalendarEventStatus,
      ...(operation && operation !== "auto" ? { operation: operation as "BluePex" | "Opus Tech" } : {}),
    });
  };

  const mappedEvents: MappedCalendarEvent[] = events?.map(evt => ({
    ...evt,
    start: new Date(evt.start_time),
    end: new Date(evt.end_time),
  })) || [];

  const eventStyleGetter = (event: MappedCalendarEvent) => {
    let backgroundColor = "#3b82f6"; // default blue
    if (event.operation === "Opus Tech") backgroundColor = "#10b981"; // green
    if (event.status === "Realizado") backgroundColor = "#6b7280"; // gray
    if (event.status === "Cancelado") backgroundColor = "#ef4444"; // red
    
    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
        fontSize: "12px",
        padding: "2px 4px"
      }
    };
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agenda de Reuniões</h2>
        <div className="flex gap-2">
          {googleConnected && (
            <Button variant="ghost" size="icon" onClick={() => handleSyncNow(false)} disabled={isSyncing} title="Sincronizar Google Calendar">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              {googleConnected ? "Google Calendar" : "Conectar Google"}
              {googleConnected && <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>}
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Nova Reunião
          </Button>
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Integração com Google Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm">
            <div className="bg-muted/40 border border-border/50 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Status da Conexão Centralizada</span>
                {googleConnected
                  ? <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">Ativo</Badge>
                  : <Badge variant="secondary" className="text-xs">Não configurado</Badge>
                }
              </div>
              {googleConnected && googleEmail && (
                <p className="text-xs text-muted-foreground">Conta vinculada: <span className="text-foreground font-medium">{googleEmail}</span></p>
              )}

              {role === "admin" ? (
                /* Admin: can connect or resync */
                googleConnected ? (
                  <Button onClick={() => handleSyncNow(false)} disabled={isSyncing} className="w-full">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                  </Button>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Conecte a conta Google que será a fonte centralizada de calendário para toda a plataforma.
                    </p>
                    <Button onClick={handleConnectGoogle} disabled={isConnecting} className="w-full">
                      <Mail className="mr-2 h-4 w-4" />
                      {isConnecting ? "Redirecionando..." : "Conectar Conta Google Centralizada"}
                    </Button>
                  </>
                )
              ) : (
                /* Non-admin: can only sync */
                googleConnected ? (
                  <Button onClick={() => handleSyncNow(false)} disabled={isSyncing} className="w-full">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A conta Google centralizada ainda não foi configurada. Solicite ao administrador da plataforma para conectá-la.
                  </p>
                )
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Como funciona</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Convites aceitos no Google Calendar são importados automaticamente (a cada 15 min e ao entrar na página).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Links <strong>meet.google.com</strong> → classificado como <strong>BluePex</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Links <strong>teams.microsoft.com</strong> → classificado como <strong>Opus Tech</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Reuniões criadas manualmente continuam pedindo a operação.</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Detalhes da Reunião" : "Nova Reunião"}</DialogTitle>
          </DialogHeader>
          <form key={editingEvent?.id ?? "new"} onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required defaultValue={editingEvent?.title} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="datetime-local"
                  required
                  value={formStart}
                  onChange={(e) => {
                    setFormStart(e.target.value);
                    if (e.target.value) setFormEnd(addMinutes(e.target.value, 90));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  required
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_link">Link da Reunião (opcional)</Label>
              <Input id="meeting_link" name="meeting_link" type="url" defaultValue={editingEvent?.meeting_link} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea id="description" name="description" defaultValue={editingEvent?.description} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingEvent?.status || "Agendado"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Realizado">Realizado</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="operation">Operação</Label>
                <Select name="operation" defaultValue={editingEvent?.operation || "auto"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Operação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Detectar pelo link</SelectItem>
                    <SelectItem value="BluePex">BluePex</SelectItem>
                    <SelectItem value="Opus Tech">Opus Tech</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between mt-6">
              {editingEvent ? (
                <Button type="button" variant="destructive" onClick={() => {
                  if (confirm("Deseja excluir esta reunião?")) deleteEventMutation.mutate(editingEvent.id);
                }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              ) : <div></div>}
              <Button type="submit" disabled={saveEventMutation.isPending}>
                {saveEventMutation.isPending ? "Salvando..." : "Salvar Reunião"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="flex-1 mt-4">
        <CardContent className="p-0 h-[600px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Carregando calendário...
            </div>
          ) : (
            <Calendar<MappedCalendarEvent>
              localizer={localizer}
              events={mappedEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%", padding: "20px" }}
              view={view}
              onView={(v) => setView(v)}
              date={date}
              onNavigate={(d) => setDate(d)}
              messages={{
                next: "Próximo",
                previous: "Anterior",
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                agenda: "Lista",
                noEventsInRange: "Não há reuniões neste período.",
              }}
              culture="pt-BR"
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event: MappedCalendarEvent) => handleOpenDialog(event)}
              selectable
              onSelectSlot={({ start }) => {
                setEditingEvent(null);
                setSlotDates(null);
                const s = format(start, "yyyy-MM-dd'T'HH:mm");
                setFormStart(s);
                setFormEnd(addMinutes(s, 90));
                setIsDialogOpen(true);
              }}
              components={{
                toolbar: (props) => (
                  <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => props.onNavigate('PREV')}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => props.onNavigate('TODAY')}>Hoje</Button>
                      <Button variant="outline" size="sm" onClick={() => props.onNavigate('NEXT')}>Próximo</Button>
                    </div>
                    <span className="text-lg font-semibold">{props.label}</span>
                    <div className="flex items-center space-x-2">
                      <Button variant={props.view === Views.MONTH ? "default" : "outline"} size="sm" onClick={() => props.onView(Views.MONTH)}>Mês</Button>
                      <Button variant={props.view === Views.WEEK ? "default" : "outline"} size="sm" onClick={() => props.onView(Views.WEEK)}>Semana</Button>
                      <Button variant={props.view === Views.DAY ? "default" : "outline"} size="sm" onClick={() => props.onView(Views.DAY)}>Dia</Button>
                    </div>
                  </div>
                )
              }}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Legendas adicionadas para facilitar visualização de cor do rbc */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground pb-4">
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span> BluePex (Google Meet)</div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span> Opus Tech (Teams)</div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-2"></span> Realizado</div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> Cancelado</div>
      </div>
    </div>
  );
}
