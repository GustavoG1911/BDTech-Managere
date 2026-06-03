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

  it("maps one-row-per-persona ICP spreadsheets and preserves extra context", () => {
    const parsed = parseProspectImportText(
      "Nome,Cargo,Empresa,Segmento,Cidade,Estado,LinkedIn,Telefone_Empresa,Website_Empresa,Email,Fit_ICP,Prioridade,Obs_Telefone\n" +
      "Michael Vicentim,Diretor de Tecnologia e Inovação,A.Yoshii Engenharia,Construção,Londrina,PR,https://www.linkedin.com/in/michael-vicentim-83759457/,(43) 3371-1000,ayoshii.com.br,michael@ayoshii.com.br,Alto,1,Central sede",
    );
    const mapping = guessProspectImportMapping(parsed.headers);
    const prospect = buildProspectFromImportRow(parsed.rows[0], mapping, "Mapeamento", ["Mapeamento"], "Opus Tech");

    expect(mapping.company).toBe("Empresa");
    expect(mapping.contact_name).toBe("Nome");
    expect(mapping.role).toBe("Cargo");
    expect(mapping.linkedin_url).toBe("LinkedIn");
    expect(mapping.company_phone).toBe("Telefone_Empresa");
    expect(mapping.company_website).toBe("Website_Empresa");
    expect(mapping.contact_email).toBe("Email");
    expect(prospect.operation).toBe("Opus Tech");
    expect(prospect.company_phone).toBe("(43) 3371-1000");
    expect(prospect.qualification_notes).toContain("Segmento: Construção");
    expect(prospect.qualification_notes).toContain("Cidade: Londrina/PR");
    expect(prospect.qualification_notes).toContain("Site: ayoshii.com.br");
    expect(prospect.qualification_notes).toContain("Fit ICP: Alto");
    expect(prospect.qualification_notes).toContain("Prioridade: 1");
    expect(prospect.qualification_notes).toContain("Obs. telefone: Central sede");
  });
});
