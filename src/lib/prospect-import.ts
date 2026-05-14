import { Prospect } from "./types";

export type ImportFieldKey =
  | "company"
  | "operation"
  | "contact_name"
  | "role"
  | "linkedin_url"
  | "company_email"
  | "company_phone"
  | "contact_email"
  | "contact_phone"
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
  { key: "company_email", label: "Email da empresa" },
  { key: "company_phone", label: "Telefone da empresa" },
  { key: "contact_email", label: "Email do contato" },
  { key: "contact_phone", label: "Telefone do contato" },
  { key: "qualification_notes", label: "Observações" },
  { key: "status", label: "Etapa do funil" },
];

const HEADER_HINTS: Record<ImportFieldKey, string[]> = {
  company: ["empresa", "conta", "organizacao", "organização", "companhia", "cliente", "nome da empresa"],
  contact_name: ["contato", "nome", "decisor", "lead", "responsavel", "responsável", "pessoa"],
  role: ["cargo", "funcao", "função", "posicao", "posição"],
  operation: ["operacao", "produto", "unidade", "empresa alvo", "bluepex", "opus"],
  linkedin_url: ["linkedin", "linked in", "perfil"],
  company_email: ["email empresa", "e-mail empresa", "email corporativo", "email da empresa"],
  company_phone: ["telefone empresa", "tel empresa", "fone empresa", "whatsapp empresa"],
  contact_email: ["email contato", "e-mail contato", "email pessoal", "email do contato"],
  contact_phone: ["telefone contato", "tel contato", "fone contato", "whatsapp", "celular"],
  qualification_notes: ["observacao", "observação", "observacoes", "observações", "notas", "comentario", "comentário"],
  status: ["status", "etapa", "fase", "funil"],
};

export const normalizeImportValue = (value?: string | null) => (value || "").trim();

export const normalizeImportKey = (value?: string | null) =>
  normalizeImportValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

export const normalizeProspectOperation = (value?: string | null): Prospect["operation"] => {
  const normalized = normalizeImportKey(value);
  if (normalized.includes("blue")) return "BluePex";
  if (normalized.includes("opus")) return "Opus Tech";
  return "A definir";
};

export const parseProspectImportText = (text: string) => {
  const cleanText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(cleanText);
  const rows = parseDelimitedText(cleanText, delimiter).filter((row) => row.some((cell) => normalizeImportValue(cell)));

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
): Partial<Prospect> => {
  const read = (key: ImportFieldKey) => {
    const column = mapping[key];
    return column && column !== NO_IMPORT_FIELD ? normalizeImportValue(row[column]) : "";
  };

  const statusFromSheet = read("status");
  const matchedStatus = availableStatuses.find(
    (status) => normalizeImportKey(status) === normalizeImportKey(statusFromSheet),
  );

  return {
    company: read("company"),
    operation: normalizeProspectOperation(read("operation")),
    contact_name: read("contact_name"),
    role: read("role") || undefined,
    linkedin_url: read("linkedin_url") || undefined,
    company_email: read("company_email") || undefined,
    company_phone: read("company_phone") || undefined,
    contact_email: read("contact_email") || undefined,
    contact_phone: read("contact_phone") || undefined,
    qualification_notes: read("qualification_notes") || undefined,
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
  if (field === "company" && normalizedHeader.includes("contato")) return 0;
  if (field === "company_email" && normalizedHeader.includes("contato")) return 0;
  if (field === "contact_email" && normalizedHeader.includes("empresa")) return 0;
  if (field === "company_phone" && normalizedHeader.includes("contato")) return 0;
  if (field === "contact_phone" && normalizedHeader.includes("empresa")) return 0;

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

    return Math.max(bestScore, score + Math.min(hint.length, 20) / 100);
  }, 0);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
