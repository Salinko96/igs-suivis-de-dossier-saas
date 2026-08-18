import { describe, expect, it } from "vitest";
import { initialImportData } from "./initialImportData";

describe("jeu d’import initial IGS", () => {
  it("reprend les 54 dossiers réellement extraits du fichier Excel source", () => {
    expect(initialImportData.dossiers).toHaveLength(54);
    expect(initialImportData.dossiers[0]).toMatchObject({
      dossierNumber: "DOS-0001",
      client: "Guinean Birimian Gold S.A",
      transportMode: "Maritime",
    });
  });

  it("embarque les référentiels source pour les listes déroulantes", () => {
    expect(initialImportData.referenceItems.length).toBeGreaterThan(100);
    expect(initialImportData.referenceItems).toContainEqual({ category: "mode_transport", label: "Maritime", sortOrder: 1 });
    expect(initialImportData.referenceItems).toContainEqual({ category: "statut_douane", label: "Dédouané", sortOrder: 7 });
  });
});
