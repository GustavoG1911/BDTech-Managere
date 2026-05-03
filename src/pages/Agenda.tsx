import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/supabase-agenda";
import { useAuth } from "@/hooks/useAuth";
import { CalendarEvent, CalendarEventStatus } from "@/lib/types";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit, Video, Users, Link as LinkIcon, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar-events", user?.id],
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
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao salvar reunião: ${error?.message || "Erro desconhecido"}`);
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
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao excluir reunião: ${error?.message || "Erro desconhecido"}`);
    }
  });

  const handleOpenDialog = (event?: CalendarEvent) => {
    setEditingEvent(event || null);
    setIsDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    
    saveEventMutation.mutate({
      title: formData.get("title") as string,
      start_time: new Date(start_time).toISOString(),
      end_time: new Date(end_time).toISOString(),
      meeting_link: formData.get("meeting_link") as string,
      description: formData.get("description") as string,
      status: (formData.get("status") || "Agendado") as CalendarEventStatus,
    });
  };

  const mappedEvents = events?.map(evt => ({
    ...evt,
    start: new Date(evt.start_time),
    end: new Date(evt.end_time),
  })) || [];

  const eventStyleGetter = (event: any) => {
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
          <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
            <Mail className="mr-2 h-4 w-4" /> Integração Google (Em breve)
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Nova Reunião
          </Button>
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integração com Google Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm text-muted-foreground">
            <p>Em breve, você poderá conectar a sua conta centralizadora do Gmail para puxar os convites e reuniões agendadas automaticamente para o sistema.</p>
            <div className="bg-muted p-4 rounded-md flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Status da Conexão</span>
                <Badge variant="secondary">Desconectado</Badge>
              </div>
              <Button disabled className="w-full">
                <Mail className="mr-2 h-4 w-4" /> Conectar Conta Google
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Detalhes da Reunião" : "Nova Reunião"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required defaultValue={editingEvent?.title} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início</Label>
                <Input id="start_time" name="start_time" type="datetime-local" required defaultValue={editingEvent ? new Date(editingEvent.start_time).toISOString().slice(0, 16) : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim</Label>
                <Input id="end_time" name="end_time" type="datetime-local" required defaultValue={editingEvent ? new Date(editingEvent.end_time).toISOString().slice(0, 16) : ""} />
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
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={editingEvent?.status || "Agendado"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Realizado">Realizado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
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
            <Calendar
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
              onSelectEvent={(event) => handleOpenDialog(event)}
              selectable
              onSelectSlot={(slotInfo) => {
                setEditingEvent(null);
                // Pre-fill dialog with clicked dates
                const prefillEvent: Partial<CalendarEvent> = {
                  start_time: slotInfo.start.toISOString(),
                  end_time: slotInfo.end.toISOString()
                };
                // React-hook-form or native form isn't fully controlled here, 
                // but we can set it and let the defaultValue handle it roughly
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
