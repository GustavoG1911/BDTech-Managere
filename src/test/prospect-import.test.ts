import { describe, expect, it } from "vitest";
import {
  buildProspectFromImportRow,
  emptyImportMapping,
  guessProspectImportMapping,
  parseProspectImportTable,
  parseProspectImportText,
} from "@/lib/prospect-import";

describe("prospect import parsing", () => {
  it("keeps CSV support and ignores Excel separator hints", () => {
    const parsed = parseProspectImportText("sep=;\nEmpresa;Nome do contato;Email\nAcme;Ana;ana@acme.com");
    const mapping = guessProspectImportMapping(parsed.headers);

    expect(parsed.headers).toEqual(["Empresa", "Nome do contato", "Email"]);
    expect(parsed.rows).toHaveLength(1);
    expect(mapping.company).toBe("Empresa");
    expect(mapping.contact_name).toBe("Nome do contato");
    expect(mapping.contact_email).toBe("Email");
  });

  it("parses XLSX-style tables through the same import shape", () => {
    const parsed = parseProspectImportTable([
      ["Empresa", "Contato", "Cargo", "Contato 2", "Cargo 2"],
      ["Opus", "Bruno", "CTO", "Carla", "CFO"],
    ]);
    const mapping = guessProspectImportMapping(parsed.headers);
    const prospect = buildProspectFromImportRow(parsed.rows[0], mapping, "Mapeamento", ["Mapeamento"]);

    expect(parsed.rows).toHaveLength(1);
    expect(prospect.company).toBe("Opus");
    expect(prospect.contact_name).toBe("Bruno");
    expect(prospect.personas).toEqual([
      expect.objectContaining({ name: "Bruno", role: "CTO" }),
      expect.objectContaining({ name: "Carla", role: "CFO" }),
    ]);
  });
});
