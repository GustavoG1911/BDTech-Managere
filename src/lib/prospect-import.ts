import { Prospect } from "./types";

export type ImportCellValue = string | number | boolean | Date | null | undefined;
export type ImportFieldKey =
  | "company"
  | "operation"
  | "contact_name"
  | "role"
  | "linkedin_url"
  | "contact_name_2"
  | "role_2"
  | "linkedin_url_2"
  | "contact_email_2"
  | "contact_phone_2"
  | "contact_name_3"
  | "role_3"
  | "linkedin_url_3"
  | "contact_email_3"
  | "contact_phone_3"
  | "company_email"
  | "company_phone"
  | "company_website"
  | "contact_email"
  | "contact_phone"
  | "segment"
  | "city"
  | "state"
  | "fit_icp"
  | "priority"
  | "phone_notes"
  | "qualification_notes"
  | "status";

export type ImportRow = Record<string, string>;
export type ImportFieldMapping = Record<ImportFieldKey, string>;

export const NO_IMPORT_FIELD = "__none__";

export const IMPORT_FIELDS: Array<{
  key: ImportFieldKey;
  label: string;
  required?: boolean;
}> = [
  { key: "company", label: "Empresa", required: true },
  { key: "operation", label: "Operação" },
  { key: "contact_name", label: "Nome do contato", required: true },
  { key: "role", label: "Cargo" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "contact_name_2", label: "Nome do contato 2" },
  { key: "role_2", label: "Cargo 2" },
  { key: "linkedin_url_2", label: "LinkedIn 2" },
  { key: "contact_email_2", label: "Email do contato 2" },
  { key: "contact_phone_2", label: "Telefone do contato 2" },
  { key: "contact_name_3", label: "Nome do contato 3" },
  { key: "role_3", label: "Cargo 3" },
  { key: "linkedin_url_3", label: "LinkedIn 3" },
  { key: "contact_email_3", label: "Email do contato 3" },
  { key: "contact_phone_3", label: "Telefone do contato 3" },
  { key: "company_email", label: "Email da empresa" },
  { key: "company_phone", label: "Telefone da empresa" },
  { key: "company_website", label: "Site da empresa" },
  { key: "contact_email", label: "Email do contato" },
  { key: "contact_phone", label: "Telefone do contato" },
  { key: "segment", label: "Segmento" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "fit_icp", label: "Fit ICP" },
  { key: "priority", label: "Prioridade" },
  { key: "phone_notes", label: "Obs. telefone" },
  { key: "qualification_notes", label: "Observações" },
  { key: "status", label: "Etapa do funil" },
];

const HEADER_HINTS: Record<ImportFieldKey, string[]> = {
  company: ["empresa", "conta", "organizacao", "organização", "companhia", "cliente", "nome da empresa"],
  contact_name: ["contato", "nome", "decisor", "lead", "responsavel", "responsável", "pessoa"],
  role: ["cargo", "funcao", "função", "posicao", "posição"],
  operation: ["operacao", "produto", "unidade", "empresa alvo", "bluepex", "opus"],
  linkedin_url: ["linkedin", "linked in", "perfil"],
  contact_name_2: ["contato 2", "nome 2", "decisor 2", "lead 2", "persona 2", "pessoa 2"],
  role_2: ["cargo 2", "funcao 2", "função 2", "posicao 2", "posição 2"],
  linkedin_url_2: ["linkedin 2", "linked in 2", "perfil 2"],
  contact_email_2: ["email contato 2", "e-mail contato 2", "email 2", "email do contato 2"],
  contact_phone_2: ["telefone contato 2", "tel contato 2", "fone contato 2", "whatsapp 2", "celular 2"],
  contact_name_3: ["contato 3", "nome 3", "decisor 3", "lead 3", "persona 3", "pessoa 3"],
  role_3: ["cargo 3", "funcao 3", "função 3", "posicao 3", "posição 3"],
  linkedin_url_3: ["linkedin 3", "linked in 3", "perfil 3"],
  contact_email_3: ["email contato 3", "e-mail contato 3", "email 3", "email do contato 3"],
  contact_phone_3: ["telefone contato 3", "tel contato 3", "fone contato 3", "whatsapp 3", "celular 3"],
  company_email: ["email empresa", "e-mail empresa", "email corporativo", "email da empresa"],
  company_phone: ["telefone empresa", "tel empresa", "fone empresa", "whatsapp empresa"],
  company_website: ["website empresa", "site empresa", "site da empresa", "dominio empresa", "domínio empresa", "website", "site"],
  contact_email: ["email contato", "e-mail contato", "email pessoal", "email do contato"],
  contact_phone: ["telefone contato", "tel contato", "fone contato", "whatsapp", "celular"],
  segment: ["segmento", "setor", "industria", "indústria", "mercado"],
  city: ["cidade", "municipio", "município"],
  state: ["estado", "uf"],
  fit_icp: ["fit icp", "fit", "icp", "aderencia icp", "aderência icp"],
  priority: ["prioridade", "prioridade icp", "ordem"],
  phone_notes: ["obs telefone", "observacao telefone", "observação telefone", "notas telefone", "telefone observacao", "telefone observação"],
  qualification_notes: ["observacao", "observação", "observacoes", "observações", "notas", "comentario", "comentário"],
  status: ["status", "etapa", "fase", "funil"],
};

