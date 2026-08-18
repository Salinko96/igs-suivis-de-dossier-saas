import { describe, expect, it } from "vitest";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";

const completeDossier = {
  clientDossierNumber: "CKY8126000377",
  client: "Guinean Birimian Gold S.A",
  blLtaNumber: "NGP3626648",
  cargoNature: "Cyanure de sodium",
  transportMode: "Maritime",
  eta: new Date("2026-07-30"),
  originPort: "Ningbo port-china",
  destinationPort: "Port Autonome de Conakry",
  container: "5x 20 st",
  goodsReleaseDate: new Date("2026-08-01"),
  declarationNumber: "S 132- 20/07/2026",
  bulletinNumber: "L 1723 Du 21/07/2026",
};

describe("règles de régularisation", () => {
  it("régularise un dossier lorsque tous les champs métier requis sont complétés", () => {
    expect(calculateDossierState(completeDossier)).toMatchObject({
      calculatedStatus: "Régularisé",
      calculatedPriority: "Basse",
      completionRate: 100,
      missingFields: [],
    });
  });

  it("attribue la priorité haute quand un élément obligatoire est absent", () => {
    const state = calculateDossierState({ ...completeDossier, bulletinNumber: null, container: null, bulk: null });
    expect(state.calculatedStatus).toBe("À régulariser");
    expect(state.calculatedPriority).toBe("Haute");
    expect(state.missingFields).toContain("bulletinNumber");
    expect(state.missingFields).toContain("container");
  });

  it("formate la numérotation métier DOS-XXXX", () => {
    expect(formatDossierNumber(55)).toBe("DOS-0055");
  });
});
