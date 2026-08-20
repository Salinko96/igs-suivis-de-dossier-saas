import * as db from "./db";
import { calculateDemurrageRisk, DemurrageRiskInfo } from "./dossierRules";
import { sendDossierWhatsAppAlert, sendDossierEmailAlert } from "./alertsService";

export interface DemurrageScanResult {
  timestamp: string;
  totalDossiersScanned: number;
  unreleasedDossiersCount: number;
  j2WarningCount: number;
  overdueCount: number;
  alertsSentCount: number;
  details: Array<{
    dossierId: number;
    dossierNumber: string;
    client: string;
    blLtaNumber: string;
    eta: string;
    daysOnQuay: number;
    riskStatus: string;
    alertDispatched: boolean;
  }>;
}

/**
 * Job de relance automatique pour la franchise portuaire PAC (7 jours)
 * Déclenche les alertes J-2 et surestaries dépassées
 */
export async function runDemurrageReminderJob(): Promise<DemurrageScanResult> {
  const allDossiers = await db.listDossiers();
  const unreleased = allDossiers.filter(d => !d.goodsReleaseDate && d.eta);
  const now = new Date();

  let j2Count = 0;
  let overdueCount = 0;
  let alertsCount = 0;
  const details: DemurrageScanResult["details"] = [];

  for (const dossier of unreleased) {
    const risk = calculateDemurrageRisk(dossier.eta, dossier.goodsReleaseDate, 7, now);

    if (risk.isRisk) {
      if (risk.isWarningJ2) j2Count++;
      if (risk.isOverdue) overdueCount++;

      let alertMessage = "";
      if (risk.isWarningJ2) {
        alertMessage = `⚠️ [ALERTE FRANCHISE J-2] Le dossier ${dossier.dossierNumber} (BL: ${dossier.blLtaNumber || "N/A"}) pour ${dossier.client || "Client"} arrive à expiration de franchise portuaire dans ${risk.daysRemaining} jour(s) (Quai PAC). Procédez d'urgence à la sortie marchandise.`;
      } else if (risk.isOverdue) {
        alertMessage = `🚨 [SURESTARIE DÉPASSÉE (+${risk.daysOverFreeTime}j)] Le dossier ${dossier.dossierNumber} (BL: ${dossier.blLtaNumber || "N/A"}) pour ${dossier.client || "Client"} est en dépassement de franchise depuis ${risk.daysOverFreeTime} jour(s). Frais de surestaries en cours au Port Autonome de Conakry.`;
      }

      // Envoi de notification persistée
      await db.addNotification({
        dossierId: dossier.id,
        dossierNumber: dossier.dossierNumber,
        type: "SURESTARIES_RISQUE",
        title: risk.isWarningJ2 ? "Risque Surestarie Portuaire (J-2)" : "Dépassement de Franchise PAC",
        message: alertMessage,
        recipientRole: "declarant",
        recipientEmail: "transit@igs-logistics.gn",
      });

      // Dispatch WhatsApp vers déclarant / responsable
      sendDossierWhatsAppAlert({
        dossierNumber: dossier.dossierNumber,
        clientName: dossier.client || "Client IGS",
        recipientPhone: "+224621001122",
        messageText: alertMessage,
      });

      // Dispatch Email
      sendDossierEmailAlert({
        dossierNumber: dossier.dossierNumber,
        clientName: dossier.client || "Client IGS",
        recipientEmail: "logistique@igs-logistics.gn",
        subject: `[URGENT] ${risk.statusLabel} — Dossier ${dossier.dossierNumber}`,
        htmlContent: `<p>${alertMessage}</p>`,
      });

      alertsCount++;
      details.push({
        dossierId: dossier.id,
        dossierNumber: dossier.dossierNumber,
        client: dossier.client || "Non renseigné",
        blLtaNumber: dossier.blLtaNumber || "Non renseigné",
        eta: dossier.eta ? new Date(dossier.eta).toISOString().slice(0, 10) : "N/A",
        daysOnQuay: risk.daysOnQuay,
        riskStatus: risk.statusLabel,
        alertDispatched: true,
      });
    }
  }

  return {
    timestamp: now.toISOString(),
    totalDossiersScanned: allDossiers.length,
    unreleasedDossiersCount: unreleased.length,
    j2WarningCount: j2Count,
    overdueCount,
    alertsSentCount: alertsCount,
    details,
  };
}
