import { describe, expect, it } from "vitest";
import { initialImportData } from "./initialImportData";

describe("jeu d’import initial IGS et référentiels Guinée & Afrique de l'Ouest", () => {
  it("reprend les 54 dossiers réellement extraits du fichier Excel source", () => {
    expect(initialImportData.dossiers).toHaveLength(54);
    expect(initialImportData.dossiers[0]).toMatchObject({
      dossierNumber: "DOS-0001",
      client: "Guinean Birimian Gold S.A",
      transportMode: "Maritime",
    });
  });

  it("embarque les référentiels maritimes et douaniers adaptés aux réalités ouest-africaines", () => {
    expect(initialImportData.referenceItems.length).toBeGreaterThan(200);

    const categories = new Set(initialImportData.referenceItems.map(r => r.category));
    expect(categories.has("port_origine")).toBe(true);
    expect(categories.has("port_destination")).toBe(true);
    expect(categories.has("regime")).toBe(true);
    expect(categories.has("devise")).toBe(true);
    expect(categories.has("statut_douane")).toBe(true);
    expect(categories.has("alerte_terrain")).toBe(true);

    const labels = initialImportData.referenceItems.map(r => r.label);
    expect(labels).toContain("Port Autonome de Conakry (PAC)");
    expect(labels).toContain("Port Minéralier de Kamsar");
    expect(labels).toContain("Port Autonome de San Pedro (Côte d'Ivoire)");
    expect(labels).toContain("Port Autonome de Dakar (Sénégal)");
    expect(labels).toContain("GNF (Franc Guinéen)");
    expect(labels).toContain("USD (Dollar US)");
    expect(labels).toContain("DDI - Demande de Déclaration d'Importation (GUCEG)");
    expect(labels).toContain("Déclaration douane SYDONIA World");
  });
});
