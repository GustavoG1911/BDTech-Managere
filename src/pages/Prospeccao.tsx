import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchProspects, createProspect, updateProspectStatus, fetchProspectNotes, createProspectNote } from "@/lib/supabase-prospeccao";
import { createCalendarEvent } from "@/lib/supabase-agenda";
import { useAuth } from "@/hooks/useAuth";
import { CalendarEvent, Prospect, ProspectStatus } from "@/lib/types";
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
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao criar lead: ${msg}`);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProspectStatus }) => updateProspectStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Status atualizado!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao atualizar status: ${msg}`);
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: (text: string) => createProspectNote(selectedProspect!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-notes"] });
      toast.success("Nota adicionada com sucesso!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao adicionar nota: ${msg}`);
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<Partial<CalendarEvent>, "user_id" | "prospect_id">) => {
      // 1. Cria evento PRIMEIRO — se falhar, prospect não muda de coluna
      const createdEvent = await createCalendarEvent({ ...eventData, user_id: user!.id, prospect_id: scheduleTargetId });
      // 2. Só então atualiza o status do prospect
      if (scheduleTargetId && scheduleTargetCol) {
        await updateProspectStatus(scheduleTargetId, scheduleTargetCol);
      }
      return createdEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsScheduleModalOpen(false);
      setScheduleTargetId(null);
      setScheduleTargetCol(null);
      toast.success("Lead movido e Reunião agendada com sucesso!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao agendar reunião: ${msg}`);
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
      if (status.trim().toLowerCase() === "agendado") {
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
          {columns.map((col, colIdx) => {
            const colProspects = getProspectsByStatus(col);
            const accentColors = [
              "border-t-blue-500/70",
              "border-t-amber-500/70",
              "border-t-emerald-500/70",
              "border-t-rose-500/70",
              "border-t-violet-500/70",
              "border-t-cyan-500/70",
            ];
            const accent = accentColors[colIdx % accentColors.length];
            return (
              <div
                key={col}
                className={`w-[290px] flex flex-col h-full rounded-xl bg-card border border-border/50 border-t-2 ${accent} shadow-sm`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <h3 className="font-semibold text-sm tracking-tight">{col}</h3>
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                    {colProspects.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px]">
                  {isLoading ? (
                    <p className="text-xs text-center text-muted-foreground mt-6">Carregando...</p>
                  ) : colProspects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-xs text-muted-foreground/50">Nenhum lead aqui</p>
                    </div>
                  ) : (
                    colProspects.map((p) => (
                      <Card
                        key={p.id}
                        className="cursor-grab active:cursor-grabbing hover:border-primary/60 hover:shadow-md transition-all duration-150 bg-background/60"
                        onClick={() => setSelectedProspect(p)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <CardContent className="p-3 pointer-events-none space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm leading-tight line-clamp-1 flex-1">{p.company}</h4>
                            {p.has_scheduled_meeting && (
                              <span title="Reunião vinculada na Agenda">
                                <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-1">
                              <UserCircle2 className="h-3 w-3 shrink-0" />
                              {p.contact_name}
                            </p>
                            {p.role && (
                              <p className="text-[11px] text-muted-foreground/60 pl-4 line-clamp-1">{p.role}</p>
                            )}
                          </div>
                          {p.linkedin_url && (
                            <div className="pt-1.5 border-t border-border/40 flex items-center gap-1.5">
                              <Linkedin className="h-2.5 w-2.5 text-blue-400/60" />
                              <span className="text-[10px] text-blue-400/60 font-medium">LinkedIn</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
        <SheetContent className="w-[400px] sm:w-[480px] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border/50">
            <SheetHeader className="space-y-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg font-bold leading-tight truncate">{selectedProspect?.company}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] h-5">{selectedProspect?.status}</Badge>
                    {selectedProspect?.has_scheduled_meeting && (
                      <Badge className="text-[10px] h-5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
                        <Calendar className="h-3 w-3 mr-1" /> Reunião agendada
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Contact info row */}
            <div className="mt-4 grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{selectedProspect?.contact_name}</span>
                {selectedProspect?.role && <span className="text-muted-foreground text-xs">· {selectedProspect.role}</span>}
              </div>
              {selectedProspect?.linkedin_url && (
                <a
                  href={selectedProspect.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors w-fit"
                >
                  <Linkedin className="h-4 w-4 shrink-0" />
                  <span>Ver perfil no LinkedIn</span>
                </a>
              )}
            </div>
          </div>

          {/* Notes section */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Histórico e Notas</h3>
              <form onSubmit={handleAddNote} className="mb-5 space-y-2">
                <Textarea
                  name="note_text"
                  placeholder="Registro de contato, resumo de call, qualificação..."
                  required
                  className="resize-none text-sm"
                  rows={3}
                />
                <Button type="submit" size="sm" className="w-full" disabled={createNoteMutation.isPending}>
                  {createNoteMutation.isPending ? "Salvando..." : "Adicionar Nota"}
                </Button>
              </form>

              {/* Notes timeline — simplified linear */}
              <div className="space-y-3">
                {notes?.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border/60 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="w-px flex-1 bg-border/40 mt-1"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <time className="text-[10px] font-medium text-muted-foreground/70 block mb-1">
                        {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </time>
                      <div className="bg-muted/40 border border-border/40 rounded-lg p-3">
                        <p className="text-sm leading-relaxed">{note.note_text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!notes || notes.length === 0) && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground/50">Nenhuma nota registrada ainda.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
