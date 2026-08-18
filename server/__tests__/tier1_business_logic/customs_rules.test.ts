import { describe, expect, it } from "vitest";
import { calculateDossierState, formatDossierNumber, REQUIRED_DOSSIER_FIELDS } from "../../dossierRules";

/**
 * Fonctions et validateurs de logique douanière guinéenne (SYDONIA, GUCEG, PAC).
 */
export function validateSydoniaDeclaration(declarationNumber?: string | null): boolean {
  if (!declarationNumber) return false;
  // Format SYDONIA Guinée standard : "S <numéro>- <année/date>" ex: "S 142- 2026" ou "S 142- 27/07/2026"
  const sydoniaRegex = /^S\s*\d+[\s-]+\d{2,4}(\/\d{2}\/\d{4})?$/i;
  return sydoniaRegex.test(declarationNumber.trim());
}

export function validateBulletinLiquidation(bulletinNumber?: string | null): boolean {
  if (!bulletinNumber) return false;
  // Format Bulletin de Liquidation : "L <numéro>- <année>" ou "BLD-<numéro>"
  const bldRegex = /^(L\s*\d+[\s-]+\d{4}|BLD-?\d+)$/i;
  return bldRegex.test(bulletinNumber.trim());
}

export function validateDdiGuceg(ddiNumber?: string | null): boolean {
  if (!ddiNumber) return false;
  // Format DDI GUCEG : "DDI-2026-XXXX" ou "DDI-XXXX"
  const ddiRegex = /^DDI(-\d{4})?-\d+$/i;
  return ddiRegex.test(ddiNumber.trim());
}

export function calculateDemurrageRisk(
  eta: Date | null,
  goodsReleaseDate: Date | null,
  now: Date = new Date(),
  freeDays = 7
): { isAtRisk: boolean; daysInPort: number; demurrageDays: number } {
  if (!eta) return { isAtRisk: false, daysInPort: 0, demurrageDays: 0 };
  if (goodsReleaseDate) {
    const totalDays = Math.max(0, Math.round((goodsReleaseDate.getTime() - eta.getTime()) / 86400000));
    const demurrageDays = Math.max(0, totalDays - freeDays);
    return { isAtRisk: demurrageDays > 0, daysInPort: totalDays, demurrageDays };
  }
  const daysSinceEta = Math.round((now.getTime() - eta.getTime()) / 86400000);
  if (daysSinceEta <= 0) return { isAtRisk: false, daysInPort: 0, demurrageDays: 0 };
  const demurrageDays = Math.max(0, daysSinceEta - freeDays);
  return {
    isAtRisk: daysSinceEta > freeDays,
    daysInPort: daysSinceEta,
    demurrageDays,
  };
}

