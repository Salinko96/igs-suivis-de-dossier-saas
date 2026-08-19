import type { Dossier, Notification } from "../drizzle/schema";

export interface ProactiveAlert {
  id: number;
  dossierId: number;
  dossierNumber: string;
  type: "ETA_DEPASSEE" | "SURESTARIES_RISQUE" | "BULLETIN_MANQUANT" | "DDI_MANQUANTE" | "STATUT_MODIFIE";
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  isRead: number;
  createdAt: Date;
}

export function generateProactiveAlerts(dossiers: Dossier[]): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let idCounter = 1;

  for (const d of dossiers) {
    if (!d.eta) continue;

    const etaDate = new Date(d.eta);
    etaDate.setHours(0, 0, 0, 0);

    const isPastEta = etaDate < now;
    const isReleased = Boolean(d.goodsReleaseDate);
    const daysSinceEta = Math.round((now.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24));

    // 1. Risque de surestaries au Port de Conakry (franchise 7 jours dépassée)
    if (isPastEta && !isReleased && daysSinceEta > 7) {
      alerts.push({
        id: idCounter++,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "SURESTARIES_RISQUE",
        title: `🚨 Risque Surestaries (${d.dossierNumber})`,
        message: `Au port depuis ${daysSinceEta} jours (franchise 7j dépassée de ${daysSinceEta - 7}j). ${d.client || "Client"} • BL: ${d.blLtaNumber || "N/A"}.`,
        severity: "critical",
        isRead: 0,
        createdAt: new Date(Date.now() - (idCounter * 60000)),
      });
    }

    // 2. ETA Dépassée sans sortie de marchandise
    if (isPastEta && !isReleased) {
      alerts.push({
        id: idCounter++,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "ETA_DEPASSEE",
        title: `⏱️ Navire arrivé sans sortie (${d.dossierNumber})`,
        message: `ETA échue le ${etaDate.toLocaleDateString("fr-FR")} (${daysSinceEta}j). Marchandise toujours au quai PAC.`,
        severity: daysSinceEta > 7 ? "critical" : "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (idCounter * 120000)),
      });
    }

    // 3. Dossier arrivé sans N° de déclaration Sydonia
    if (isPastEta && !d.declarationNumber) {
      alerts.push({
        id: idCounter++,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "DDI_MANQUANTE",
        title: `📄 Sydonia manquant (${d.dossierNumber})`,
        message: `Navire arrivé mais déclaration SYDONIA World non renseignée pour ${d.client || "le client"}.`,
        severity: "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (idCounter * 180000)),
      });
    }
  }

  // Trier les alertes par sévérité critique puis par date
  return alerts.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Hook / Interface pour les futurs canaux de notification externes (Email Resend / WhatsApp)
 */
export async function dispatchExternalAlertNotification(
  alert: ProactiveAlert,
  channel: "email" | "whatsapp" = "email"
): Promise<{ success: boolean; channel: string; dispatchedAt: Date }> {
  // Préparation de l'intégration Resend / WhatsApp API
  console.log(`[AlertService] Dispatching ${alert.type} via ${channel} to responsible team:`, {
    dossier: alert.dossierNumber,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
  });

  return {
    success: true,
    channel,
    dispatchedAt: new Date(),
  };
}
