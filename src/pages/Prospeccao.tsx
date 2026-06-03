import React, { useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchProspects,
  createProspect,
  deleteProspectsByIds,
  importProspectsWithReport,
  ProspectImportError,
  ProspectImportItem,
  ProspectImportReport,
  updateProspect,
  updateProspectStatus,
  fetchProspectNotes,
  createProspectNote,
  getProspectPersonas,
  normalizeProspectForDisplay,
} from "@/lib/supabase-prospeccao";
import { createCalendarEvent } from "@/lib/supabase-agenda";
import { useAuth } from "@/hooks/useAuth";
import { CalendarEvent, Operation, Prospect, ProspectOperation, ProspectPersona, ProspectStatus } from "@/lib/types";
import {
  buildProspectFromImportRow,
  emptyImportMapping,
  guessProspectImportMapping,
  IMPORT_FIELDS,
  ImportFieldKey,
  ImportFieldMapping,
  ImportRow,
  NO_IMPORT_FIELD,
  normalizeImportKey,
  normalizeProspectOperation,
  parseProspectImportTable,
  parseProspectImportText,
} from "@/lib/prospect-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Linkedin, Calendar, Building2, UserCircle2, Users2, Settings2, X, GripVertical, Phone, Pencil, ClipboardList, Mail, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const normalizeUrlKey = (value?: string | null) => {
  const rawValue = (value || "").trim().toLowerCase();
  if (!rawValue) return "";

  const urlValue = /^[a-z]+:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/$/, "");
    return `${hostname}${pathname}`.toLowerCase();
  } catch {
    return normalizeImportKey(rawValue);
  }
};

const buildDuplicateKey = (company?: string | null, identity?: string | null) =>
  `${normalizeImportKey(company)}|${identity || ""}`;

const buildPersonaId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createEmptyPersona = (): ProspectPersona => ({
  id: buildPersonaId(),
  name: "",
  role: "",
  linkedin_url: "",
  email: "",
  phone: "",
});

const normalizePersonasForForm = (personas: ProspectPersona[]) =>
  personas.length > 0 ? personas : [createEmptyPersona()];

const getPersonasForForm = (prospect: Partial<Prospect>) => {
  const personas = Array.isArray(prospect.personas) ? prospect.personas : getProspectPersonas(prospect);
  return normalizePersonasForForm(personas);
};

const buildPersonaIdentityKeys = (persona: Partial<ProspectPersona>) => {
  const keys = [
    persona.linkedin_url ? `linkedin:${normalizeUrlKey(persona.linkedin_url)}` : "",
    persona.email ? `email:${persona.email.trim().toLowerCase()}` : "",
    persona.name ? `name:${normalizeImportKey(persona.name)}` : "",
  ];

  return keys.filter(Boolean);
};

const buildDuplicateKeysForProspect = (prospect: Partial<Prospect>) => {
  const personas = getProspectPersonas(prospect);
  const personaKeys = personas.length > 0
    ? personas.flatMap(buildPersonaIdentityKeys)
    : [`name:${normalizeImportKey(prospect.contact_name || "")}`].filter((key) => key !== "name:");
  return personaKeys.map((key) => buildDuplicateKey(prospect.company, key));
};

const getImportMappedValue = (row: ImportRow, mapping: ImportFieldMapping, field: ImportFieldKey) => {
  const column = mapping[field];
  return column && column !== NO_IMPORT_FIELD ? row[column]?.trim() || "" : "";
};

const buildCompanyGroupKey = (prospect: Partial<Prospect>, row: ImportRow, mapping: ImportFieldMapping) => {
  const companyKey = normalizeImportKey(prospect.company);
  const websiteKey = normalizeUrlKey(getImportMappedValue(row, mapping, "company_website"));
  return websiteKey ? `${companyKey}|site:${websiteKey}` : companyKey;
};

