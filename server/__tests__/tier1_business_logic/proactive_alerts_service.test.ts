import { describe, expect, it } from "vitest";
import { generateProactiveAlerts, dispatchExternalAlertNotification } from "../../alertsService";
import type { Dossier } from "../../../drizzle/schema";

describe("Proactive Alerts Service & Demurrage Detection (R3)", () => {
  const baseDossier: Dossier = {
    id: 1,
    dossierNumber: "DOS-0001",
    clientDossierNumber: "CKY-001",
    client: "Guinean Birimian Gold S.A",
    blLtaNumber: "HLCUNG12604AUQG1",
    cargoNature: "Tubes d'acier",
    transportMode: "Maritime",
    eta: new Date("2026-08-01T00:00:00Z"), // 18 jours écoulés
    originPort: "Ningbo",
    destinationPort: "Port Autonome de Conakry",
    container: "02TC40'",
    bulk: null,
    goodsReleaseDate: null, // Toujours au quai
    declarationNumber: null,
    bulletinNumber: null,
    finalDeclarationNumber: null,
    ddiGucegNumber: null,
    badStatus: null,
    baeStatus: null,
    calculatedStatus: "À régulariser",
    calculatedPriority: "Haute",
    completionRate: 50,
    documentStatus: null,
    customsStatus: null,
    portStatus: null,
    financialStatus: null,
    fieldOperation: null,
    responsible: "Mamadou Diallo",
    nextAction: null,
    fieldAlert: null,
    deliveryLocation: null,
    declarant: null,
    service: "Transit",
    regime: "IM4",
    notes: null,
    portalAccessCode: "IGS-1001",
    createdById: 1,
    updatedById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("1. Détecte une alerte de surestaries critique si la marchandise est au port depuis plus de 7 jours", () => {
    const alerts = generateProactiveAlerts([baseDossier]);
    const demurrageAlert = alerts.find(a => a.type === "SURESTARIES_RISQUE");
    expect(demurrageAlert).toBeDefined();
    expect(demurrageAlert?.severity).toBe("critical");
    expect(demurrageAlert?.dossierNumber).toBe("DOS-0001");
    expect(demurrageAlert?.message).toContain("franchise 7j dépassée");
  });

  it("2. Détecte une alerte ETA dépassée si le navire est arrivé sans date de sortie de marchandise", () => {
    const alerts = generateProactiveAlerts([baseDossier]);
    const etaAlert = alerts.find(a => a.type === "ETA_DEPASSEE");
    expect(etaAlert).toBeDefined();
    expect(etaAlert?.dossierNumber).toBe("DOS-0001");
  });

  it("3. Ne génère pas d'alerte de surestaries si la marchandise a été enlevée à temps", () => {
    const clearedDossier: Dossier = {
      ...baseDossier,
      id: 2,
      dossierNumber: "DOS-0002",
      goodsReleaseDate: new Date("2026-08-04T00:00:00Z"), // Sorti après 3 jours (dans la franchise)
    };
    const alerts = generateProactiveAlerts([clearedDossier]);
    const demurrageAlert = alerts.find(a => a.dossierNumber === "DOS-0002" && a.type === "SURESTARIES_RISQUE");
    expect(demurrageAlert).toBeUndefined();
  });

  it("4. Prépare le hook d'envoi externe (Resend email / WhatsApp) sans erreur", async () => {
    const mockAlert = {
      id: 99,
      dossierId: 1,
      dossierNumber: "DOS-0001",
      type: "SURESTARIES_RISQUE" as const,
      title: "Surestaries",
      message: "Test message",
      severity: "critical" as const,
      isRead: 0,
      createdAt: new Date(),
    };

    const res = await dispatchExternalAlertNotification(mockAlert, "email");
    expect(res.success).toBe(true);
    expect(res.channel).toBe("email");
  });
});
