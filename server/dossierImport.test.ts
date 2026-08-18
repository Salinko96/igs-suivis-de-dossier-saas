import { describe, expect, it } from "vitest";
import { importDossiersBatch, listDossiers } from "./db";

describe("Dossiers Batch Import Engine (Anti-Doublons & Automatisations)", () => {
  it("crée les dossiers lors d'un premier import et met à jour sans créer de doublon lors du second", async () => {
    const itemA = {
      clientDossierNumber: "CKY-TEST-001",
      client: "Guinee Mining Test",
      blLtaNumber: "BL-TEST-9999",
      cargoNature: "Acier industriel",
      transportMode: "Maritime",
      eta: new Date("2026-09-15"),
      originPort: "Ningbo",
      destinationPort: "Port Autonome de Conakry",
      container: "2x 40' HC",
      declarationNumber: null,
      bulletinNumber: null,
    };

    // 1er import
    const result1 = await importDossiersBatch([itemA], 1, "Test Opérateur");
    expect(result1.total).toBe(1);
    expect(result1.createdCount).toBe(1);
    expect(result1.updatedCount).toBe(0);

    // 2nd import avec des informations complémentaires (N° Déclaration + Bulletin)
    const itemA_updated = {
      ...itemA,
      declarationNumber: "S 1422026",
      bulletinNumber: "L 18882026",
      goodsReleaseDate: new Date("2026-09-20"),
    };

    const result2 = await importDossiersBatch([itemA_updated], 1, "Test Opérateur");
    expect(result2.total).toBe(1);
    expect(result2.createdCount).toBe(0);
    expect(result2.updatedCount).toBe(1);
    expect(result2.duplicatesPrevented).toBe(1);

    // Vérifier que le dossier a bien été mis à jour avec le nouveau statut régularisé
    const all = await listDossiers({ search: "BL-TEST-9999" });
    expect(all.length).toBe(1);
    expect(all[0].declarationNumber).toBe("S 1422026");
    expect(all[0].bulletinNumber).toBe("L 18882026");
    expect(all[0].calculatedStatus).toBe("Régularisé");
  });
});