describe("Tier 1 - Pure Business Logic: Customs Rules & Dossier State Engine (R2)", () => {
  describe("1. Validation des Identifiants Douaniers (SYDONIA, BLD, DDI GUCEG)", () => {
    it("valide les numéros de déclaration SYDONIA World Guinée conformes", () => {
      expect(validateSydoniaDeclaration("S 142- 2026")).toBe(true);
      expect(validateSydoniaDeclaration("S 889- 27/07/2026")).toBe(true);
      expect(validateSydoniaDeclaration("S 0042- 2026")).toBe(true);
    });

    it("rejette les numéros de déclaration invalides ou vides", () => {
      expect(validateSydoniaDeclaration("")).toBe(false);
      expect(validateSydoniaDeclaration(null)).toBe(false);
      expect(validateSydoniaDeclaration("INVALID_NUMBER")).toBe(false);
      expect(validateSydoniaDeclaration("12345")).toBe(false);
    });

    it("valide les formats de Bulletin de Liquidation (BLD)", () => {
      expect(validateBulletinLiquidation("L 1723- 2026")).toBe(true);
      expect(validateBulletinLiquidation("BLD-202601")).toBe(true);
      expect(validateBulletinLiquidation("")).toBe(false);
      expect(validateBulletinLiquidation(null)).toBe(false);
    });

    it("valide les formats DDI du Guichet Unique GUCEG", () => {
      expect(validateDdiGuceg("DDI-2026-8890")).toBe(true);
      expect(validateDdiGuceg("DDI-4512")).toBe(true);
      expect(validateDdiGuceg("GUCEG-INVALID")).toBe(false);
    });
  });

  describe("2. Calcul Automatique de l'État du Dossier (calculateDossierState)", () => {
    const completeDossier = {
      clientDossierNumber: "GBG-2026-001",
      client: "Guinean Birimian Gold S.A",
      blLtaNumber: "MSC12345678",
      cargoNature: "Équipements d'extraction minière",
      transportMode: "Maritime",
      eta: new Date("2026-08-10"),
      originPort: "Anvers",
      destinationPort: "Port Autonome de Conakry",
      container: "4 x 40' HC",
      goodsReleaseDate: new Date("2026-08-15"),
      declarationNumber: "S 142- 2026",
      bulletinNumber: "L 1723- 2026",
    };

    it("calcule l'état 'Régularisé' avec priorité 'Basse' et 100% de complétion pour un dossier complet", () => {
      const result = calculateDossierState(completeDossier);
      expect(result.calculatedStatus).toBe("Régularisé");
      expect(result.calculatedPriority).toBe("Basse");
      expect(result.completionRate).toBe(100);
      expect(result.missingFields).toHaveLength(0);
    });

    it("identifie les champs manquants et positionne le dossier 'À régulariser' avec priorité 'Haute'", () => {
      const incompleteDossier = {
        ...completeDossier,
        declarationNumber: null,
        bulletinNumber: null,
        goodsReleaseDate: null,
      };

      const result = calculateDossierState(incompleteDossier);
      expect(result.calculatedStatus).toBe("À régulariser");
      expect(result.calculatedPriority).toBe("Haute");
      expect(result.completionRate).toBeLessThan(100);
      expect(result.missingFields).toContain("declarationNumber");
      expect(result.missingFields).toContain("bulletinNumber");
      expect(result.missingFields).toContain("goodsReleaseDate");
    });

    it("accepte soit un conteneur soit du vrac (bulk) comme condition d'emballage", () => {
      const bulkDossier = {
        ...completeDossier,
        container: null,
        bulk: "2 500 MT Bauxite vrac",
      };
      const result = calculateDossierState(bulkDossier);
      expect(result.calculatedStatus).toBe("Régularisé");
      expect(result.missingFields).not.toContain("container");

      const noPackagingDossier = {
        ...completeDossier,
        container: null,
        bulk: null,
      };
      const noPackagingResult = calculateDossierState(noPackagingDossier);
      expect(noPackagingResult.calculatedStatus).toBe("À régulariser");
      expect(noPackagingResult.missingFields).toContain("container");
    });

    it("formate correctement les numéros de dossiers IGS avec padding à 4 chiffres", () => {
      expect(formatDossierNumber(1)).toBe("DOS-0001");
      expect(formatDossierNumber(54)).toBe("DOS-0054");
      expect(formatDossierNumber(9999)).toBe("DOS-9999");
    });
  });

  describe("3. Détection des Risques de Surestaries & Franchise PAC", () => {
    it("détecte le risque de surestaries au-delà de la franchise de 7 jours au Port de Conakry", () => {
      const now = new Date("2026-08-20T00:00:00Z");
      const eta = new Date("2026-08-10T00:00:00Z"); // 10 jours écoulés

      const result = calculateDemurrageRisk(eta, null, now, 7);
      expect(result.isAtRisk).toBe(true);
      expect(result.daysInPort).toBe(10);
      expect(result.demurrageDays).toBe(3); // 10 - 7 = 3 jours facturables
    });

    it("indique aucun risque si le dossier est dans la franchise des 7 jours", () => {
      const now = new Date("2026-08-14T00:00:00Z");
      const eta = new Date("2026-08-10T00:00:00Z"); // 4 jours écoulés

      const result = calculateDemurrageRisk(eta, null, now, 7);
      expect(result.isAtRisk).toBe(false);
      expect(result.daysInPort).toBe(4);
      expect(result.demurrageDays).toBe(0);
    });

    it("clôture le calcul dès que la marchandise est enlevée (goodsReleaseDate)", () => {
      const now = new Date("2026-08-25T00:00:00Z");
      const eta = new Date("2026-08-10T00:00:00Z");
      const goodsReleaseDate = new Date("2026-08-14T00:00:00Z"); // Enlevé au 4e jour

      const result = calculateDemurrageRisk(eta, goodsReleaseDate, now, 7);
      expect(result.isAtRisk).toBe(false);
      expect(result.daysInPort).toBe(4);
      expect(result.demurrageDays).toBe(0);
    });
  });
});
