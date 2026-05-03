import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchProspects, createProspect, updateProspectStatus, fetchProspectNotes, createProspectNote } from "@/lib/supabase-prospeccao";
import { createCalendarEvent } from "@/lib/supabase-agenda";
import { useAuth } from "@/hooks/useAuth";
import { Prospect, ProspectStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Linkedin, Calendar, Building2, UserCircle2, Settings2, X, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function Prospeccao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isNewProspectOpen, setIsNewProspectOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState<string | null>(null);
  const [scheduleTargetCol, setScheduleTargetCol] = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [draggedProspectId, setDraggedProspectId] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");

  const [columns, setColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('prospect_columns');
    return saved ? JSON.parse(saved) : ["Mapeamento", "Em Contato", "Agendado", "Perdido"];
  });

  const saveColumns = (newCols: string[]) => {
    setColumns(newCols);
    localStorage.setItem('prospect_columns', JSON.stringify(newCols));
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      saveColumns([...columns, newColumnName.trim()]);
      setNewColumnName("");
    }
  };

  const handleRemoveColumn = (col: string) => {
    saveColumns(columns.filter(c => c !== col));
  };

  const handleMoveColumn = (idx: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === columns.length - 1)) return;
    const newCols = [...columns];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newCols[idx], newCols[targetIdx]] = [newCols[targetIdx], newCols[idx]];
    saveColumns(newCols);
  };

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects", user?.id],
    queryFn: () => fetchProspects(user!.id),
    enabled: !!user?.id,
  });

  const { data: notes } = useQuery({
    queryKey: ["prospect-notes", selectedProspect?.id],
    queryFn: () => fetchProspectNotes(selectedProspect!.id),
    enabled: !!selectedProspect?.id,
  });

  const createProspectMutation = useMutation({
    mutationFn: (prospect: Partial<Prospect>) => createProspect({ ...prospect, owner_id: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setIsNewProspectOpen(false);
      toast.success("Lead criado com sucesso!");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao criar lead: ${error?.message || "Erro desconhecido"}`);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) => updateProspectStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Status atualizado!");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao atualizar status: ${error?.message || "Erro desconhecido"}`);
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: (text: string) => createProspectNote(selectedProspect!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-notes"] });
      toast.success("Nota adicionada com sucesso!");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao adicionar nota: ${error?.message || "Erro desconhecido"}`);
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      // First update prospect status
      if (scheduleTargetId && scheduleTargetCol) {
        await updateProspectStatus(scheduleTargetId, scheduleTargetCol);
      }
      // Then create event
      return createCalendarEvent({ ...eventData, user_id: user!.id, prospect_id: scheduleTargetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsScheduleModalOpen(false);
      setScheduleTargetId(null);
      setScheduleTargetCol(null);
      toast.success("Lead movido e Reunião agendada com sucesso!");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(`Erro ao agendar reunião: ${error?.message || "Erro desconhecido"}`);
    }
  });

  const handleCreateProspect = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createProspectMutation.mutate({
      company: formData.get("company") as string,
      contact_name: formData.get("contact_name") as string,
      role: formData.get("role") as string,
      linkedin_url: formData.get("linkedin_url") as string,
      status: columns[0] || "Mapeamento", // defaults to first column
    });
  };

  const handleAddNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = formData.get("note_text") as string;
    if (text.trim()) {
      createNoteMutation.mutate(text);
      (e.target as HTMLFormElement).reset();
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const prospect = prospects?.find(p => p.id === scheduleTargetId);
    
    createEventMutation.mutate({
      title: formData.get("title") as string || prospect?.company || "Reunião de Apresentação",
      start_time: new Date(formData.get("start_time") as string).toISOString(),
      end_time: new Date(formData.get("end_time") as string).toISOString(),
      meeting_link: formData.get("meeting_link") as string,
      description: formData.get("description") as string,
      status: "Agendado",
    });
  };

  const getProspectsByStatus = (status: string) => {
    return prospects?.filter(p => p.status === status) || [];
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProspectId(id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedProspectId(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedProspectId) {
      if (status.toLowerCase().includes("agendado")) {
        setScheduleTargetId(draggedProspectId);
        setScheduleTargetCol(status);
        setIsScheduleModalOpen(true);
      } else {
        updateStatusMutation.mutate({ id: draggedProspectId, status });
      }
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Prospecção (SDR)</h2>
          <p className="text-muted-foreground mt-1">Gerencie seu funil de prospecção fria até o agendamento da apresentação.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Configurar Funil
          </Button>
          <Button onClick={() => setIsNewProspectOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Etapas do Funil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Nova etapa..." 
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
              />
              <Button onClick={handleAddColumn}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={col} className="flex items-center justify-between bg-muted p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{idx + 1}. {col}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveColumn(idx, 'up')} disabled={idx === 0}>
                      <span className="text-xs">↑</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveColumn(idx, 'down')} disabled={idx === columns.length - 1}>
                      <span className="text-xs">↓</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 ml-2" onClick={() => handleRemoveColumn(col)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Dica: O status "Agendado" é utilizado para integração com a Agenda.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewProspectOpen} onOpenChange={setIsNewProspectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Prospect</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProspect} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <Input id="company" name="company" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato *</Label>
              <Input id="contact_name" name="contact_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Input id="role" name="role" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input id="linkedin_url" name="linkedin_url" type="text" />
            </div>
            <Button type="submit" className="w-full" disabled={createProspectMutation.isPending}>
              {createProspectMutation.isPending ? "Salvando..." : "Salvar Lead"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsScheduleModalOpen(false);
          setScheduleTargetId(null);
          setScheduleTargetCol(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Você moveu o prospect para a etapa "Agendado". Informe a data e hora para criar o evento na Agenda.
          </div>
          <form onSubmit={handleScheduleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Reunião</Label>
              <Input id="title" name="title" required defaultValue={prospects?.find(p => p.id === scheduleTargetId)?.company || ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início</Label>
                <Input id="start_time" name="start_time" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim</Label>
                <Input id="end_time" name="end_time" type="datetime-local" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_link">Link da Reunião (Opcional)</Label>
              <Input id="meeting_link" name="meeting_link" type="url" placeholder="https://meet.google.com/..." />
            </div>
            <Button type="submit" className="w-full" disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? "Salvando..." : "Confirmar Agendamento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full items-stretch">
          {columns.map((col) => (
            <div 
              key={col} 
              className="w-[300px] flex flex-col h-full rounded-lg bg-muted/40 p-3"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-sm">{col}</h3>
                <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
                  {getProspectsByStatus(col).length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px]">
                {isLoading ? (
                  <p className="text-xs text-center text-muted-foreground mt-4">Carregando...</p>
                ) : (
                  getProspectsByStatus(col).map((p) => (
                    <Card 
                      key={p.id} 
                      className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors" 
                      onClick={() => setSelectedProspect(p)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <CardContent className="p-3 pointer-events-none">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm line-clamp-1">{p.company}</h4>
                          {p.has_scheduled_meeting && (
                            <Calendar className="h-4 w-4 text-green-500 shrink-0" title="Reunião Agendada vinculada na Agenda" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-1">
                          <UserCircle2 className="h-3.5 w-3.5" />
                          {p.contact_name} {p.role ? `- ${p.role}` : ""}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              {selectedProspect?.company}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-6 custom-scrollbar pr-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Detalhes do Contato</h3>
                <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Nome:</span> {selectedProspect?.contact_name}</p>
                  <p><span className="text-muted-foreground">Cargo:</span> {selectedProspect?.role || "-"}</p>
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">LinkedIn:</span> 
                    {selectedProspect?.linkedin_url ? (
                      <a href={selectedProspect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                        Ver Perfil <Linkedin className="h-3 w-3" />
                      </a>
                    ) : "-"}
                  </p>
                  <p><span className="text-muted-foreground">Status Atual:</span> <Badge variant="outline">{selectedProspect?.status}</Badge></p>
                  {selectedProspect?.has_scheduled_meeting && (
                    <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md flex items-center gap-2 text-green-500">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium text-xs">Este prospect possui uma reunião agendada no sistema.</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Histórico e Notas
                </h3>
                <form onSubmit={handleAddNote} className="mb-4 space-y-2">
                  <Textarea name="note_text" placeholder="Adicionar registro de contato, resumo de call, qualificação..." required className="resize-none" rows={3} />
                  <Button type="submit" size="sm" className="w-full" disabled={createNoteMutation.isPending}>
                    {createNoteMutation.isPending ? "Salvando..." : "Adicionar Nota"}
                  </Button>
                </form>

                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                  {notes?.map((note) => (
                    <div key={note.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <time className="text-[10px] font-medium text-muted-foreground">
                            {format(new Date(note.created_at), "dd/MM/yyyy HH:mm")}
                          </time>
                        </div>
                        <p className="text-sm text-foreground">{note.note_text}</p>
                      </div>
                    </div>
                  ))}
                  {notes?.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground pt-4">Nenhuma nota registrada ainda.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