const mergeQualificationNotes = (current?: string, incoming?: string) => {
  const parts = [current, incoming]
    .map((item) => (item || "").trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join("\n\n");
};

const syncPrimaryPersonaFields = (prospect: Partial<Prospect>): Partial<Prospect> => {
  const personas = getProspectPersonas(prospect);
  const primaryPersona = personas[0];
  const hasExplicitPersonas = Array.isArray(prospect.personas);

  return {
    ...prospect,
    personas,
    contact_name: primaryPersona?.name || (hasExplicitPersonas ? "" : prospect.contact_name || ""),
    role: primaryPersona?.role || undefined,
    linkedin_url: primaryPersona?.linkedin_url || undefined,
    contact_email: primaryPersona?.email || undefined,
    contact_phone: primaryPersona?.phone || undefined,
  };
};

type ImportUiReport = ProspectImportReport & {
  skipped: ProspectImportError[];
};

const PROSPECT_OPERATIONS: ProspectOperation[] = ["A definir", "BluePex", "Opus Tech"];
const OPERATION_FILTERS: Array<ProspectOperation | "Todas"> = ["Todas", ...PROSPECT_OPERATIONS];
const DEFAULT_FUNNEL_COLUMNS = ["Mapeamento", "Em Contato", "Agendado", "Concluído", "Perdido"];
const REQUIRED_FUNNEL_COLUMNS = ["Em Contato", "Agendado", "Concluído"];
const KANBAN_AUTO_SCROLL_EDGE = 96;
const KANBAN_AUTO_SCROLL_MAX_SPEED = 24;

const getInitialFunnelStatus = (columns: string[]) =>
  columns.includes("Mapeamento") ? "Mapeamento" : columns[0] || "Mapeamento";

const getInitialImportOperation = (fileName: string): ProspectOperation =>
  normalizeProspectOperation(fileName);

const getProspectOperation = (prospect?: Pick<Prospect, "operation"> | null): ProspectOperation =>
  normalizeProspectOperation(prospect?.operation);

const getProspectOperationClass = (operation: ProspectOperation) => {
  if (operation === "BluePex") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (operation === "Opus Tech") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-border/60 bg-muted/50 text-muted-foreground";
};

const toCalendarOperation = (operation: ProspectOperation): Operation | undefined =>
  operation === "A definir" ? undefined : operation;

export default function Prospeccao() {
  const { user, position } = useAuth();
  const queryClient = useQueryClient();
  const [isNewProspectOpen, setIsNewProspectOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState<string | null>(null);
  const [scheduleTargetCol, setScheduleTargetCol] = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isSheetEditMode, setIsSheetEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Prospect>>({});
  const [draggedProspectId, setDraggedProspectId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fieldMapping, setFieldMapping] = useState<ImportFieldMapping>(() => emptyImportMapping());
  const [defaultImportStatus, setDefaultImportStatus] = useState("Mapeamento");
  const [defaultImportOperation, setDefaultImportOperation] = useState<ProspectOperation>("A definir");
  const [skipImportDuplicates, setSkipImportDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportUiReport | null>(null);
  const [isRollingBackImport, setIsRollingBackImport] = useState(false);
  const [importRollbackDone, setImportRollbackDone] = useState(false);
  const [operationFilter, setOperationFilter] = useState<ProspectOperation | "Todas">("Todas");
  const [newProspectPersonas, setNewProspectPersonas] = useState<ProspectPersona[]>(() => [createEmptyPersona()]);
  const kanbanScrollRef = React.useRef<HTMLDivElement | null>(null);
  const autoScrollFrameRef = React.useRef<number | null>(null);
  const autoScrollSpeedRef = React.useRef(0);

  React.useEffect(() => {
    if (selectedProspect) {
      setEditFormData(normalizeProspectForDisplay(selectedProspect));
      setIsSheetEditMode(false);
    }
  }, [selectedProspect?.id]);

  React.useEffect(() => {
    if (isNewProspectOpen) {
      setNewProspectPersonas([createEmptyPersona()]);
    }
  }, [isNewProspectOpen]);
  const [newColumnName, setNewColumnName] = useState("");

  const [columns, setColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('prospect_columns');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_FUNNEL_COLUMNS;
    return Array.from(new Set([...parsed, ...REQUIRED_FUNNEL_COLUMNS]));
  });

  React.useEffect(() => {
    setDefaultImportStatus((current) => (columns.includes(current) ? current : columns[0] || "Mapeamento"));
  }, [columns]);

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
    queryKey: ["prospects", user?.id, position],
    queryFn: () => fetchProspects(user!.id, position),
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

  const importProspectsMutation = useMutation({
    mutationFn: (items: ProspectImportItem[]) => importProspectsWithReport(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao importar leads: ${msg}`);
    }
  });

  const rollbackImportMutation = useMutation({
    mutationFn: (ids: string[]) => deleteProspectsByIds(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao apagar importação: ${msg}`);
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

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Prospect> }) => updateProspect(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setSelectedProspect(prev => prev ? normalizeProspectForDisplay({ ...prev, ...variables.updates } as Prospect) : null);
      setIsSheetEditMode(false);
      toast.success("Prospect atualizado!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao atualizar: ${msg}`);
    }
  });

  const updateProspectOperationMutation = useMutation({
    mutationFn: ({ id, operation }: { id: string; operation: ProspectOperation }) => updateProspect(id, { operation }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setSelectedProspect(prev => prev?.id === variables.id ? { ...prev, operation: variables.operation } : prev);
      toast.success("Operação do lead atualizada!");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao atualizar operação: ${msg}`);
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<Partial<CalendarEvent>, "user_id" | "prospect_id">) => {
      // 1. Cria evento PRIMEIRO — se falhar, prospect não muda de coluna
      const createdEvent = await createCalendarEvent({ ...eventData, user_id: user!.id, prospect_id: scheduleTargetId });
      // 2. Só então atualiza o status do prospect
      if (scheduleTargetId && scheduleTargetCol) {
        await updateProspect(scheduleTargetId, {
          status: scheduleTargetCol,
          ...(eventData.operation ? { operation: eventData.operation } : {}),
        });
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

  const handleSaveProspect = () => {
    if (!selectedProspect) return;
    const updates = syncPrimaryPersonaFields(editFormData);
    if (!updates.contact_name) {
      toast.error("Informe pelo menos uma persona com nome.");
      return;
    }
    updateProspectMutation.mutate({ id: selectedProspect.id, updates });
  };

  const handleCreateProspect = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const prospect = syncPrimaryPersonaFields({
      company: formData.get("company") as string,
      operation: normalizeProspectOperation(formData.get("operation") as string),
      company_email: formData.get("company_email") as string || undefined,
      company_phone: formData.get("company_phone") as string || undefined,
      personas: newProspectPersonas,
      qualification_notes: formData.get("qualification_notes") as string || undefined,
      status: getInitialFunnelStatus(columns),
    });

    if (!prospect.contact_name) {
      toast.error("Informe pelo menos uma persona com nome.");
      return;
    }

    createProspectMutation.mutate(prospect);
  };

  const updateNewPersona = (index: number, updates: Partial<ProspectPersona>) => {
    setNewProspectPersonas((current) => current.map((persona, personaIndex) => (
      personaIndex === index ? { ...persona, ...updates } : persona
    )));
  };

  const addNewPersona = () => {
    setNewProspectPersonas((current) => [...current, createEmptyPersona()]);
  };

  const removeNewPersona = (index: number) => {
    setNewProspectPersonas((current) => normalizePersonasForForm(current.filter((_, personaIndex) => personaIndex !== index)));
  };

  const updateEditPersona = (index: number, updates: Partial<ProspectPersona>) => {
    setEditFormData((current) => {
      const personas = getPersonasForForm(current);
      const nextPersonas = personas.map((persona, personaIndex) => (
        personaIndex === index ? { ...persona, ...updates } : persona
      ));
      return { ...current, personas: nextPersonas };
    });
  };

  const addEditPersona = () => {
    setEditFormData((current) => {
      const personas = getPersonasForForm(current);
      return { ...current, personas: [...personas, createEmptyPersona()] };
    });
  };

  const removeEditPersona = (index: number) => {
    setEditFormData((current) => {
      const personas = normalizePersonasForForm(getPersonasForForm(current).filter((_, personaIndex) => personaIndex !== index));
      return { ...current, personas };
    });
  };

  const handleProspectOperationChange = (id: string, operation: ProspectOperation) => {
    updateProspectOperationMutation.mutate({ id, operation });
  };

  const existingProspectKeys = React.useMemo(() => {
    return new Set((prospects || []).flatMap((prospect) => buildDuplicateKeysForProspect(prospect)));
  }, [prospects]);

  const importAnalysis = React.useMemo(() => {
    const seen = new Set<string>();
    let missingRequired = 0;
    let duplicates = 0;

    const analyzedRows = importRows.map((row, index) => {
      const prospect = buildProspectFromImportRow(row, fieldMapping, defaultImportStatus, columns, defaultImportOperation);
      const keys = buildDuplicateKeysForProspect(prospect);
      const hasRequiredFields = Boolean(prospect.company && prospect.contact_name);
      const isDuplicate = hasRequiredFields && keys.some((key) => existingProspectKeys.has(key) || seen.has(key));
      const skippedMessage = !hasRequiredFields
        ? "Faltam empresa ou nome do contato."
        : isDuplicate
          ? "Duplicado por empresa + contato."
          : "";

      if (!hasRequiredFields) {
        missingRequired += 1;
      } else {
        keys.forEach((key) => seen.add(key));
      }

      if (isDuplicate) duplicates += 1;

      return {
        index,
        rowNumber: index + 2,
        raw: row,
        prospect: { ...prospect, owner_id: user?.id || "", importRowNumber: index + 2 },
        hasRequiredFields,
        isDuplicate,
        skippedMessage,
      };
    });

    const importableRows = analyzedRows
      .filter((row) => row.hasRequiredFields && (!skipImportDuplicates || !row.isDuplicate));
    const groupedRows = new Map<string, {
      groupKey: string;
      prospect: ProspectImportItem;
      sourceRows: number[];
    }>();

    importableRows.forEach((row) => {
      const groupKey = buildCompanyGroupKey(row.prospect, row.raw, fieldMapping);
      const existingGroup = groupedRows.get(groupKey);

      if (!existingGroup) {
        groupedRows.set(groupKey, {
          groupKey,
          prospect: {
            ...row.prospect,
            personas: getProspectPersonas(row.prospect),
          } as ProspectImportItem,
          sourceRows: [row.rowNumber],
        });
        return;
      }

      const existingPersonaKeys = new Set(getProspectPersonas(existingGroup.prospect).flatMap(buildPersonaIdentityKeys));
      const newPersonas = getProspectPersonas(row.prospect).filter((persona) => {
        const personaKeys = buildPersonaIdentityKeys(persona);
        const alreadyExists = personaKeys.some((key) => existingPersonaKeys.has(key));
        personaKeys.forEach((key) => existingPersonaKeys.add(key));
        return !alreadyExists;
      });

      existingGroup.sourceRows.push(row.rowNumber);
      existingGroup.prospect.personas = [...getProspectPersonas(existingGroup.prospect), ...newPersonas];
      existingGroup.prospect.qualification_notes = mergeQualificationNotes(existingGroup.prospect.qualification_notes, row.prospect.qualification_notes) || undefined;
      if (!existingGroup.prospect.company_email && row.prospect.company_email) existingGroup.prospect.company_email = row.prospect.company_email;
      if (!existingGroup.prospect.company_phone && row.prospect.company_phone) existingGroup.prospect.company_phone = row.prospect.company_phone;
      if (getProspectOperation(existingGroup.prospect) === "A definir" && getProspectOperation(row.prospect) !== "A definir") {
        existingGroup.prospect.operation = getProspectOperation(row.prospect);
      }
    });

    const groups = Array.from(groupedRows.values()).map((group) => ({
      ...group,
      prospect: syncPrimaryPersonaFields(group.prospect) as ProspectImportItem,
    }));
    const validRows = groups.map((group) => group.prospect);
    const skipped = analyzedRows
      .filter((row) => !row.hasRequiredFields || (skipImportDuplicates && row.isDuplicate))
      .map((row) => ({
        rowNumber: row.rowNumber,
        company: row.prospect.company,
        contactName: row.prospect.contact_name,
        message: row.skippedMessage,
      }));

    const skippedRows = skipped.length;
    const personasCount = validRows.reduce((total, prospect) => total + getProspectPersonas(prospect).length, 0);
    const mergedRows = Math.max(0, importableRows.length - validRows.length);
    const repeatedCompanyGroups = groups.filter((group) => group.sourceRows.length > 1).length;

    return {
      rows: analyzedRows,
      groups,
      validRows,
      skipped,
      missingRequired,
      duplicates,
      skippedRows,
      personasCount,
      mergedRows,
      repeatedCompanyGroups,
    };
  }, [columns, defaultImportOperation, defaultImportStatus, existingProspectKeys, fieldMapping, importRows, skipImportDuplicates, user?.id]);

  const isImportMappingReady = fieldMapping.company !== NO_IMPORT_FIELD && fieldMapping.contact_name !== NO_IMPORT_FIELD;
  const autoDetectedFields = React.useMemo(() => {
    return IMPORT_FIELDS.filter((field) => fieldMapping[field.key] !== NO_IMPORT_FIELD);
  }, [fieldMapping]);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportReport(null);
    setImportRollbackDone(false);
    const isSpreadsheetFile = /\.(xlsx)$/i.test(file.name);
    const supportedFile = isSpreadsheetFile || /\.(csv|tsv|txt)$/i.test(file.name);
    if (!supportedFile) {
      toast.error("Envie uma planilha em XLSX, CSV ou TSV.");
      event.target.value = "";
      return;
    }

    try {
      const parsed = isSpreadsheetFile
        ? parseProspectImportTable(await readSheet(file))
        : parseProspectImportText(await file.text());

      if (!parsed.headers.length || !parsed.rows.length) {
        toast.error("Não encontrei linhas válidas nessa planilha.");
        return;
      }

      setImportFileName(file.name);
      setImportHeaders(parsed.headers);
      setImportRows(parsed.rows);
      const guessedMapping = guessProspectImportMapping(parsed.headers);
      const detectedCount = IMPORT_FIELDS.filter((field) => guessedMapping[field.key] !== NO_IMPORT_FIELD).length;
      setFieldMapping(guessedMapping);
      setDefaultImportStatus(getInitialFunnelStatus(columns));
      setDefaultImportOperation(getInitialImportOperation(file.name));
      toast.success(`${parsed.rows.length} linhas lidas. ${detectedCount} campos identificados automaticamente.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao ler a planilha: ${msg}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleImportMappingChange = (field: keyof ImportFieldMapping, value: string) => {
    setImportReport(null);
    setImportRollbackDone(false);
    setFieldMapping((current) => ({ ...current, [field]: value }));
  };

  const resetImportState = () => {
    setImportFileName("");
    setImportHeaders([]);
    setImportRows([]);
    setFieldMapping(emptyImportMapping());
    setDefaultImportOperation("A definir");
    setSkipImportDuplicates(true);
    setIsImporting(false);
    setImportReport(null);
    setImportRollbackDone(false);
    setIsRollingBackImport(false);
  };

  const handleConfirmImport = async () => {
    if (!user?.id) {
      toast.error("Você precisa estar logado para importar leads.");
      return;
    }

    if (!isImportMappingReady) {
      toast.error("Marque pelo menos os campos Empresa e Nome do contato.");
      return;
    }

    if (!importAnalysis.validRows.length) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }

    setIsImporting(true);
    try {
      const report = await importProspectsMutation.mutateAsync(importAnalysis.validRows as ProspectImportItem[]);
      const fullReport = { ...report, skipped: importAnalysis.skipped };
      setImportReport(fullReport);
      setImportRollbackDone(false);

      if (report.created.length > 0 && report.errors.length === 0) {
        toast.success(`${report.created.length} leads importados com sucesso!`);
      } else if (report.created.length > 0) {
        toast.warning(`${report.created.length} leads importados, com ${report.errors.length} erro(s).`);
      } else {
        toast.error("Nenhum lead foi importado. Confira os erros no resumo.");
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleRollbackImport = async () => {
    const ids = importReport?.created.map((prospect) => prospect.id).filter(Boolean) || [];
    if (!ids.length) return;

    const confirmed = window.confirm(`Apagar os ${ids.length} leads criados por esta importação?`);
    if (!confirmed) return;

    setIsRollingBackImport(true);
    try {
      await rollbackImportMutation.mutateAsync(ids);
      setImportRollbackDone(true);
      toast.success(`${ids.length} leads desta importação foram apagados.`);
    } finally {
      setIsRollingBackImport(false);
    }
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
    const operation = normalizeProspectOperation(formData.get("operation") as string || prospect?.operation);
    
    createEventMutation.mutate({
      title: formData.get("title") as string || prospect?.company || "Reunião de Apresentação",
      start_time: new Date(formData.get("start_time") as string).toISOString(),
      end_time: new Date(formData.get("end_time") as string).toISOString(),
      meeting_link: formData.get("meeting_link") as string,
      description: formData.get("description") as string,
      operation: toCalendarOperation(operation),
      status: "Agendado",
    });
  };

  const getProspectsByStatus = (status: string) => {
    return prospects?.filter(p => p.status === status && (operationFilter === "Todas" || getProspectOperation(p) === operationFilter)) || [];
  };

  const stopHorizontalAutoScroll = React.useCallback(() => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const startHorizontalAutoScroll = React.useCallback(() => {
    if (autoScrollFrameRef.current !== null) return;

    const scrollStep = () => {
      const container = kanbanScrollRef.current;
      const speed = autoScrollSpeedRef.current;

      if (!container || speed === 0) {
        stopHorizontalAutoScroll();
        return;
      }

      container.scrollLeft += speed;
      autoScrollFrameRef.current = requestAnimationFrame(scrollStep);
    };

    autoScrollFrameRef.current = requestAnimationFrame(scrollStep);
  }, [stopHorizontalAutoScroll]);

  const handleHorizontalAutoScroll = React.useCallback((clientX: number) => {
    const container = kanbanScrollRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) {
      stopHorizontalAutoScroll();
      return;
    }

    const rect = container.getBoundingClientRect();
    const leftDistance = clientX - rect.left;
    const rightDistance = rect.right - clientX;
    let speed = 0;

    if (leftDistance >= 0 && leftDistance < KANBAN_AUTO_SCROLL_EDGE) {
      speed = -Math.ceil(((KANBAN_AUTO_SCROLL_EDGE - leftDistance) / KANBAN_AUTO_SCROLL_EDGE) * KANBAN_AUTO_SCROLL_MAX_SPEED);
    } else if (rightDistance >= 0 && rightDistance < KANBAN_AUTO_SCROLL_EDGE) {
      speed = Math.ceil(((KANBAN_AUTO_SCROLL_EDGE - rightDistance) / KANBAN_AUTO_SCROLL_EDGE) * KANBAN_AUTO_SCROLL_MAX_SPEED);
    }

    autoScrollSpeedRef.current = speed;
    if (speed === 0) {
      stopHorizontalAutoScroll();
    } else {
      startHorizontalAutoScroll();
    }
  }, [startHorizontalAutoScroll, stopHorizontalAutoScroll]);

  React.useEffect(() => stopHorizontalAutoScroll, [stopHorizontalAutoScroll]);

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
    stopHorizontalAutoScroll();
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
          <Select value={operationFilter} onValueChange={(value) => setOperationFilter(value as ProspectOperation | "Todas")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Operação" />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_FILTERS.map((operation) => (
                <SelectItem key={operation} value={operation}>
                  {operation === "Todas" ? "Todas operações" : operation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar Planilha
          </Button>
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
              Dica: "Agendado" e "Concluído" são utilizados para integração com a Agenda.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open && !isImporting && !isRollingBackImport) resetImportState();
      }}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Planilha de Prospecção</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <Label
                htmlFor="prospect-import-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {importFileName || "Escolher arquivo XLSX, CSV ou TSV"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Arquivos do Excel, Google Sheets exportado ou CSV continuam no mesmo fluxo de conferência.
                </span>
              </Label>
              <Input
                id="prospect-import-file"
                type="file"
                accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>

            {importHeaders.length > 0 && (
              <>
                <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium">Campos identificados automaticamente</p>
                    <p className="text-xs text-muted-foreground">
                      Encontramos {autoDetectedFields.length} correspondências. Confirme abaixo ou altere qualquer campo antes de importar.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Marcação de campos</h3>
                        <p className="text-xs text-muted-foreground">
                          Escolha qual coluna da planilha corresponde a cada campo do sistema.
                        </p>
                      </div>
                      <Badge variant="outline">{importRows.length} linhas</Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {IMPORT_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs">
                              {field.label}{field.required ? " *" : ""}
                            </Label>
                            {fieldMapping[field.key] !== NO_IMPORT_FIELD && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                                Detectado
                              </Badge>
                            )}
                          </div>
                          <Select
                            value={fieldMapping[field.key]}
                            onValueChange={(value) => handleImportMappingChange(field.key, value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Ignorar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_IMPORT_FIELD}>Ignorar</SelectItem>
                              {importHeaders.map((header) => (
                                <SelectItem key={`${field.key}-${header}`} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Etapa padrão</Label>
                      <Select value={defaultImportStatus} onValueChange={(value) => {
                        setImportReport(null);
                        setImportRollbackDone(false);
                        setDefaultImportStatus(value);
                      }}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((column) => (
                            <SelectItem key={column} value={column}>
                              {column}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Usada quando a planilha não tem etapa ou quando a etapa não existe no funil.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Operação padrão</Label>
                      <Select value={defaultImportOperation} onValueChange={(value) => {
                        setImportReport(null);
                        setImportRollbackDone(false);
                        setDefaultImportOperation(value as ProspectOperation);
                      }}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROSPECT_OPERATIONS.map((operation) => (
                            <SelectItem key={operation} value={operation}>
                              {operation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Quando a planilha não informa a operação, o nome do arquivo pode sugerir BluePex ou Opus Tech.
                      </p>
                    </div>

                    <label className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm">
                      <Checkbox
                        checked={skipImportDuplicates}
                        onCheckedChange={(checked) => {
                          setImportReport(null);
                          setImportRollbackDone(false);
                          setSkipImportDuplicates(checked === true);
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        Ignorar duplicados
                        <span className="block text-xs text-muted-foreground">
                          Compara empresa + contato com os leads já cadastrados e com a própria planilha.
                        </span>
                      </span>
                    </label>

                    <div className="rounded-md border border-border/60 p-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Cards</p>
                          <p className="text-lg font-semibold">{importAnalysis.validRows.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Personas</p>
                          <p className="text-lg font-semibold">{importAnalysis.personasCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Linhas unidas</p>
                          <p className="text-lg font-semibold">{importAnalysis.mergedRows}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ignorados</p>
                          <p className="text-lg font-semibold">{importAnalysis.skippedRows}</p>
                        </div>
                      </div>
                      {importAnalysis.repeatedCompanyGroups > 0 && (
                        <div className="mt-3 flex gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <Users2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {importAnalysis.repeatedCompanyGroups} empresas repetidas serão agrupadas em cards únicos com múltiplas personas.
                          </span>
                        </div>
                      )}
                      {(importAnalysis.missingRequired > 0 || importAnalysis.duplicates > 0) && (
                        <div className="mt-3 flex gap-2 text-xs text-amber-600 dark:text-amber-400">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {importAnalysis.missingRequired > 0 && `${importAnalysis.missingRequired} sem empresa ou contato. `}
                            {importAnalysis.duplicates > 0 && `${importAnalysis.duplicates} duplicados encontrados.`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Prévia</h3>
                  <div className="overflow-hidden rounded-md border border-border/60">
                    <div className="grid grid-cols-[1fr_0.8fr_1fr_0.8fr_0.8fr] bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>Empresa</span>
                      <span>Operação</span>
                      <span>Personas</span>
                      <span>Linhas</span>
                      <span>Situação</span>
                    </div>
                    {importAnalysis.groups.slice(0, 6).map((group) => {
                      const personas = getProspectPersonas(group.prospect);
                      return (
                        <div
                          key={group.groupKey}
                          className="grid grid-cols-[1fr_0.8fr_1fr_0.8fr_0.8fr] gap-2 border-t border-border/50 px-3 py-2 text-xs"
                        >
                          <span className="truncate">{group.prospect.company || "-"}</span>
                          <span className="truncate">{getProspectOperation(group.prospect)}</span>
                          <span className="truncate">
                            {personas[0]?.name || "-"}
                            {personas.length > 1 ? ` +${personas.length - 1}` : ""}
                          </span>
                          <span className="truncate">
                            {group.sourceRows.length > 1 ? `${group.sourceRows.length} linhas` : `Linha ${group.sourceRows[0]}`}
                          </span>
                          <span className={group.sourceRows.length > 1 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                            {group.sourceRows.length > 1 ? "Agrupado" : "Pronto"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {importReport && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  {importReport.errors.length === 0 ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Resultado da importação</h3>
                      <p className="text-xs text-muted-foreground">
                        {importReport.created.length} importados, {importReport.skipped.length} ignorados e {importReport.errors.length} com erro.
                      </p>
                      {importRollbackDone && (
                        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Os leads criados por esta importação foram apagados.
                        </p>
                      )}
                    </div>

                    {(importReport.skipped.length > 0 || importReport.errors.length > 0) && (
                      <div className="max-h-36 overflow-y-auto rounded border border-border/50 bg-background/60">
                        {importReport.skipped.slice(0, 12).map((item) => (
                          <div key={`skipped-${item.rowNumber}`} className="border-b border-border/40 px-3 py-2 text-xs last:border-b-0">
                            <span className="font-medium">Linha {item.rowNumber} ignorada:</span>{" "}
                            <span className="text-muted-foreground">
                              {item.message} {item.company ? `Empresa: ${item.company}.` : ""}
                            </span>
                          </div>
                        ))}
                        {importReport.errors.slice(0, 12).map((item) => (
                          <div key={`error-${item.rowNumber}`} className="border-b border-border/40 px-3 py-2 text-xs last:border-b-0">
                            <span className="font-medium text-destructive">Linha {item.rowNumber} com erro:</span>{" "}
                            <span className="text-muted-foreground">
                              {item.message} {item.company ? `Empresa: ${item.company}.` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {importReport.created.length > 0 && !importRollbackDone && (
                      <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Se algo ficou errado, apague apenas os leads criados nesta importação.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRollbackImport}
                          disabled={isRollingBackImport}
                          className="shrink-0"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isRollingBackImport ? "Apagando..." : "Apagar esta importação"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isImporting || isRollingBackImport}>
                {importReport ? "Concluir" : "Cancelar"}
              </Button>
              {!importReport && (
                <Button
                  onClick={handleConfirmImport}
                  disabled={!importHeaders.length || !isImportMappingReady || !importAnalysis.validRows.length || isImporting}
                >
                  {isImporting ? "Importando..." : "Confirmar e Importar Leads"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewProspectOpen} onOpenChange={setIsNewProspectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Prospect</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProspect} className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="company">Empresa *</Label>
                <Input id="company" name="company" required />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="operation">Operação</Label>
                <Select name="operation" defaultValue="A definir">
                  <SelectTrigger id="operation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROSPECT_OPERATIONS.map((operation) => (
                      <SelectItem key={operation} value={operation}>{operation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Personas *</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addNewPersona}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Persona
                  </Button>
                </div>
                <div className="space-y-3">
                  {newProspectPersonas.map((persona, index) => (
                    <div key={persona.id} className="rounded-md border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Persona {index + 1}</span>
                        {newProspectPersonas.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeNewPersona(index)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome {index === 0 ? "*" : ""}</Label>
                          <Input value={persona.name} onChange={(e) => updateNewPersona(index, { name: e.target.value })} required={index === 0} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cargo</Label>
                          <Input value={persona.role || ""} onChange={(e) => updateNewPersona(index, { role: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">WhatsApp</Label>
                          <Input value={persona.phone || ""} onChange={(e) => updateNewPersona(index, { phone: e.target.value })} className="h-8 text-sm" placeholder="+55 11..." />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input value={persona.email || ""} onChange={(e) => updateNewPersona(index, { email: e.target.value })} className="h-8 text-sm" type="email" />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">LinkedIn URL</Label>
                          <Input value={persona.linkedin_url || ""} onChange={(e) => updateNewPersona(index, { linkedin_url: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_phone">Tel. Empresa</Label>
                <Input id="company_phone" name="company_phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_email">Email Empresa</Label>
                <Input id="company_email" name="company_email" type="email" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="qualification_notes">Observações</Label>
                <Textarea id="qualification_notes" name="qualification_notes" rows={2} className="resize-none" />
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="schedule_operation">Operação</Label>
              <Select name="operation" defaultValue={getProspectOperation(prospects?.find(p => p.id === scheduleTargetId))}>
                <SelectTrigger id="schedule_operation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_OPERATIONS.map((operation) => (
                    <SelectItem key={operation} value={operation}>{operation}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <div
        ref={kanbanScrollRef}
        className="prospect-kanban-scroll flex-1 min-w-0 overflow-x-auto overflow-y-hidden pb-4"
        onMouseMove={(event) => handleHorizontalAutoScroll(event.clientX)}
        onMouseLeave={stopHorizontalAutoScroll}
        onDragOver={(event) => {
          handleDragOver(event);
          handleHorizontalAutoScroll(event.clientX);
        }}
      >
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
                    colProspects.map((p) => {
                      const personas = getProspectPersonas(p);
                      const primaryPersona = personas[0];

                      return (
                        <Card
                          key={p.id}
                          className="cursor-grab active:cursor-grabbing hover:border-primary/60 hover:shadow-md transition-all duration-150 bg-background/60"
                          onClick={() => setSelectedProspect(p)}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-sm leading-tight line-clamp-1 flex-1">{p.company}</h4>
                              <div className="flex items-center gap-1 shrink-0">
                                {personas.length > 1 && (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    <Users2 className="mr-1 h-3 w-3" /> {personas.length}
                                  </Badge>
                                )}
                                {p.has_scheduled_meeting && (
                                  <span title="Reunião vinculada na Agenda">
                                    <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          <div
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            draggable={false}
                          >
                            <Select
                              value={getProspectOperation(p)}
                              onValueChange={(value) => handleProspectOperationChange(p.id, value as ProspectOperation)}
                              disabled={updateProspectOperationMutation.isPending}
                            >
                              <SelectTrigger className={`h-7 w-full text-[11px] border ${getProspectOperationClass(getProspectOperation(p))}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROSPECT_OPERATIONS.map((operation) => (
                                  <SelectItem key={operation} value={operation}>{operation}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-1">
                                <UserCircle2 className="h-3 w-3 shrink-0" />
                                {primaryPersona?.name || p.contact_name}
                              </p>
                              {(primaryPersona?.role || p.role) && (
                                <p className="text-[11px] text-muted-foreground/60 pl-4 line-clamp-1">{primaryPersona?.role || p.role}</p>
                              )}
                              {personas.length > 1 && (
                                <p className="text-[10px] text-muted-foreground/60 pl-4 line-clamp-1">
                                  +{personas.length - 1} persona{personas.length > 2 ? "s" : ""}
                                </p>
                              )}
                            </div>
                            {((primaryPersona?.linkedin_url || p.linkedin_url) || (primaryPersona?.phone || p.contact_phone)) && (
                            <div className="pt-1.5 border-t border-border/40 flex items-center gap-3">
                              {(primaryPersona?.linkedin_url || p.linkedin_url) && (
                                <div className="flex items-center gap-1.5">
                                  <Linkedin className="h-2.5 w-2.5 text-blue-400/60" />
                                  <span className="text-[10px] text-blue-400/60 font-medium">LinkedIn</span>
                                </div>
                              )}
                              {(primaryPersona?.phone || p.contact_phone) && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-2.5 w-2.5 text-emerald-400/60" />
                                  <span className="text-[10px] text-emerald-400/60 font-medium">WhatsApp</span>
                                </div>
                              )}
                            </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border/50">
            <SheetHeader className="space-y-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <SheetTitle className="text-lg font-bold leading-tight truncate">{selectedProspect?.company}</SheetTitle>
                    {isSheetEditMode ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveProspect} disabled={updateProspectMutation.isPending}>
                          {updateProspectMutation.isPending ? "..." : "Salvar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setIsSheetEditMode(false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setIsSheetEditMode(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] h-5">{selectedProspect?.status}</Badge>
                    <Badge className={`text-[10px] h-5 ${getProspectOperationClass(getProspectOperation(selectedProspect))}`}>
                      {getProspectOperation(selectedProspect)}
                    </Badge>
                    {selectedProspect?.has_scheduled_meeting && (
                      <Badge className="text-[10px] h-5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
                        <Calendar className="h-3 w-3 mr-1" /> Reunião agendada
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Contact info — view mode */}
            {!isSheetEditMode ? (
              <div className="mt-4 space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users2 className="h-3.5 w-3.5" /> Personas
                  </div>
                  {selectedProspect && getProspectPersonas(selectedProspect).map((persona, index) => (
                    <div key={persona.id} className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{persona.name}</span>
                        {index === 0 && <Badge variant="outline" className="h-5 text-[10px]">Principal</Badge>}
                      </div>
                      {persona.role && <p className="pl-6 text-xs text-muted-foreground">{persona.role}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                        {persona.linkedin_url && (
                          <a href={persona.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            <Linkedin className="h-3.5 w-3.5 shrink-0" />
                            <span>LinkedIn</span>
                          </a>
                        )}
                        {persona.phone && (
                          <a href={`https://wa.me/${persona.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{persona.phone}</span>
                          </a>
                        )}
                        {persona.email && (
                          <a href={`mailto:${persona.email}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span>{persona.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedProspect?.company_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>{selectedProspect.company_phone} (empresa)</span>
                  </div>
                )}
                {selectedProspect?.company_email && (
                  <a href={`mailto:${selectedProspect.company_email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{selectedProspect.company_email} (empresa)</span>
                  </a>
                )}
              </div>
            ) : (
              /* Edit mode form */
              <div className="mt-4 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Empresa *</Label>
                  <Input value={editFormData.company || ''} onChange={e => setEditFormData(p => ({ ...p, company: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Operação</Label>
                    <Select
                      value={getProspectOperation(editFormData as Prospect)}
                      onValueChange={(value) => setEditFormData(p => ({ ...p, operation: value as ProspectOperation }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROSPECT_OPERATIONS.map((operation) => (
                          <SelectItem key={operation} value={operation}>{operation}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Personas *</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addEditPersona}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Persona
                    </Button>
                  </div>
                  {getPersonasForForm(editFormData).map((persona, index) => (
                    <div key={persona.id} className="rounded-md border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Persona {index + 1}</span>
                        {getPersonasForForm(editFormData).length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeEditPersona(index)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome {index === 0 ? "*" : ""}</Label>
                          <Input value={persona.name} onChange={(e) => updateEditPersona(index, { name: e.target.value })} required={index === 0} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cargo</Label>
                          <Input value={persona.role || ""} onChange={(e) => updateEditPersona(index, { role: e.target.value })} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">WhatsApp</Label>
                          <Input value={persona.phone || ""} onChange={(e) => updateEditPersona(index, { phone: e.target.value })} className="h-8 text-sm" placeholder="+55 11..." />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input value={persona.email || ""} onChange={(e) => updateEditPersona(index, { email: e.target.value })} className="h-8 text-sm" type="email" />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">LinkedIn URL</Label>
                          <Input value={persona.linkedin_url || ""} onChange={(e) => updateEditPersona(index, { linkedin_url: e.target.value })} className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tel. Empresa</Label>
                    <Input value={editFormData.company_phone || ''} onChange={e => setEditFormData(p => ({ ...p, company_phone: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email Empresa</Label>
                    <Input value={editFormData.company_email || ''} onChange={e => setEditFormData(p => ({ ...p, company_email: e.target.value }))} className="h-8 text-sm" type="email" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Observations */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5" /> Observações
              </h3>
              {isSheetEditMode ? (
                <Textarea
                  value={editFormData.qualification_notes || ''}
                  onChange={e => setEditFormData(p => ({ ...p, qualification_notes: e.target.value }))}
                  placeholder="Contexto da empresa, pontos de atenção, qualificação..."
                  className="resize-none text-sm"
                  rows={3}
                />
              ) : selectedProspect?.qualification_notes ? (
                <div className="bg-muted/40 border border-border/40 rounded-lg p-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedProspect.qualification_notes}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">Nenhuma observação registrada.</p>
              )}
            </div>

            {/* Notes */}
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
