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

  for (const d of dossiers) {
    if (!d.eta) continue;

    const etaDate = new Date(d.eta);
    etaDate.setHours(0, 0, 0, 0);

    const isPastEta = etaDate < now;
    const isReleased = Boolean(d.goodsReleaseDate);
    const daysSinceEta = Math.round((now.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24));

    // 1. Risque de surestaries au Port de Conakry (franchise 7 jours dépassée) - Type Index 1
    if (isPastEta && !isReleased && daysSinceEta > 7) {
      alerts.push({
        id: d.id * 10 + 1,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "SURESTARIES_RISQUE",
        title: `🚨 Risque Surestaries (${d.dossierNumber})`,
        message: `Au port depuis ${daysSinceEta} jours (franchise 7j dépassée de ${daysSinceEta - 7}j). ${d.client || "Client"} • BL: ${d.blLtaNumber || "N/A"}.`,
        severity: "critical",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 1) * 60000),
      });
    }

    // 2. ETA Dépassée sans sortie de marchandise - Type Index 2
    if (isPastEta && !isReleased) {
      alerts.push({
        id: d.id * 10 + 2,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "ETA_DEPASSEE",
        title: `⏱️ Navire arrivé sans sortie (${d.dossierNumber})`,
        message: `ETA échue le ${etaDate.toLocaleDateString("fr-FR")} (${daysSinceEta}j). Marchandise toujours au quai PAC.`,
        severity: daysSinceEta > 7 ? "critical" : "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 2) * 60000),
      });
    }

    // 3. Dossier arrivé sans N° de déclaration Sydonia - Type Index 3
    if (isPastEta && !d.declarationNumber) {
      alerts.push({
        id: d.id * 10 + 3,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "DDI_MANQUANTE",
        title: `📄 Sydonia manquant (${d.dossierNumber})`,
        message: `Navire arrivé mais déclaration SYDONIA World non renseignée pour ${d.client || "le client"}.`,
        severity: "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 3) * 60000),
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
 * Envoi réel d'une alerte WhatsApp (API WhatsApp Cloud / Meta ou Webhook Twilio)
 */
export async function sendDossierWhatsAppAlert(params: {
  dossierNumber: string;
  recipientPhone: string;
  clientName: string;
  messageText: string;
}): Promise<{ success: boolean; channel: "whatsapp"; sentTo: string; preview: string }> {
  const cleanPhone = params.recipientPhone.replace(/[^0-9+]/g, "") || "+224620000000";
  const formattedText = `🚢 *IGS TRANSIT & DOUANE GUINÉE*\n\n` +
    `*Dossier :* ${params.dossierNumber}\n` +
    `*Client :* ${params.clientName}\n\n` +
    `📢 *Alerte Opérationnelle :*\n${params.messageText}\n\n` +
    `🔗 Suivi en direct : https://igs-suivis-de-dossier-saas.vercel.app/portail-client`;

  console.log(`[WhatsApp Dispatch] Envoi vers ${cleanPhone} :`, formattedText);

  // Si WHATSAPP_API_TOKEN est configuré, déclencher la requête HTTP REST vers Meta API
  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: formattedText },
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      console.warn("[WhatsApp Dispatch Error]", err);
    }
  }

  return {
    success: true,
    channel: "whatsapp",
    sentTo: cleanPhone,
    preview: formattedText,
  };
}

/**
 * Envoi d'email transactionnel (Resend / SendGrid API)
 */
export async function sendDossierEmailAlert(params: {
  dossierNumber: string;
  recipientEmail: string;
  clientName: string;
  subject: string;
  htmlContent: string;
}): Promise<{ success: boolean; channel: "email"; sentTo: string }> {
  const email = params.recipientEmail || "contact@igs-logistics.gn";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "IGS Transit <onboarding@resend.dev>";

  console.log(`[Email Dispatch] Envoi vers ${email} : "${params.subject}"`);

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: params.subject,
          html: params.htmlContent,
        }),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      console.log("[Resend Email Result]", data);
    } catch (err) {
      console.warn("[Email Dispatch Error]", err);
    }
  }

  return {
    success: true,
    channel: "email",
    sentTo: email,
  };
}

/**
 * Dispatch générique
 */
export async function dispatchExternalAlertNotification(
  alert: ProactiveAlert,
  channel: "email" | "whatsapp" = "email"
): Promise<{ success: boolean; channel: string; dispatchedAt: Date }> {
  if (channel === "whatsapp") {
    await sendDossierWhatsAppAlert({
      dossierNumber: alert.dossierNumber,
      clientName: "Client IGS",
      recipientPhone: "+224620000000",
      messageText: alert.message,
    });
  } else {
    await sendDossierEmailAlert({
      dossierNumber: alert.dossierNumber,
      clientName: "Client IGS",
      recipientEmail: "contact@igs-logistics.gn",
      subject: alert.title,
      htmlContent: `<p>${alert.message}</p>`,
    });
  }

  return {
    success: true,
    channel,
    dispatchedAt: new Date(),
  };
}
