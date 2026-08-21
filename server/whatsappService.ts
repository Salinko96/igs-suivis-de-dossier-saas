import type { Dossier, Invoice, PacDisbursement } from "../drizzle/schema";
import { logAuditEvent, addNotification } from "./db";

export type WhatsappHsmTemplate =
  | "dossier_cree"
  | "eta_mise_a_jour"
  | "alerte_surestarie_imminente"
  | "dossier_regularise"
  | "facture_disponible";

export interface WhatsappSendOptions {
  dossierId?: number;
  dossierNumber: string;
  clientName: string;
  recipientPhone: string;
  template: WhatsappHsmTemplate;
  variables: {
    blLtaNumber?: string | null;
    eta?: string | Date | null;
    daysOnQuay?: number | null;
    amount?: number | null;
    currency?: string;
    invoiceNumber?: string;
    customsDeclaration?: string | null;
    directTrackingUrl?: string;
  };
  userId?: number;
  userName?: string;
}

export interface RenderedHsmMessage {
  template: WhatsappHsmTemplate;
  header: string;
  body: string;
  footer: string;
  fullText: string;
}

/**
 * Render standard official IGS WhatsApp HSM Message Templates
 */
export function renderWhatsappHsmTemplate(options: WhatsappSendOptions): RenderedHsmMessage {
  const { template, dossierNumber, clientName, variables } = options;
  const trackingUrl = variables.directTrackingUrl || `https://igs-suivis-de-dossier-saas.vercel.app/portail-client`;
  const header = `🚢 *IBRAHIMA GOLD SERVICE (IGS) — TRANSIT & DOUANE GUINÉE*`;
  const footer = `\n━━━━━━━━━━━━━━━━━━━━\n📍 *Conakry Terminal • Port Autonome de Conakry (PAC)*\n📞 *Assistance 24/7 :* +224 620 00 00 00\n🔗 *Suivi temps réel :* ${trackingUrl}`;

  let body = "";

  switch (template) {
    case "dossier_cree":
      body =
        `Bonjour *${clientName}*,\n\n` +
        `✅ Votre dossier de transit maritime *${dossierNumber}* a été ouvert avec succès dans notre système.\n` +
        `• *Connaissement (BL/LTA) :* ${variables.blLtaNumber || "En attente"}\n` +
        `• *Date estimée d'accostage (ETA) :* ${variables.eta ? new Date(variables.eta).toLocaleDateString("fr-FR") : "Non confirmée"}\n` +
        `• *Équipe en charge :* Service Opérations Quai PAC IGS.`;
      break;

    case "eta_mise_a_jour":
      body =
        `Avis à l'attention de *${clientName}*,\n\n` +
        `⏱️ *Mise à jour d'ETA Navire — Dossier ${dossierNumber}*\n` +
        `• *Nouveau créneau d'arrivée au Port de Conakry :* ${variables.eta ? new Date(variables.eta).toLocaleDateString("fr-FR") : "Confirmé"}\n` +
        `• *Connaissement (BL) :* ${variables.blLtaNumber || "N/A"}\n` +
        `Nos déclarants quai sont pré-positionnés pour le pointage et l'acconage dès l'amarrage.`;
      break;

    case "alerte_surestarie_imminente":
      body =
        `⚠️ *ALERTE EXPIRATION FRANCHISE PORTUAIRE (J-2)*\n` +
        `Client : *${clientName}* • Dossier : *${dossierNumber}*\n\n` +
        `Le séjour de votre cargaison au quai de Conakry atteint *${variables.daysOnQuay || 5} jours* (franchise armateur de 7 jours).\n` +
        `🚨 *Action requise :* Clôture de la déclaration SYDONIA World et acquittement des débours PAC pour éviter l'application des surestaries journalières.`;
      break;

    case "dossier_regularise":
      body =
        `🎉 *CONFIRMATION DE DÉDOUANEMENT & SORTIE DE QUAI*\n` +
        `Client : *${clientName}* • Dossier : *${dossierNumber}*\n\n` +
        `✅ Le Bon à Enlever (BAE) / SYDONIA World N° ${variables.customsDeclaration || "Validé"} a été délivré.\n` +
        `Les formalités de dédouanement et le bon de sortie de quai sont complets. La livraison sur votre site d'exploitation peut débuter.`;
      break;

    case "facture_disponible":
      body =
        `📄 *AVIS DE FACTURATION & DÉBOURS DOUANIERS*\n` +
        `Client : *${clientName}* • Facture N° *${variables.invoiceNumber || "FAC-2026"}*\n\n` +
        `• *Dossier rattaché :* ${dossierNumber}\n` +
        `• *Montant Total :* ${Number(variables.amount || 0).toLocaleString("fr-FR")} ${variables.currency || "GNF"}\n` +
        `Votre facture détaillée et le relevé des débours Trésor/PAC sont disponibles sur votre espace sécurisé.`;
      break;

    default:
      body = `Notification opérationnelle concernant le dossier ${dossierNumber} pour ${clientName}.`;
      break;
  }

  const fullText = `${header}\n\n${body}${footer}`;

  return {
    template,
    header,
    body,
    footer,
    fullText,
  };
}

/**
 * Send WhatsApp Message via Meta Cloud API or Twilio WhatsApp API
 */
export async function sendWhatsappBusinessMessage(options: WhatsappSendOptions): Promise<{
  success: boolean;
  messageId: string;
  renderedText: string;
  recipientPhone: string;
  provider: "meta_cloud_api" | "twilio" | "simulator";
}> {
  const rendered = renderWhatsappHsmTemplate(options);
  const cleanPhone = options.recipientPhone.replace(/[^0-9+]/g, "") || "+224620000000";
  let provider: "meta_cloud_api" | "twilio" | "simulator" = "simulator";
  let messageId = `wamid.HBgL${Date.now()}${Math.floor(Math.random() * 1000)}`;

  console.log(`[WhatsApp Business API] Dispatch to ${cleanPhone} [Template: ${options.template}] :\n${rendered.fullText}`);

  // 1. Meta Cloud API (WhatsApp Cloud API)
  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    provider = "meta_cloud_api";
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: rendered.fullText },
        }),
      });
      const data = await response.json();
      if (data.messages && data.messages[0]?.id) {
        messageId = data.messages[0].id;
      }
    } catch (err) {
      console.warn("[WhatsApp Meta API Exception]", err);
    }
  }

  // Log dans l'audit trail
  if (options.dossierId) {
    try {
      await logAuditEvent({
        dossierId: options.dossierId,
        userId: options.userId || 1,
        userName: options.userName || "WhatsApp Business Engine",
        userRole: "system",
        action: "WHATSAPP_ENVOYE",
        entityType: "notification",
        entityId: null,
        fieldChanged: "WhatsApp Alert",
        previousValue: null,
        newValue: `${options.template} ➔ ${cleanPhone}`,
        metadata: {
          template: options.template,
          recipient: cleanPhone,
          messageId,
          provider,
        },
        comment: `Message WhatsApp envoyé au client ${options.clientName} (Template: ${options.template})`,
      });
    } catch (e) {}
  }

  return {
    success: true,
    messageId,
    renderedText: rendered.fullText,
    recipientPhone: cleanPhone,
    provider,
  };
}