export const normalizeImportValue = (value?: string | null) => (value || "").trim();

const normalizeImportCellValue = (value: ImportCellValue) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  return String(value).trim();
};

export const normalizeImportKey = (value?: string | null) =>
  normalizeImportValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeProspectOperation = (value?: string | null): Prospect["operation"] => {
  const normalized = normalizeImportKey(value);
  if (normalized.includes("blue")) return "BluePex";
  if (normalized.includes("opus")) return "Opus Tech";
  return "A definir";
};

export const parseProspectImportText = (text: string) => {
  const cleanText = text.replace(/^\uFEFF/, "");
  const separatorLine = cleanText.match(/^sep\s*=\s*([,;\t])\s*(?:\r?\n|$)/i);
  const content = separatorLine ? cleanText.slice(separatorLine[0].length) : cleanText;
  const delimiter = separatorLine?.[1] || detectDelimiter(content);
  const rows = parseDelimitedText(content, delimiter);

  return parseProspectImportTable(rows);
};

export const parseProspectImportTable = (tableRows: ImportCellValue[][]) => {
  const rows = tableRows
    .map((row) => row.map(normalizeImportCellValue))
    .filter((row) => row.some((cell) => normalizeImportValue(cell)));

  if (rows.length < 2) {
    return { headers: [], rows: [] as ImportRow[] };
  }

  const headers = dedupeHeaders(rows[0].map((header, index) => normalizeImportValue(header) || `Coluna ${index + 1}`));
  const dataRows = rows.slice(1).map((row) =>
    headers.reduce<ImportRow>((acc, header, index) => {
      acc[header] = normalizeImportValue(row[index]);
      return acc;
    }, {})
  );

  return { headers, rows: dataRows };
};

export const guessProspectImportMapping = (headers: string[]): ImportFieldMapping => {
  const mapping = emptyImportMapping();
  const usedHeaders = new Set<string>();

  IMPORT_FIELDS.forEach(({ key }) => {
    const matchedHeader = findBestHeaderForField(key, headers.filter((header) => !usedHeaders.has(header)));

    if (matchedHeader) {
      mapping[key] = matchedHeader;
      usedHeaders.add(matchedHeader);
    }
  });

  return mapping;
};

export const emptyImportMapping = (): ImportFieldMapping =>
  IMPORT_FIELDS.reduce<ImportFieldMapping>((acc, field) => {
    acc[field.key] = NO_IMPORT_FIELD;
    return acc;
  }, {} as ImportFieldMapping);

