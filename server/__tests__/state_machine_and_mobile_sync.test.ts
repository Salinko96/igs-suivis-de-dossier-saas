import { describe, expect, it } from "vitest";
import * as db from "../db";
import { validateStatusTransition, calculateDemurrageRisk } from "../dossierRules";
import { runDemurrageReminderJob } from "../cronDemurrageReminders";
import { appRouter } from "../routers";

describe("State Machine, Mobile Quai Update & Demurrage Reminders Suite", () => {
  // 1. STATE MACHINE DES STATUTS DOUANIERS
  describe("1. Customs Status State Machine & Transition Rules", () => {
    it("rejects transition to 'Régularisé' if goodsReleaseDate is missing", () => {
      const mockDossier = {
        clientDossierNumber: "DOS-0001",
        client: "Guinean Birimian Gold",
        declarationNumber: "DEC-2026-001",
        goodsReleaseDate: null,
      };

      const result = validateStatusTransition(mockDossier, "Régularisé");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("Date de sortie marchandise (goodsReleaseDate)");
      expect(result.error).toContain("Transition refusée");
    });

    it("rejects transition to 'Régularisé' if declarationNumber is missing", () => {
      const mockDossier = {
        clientDossierNumber: "DOS-0001",
        client: "Guinean Birimian Gold",
        declarationNumber: null,
        goodsReleaseDate: new Date("2026-08-20"),
      };

      const result = validateStatusTransition(mockDossier, "Régularisé");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("Numéro de déclaration douanière (declarationNumber)");
    });

    it("allows transition to 'Régularisé' when both goodsReleaseDate and declarationNumber are present", () => {
      const mockDossier = {
        clientDossierNumber: "DOS-0001",
        client: "Guinean Birimian Gold",
        declarationNumber: "DEC-2026-9999",
        goodsReleaseDate: new Date("2026-08-20"),
      };

      const result = validateStatusTransition(mockDossier, "Régularisé");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("allows transition when missing fields are provided in update payload", () => {
      const mockDossier = {
        clientDossierNumber: "DOS-0001",
        client: "Guinean Birimian Gold",
        declarationNumber: null,
        goodsReleaseDate: null,
      };

      const updateData = {
        declarationNumber: "DEC-SYDONIA-2026",
        goodsReleaseDate: new Date("2026-08-20"),
      };

      const result = validateStatusTransition(mockDossier, "Régularisé", updateData);
      expect(result.valid).toBe(true);
    });
  });

  // 2. CALCUL DES RISQUES DE SURESTARIES & RELANCES AUTOMATIQUES
  describe("2. Demurrage Risk Calculation & Automated Reminders", () => {
    it("detects J-2 warning when ETA was 5 days ago without goods release", () => {
      const referenceDate = new Date("2026-08-20T12:00:00Z");
      const eta5DaysAgo = new Date("2026-08-15T12:00:00Z"); // 5 days elapsed

      const risk = calculateDemurrageRisk(eta5DaysAgo, null, 7, referenceDate);
      expect(risk.daysOnQuay).toBe(5);
      expect(risk.isRisk).toBe(true);
      expect(risk.isWarningJ2).toBe(true);
      expect(risk.isOverdue).toBe(false);
      expect(risk.daysRemaining).toBe(2);
      expect(risk.statusLabel).toBe("Risque Surestarie (J-2)");
    });

    it("detects overdue demurrage when ETA was 10 days ago without goods release", () => {
      const referenceDate = new Date("2026-08-20T12:00:00Z");
      const eta10DaysAgo = new Date("2026-08-10T12:00:00Z"); // 10 days elapsed

      const risk = calculateDemurrageRisk(eta10DaysAgo, null, 7, referenceDate);
      expect(risk.daysOnQuay).toBe(10);
      expect(risk.isRisk).toBe(true);
      expect(risk.isOverdue).toBe(true);
      expect(risk.daysOverFreeTime).toBe(3); // 10 - 7
      expect(risk.statusLabel).toBe("Surestarie Dépassée");
    });

    it("returns resolved status when goodsReleaseDate is present", () => {
      const eta10DaysAgo = new Date("2026-08-10T12:00:00Z");
      const releaseDate = new Date("2026-08-14T12:00:00Z");

      const risk = calculateDemurrageRisk(eta10DaysAgo, releaseDate, 7);
      expect(risk.isRisk).toBe(false);
      expect(risk.isOverdue).toBe(false);
      expect(risk.statusLabel).toBe("Sorti");
    });

    it("executes runDemurrageReminderJob and dispatches alerts without errors", async () => {
      const scanResult = await runDemurrageReminderJob();
      expect(scanResult).toBeDefined();
      expect(scanResult.totalDossiersScanned).toBeGreaterThan(0);
      expect(typeof scanResult.unreleasedDossiersCount).toBe("number");
      expect(typeof scanResult.alertsSentCount).toBe("number");
      expect(Array.isArray(scanResult.details)).toBe(true);
    });
  });

  // 3. MISE À JOUR RAPIDE MOBILE POUR DÉCLARANTS QUAI
  describe("3. Mobile Quai Quick Update via tRPC", () => {
    it("executes quickUpdateMobile procedure for declarant", async () => {
      const declarantContext = {
        req: {} as any,
        res: {} as any,
        user: {
          id: 2,
          openId: "declarant-pac",
          name: "Mamadou Diallo (Déclarant Quai)",
          email: "m.diallo@igs-logistics.gn",
          role: "declarant" as const,
          isActive: true,
          clientCompany: null,
          phone: "+224621001122",
          sessionRevokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      };

      const caller = appRouter.createCaller(declarantContext);

      const res = await caller.dossier.quickUpdateMobile({
        dossierId: 1,
        goodsReleaseDate: "2026-08-20",
        declarationNumber: "DEC-2026-SYDONIA-01",
        badStatus: "Obtenu",
        baeStatus: "Obtenu",
        comment: "Marchandise sortie du quai 2 à 15h30.",
      });

      expect(res).toBeDefined();
      expect(res.goodsReleaseDate).toBeDefined();
      expect(res.declarationNumber).toBe("DEC-2026-SYDONIA-01");
      expect(res.badStatus).toBe("Obtenu");
      expect(res.baeStatus).toBe("Obtenu");
    });
  });
});