export const buildProspectFromImportRow = (
  row: ImportRow,
  mapping: ImportFieldMapping,
  defaultStatus: string,
  availableStatuses: string[],
  defaultOperation: Prospect["operation"] = "A definir",
): Partial<Prospect> => {
  const read = (key: ImportFieldKey) => {
    const column = mapping[key];
    return column && column !== NO_IMPORT_FIELD ? normalizeImportValue(row[column]) : "";
  };

  const statusFromSheet = read("status");
  const matchedStatus = availableStatuses.find(
    (status) => normalizeImportKey(status) === normalizeImportKey(statusFromSheet),
  );
  const personas = [
    {
      name: read("contact_name"),
      role: read("role") || undefined,
      linkedin_url: read("linkedin_url") || undefined,
      email: read("contact_email") || undefined,
      phone: read("contact_phone") || undefined,
    },
    {
      name: read("contact_name_2"),
      role: read("role_2") || undefined,
      linkedin_url: read("linkedin_url_2") || undefined,
      email: read("contact_email_2") || undefined,
      phone: read("contact_phone_2") || undefined,
    },
    {
      name: read("contact_name_3"),
      role: read("role_3") || undefined,
      linkedin_url: read("linkedin_url_3") || undefined,
      email: read("contact_email_3") || undefined,
      phone: read("contact_phone_3") || undefined,
    },
  ].filter((persona) => persona.name);
  const primaryPersona = personas[0];
  const operationFromSheet = read("operation");
  const structuredNotes = [
    ["Segmento", read("segment")],
    ["Cidade", [read("city"), read("state")].filter(Boolean).join("/")],
    ["Site", read("company_website")],
    ["Fit ICP", read("fit_icp")],
    ["Prioridade", read("priority")],
    ["Obs. telefone", read("phone_notes")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const qualificationNotes = [read("qualification_notes"), structuredNotes].filter(Boolean).join("\n");

  return {
    company: read("company"),
    operation: operationFromSheet ? normalizeProspectOperation(operationFromSheet) : defaultOperation,
    contact_name: primaryPersona?.name || "",
    role: primaryPersona?.role,
    linkedin_url: primaryPersona?.linkedin_url,
    company_email: read("company_email") || undefined,
    company_phone: read("company_phone") || undefined,
    contact_email: primaryPersona?.email,
    contact_phone: primaryPersona?.phone,
    personas,
    qualification_notes: qualificationNotes || undefined,
    status: matchedStatus || defaultStatus,
  };
};

const detectDelimiter = (text: string) => {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const delimiters = ["\t", ";", ","];
  return delimiters.reduce((best, delimiter) => {
    const count = (sample.match(new RegExp(escapeRegExp(delimiter), "g")) || []).length;
    const bestCount = (sample.match(new RegExp(escapeRegExp(best), "g")) || []).length;
    return count > bestCount ? delimiter : best;
  }, ",");
};

const parseDelimitedText = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
};

const dedupeHeaders = (headers: string[]) => {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const count = seen.get(header) || 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header} ${count + 1}`;
  });
};

const findBestHeaderForField = (field: ImportFieldKey, headers: string[]) => {
  const hints = HEADER_HINTS[field].map(normalizeImportKey);
  const candidates = headers
    .map((header, index) => ({
      header,
      index,
      score: getHeaderMatchScore(field, normalizeImportKey(header), hints),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return candidates[0]?.header;
};

const getHeaderMatchScore = (field: ImportFieldKey, normalizedHeader: string, hints: string[]) => {
  if (!normalizedHeader) return 0;

  if (field === "contact_name" && normalizedHeader.includes("empresa")) return 0;
  if (field === "company" && ["site", "website", "dominio"].some((word) => normalizedHeader.includes(word))) return 0;
  if (field === "company" && normalizedHeader.includes("contato")) return 0;
  if (field === "company_email" && normalizedHeader.includes("contato")) return 0;
  if (field === "contact_email" && normalizedHeader.includes("empresa")) return 0;
  if (field === "company_phone" && normalizedHeader.includes("contato")) return 0;
  if (field === "contact_phone" && normalizedHeader.includes("empresa")) return 0;
  if (field === "qualification_notes" && normalizedHeader.includes("telefone")) return 0;
  if (field.endsWith("_2") && !normalizedHeader.includes("2")) return 0;
  if (field.endsWith("_3") && !normalizedHeader.includes("3")) return 0;

  if (["email", "e-mail", "mail"].includes(normalizedHeader)) {
    if (field === "company_email") return 0;
    if (field === "contact_email") return 95;
  }

  if (["telefone", "tel", "fone", "whatsapp", "celular"].includes(normalizedHeader)) {
    if (field === "company_phone") return 0;
    if (field === "contact_phone") return 95;
  }

  return hints.reduce((bestScore, hint) => {
    let score = 0;

    if (normalizedHeader === hint) {
      score = 100;
    } else if (normalizedHeader.startsWith(hint)) {
      score = 80;
    } else if (normalizedHeader.includes(hint)) {
      score = 60;
    } else if (hint.includes(normalizedHeader) && normalizedHeader.length > 3) {
      score = 30;
    }

    if (score === 0) return bestScore;
    return Math.max(bestScore, score + Math.min(hint.length, 20) / 100);
  }, 0);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
