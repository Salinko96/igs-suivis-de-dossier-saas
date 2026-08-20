var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/supabase.ts
var supabase_exports = {};
__export(supabase_exports, {
  getSignedDownloadUrl: () => getSignedDownloadUrl,
  getSupabaseServerClient: () => getSupabaseServerClient,
  isSupabaseConfigured: () => isSupabaseConfigured,
  uploadInvoicePdf: () => uploadInvoicePdf,
  uploadPaymentProof: () => uploadPaymentProof
});
import { createClient } from "@supabase/supabase-js";
function getSupabaseServerClient() {
  if (_supabaseClient) return _supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  try {
    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return _supabaseClient;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize server client:", err);
    return null;
  }
}
function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}
async function uploadInvoicePdf(invoiceNumber, pdfBuffer, mimeType = "application/pdf") {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const cleanNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `facture_${cleanNumber}_${Date.now()}.pdf`;
  const filePath = `invoices/${fileName}`;
  try {
    const { data, error } = await supabase.storage.from("factures").upload(filePath, pdfBuffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) {
      console.warn("[Supabase Storage] Error uploading invoice PDF:", error.message);
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from("factures").getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("[Supabase Storage] Exception during invoice PDF upload:", err);
    return null;
  }
}
async function uploadPaymentProof(invoiceId, fileBuffer, originalFileName, mimeType = "image/jpeg") {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const ext = originalFileName.split(".").pop() || "jpg";
  const filePath = `payments/invoice_${invoiceId}_${Date.now()}.${ext}`;
  try {
    const { data, error } = await supabase.storage.from("preuves_paiement").upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) {
      console.warn("[Supabase Storage] Error uploading payment proof:", error.message);
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from("preuves_paiement").getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("[Supabase Storage] Exception during payment proof upload:", err);
    return null;
  }
}
async function getSignedDownloadUrl(bucket, filePath, expiresInSeconds = 3600) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
var _supabaseClient;
var init_supabase = __esm({
  "server/supabase.ts"() {
    "use strict";
    _supabaseClient = null;
  }
});

// server/_core/app.ts
import "dotenv/config";
import express from "express";
import compression from "compression";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { TRPCError } from "@trpc/server";

// drizzle/schema.ts
import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["user", "declarant", "comptable", "manager", "client", "admin"]);
var calculatedStatusEnum = pgEnum("calculated_status", ["R\xE9gularis\xE9", "\xC0 r\xE9gulariser"]);
var calculatedPriorityEnum = pgEnum("calculated_priority", ["Haute", "Normale", "Basse"]);
var documentTypeEnum = pgEnum("document_type", ["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]);
var invoiceStatusEnum = pgEnum("invoice_status", ["Proforma", "\xC9mise", "Pay\xE9e", "En_retard", "Annul\xE9e"]);
var invoiceTypeEnum = pgEnum("invoice_type", ["Proforma", "Definitive"]);
var taskStatusEnum = pgEnum("task_status", ["A_faire", "En_cours", "Termine", "Bloque"]);
var notificationTypeEnum = pgEnum("notification_type", ["ETA_DEPASSEE", "DDI_MANQUANTE", "BULLETIN_MANQUANT", "SURESTARIES_RISQUE", "STATUT_MODIFIE", "DOCUMENT_AJOUTE", "FACTURE_GENEREE"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  clientCompany: varchar("clientCompany", { length: 255 }),
  // Pour le portail client
  phone: varchar("phone", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  sessionRevokedAt: timestamp("sessionRevokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 160 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  country: varchar("country", { length: 100 }).default("Guin\xE9e"),
  taxId: varchar("taxId", { length: 80 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => [
  uniqueIndex("clients_name_unique").on(table.name)
]);
var dossiers = pgTable("dossiers", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().default(1),
  dossierNumber: varchar("dossierNumber", { length: 16 }).notNull(),
  clientDossierNumber: varchar("clientDossierNumber", { length: 120 }),
  clientId: integer("clientId"),
  client: varchar("client", { length: 255 }),
  blLtaNumber: varchar("blLtaNumber", { length: 160 }),
  cargoNature: text("cargoNature"),
  transportMode: varchar("transportMode", { length: 64 }),
  eta: timestamp("eta"),
  originPort: varchar("originPort", { length: 255 }),
  destinationPort: varchar("destinationPort", { length: 255 }),
  port: varchar("port", { length: 120 }).default("Port Autonome de Conakry (PAC)"),
  container: varchar("container", { length: 255 }),
  bulk: varchar("bulk", { length: 255 }),
  goodsReleaseDate: timestamp("goodsReleaseDate"),
  daysOnQuay: integer("daysOnQuay").default(0),
  // Jours de séjour quai (alerte si > 7j)
  declarationNumber: varchar("declarationNumber", { length: 160 }),
  bulletinNumber: varchar("bulletinNumber", { length: 160 }),
  finalDeclarationNumber: varchar("finalDeclarationNumber", { length: 160 }),
  ddiGucegNumber: varchar("ddiGucegNumber", { length: 160 }),
  badStatus: varchar("badStatus", { length: 64 }),
  baeStatus: varchar("baeStatus", { length: 64 }),
  calculatedStatus: calculatedStatusEnum("calculatedStatus").notNull(),
  calculatedPriority: calculatedPriorityEnum("calculatedPriority").notNull(),
  completionRate: integer("completionRate").notNull().default(0),
  documentStatus: varchar("documentStatus", { length: 80 }),
  customsStatus: varchar("customsStatus", { length: 80 }),
  portStatus: varchar("portStatus", { length: 100 }),
  financialStatus: varchar("financialStatus", { length: 100 }),
  fieldOperation: varchar("fieldOperation", { length: 160 }),
  responsible: varchar("responsible", { length: 120 }),
  nextAction: varchar("nextAction", { length: 255 }),
  fieldAlert: varchar("fieldAlert", { length: 120 }),
  deliveryLocation: varchar("deliveryLocation", { length: 120 }),
  declarant: varchar("declarant", { length: 120 }),
  service: varchar("service", { length: 80 }),
  regime: varchar("regime", { length: 80 }),
  notes: text("notes"),
  portalAccessCode: varchar("portalAccessCode", { length: 32 }),
  // Code direct de suivi pour le client
  createdById: integer("createdById"),
  updatedById: integer("updatedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => [
  uniqueIndex("dossiers_number_unique").on(table.dossierNumber),
  index("dossiers_client_idx").on(table.client),
  index("dossiers_status_idx").on(table.calculatedStatus),
  index("dossiers_priority_idx").on(table.calculatedPriority),
  index("dossiers_eta_idx").on(table.eta),
  index("dossiers_bl_lta_idx").on(table.blLtaNumber),
  index("dossiers_responsible_idx").on(table.responsible),
  index("dossiers_portal_code_idx").on(table.portalAccessCode)
]);
var documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: documentTypeEnum("type").notNull().default("Autre"),
  fileUrl: text("fileUrl").notNull(),
  // Base64 Data URI ou URL externe/S3/Supabase Storage
  fileSize: integer("fileSize").notNull().default(0),
  // en octets
  mimeType: varchar("mimeType", { length: 120 }),
  uploadedById: integer("uploadedById"),
  uploaderName: varchar("uploaderName", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("documents_dossier_idx").on(table.dossierId)
]);
var dossierStatusHistory = pgTable("dossier_status_history", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  changedById: integer("changedById"),
  authorName: varchar("authorName", { length: 120 }),
  userRole: varchar("userRole", { length: 64 }),
  action: varchar("action", { length: 120 }),
  entityType: varchar("entityType", { length: 64 }).default("dossier"),
  entityId: integer("entityId"),
  fieldChanged: varchar("fieldChanged", { length: 80 }).notNull(),
  previousValue: text("previousValue"),
  newValue: text("newValue"),
  beforeData: text("beforeData"),
  afterData: text("afterData"),
  comment: text("comment"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("dossier_history_dossier_idx").on(table.dossierId),
  index("dossier_history_action_idx").on(table.action),
  index("dossier_history_entity_idx").on(table.entityType, table.entityId),
  index("dossier_history_created_idx").on(table.createdAt)
]);
var invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  clientId: integer("clientId"),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  client: varchar("client", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("GNF"),
  // GNF, USD, EUR
  invoiceType: invoiceTypeEnum("invoiceType").notNull().default("Proforma"),
  exchangeRate: integer("exchangeRate").notNull().default(8650),
  amountHt: integer("amountHt").notNull().default(0),
  amountTva: integer("amountTva").notNull().default(0),
  amountTtc: integer("amountTtc").notNull().default(0),
  disbursementsAmount: integer("disbursementsAmount").notNull().default(0),
  // Débours totaux (douane + PAC)
  customsDutiesAmount: integer("customsDutiesAmount").notNull().default(0),
  // Droits de douane
  portFeesAmount: integer("portFeesAmount").notNull().default(0),
  // Redevance portuaire PAC
  storageAndDemurrageFees: integer("storageAndDemurrageFees").notNull().default(0),
  // Surestaries / magasinage
  estimatedMargin: integer("estimatedMargin").notNull().default(0),
  // Marge brute estimée
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  paymentReference: varchar("paymentReference", { length: 120 }),
  receiptNumber: varchar("receiptNumber", { length: 64 }),
  status: invoiceStatusEnum("status").notNull().default("Proforma"),
  pdfUrl: text("pdfUrl"),
  // URL Supabase Storage du PDF généré
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => [
  uniqueIndex("invoices_number_unique").on(table.invoiceNumber),
  index("invoices_dossier_idx").on(table.dossierId),
  index("invoices_client_idx").on(table.client),
  index("invoices_status_idx").on(table.status)
]);
var invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("GNF"),
  paymentMethod: varchar("paymentMethod", { length: 64 }).notNull(),
  paymentReference: varchar("paymentReference", { length: 120 }),
  paymentDate: timestamp("paymentDate").defaultNow().notNull(),
  proofUrl: text("proofUrl"),
  // URL Supabase Storage du justificatif bancaire / quittance
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("invoice_payments_invoice_idx").on(table.invoiceId)
]);
var pacDisbursements = pgTable("pac_disbursements", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  invoiceId: integer("invoiceId"),
  type: varchar("type", { length: 64 }).notNull().default("douane"),
  // douane, port, surestaries, acconage, autre
  amountAdvanced: integer("amountAdvanced").notNull().default(0),
  // Montant avancé par IGS
  amountReimbursed: integer("amountReimbursed").notNull().default(0),
  // Montant remboursé par le client
  status: varchar("status", { length: 32 }).notNull().default("avance"),
  // avance, rembourse_partiel, rembourse_total
  receiptNumber: varchar("receiptNumber", { length: 64 }),
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
}, (table) => [
  index("pac_disbursements_dossier_idx").on(table.dossierId),
  index("pac_disbursements_invoice_idx").on(table.invoiceId)
]);
var exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  sourceCurrency: varchar("sourceCurrency", { length: 8 }).notNull().default("USD"),
  targetCurrency: varchar("targetCurrency", { length: 8 }).notNull().default("GNF"),
  rate: integer("rate").notNull().default(8650),
  updatedById: integer("updatedById"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});
var dossierTasks = pgTable("dossier_tasks", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  assignedTo: varchar("assignedTo", { length: 120 }),
  dueDate: timestamp("dueDate"),
  status: taskStatusEnum("status").notNull().default("A_faire"),
  priority: calculatedPriorityEnum("priority").notNull().default("Normale"),
  completedAt: timestamp("completedAt"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("dossier_tasks_dossier_idx").on(table.dossierId),
  index("dossier_tasks_status_idx").on(table.status)
]);
var dossierComments = pgTable("dossier_comments", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  authorId: integer("authorId"),
  authorName: varchar("authorName", { length: 120 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("dossier_comments_dossier_idx").on(table.dossierId)
]);
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId"),
  dossierNumber: varchar("dossierNumber", { length: 16 }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  recipientRole: varchar("recipientRole", { length: 64 }),
  isRead: integer("isRead").notNull().default(0),
  // 0 ou 1
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  index("notifications_dossier_idx").on(table.dossierId),
  index("notifications_is_read_idx").on(table.isRead),
  index("notifications_created_idx").on(table.createdAt)
]);
var referenceItems = pgTable("reference_items", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [
  uniqueIndex("reference_category_label_unique").on(table.category, table.label),
  index("reference_category_idx").on(table.category)
]);

// server/dossierRules.ts
var REQUIRED_DOSSIER_FIELDS = [
  "clientDossierNumber",
  "client",
  "blLtaNumber",
  "cargoNature",
  "transportMode",
  "eta",
  "originPort",
  "destinationPort",
  "goodsReleaseDate",
  "declarationNumber",
  "bulletinNumber"
];
var hasValue = (value) => value !== null && value !== void 0 && String(value).trim() !== "";
function calculateDossierState(input) {
  const missingFields = REQUIRED_DOSSIER_FIELDS.filter((field) => !hasValue(input[field]));
  const hasPackaging = hasValue(input.container) || hasValue(input.bulk);
  if (!hasPackaging) missingFields.push("container");
  const calculatedStatus = missingFields.length === 0 ? "R\xE9gularis\xE9" : "\xC0 r\xE9gulariser";
  return {
    calculatedStatus,
    calculatedPriority: calculatedStatus === "R\xE9gularis\xE9" ? "Basse" : "Haute",
    completionRate: Math.round((REQUIRED_DOSSIER_FIELDS.length + 1 - missingFields.length) / (REQUIRED_DOSSIER_FIELDS.length + 1) * 100),
    missingFields
  };
}
function formatDossierNumber(sequence) {
  return `DOS-${String(sequence).padStart(4, "0")}`;
}

// server/alertsService.ts
function generateProactiveAlerts(dossiers2) {
  const alerts = [];
  const now = /* @__PURE__ */ new Date();
  now.setHours(0, 0, 0, 0);
  for (const d of dossiers2) {
    if (!d.eta) continue;
    const etaDate = new Date(d.eta);
    etaDate.setHours(0, 0, 0, 0);
    const isPastEta = etaDate < now;
    const isReleased = Boolean(d.goodsReleaseDate);
    const daysSinceEta = Math.round((now.getTime() - etaDate.getTime()) / (1e3 * 60 * 60 * 24));
    if (isPastEta && !isReleased && daysSinceEta > 7) {
      alerts.push({
        id: d.id * 10 + 1,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "SURESTARIES_RISQUE",
        title: `\u{1F6A8} Risque Surestaries (${d.dossierNumber})`,
        message: `Au port depuis ${daysSinceEta} jours (franchise 7j d\xE9pass\xE9e de ${daysSinceEta - 7}j). ${d.client || "Client"} \u2022 BL: ${d.blLtaNumber || "N/A"}.`,
        severity: "critical",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 1) * 6e4)
      });
    }
    if (isPastEta && !isReleased) {
      alerts.push({
        id: d.id * 10 + 2,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "ETA_DEPASSEE",
        title: `\u23F1\uFE0F Navire arriv\xE9 sans sortie (${d.dossierNumber})`,
        message: `ETA \xE9chue le ${etaDate.toLocaleDateString("fr-FR")} (${daysSinceEta}j). Marchandise toujours au quai PAC.`,
        severity: daysSinceEta > 7 ? "critical" : "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 2) * 6e4)
      });
    }
    if (isPastEta && !d.declarationNumber) {
      alerts.push({
        id: d.id * 10 + 3,
        dossierId: d.id,
        dossierNumber: d.dossierNumber,
        type: "DDI_MANQUANTE",
        title: `\u{1F4C4} Sydonia manquant (${d.dossierNumber})`,
        message: `Navire arriv\xE9 mais d\xE9claration SYDONIA World non renseign\xE9e pour ${d.client || "le client"}.`,
        severity: "warning",
        isRead: 0,
        createdAt: new Date(Date.now() - (d.id * 10 + 3) * 6e4)
      });
    }
  }
  return alerts.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
async function sendDossierWhatsAppAlert(params) {
  const cleanPhone = params.recipientPhone.replace(/[^0-9+]/g, "") || "+224620000000";
  const formattedText = `\u{1F6A2} *IGS TRANSIT & DOUANE GUIN\xC9E*

*Dossier :* ${params.dossierNumber}
*Client :* ${params.clientName}

\u{1F4E2} *Alerte Op\xE9rationnelle :*
${params.messageText}

\u{1F517} Suivi en direct : https://igs-suivis-de-dossier-saas.vercel.app/portail-client`;
  console.log(`[WhatsApp Dispatch] Envoi vers ${cleanPhone} :`, formattedText);
  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: formattedText }
        })
      });
    } catch (err) {
      console.warn("[WhatsApp Dispatch Error]", err);
    }
  }
  return {
    success: true,
    channel: "whatsapp",
    sentTo: cleanPhone,
    preview: formattedText
  };
}
async function sendDossierEmailAlert(params) {
  const email = params.recipientEmail || "contact@igs-logistics.gn";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "IGS Transit <onboarding@resend.dev>";
  console.log(`[Email Dispatch] Envoi vers ${email} : "${params.subject}"`);
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: params.subject,
          html: params.htmlContent
        })
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
    sentTo: email
  };
}

// server/initialImportData.ts
var initialImportData = {
  "dossiers": [
    {
      "dossierNumber": "DOS-0001",
      "clientDossierNumber": "CKYSI26000340",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "HLCUNG12604AUQG1",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-31",
      "originPort": "Ningbo port-china",
      "destinationPort": "Conakry",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 142- 27/07/2026",
      "bulletinNumber": "L 1774 Du 28/07/2026",
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0002",
      "clientDossierNumber": "CKYSI26000342",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "HLCUNG12604AVHK6",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-31",
      "originPort": "Ningbo port-china",
      "destinationPort": "Conakry",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 143- 27/07/2026",
      "bulletinNumber": "L 1773 Du 28/07/2026",
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0003",
      "clientDossierNumber": null,
      "client": "Guinee Yongchuang Shipbuilding LTD - Sarl",
      "blLtaNumber": "JH260LYG11",
      "cargoNature": "Hot- Rolled Steel Plates",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Lianyunggang-China",
      "destinationPort": "Boffa-Conakry",
      "container": null,
      "bulk": "56 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0004",
      "clientDossierNumber": null,
      "client": "Guinee Yongchuang Shipbuilding LTD - Sarl",
      "blLtaNumber": "JH260LYG12",
      "cargoNature": "Galvanized Steel Tubes",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Lianyunggang-China",
      "destinationPort": "Boffa-Conakry",
      "container": null,
      "bulk": "6 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0005",
      "clientDossierNumber": null,
      "client": "Guinee Yongchuang Shipbuilding LTD - Sarl",
      "blLtaNumber": "JH260LYG13",
      "cargoNature": "H-Beam Steel",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Lianyunggang-China",
      "destinationPort": "Boffa-Conakry",
      "container": null,
      "bulk": "2 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0006",
      "clientDossierNumber": null,
      "client": "Guinee Yongchuang Shipbuilding LTD - Sarl",
      "blLtaNumber": "JH260LYG14",
      "cargoNature": "Angle Steel",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Lianyunggang-China",
      "destinationPort": "Boffa-Conakry",
      "container": null,
      "bulk": "2 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0007",
      "clientDossierNumber": null,
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NFFN017C000101",
      "cargoNature": "Environmental Gold Leaching Agent",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Rizhao-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "20 TC20'",
      "bulk": "22 400 kgs",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0008",
      "clientDossierNumber": null,
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NFFN017C000102",
      "cargoNature": "H-Beam Channel Steel, Angle Steel, Patterned Plate, Flat-Opened",
      "transportMode": "Maritime",
      "eta": "2026-07-21",
      "originPort": "Rizhao-china",
      "destinationPort": "Boffa-Conakry",
      "container": null,
      "bulk": "15 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0009",
      "clientDossierNumber": "CKY8126000377",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3626648",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-07-30",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "5x 20 st",
      "bulk": null,
      "goodsReleaseDate": "2026-08-01",
      "declarationNumber": "S 132- 20/07/2026",
      "bulletinNumber": "L 1723 Du 21/07/2026",
      "finalDeclarationNumber": "C 1317-2026"
    },
    {
      "dossierNumber": "DOS-0010",
      "clientDossierNumber": "CKY8126000378",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3651868",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-07-30",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "5x 20 st",
      "bulk": null,
      "goodsReleaseDate": "2026-08-01",
      "declarationNumber": "S 133- 20/07/2026",
      "bulletinNumber": "L 1729 Du 21/07/2026",
      "finalDeclarationNumber": "C 1319-2026"
    },
    {
      "dossierNumber": "DOS-0011",
      "clientDossierNumber": "CKY8126000380",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3654574",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-07-30",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "4x 20 st",
      "bulk": null,
      "goodsReleaseDate": "2026-08-01",
      "declarationNumber": "S 135- 20/07/2026",
      "bulletinNumber": "L 1725 Du 21/07/2026",
      "finalDeclarationNumber": "C 1322-2026"
    },
    {
      "dossierNumber": "DOS-0012",
      "clientDossierNumber": "CKY8126000379",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3654656",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-07-30",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "6x",
      "bulk": null,
      "goodsReleaseDate": "2026-08-01",
      "declarationNumber": "S 134- 20/07/2026",
      "bulletinNumber": "L 1728 Du 21/07/2026",
      "finalDeclarationNumber": "C 1323-2026"
    },
    {
      "dossierNumber": "DOS-0013",
      "clientDossierNumber": "CKY8126000409",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3711076",
      "cargoNature": "Sodium Cyanide Solide",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "5x 20 st",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 162- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0014",
      "clientDossierNumber": "CKYSI26000364",
      "client": "Capdrill",
      "blLtaNumber": "S04019953",
      "cargoNature": "Mining Parts",
      "transportMode": "Maritime",
      "eta": "2026-08-20",
      "originPort": null,
      "destinationPort": "Conakry",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0015",
      "clientDossierNumber": "CKYSI26000350",
      "client": "Rabotec",
      "blLtaNumber": "PRORO19/2026",
      "cargoNature": "Prorogation AT",
      "transportMode": "Domestique",
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0016",
      "clientDossierNumber": "CKYSE26000348",
      "client": "BelAir",
      "blLtaNumber": "NF VISION",
      "cargoNature": "Bauxite",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0017",
      "clientDossierNumber": "CKYSI26000347",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3574724",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-22",
      "originPort": "china",
      "destinationPort": "conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-28",
      "declarationNumber": "S117 du 08/07/26",
      "bulletinNumber": "L1597 du 09/07/2026",
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0018",
      "clientDossierNumber": "CKYSI26000346",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3572754",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-22",
      "originPort": "china",
      "destinationPort": "conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-28",
      "declarationNumber": "S119 du 08/07/26",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0019",
      "clientDossierNumber": "CKYSI26000345",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3583958",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-22",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0020",
      "clientDossierNumber": "CKYSI26000344",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "HLCUNG12604ATCF6",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-19",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-20",
      "declarationNumber": "S114 du 08/07/26",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0021",
      "clientDossierNumber": "CKYSI26000343",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "HLCUNG1260478795",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-18",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-20",
      "declarationNumber": "S116 du 08/07/26",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0022",
      "clientDossierNumber": "CKYSI26000341",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3583949",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-25",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-28",
      "declarationNumber": "S115 du 08/07/26",
      "bulletinNumber": "L1589 du 09/07/2026",
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0023",
      "clientDossierNumber": "CKYSI26000339",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "HLCUNG1260470029",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-18",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": "2026-07-20",
      "declarationNumber": "S121 du 08/07/26",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0024",
      "clientDossierNumber": "CKYSI26000338",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3626633",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-07-25",
      "originPort": "china",
      "destinationPort": "Conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0025",
      "clientDossierNumber": "CKYSI26000337",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NFVS01C000101",
      "cargoNature": "Machine foreuse et \xE9quipements",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": "china",
      "destinationPort": "Boffa",
      "container": null,
      "bulk": "31 colis",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0026",
      "clientDossierNumber": "CKYSI26000336",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NFVS01J000102",
      "cargoNature": "Steel Ball",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": "china",
      "destinationPort": "Boffa",
      "container": "40TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0027",
      "clientDossierNumber": "CKYSI26000335",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NFVS01H000302",
      "cargoNature": "Calcium oxide",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": "china",
      "destinationPort": "Boffa",
      "container": "43TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0028",
      "clientDossierNumber": "CKYSI26000334",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NFVS01H000301",
      "cargoNature": "Quick Lime",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": "china",
      "destinationPort": "Boffa",
      "container": "46TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0029",
      "clientDossierNumber": "CKYSI26000333",
      "client": null,
      "blLtaNumber": "NFVS01C000301",
      "cargoNature": "Trommel Screen",
      "transportMode": null,
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": "6 Pkg",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0030",
      "clientDossierNumber": "CKYSI26000331",
      "client": null,
      "blLtaNumber": "NFVS01J000101",
      "cargoNature": null,
      "transportMode": null,
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0031",
      "clientDossierNumber": "CKYSI26000330",
      "client": null,
      "blLtaNumber": "NFVS01H000201",
      "cargoNature": null,
      "transportMode": null,
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0032",
      "clientDossierNumber": "CKYSI26000329",
      "client": null,
      "blLtaNumber": "NFVS01C000201",
      "cargoNature": null,
      "transportMode": null,
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0033",
      "clientDossierNumber": "CKY8126000432",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3696879",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-12",
      "originPort": "Ningbo port-china",
      "destinationPort": "Conakry, GN",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 161- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0034",
      "clientDossierNumber": "CKY8126000431",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3768278",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-12",
      "originPort": "Ningbo port-china",
      "destinationPort": "Conakry, GN",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 160- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0035",
      "clientDossierNumber": "CKY8126000407",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3768351",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "Ningbo port-china",
      "destinationPort": "Conakry, GN",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 157- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0036",
      "clientDossierNumber": "CKY8126000408",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "MEDUY4002885",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-18",
      "originPort": "Ningbo, CN",
      "destinationPort": "Conakry, GN",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0037",
      "clientDossierNumber": "CKY8126000413",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3670655",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": null,
      "destinationPort": null,
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 158- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0038",
      "clientDossierNumber": "CKY8126000414",
      "client": "Guinean Birimian Gold S.A",
      "blLtaNumber": "NGP3677538",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": null,
      "destinationPort": null,
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 159- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0039",
      "clientDossierNumber": "CKY8126000412",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3669558",
      "cargoNature": "Cyanure",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "CHINE",
      "destinationPort": "Conakry, GN",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 156- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0040",
      "clientDossierNumber": "CKYSI26000324",
      "client": "Fabrimetal",
      "blLtaNumber": "MEDUXO787576",
      "cargoNature": "Bar bending machine",
      "transportMode": "Maritime",
      "eta": "2026-08-03",
      "originPort": "Nhava Sheva, IndiA",
      "destinationPort": "Conakry, GN",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0041",
      "clientDossierNumber": "CKYSI26000323",
      "client": "Fabrimetal",
      "blLtaNumber": "MEDUXO733307",
      "cargoNature": "Spare parts for induction furnace",
      "transportMode": "Maritime",
      "eta": "2026-08-04",
      "originPort": "Mundra,India",
      "destinationPort": "Conakry, GN",
      "container": "02TC40';01TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0042",
      "clientDossierNumber": "CKYSI26000318",
      "client": "Fabrimetal",
      "blLtaNumber": "MEDUJ7763785",
      "cargoNature": "006054796h91-genset 250kva AMF 3P STD",
      "transportMode": "Maritime",
      "eta": "2026-08-07",
      "originPort": "Nhava Sheva, IndiA",
      "destinationPort": "Conakry, GN",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0043",
      "clientDossierNumber": null,
      "client": "Fabrimetal",
      "blLtaNumber": "HLCUBO12606CGXW0",
      "cargoNature": "Africa steel dynamics LTd",
      "transportMode": "Maritime",
      "eta": null,
      "originPort": "Mundra,India",
      "destinationPort": "Conakry, GN",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0044",
      "clientDossierNumber": "CKYSI26000320",
      "client": "Fabrimetal",
      "blLtaNumber": "EID0951355",
      "cargoNature": "Escort Back loader",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "Mundra,India",
      "destinationPort": "Conakry, GN",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0045",
      "clientDossierNumber": "CKYSI26000363",
      "client": "Fabrimetal",
      "blLtaNumber": "EID0951814",
      "cargoNature": "Meubles, Mobilier, etc",
      "transportMode": "Maritime",
      "eta": "2026-09-20",
      "originPort": "Mundra,India",
      "destinationPort": "Conakry, GN",
      "container": "01TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0046",
      "clientDossierNumber": "CKY8126000411",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3711084",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "Ningbo, CN",
      "destinationPort": "Conakry, GN",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 155- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0047",
      "clientDossierNumber": "CKY8126000410",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "NGP3669057",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-08-13",
      "originPort": "Ningbo, CN",
      "destinationPort": "Conakry, GN",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 154- 08/08/2026",
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0048",
      "clientDossierNumber": "CKYSI26000293",
      "client": "Capdrill",
      "blLtaNumber": "S329450131",
      "cargoNature": "New unpacked vehicule",
      "transportMode": "Maritime",
      "eta": "2026-08-07",
      "originPort": "Atwerp",
      "destinationPort": "Conakry, GN",
      "container": null,
      "bulk": "2 PKG",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0049",
      "clientDossierNumber": "CKY8126000439",
      "client": "Guinee Gold Exploration S.A",
      "blLtaNumber": "VTHC20260803-6-SGGE-HCL",
      "cargoNature": "Acide chlorhydrique",
      "transportMode": "Routier",
      "eta": "2026-08-13",
      "originPort": "Accra, Guinea",
      "destinationPort": "Siguiri, GN",
      "container": null,
      "bulk": "83.52 tonnes",
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0050",
      "clientDossierNumber": "CKY8126000298",
      "client": "Rabotec",
      "blLtaNumber": "MEDUXs477883",
      "cargoNature": "Flexible rubber pipes",
      "transportMode": "Maritime",
      "eta": "2026-08-18",
      "originPort": "Qingdao, china",
      "destinationPort": "Conakry, GN",
      "container": "01TC40'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0051",
      "clientDossierNumber": "CKY8126000318",
      "client": "Fabrimetal",
      "blLtaNumber": "MEDUJ7763785",
      "cargoNature": null,
      "transportMode": null,
      "eta": null,
      "originPort": null,
      "destinationPort": null,
      "container": null,
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0052",
      "clientDossierNumber": "CKY8126000441",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3876679",
      "cargoNature": "Sodium Cyanide Solide",
      "transportMode": "Maritime",
      "eta": "2026-09-26",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "06TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0053",
      "clientDossierNumber": "CKY8126000440",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "NGP3796299",
      "cargoNature": "Sodium Cyanide Solide",
      "transportMode": "Maritime",
      "eta": "2026-09-26",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "04TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": null,
      "bulletinNumber": null,
      "finalDeclarationNumber": null
    },
    {
      "dossierNumber": "DOS-0054",
      "clientDossierNumber": "CKY8126000280",
      "client": "New Japon Mining Company S.A",
      "blLtaNumber": "293961486",
      "cargoNature": "Cyanure de sodium",
      "transportMode": "Maritime",
      "eta": "2026-06-16",
      "originPort": "Ningbo port-china",
      "destinationPort": "Port Autonome de Conakry",
      "container": "05TC20'",
      "bulk": null,
      "goodsReleaseDate": null,
      "declarationNumber": "S 97- 17/06/2026",
      "bulletinNumber": "L 1911 Du 10/08/2026",
      "finalDeclarationNumber": "C 1398-2026"
    }
  ],
  "referenceItems": [
    {
      "category": "statut",
      "label": "R\xE9gularis\xE9",
      "sortOrder": 1
    },
    {
      "category": "statut",
      "label": "\xC0 r\xE9gulariser",
      "sortOrder": 2
    },
    {
      "category": "priorite",
      "label": "Haute",
      "sortOrder": 1
    },
    {
      "category": "priorite",
      "label": "Normale",
      "sortOrder": 2
    },
    {
      "category": "priorite",
      "label": "Basse",
      "sortOrder": 3
    },
    {
      "category": "document_recu",
      "label": "Oui",
      "sortOrder": 1
    },
    {
      "category": "document_recu",
      "label": "Non",
      "sortOrder": 2
    },
    {
      "category": "document_recu",
      "label": "Partiel",
      "sortOrder": 3
    },
    {
      "category": "document_recu",
      "label": "Non applicable",
      "sortOrder": 4
    },
    {
      "category": "mode_transport",
      "label": "Maritime",
      "sortOrder": 1
    },
    {
      "category": "mode_transport",
      "label": "A\xE9rien",
      "sortOrder": 2
    },
    {
      "category": "mode_transport",
      "label": "Routier",
      "sortOrder": 3
    },
    {
      "category": "mode_transport",
      "label": "Mixte",
      "sortOrder": 4
    },
    {
      "category": "mode_transport",
      "label": "Domestique",
      "sortOrder": 5
    },
    {
      "category": "declarant",
      "label": "Interne",
      "sortOrder": 1
    },
    {
      "category": "declarant",
      "label": "Client",
      "sortOrder": 2
    },
    {
      "category": "declarant",
      "label": "Partenaire",
      "sortOrder": 3
    },
    {
      "category": "declarant",
      "label": "\xC0 d\xE9finir",
      "sortOrder": 4
    },
    {
      "category": "type_operation",
      "label": "Maritime",
      "sortOrder": 1
    },
    {
      "category": "type_operation",
      "label": "Terrestre",
      "sortOrder": 2
    },
    {
      "category": "type_operation",
      "label": "Domestique",
      "sortOrder": 3
    },
    {
      "category": "client",
      "label": "Tesmec",
      "sortOrder": 1
    },
    {
      "category": "client",
      "label": "Kalpataru",
      "sortOrder": 2
    },
    {
      "category": "client",
      "label": "Rabotec",
      "sortOrder": 3
    },
    {
      "category": "client",
      "label": "Mohan",
      "sortOrder": 4
    },
    {
      "category": "client",
      "label": "Fabrimetal",
      "sortOrder": 5
    },
    {
      "category": "client",
      "label": "GGE",
      "sortOrder": 6
    },
    {
      "category": "client",
      "label": "NJP",
      "sortOrder": 7
    },
    {
      "category": "client",
      "label": "GBG",
      "sortOrder": 8
    },
    {
      "category": "client",
      "label": "Fauveder",
      "sortOrder": 9
    },
    {
      "category": "client",
      "label": "Capdrill",
      "sortOrder": 10
    },
    {
      "category": "client",
      "label": "BelAir",
      "sortOrder": 11
    },
    {
      "category": "statut_financier",
      "label": "Non \xE9tablis",
      "sortOrder": 1
    },
    {
      "category": "statut_financier",
      "label": "Fact. D\xE9finitive",
      "sortOrder": 2
    },
    {
      "category": "statut_financier",
      "label": "Fact. Partiel",
      "sortOrder": 3
    },
    {
      "category": "statut_financier",
      "label": "Fact. Proforma",
      "sortOrder": 4
    },
    {
      "category": "statut_financier",
      "label": "D\xE9charg\xE9",
      "sortOrder": 5
    },
    {
      "category": "operation_terrain",
      "label": "R\xE9ception documents client",
      "sortOrder": 1
    },
    {
      "category": "operation_terrain",
      "label": "V\xE9rification documents",
      "sortOrder": 2
    },
    {
      "category": "operation_terrain",
      "label": "D\xE9claration douane",
      "sortOrder": 3
    },
    {
      "category": "operation_terrain",
      "label": "Suivi r\xE9pertoire / bulletin / attestation",
      "sortOrder": 4
    },
    {
      "category": "operation_terrain",
      "label": "Paiement droits et frais",
      "sortOrder": 5
    },
    {
      "category": "operation_terrain",
      "label": "Sortie port",
      "sortOrder": 6
    },
    {
      "category": "operation_terrain",
      "label": "Livraison client",
      "sortOrder": 7
    },
    {
      "category": "operation_terrain",
      "label": "Facturation",
      "sortOrder": 8
    },
    {
      "category": "operation_terrain",
      "label": "Cl\xF4ture dossier",
      "sortOrder": 9
    },
    {
      "category": "statut_carnet",
      "label": "\xC9tablis",
      "sortOrder": 1
    },
    {
      "category": "statut_carnet",
      "label": "Partiel",
      "sortOrder": 2
    },
    {
      "category": "statut_carnet",
      "label": "Non \xE9tablis",
      "sortOrder": 3
    },
    {
      "category": "responsable",
      "label": "Amine",
      "sortOrder": 1
    },
    {
      "category": "responsable",
      "label": "Hadja",
      "sortOrder": 2
    },
    {
      "category": "responsable",
      "label": "Tawel",
      "sortOrder": 3
    },
    {
      "category": "priorite_source",
      "label": "Bas",
      "sortOrder": 1
    },
    {
      "category": "priorite_source",
      "label": "Moyen",
      "sortOrder": 2
    },
    {
      "category": "priorite_source",
      "label": "\xC9lev\xE9e",
      "sortOrder": 3
    },
    {
      "category": "regime",
      "label": "TTC",
      "sortOrder": 1
    },
    {
      "category": "regime",
      "label": "EXO",
      "sortOrder": 2
    },
    {
      "category": "regime",
      "label": "AT",
      "sortOrder": 3
    },
    {
      "category": "declarant_igs",
      "label": "Interne",
      "sortOrder": 1
    },
    {
      "category": "declarant_igs",
      "label": "Client",
      "sortOrder": 2
    },
    {
      "category": "declarant_igs",
      "label": "Partenaire",
      "sortOrder": 3
    },
    {
      "category": "declarant_igs",
      "label": "\xC0 d\xE9finir",
      "sortOrder": 4
    },
    {
      "category": "declarant_igs",
      "label": "Sow",
      "sortOrder": 5
    },
    {
      "category": "declarant_igs",
      "label": "Amine",
      "sortOrder": 6
    },
    {
      "category": "declarant_igs",
      "label": "Tawel",
      "sortOrder": 7
    },
    {
      "category": "livreur",
      "label": "Hadja",
      "sortOrder": 1
    },
    {
      "category": "livreur",
      "label": "Tawel",
      "sortOrder": 2
    },
    {
      "category": "livreur",
      "label": "\xC9quipe IGS",
      "sortOrder": 3
    },
    {
      "category": "livreur",
      "label": "Transporteur externe",
      "sortOrder": 4
    },
    {
      "category": "livreur",
      "label": "Client",
      "sortOrder": 5
    },
    {
      "category": "lieu_livraison",
      "label": "Conakry",
      "sortOrder": 1
    },
    {
      "category": "lieu_livraison",
      "label": "Port Autonome de Conakry",
      "sortOrder": 2
    },
    {
      "category": "lieu_livraison",
      "label": "Boffa",
      "sortOrder": 3
    },
    {
      "category": "lieu_livraison",
      "label": "Kamsar",
      "sortOrder": 4
    },
    {
      "category": "lieu_livraison",
      "label": "Sangaredi",
      "sortOrder": 5
    },
    {
      "category": "lieu_livraison",
      "label": "Kaloum",
      "sortOrder": 6
    },
    {
      "category": "lieu_livraison",
      "label": "Matoto",
      "sortOrder": 7
    },
    {
      "category": "lieu_livraison",
      "label": "Dixinn",
      "sortOrder": 8
    },
    {
      "category": "document_guinee",
      "label": "BL / LTA",
      "sortOrder": 1
    },
    {
      "category": "document_guinee",
      "label": "Facture commerciale",
      "sortOrder": 2
    },
    {
      "category": "document_guinee",
      "label": "Packing list",
      "sortOrder": 3
    },
    {
      "category": "document_guinee",
      "label": "Certificat d\u2019origine",
      "sortOrder": 4
    },
    {
      "category": "document_guinee",
      "label": "D\xE9claration douane",
      "sortOrder": 5
    },
    {
      "category": "document_guinee",
      "label": "N\xB0 r\xE9pertoire",
      "sortOrder": 6
    },
    {
      "category": "document_guinee",
      "label": "N\xB0 bulletin",
      "sortOrder": 7
    },
    {
      "category": "document_guinee",
      "label": "N\xB0 attestation",
      "sortOrder": 8
    },
    {
      "category": "document_guinee",
      "label": "Bordereau de livraison",
      "sortOrder": 9
    },
    {
      "category": "document_guinee",
      "label": "Bon de sortie port",
      "sortOrder": 10
    },
    {
      "category": "document_guinee",
      "label": "Quitus / preuve de paiement si applicable",
      "sortOrder": 11
    },
    {
      "category": "document_guinee",
      "label": "Autorisation ou document sp\xE9cial selon marchandise",
      "sortOrder": 12
    },
    {
      "category": "responsable_igs",
      "label": "Amine",
      "sortOrder": 1
    },
    {
      "category": "responsable_igs",
      "label": "Hadja",
      "sortOrder": 2
    },
    {
      "category": "responsable_igs",
      "label": "Tawel",
      "sortOrder": 3
    },
    {
      "category": "responsable_igs",
      "label": "Sow",
      "sortOrder": 4
    },
    {
      "category": "responsable_igs",
      "label": "Direction",
      "sortOrder": 5
    },
    {
      "category": "alerte_terrain",
      "label": "OK",
      "sortOrder": 1
    },
    {
      "category": "alerte_terrain",
      "label": "ETA d\xE9pass\xE9e",
      "sortOrder": 2
    },
    {
      "category": "alerte_terrain",
      "label": "Documents incomplets",
      "sortOrder": 3
    },
    {
      "category": "alerte_terrain",
      "label": "Action urgente",
      "sortOrder": 4
    },
    {
      "category": "alerte_terrain",
      "label": "Blocage douane",
      "sortOrder": 5
    },
    {
      "category": "alerte_terrain",
      "label": "Blocage port",
      "sortOrder": 6
    },
    {
      "category": "alerte_terrain",
      "label": "Paiement en attente",
      "sortOrder": 7
    },
    {
      "category": "alerte_terrain",
      "label": "Document sp\xE9cial requis",
      "sortOrder": 8
    },
    {
      "category": "prochaine_action",
      "label": "Relancer le client",
      "sortOrder": 1
    },
    {
      "category": "prochaine_action",
      "label": "V\xE9rifier les documents",
      "sortOrder": 2
    },
    {
      "category": "prochaine_action",
      "label": "Pr\xE9parer la d\xE9claration",
      "sortOrder": 3
    },
    {
      "category": "prochaine_action",
      "label": "Suivre r\xE9pertoire / bulletin / attestation",
      "sortOrder": 4
    },
    {
      "category": "prochaine_action",
      "label": "Faire payer droits et frais",
      "sortOrder": 5
    },
    {
      "category": "prochaine_action",
      "label": "Obtenir le bon de sortie port",
      "sortOrder": 6
    },
    {
      "category": "prochaine_action",
      "label": "Organiser la livraison",
      "sortOrder": 7
    },
    {
      "category": "prochaine_action",
      "label": "\xC9mettre la facture",
      "sortOrder": 8
    },
    {
      "category": "prochaine_action",
      "label": "Cl\xF4turer le dossier",
      "sortOrder": 9
    },
    {
      "category": "statut_documentaire",
      "label": "En attente",
      "sortOrder": 1
    },
    {
      "category": "statut_documentaire",
      "label": "Documents re\xE7us",
      "sortOrder": 2
    },
    {
      "category": "statut_documentaire",
      "label": "Documents incomplets",
      "sortOrder": 3
    },
    {
      "category": "statut_documentaire",
      "label": "Non applicable",
      "sortOrder": 4
    },
    {
      "category": "statut_douane",
      "label": "Non d\xE9marr\xE9",
      "sortOrder": 1
    },
    {
      "category": "statut_douane",
      "label": "\xC0 d\xE9douaner",
      "sortOrder": 2
    },
    {
      "category": "statut_douane",
      "label": "En d\xE9claration",
      "sortOrder": 3
    },
    {
      "category": "statut_douane",
      "label": "D\xE9clar\xE9",
      "sortOrder": 4
    },
    {
      "category": "statut_douane",
      "label": "En attente paiement",
      "sortOrder": 5
    },
    {
      "category": "statut_douane",
      "label": "Paiement effectu\xE9",
      "sortOrder": 6
    },
    {
      "category": "statut_douane",
      "label": "D\xE9douan\xE9",
      "sortOrder": 7
    },
    {
      "category": "statut_douane",
      "label": "Termin\xE9",
      "sortOrder": 8
    },
    {
      "category": "statut_douane",
      "label": "Bloqu\xE9",
      "sortOrder": 9
    },
    {
      "category": "statut_douane",
      "label": "R\xE9gulariser",
      "sortOrder": 10
    },
    {
      "category": "statut_port",
      "label": "Non concern\xE9",
      "sortOrder": 1
    },
    {
      "category": "statut_port",
      "label": "En attente",
      "sortOrder": 2
    },
    {
      "category": "statut_port",
      "label": "Arriv\xE9 au port",
      "sortOrder": 3
    },
    {
      "category": "statut_port",
      "label": "En attente bon de sortie",
      "sortOrder": 4
    },
    {
      "category": "statut_port",
      "label": "Bon de sortie port",
      "sortOrder": 5
    },
    {
      "category": "statut_port",
      "label": "Sorti du port",
      "sortOrder": 6
    },
    {
      "category": "statut_port",
      "label": "Bloqu\xE9",
      "sortOrder": 7
    },
    {
      "category": "service",
      "label": "Import",
      "sortOrder": 1
    },
    {
      "category": "service",
      "label": "Transit",
      "sortOrder": 2
    },
    {
      "category": "service",
      "label": "D\xE9douanement",
      "sortOrder": 3
    },
    {
      "category": "service",
      "label": "Op\xE9ration portuaire",
      "sortOrder": 4
    },
    {
      "category": "service",
      "label": "Livraison",
      "sortOrder": 5
    },
    {
      "category": "service",
      "label": "Suivi client",
      "sortOrder": 6
    },
    {
      "category": "port_origine",
      "label": "Port Autonome de Conakry (PAC)",
      "sortOrder": 1
    },
    {
      "category": "port_origine",
      "label": "Port Min\xE9ralier de Kamsar",
      "sortOrder": 2
    },
    {
      "category": "port_origine",
      "label": "Port de Boffa",
      "sortOrder": 3
    },
    {
      "category": "port_origine",
      "label": "Port Autonome de San Pedro (C\xF4te d'Ivoire)",
      "sortOrder": 4
    },
    {
      "category": "port_origine",
      "label": "Port Autonome d'Abidjan (C\xF4te d'Ivoire)",
      "sortOrder": 5
    },
    {
      "category": "port_origine",
      "label": "Port Autonome de Dakar (S\xE9n\xE9gal)",
      "sortOrder": 6
    },
    {
      "category": "port_origine",
      "label": "Port de Tema (Ghana)",
      "sortOrder": 7
    },
    {
      "category": "port_origine",
      "label": "Port de Lom\xE9 (Togo)",
      "sortOrder": 8
    },
    {
      "category": "port_origine",
      "label": "Port de Cotonou (B\xE9nin)",
      "sortOrder": 9
    },
    {
      "category": "port_origine",
      "label": "Ningbo port-china",
      "sortOrder": 10
    },
    {
      "category": "port_origine",
      "label": "Shanghai Port (Chine)",
      "sortOrder": 11
    },
    {
      "category": "port_origine",
      "label": "Qingdao Port (Chine)",
      "sortOrder": 12
    },
    {
      "category": "port_origine",
      "label": "Tianjin Port (Chine)",
      "sortOrder": 13
    },
    {
      "category": "port_origine",
      "label": "Lianyunggang-China",
      "sortOrder": 14
    },
    {
      "category": "port_origine",
      "label": "Port d'Anvers (Belgique)",
      "sortOrder": 15
    },
    {
      "category": "port_origine",
      "label": "Port de Rotterdam (Pays-Bas)",
      "sortOrder": 16
    },
    {
      "category": "port_origine",
      "label": "Port de Valence (Espagne)",
      "sortOrder": 17
    },
    {
      "category": "port_origine",
      "label": "Port de Duba\xEF (Jebel Ali)",
      "sortOrder": 18
    },
    {
      "category": "port_origine",
      "label": "Port d'Istanbul (Turquie)",
      "sortOrder": 19
    },
    {
      "category": "port_destination",
      "label": "Port Autonome de Conakry",
      "sortOrder": 1
    },
    {
      "category": "port_destination",
      "label": "Port Min\xE9ralier de Kamsar",
      "sortOrder": 2
    },
    {
      "category": "port_destination",
      "label": "Port de Boffa",
      "sortOrder": 3
    },
    {
      "category": "port_destination",
      "label": "Port de Bok\xE9",
      "sortOrder": 4
    },
    {
      "category": "port_destination",
      "label": "Port de Taressa",
      "sortOrder": 5
    },
    {
      "category": "port_destination",
      "label": "Port de Konta",
      "sortOrder": 6
    },
    {
      "category": "port_destination",
      "label": "Boffa-Conakry",
      "sortOrder": 7
    },
    {
      "category": "port_destination",
      "label": "Conakry",
      "sortOrder": 8
    },
    {
      "category": "port_destination",
      "label": "Port Autonome de San Pedro (C\xF4te d'Ivoire)",
      "sortOrder": 9
    },
    {
      "category": "port_destination",
      "label": "Port Autonome d'Abidjan (C\xF4te d'Ivoire)",
      "sortOrder": 10
    },
    {
      "category": "port_destination",
      "label": "Port Autonome de Dakar (S\xE9n\xE9gal)",
      "sortOrder": 11
    },
    {
      "category": "port_destination",
      "label": "A\xE9roport International Ahmed S\xE9kou Tour\xE9 (Conakry)",
      "sortOrder": 12
    },
    {
      "category": "devise",
      "label": "GNF (Franc Guin\xE9en)",
      "sortOrder": 1
    },
    {
      "category": "devise",
      "label": "USD (Dollar US)",
      "sortOrder": 2
    },
    {
      "category": "devise",
      "label": "EUR (Euro)",
      "sortOrder": 3
    },
    {
      "category": "devise",
      "label": "XOF (Franc CFA)",
      "sortOrder": 4
    },
    {
      "category": "regime",
      "label": "Mise \xE0 la consommation directe (IM4 - TTC)",
      "sortOrder": 4
    },
    {
      "category": "regime",
      "label": "Mise \xE0 la consommation sous exon\xE9ration (IM4 - EXO)",
      "sortOrder": 5
    },
    {
      "category": "regime",
      "label": "R\xE9gime Minier / Convention (EXO-MIN)",
      "sortOrder": 6
    },
    {
      "category": "regime",
      "label": "Transit National / International (IM8 - DDI / TRIE)",
      "sortOrder": 7
    },
    {
      "category": "regime",
      "label": "Admission Temporaire (IM5 - AT)",
      "sortOrder": 8
    },
    {
      "category": "regime",
      "label": "Entrep\xF4t de Douane (IM7 - ED)",
      "sortOrder": 9
    },
    {
      "category": "regime",
      "label": "Exportation / R\xE9exportation (EX)",
      "sortOrder": 10
    },
    {
      "category": "statut_douane",
      "label": "DDI initi\xE9e (GUCEG)",
      "sortOrder": 11
    },
    {
      "category": "statut_douane",
      "label": "DDI approuv\xE9e",
      "sortOrder": 12
    },
    {
      "category": "statut_douane",
      "label": "En cours de d\xE9claration (SYDONIA)",
      "sortOrder": 13
    },
    {
      "category": "statut_douane",
      "label": "Bulletin de liquidation \xE9mis",
      "sortOrder": 14
    },
    {
      "category": "statut_douane",
      "label": "Visite douane / Scanner",
      "sortOrder": 15
    },
    {
      "category": "statut_douane",
      "label": "Bon \xE0 Enlever (BAE) obtenu",
      "sortOrder": 16
    },
    {
      "category": "statut_port",
      "label": "Navire en rade",
      "sortOrder": 8
    },
    {
      "category": "statut_port",
      "label": "Navire \xE0 quai / D\xE9chargement",
      "sortOrder": 9
    },
    {
      "category": "statut_port",
      "label": "Conteneur sous douane (Terre-plein)",
      "sortOrder": 10
    },
    {
      "category": "statut_port",
      "label": "Frais portuaires r\xE9gl\xE9s (PAC / ALPORT / Bollor\xE9)",
      "sortOrder": 11
    },
    {
      "category": "statut_port",
      "label": "Surestaries en cours",
      "sortOrder": 12
    },
    {
      "category": "statut_financier",
      "label": "Avance re\xE7ue",
      "sortOrder": 6
    },
    {
      "category": "statut_financier",
      "label": "Paiement droits & taxes effectu\xE9",
      "sortOrder": 7
    },
    {
      "category": "statut_financier",
      "label": "Pay\xE9 int\xE9gralement (GNF / USD)",
      "sortOrder": 8
    },
    {
      "category": "statut_financier",
      "label": "En attente quitus client",
      "sortOrder": 9
    },
    {
      "category": "document_guinee",
      "label": "DDI - Demande de D\xE9claration d'Importation (GUCEG)",
      "sortOrder": 13
    },
    {
      "category": "document_guinee",
      "label": "Bordereau de suivi des cargaisons (BSC / BESC Guin\xE9e)",
      "sortOrder": 14
    },
    {
      "category": "document_guinee",
      "label": "D\xE9claration douane SYDONIA World",
      "sortOrder": 15
    },
    {
      "category": "document_guinee",
      "label": "Quittance / Preuve de paiement douane",
      "sortOrder": 16
    },
    {
      "category": "document_guinee",
      "label": "Bon \xE0 Enlever douane (BAE)",
      "sortOrder": 17
    },
    {
      "category": "document_guinee",
      "label": "Bon de sortie port PAC",
      "sortOrder": 18
    },
    {
      "category": "document_guinee",
      "label": "Autorisation sp\xE9ciale mati\xE8res dangereuses / Cyanure",
      "sortOrder": 19
    },
    {
      "category": "alerte_terrain",
      "label": "ETA imminente (< 48h)",
      "sortOrder": 9
    },
    {
      "category": "alerte_terrain",
      "label": "DDI manquante ou expir\xE9e",
      "sortOrder": 10
    },
    {
      "category": "alerte_terrain",
      "label": "Surestaries / Magasinage risque \xE9lev\xE9",
      "sortOrder": 11
    },
    {
      "category": "alerte_terrain",
      "label": "Blocage visite Douane / Scanner",
      "sortOrder": 12
    },
    {
      "category": "alerte_terrain",
      "label": "Document sp\xE9cial requis (Cyanure/Minier)",
      "sortOrder": 13
    },
    {
      "category": "prochaine_action",
      "label": "Soumettre la DDI sur GUCEG",
      "sortOrder": 10
    },
    {
      "category": "prochaine_action",
      "label": "Pr\xE9parer la d\xE9claration SYDONIA",
      "sortOrder": 11
    },
    {
      "category": "prochaine_action",
      "label": "Effectuer passage scanner / Visite",
      "sortOrder": 12
    },
    {
      "category": "prochaine_action",
      "label": "Obtenir le Bon \xE0 Enlever (BAE)",
      "sortOrder": 13
    },
    {
      "category": "prochaine_action",
      "label": "\xC9mettre la facture (GNF / USD)",
      "sortOrder": 14
    },
    {
      "category": "lieu_livraison",
      "label": "Zone Industrielle Kagb\xE9len",
      "sortOrder": 9
    },
    {
      "category": "lieu_livraison",
      "label": "Ratoma",
      "sortOrder": 10
    },
    {
      "category": "lieu_livraison",
      "label": "Bok\xE9",
      "sortOrder": 11
    },
    {
      "category": "lieu_livraison",
      "label": "Siguiri (Zone mini\xE8re)",
      "sortOrder": 12
    },
    {
      "category": "lieu_livraison",
      "label": "Kindia",
      "sortOrder": 13
    },
    {
      "category": "lieu_livraison",
      "label": "Mamou",
      "sortOrder": 14
    },
    {
      "category": "lieu_livraison",
      "label": "Kankan",
      "sortOrder": 15
    }
  ]
};

// server/initialUsersData.ts
var initialUsersData = [
  // --- 1. CORE PROFILES ---
  {
    id: 1,
    openId: "igs_admin_conakry",
    name: "Ibrahima Gold Service (Admin)",
    email: "contact@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 620 00 00 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:30:00Z")
  },
  {
    id: 2,
    openId: "declarant_conakry",
    name: "Mamadou Diallo (D\xE9clarant PAC)",
    email: "declarant@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 621 11 22 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:15:00Z")
  },
  {
    id: 3,
    openId: "comptable_conakry",
    name: "Fatoumata Camara (Comptable)",
    email: "finance@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 622 44 55 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:45:00Z")
  },
  {
    id: 4,
    openId: "client_birimian",
    name: "Guinean Birimian Gold (Portail)",
    email: "logistique@birimian-gold.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Guinean Birimian Gold S.A",
    phone: "+224 623 77 88 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:00:00Z")
  },
  // --- 2. ADMINS & MANAGERS D'EXPLOITATION (12) ---
  {
    id: 5,
    openId: "igs_manager_alpha_barry",
    name: "Alpha Barry (Directeur des Op\xE9rations)",
    email: "alpha.barry@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 620 12 34 56",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:50:00Z")
  },
  {
    id: 6,
    openId: "igs_admin_mariama_kourouma",
    name: "Mariama Kourouma (Directrice G\xE9n\xE9rale Adjointe)",
    email: "m.kourouma@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 620 98 76 54",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:10:00Z")
  },
  {
    id: 7,
    openId: "igs_admin_sekouba_keita",
    name: "Sekouba Keita (Responsable Sydonia & GUCEG)",
    email: "s.keita@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 621 33 44 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:30:00Z")
  },
  {
    id: 8,
    openId: "igs_manager_hadja_diallo",
    name: "Hadja Aissatou Diallo (Superviseur Port Kamsar)",
    email: "a.diallo.kamsar@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 622 77 88 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T16:40:00Z")
  },
  {
    id: 9,
    openId: "igs_admin_ousmane_bah",
    name: "Ousmane Bah (Directeur Transit Maritime)",
    email: "o.bah@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 623 11 22 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:15:00Z")
  },
  {
    id: 10,
    openId: "igs_manager_fatoumata_balde",
    name: "Fatoumata Binta Balde (Audit Interne & Qualit\xE9)",
    email: "fb.balde@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 624 55 66 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:55:00Z")
  },
  {
    id: 11,
    openId: "igs_admin_mohamed_cisse",
    name: "Mohamed Lamine Cisse (Chef des Relations Douane)",
    email: "ml.cisse@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 625 22 33 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:05:00Z")
  },
  {
    id: 12,
    openId: "igs_manager_kadiatou_sylla",
    name: "Kadiatou Sylla (Superviseur Quai Nord PAC)",
    email: "k.sylla@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 626 44 88 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:15:00Z")
  },
  {
    id: 13,
    openId: "igs_manager_thierno_diallo",
    name: "Thierno Sadou Diallo (Chef d'Agence Kamsar)",
    email: "ts.diallo@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 627 99 00 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T14:20:00Z")
  },
  {
    id: 14,
    openId: "igs_admin_ibrahima_bangoura",
    name: "Ibrahima Sory Bangoura (Responsable IT & S\xE9curit\xE9)",
    email: "is.bangoura@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 628 33 55 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:10:00Z")
  },
  {
    id: 15,
    openId: "igs_manager_djiba_camara",
    name: "Djiba Camara (Manager Relations GUCEG PAC)",
    email: "d.camara@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 629 11 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T07:45:00Z")
  },
  {
    id: 16,
    openId: "igs_manager_cellou_diallo",
    name: "Mamadou Cellou Diallo (Responsable HSE Portuaire)",
    email: "mc.diallo@igs-logistics.gn",
    loginMethod: "direct",
    role: "manager",
    clientCompany: null,
    phone: "+224 660 55 66 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-18T16:30:00Z")
  },
  // --- 3. DÉCLARANTS DOUANE PAC & PORTS (45) ---
  {
    id: 17,
    openId: "igs_declarant_lamarana_diallo",
    name: "Mamadou Lamarana Diallo (Quai Nord)",
    email: "ml.diallo@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 621 44 11 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:40:00Z")
  },
  {
    id: 18,
    openId: "igs_declarant_aboubacar_soumah",
    name: "Aboubacar Soumah (Terminal Conteneurs PAC)",
    email: "a.soumah@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 622 33 22 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-22T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:25:00Z")
  },
  {
    id: 19,
    openId: "igs_declarant_amadou_barry",
    name: "Amadou Tidiane Barry (SYDONIA PAC)",
    email: "at.barry@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 623 55 66 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:30:00Z")
  },
  {
    id: 20,
    openId: "igs_declarant_mohamed_camara",
    name: "Mohamed Camara (Quai Sud PAC)",
    email: "m.camara@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 624 88 99 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:45:00Z")
  },
  {
    id: 21,
    openId: "igs_declarant_sekou_conde",
    name: "Sekou Conde (Terminal Ro-Ro)",
    email: "s.conde@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 625 77 11 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:10:00Z")
  },
  {
    id: 22,
    openId: "igs_declarant_alpha_oumar_diallo",
    name: "Alpha Oumar Diallo (Port Min\xE9ralier Kamsar)",
    email: "ao.diallo@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 626 22 44 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T17:15:00Z")
  },
  {
    id: 23,
    openId: "igs_declarant_kalil_traore",
    name: "Ibrahima Kalil Traore (Bureau Douane PAC)",
    email: "ik.traore@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 627 66 88 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-12T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:40:00Z")
  },
  {
    id: 24,
    openId: "igs_declarant_morlaye_sylla",
    name: "Morlaye Sylla (Terminal Vraquier)",
    email: "m.sylla@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 628 44 99 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:20:00Z")
  },
  {
    id: 25,
    openId: "igs_declarant_fode_bangoura",
    name: "Fode Bangoura (Bureau GUCEG Conakry)",
    email: "f.bangoura@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 629 88 22 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-18T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:05:00Z")
  },
  {
    id: 26,
    openId: "igs_declarant_cheick_toure",
    name: "Cheick Ahmed Toure (Terminal P\xE9trolier)",
    email: "ca.toure@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 660 11 33 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z")
  },
  {
    id: 27,
    openId: "igs_declarant_abdoulaye_balde",
    name: "Abdoulaye Balde (Quai Commercial PAC)",
    email: "a.balde@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 661 44 77 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:25:00Z")
  },
  {
    id: 28,
    openId: "igs_declarant_lansana_keita",
    name: "Lansana Keita (Sydonia BAE/BL)",
    email: "l.keita@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 662 22 55 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:05:00Z")
  },
  {
    id: 29,
    openId: "igs_declarant_saliou_sow",
    name: "Mamadou Saliou Sow (Quai Ouest PAC)",
    email: "ms.sow@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 663 88 11 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:50:00Z")
  },
  {
    id: 30,
    openId: "igs_declarant_oumar_bah",
    name: "Oumar Bah (DDI & Bulletin Liquidation)",
    email: "o.bah.douane@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 664 33 66 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:35:00Z")
  },
  {
    id: 31,
    openId: "igs_declarant_youssouf_camara",
    name: "Youssouf Camara (Zone Matoto & Entrep\xF4ts)",
    email: "y.camara@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 665 77 00 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-12T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T15:10:00Z")
  },
  {
    id: 32,
    openId: "igs_declarant_aly_cisse",
    name: "Aly Badara Cisse (Transit Fronti\xE8re)",
    email: "ab.cisse@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 666 11 44 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:20:00Z")
  },
  {
    id: 33,
    openId: "igs_declarant_sekou_diakite",
    name: "S\xE9kou Oumar Diakite (Port Min\xE9ralier Boffa)",
    email: "so.diakite@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 667 55 88 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:15:00Z")
  },
  {
    id: 34,
    openId: "igs_declarant_boubacar_diallo",
    name: "Boubacar Diallo (Port de Bok\xE9 Dapilon)",
    email: "b.diallo.boke@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 668 99 22 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T18:00:00Z")
  },
  {
    id: 35,
    openId: "igs_declarant_alpha_barry_kamsar",
    name: "Mamadou Alpha Barry (Bauxite Kamsar)",
    email: "ma.barry.kamsar@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 669 33 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T07:30:00Z")
  },
  {
    id: 36,
    openId: "igs_declarant_alhassane_soumah",
    name: "Alhassane Soumah (PAC Quai Nord 2)",
    email: "a.soumah.pac@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 620 44 77 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:00:00Z")
  },
  {
    id: 37,
    openId: "igs_declarant_sory_diane",
    name: "Ibrahima Sory Diane (SYDONIA Kamsar)",
    email: "is.diane@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 621 88 11 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:40:00Z")
  },
  {
    id: 38,
    openId: "igs_declarant_jean_loua",
    name: "Jean-Pierre Loua (R\xE9gime Transit N1)",
    email: "jp.loua@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 622 22 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:50:00Z")
  },
  {
    id: 39,
    openId: "igs_declarant_david_haba",
    name: "David Haba (D\xE9douanement V\xE9hicules PAC)",
    email: "d.haba@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 623 66 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:55:00Z")
  },
  {
    id: 40,
    openId: "igs_declarant_paul_lamah",
    name: "Paul Lamah (Fret Sp\xE9cialis\xE9)",
    email: "p.lamah@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 624 00 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:45:00Z")
  },
  {
    id: 41,
    openId: "igs_declarant_mohamed_cherif",
    name: "Mohamed Cherif (Hydrocarbures & Chimiques)",
    email: "m.cherif@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 625 44 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:20:00Z")
  },
  {
    id: 42,
    openId: "igs_declarant_mamady_kaba",
    name: "Mamady Kaba (Minerais & Vrac)",
    email: "m.kaba.vrac@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 626 88 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:10:00Z")
  },
  {
    id: 43,
    openId: "igs_declarant_souleymane_diallo",
    name: "Souleymane Diallo (DDI GUCEG)",
    email: "s.diallo.guceg@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 627 22 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:00:00Z")
  },
  {
    id: 44,
    openId: "igs_declarant_bakary_kante",
    name: "Bakary Kante (Terminal Conteneurs)",
    email: "b.kante@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 628 66 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:35:00Z")
  },
  {
    id: 45,
    openId: "igs_declarant_alseny_camara",
    name: "Alseny Camara (Acconage & Relevage PAC)",
    email: "a.camara.acconage@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 629 00 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:15:00Z")
  },
  {
    id: 46,
    openId: "igs_declarant_naby_toure",
    name: "Naby Youssouf Toure (Quai Sud)",
    email: "ny.toure@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 660 44 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:00:00Z")
  },
  {
    id: 47,
    openId: "igs_declarant_daouda_conde",
    name: "Daouda Conde (Magasin Calage PAC)",
    email: "d.conde.magasin@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 661 88 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:05:00Z")
  },
  {
    id: 48,
    openId: "igs_declarant_cherif_diallo",
    name: "Cherif Diallo (D\xE9barquement Min\xE9ralier)",
    email: "c.diallo.mineral@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 662 22 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T07:50:00Z")
  },
  {
    id: 49,
    openId: "igs_declarant_thierno_sow",
    name: "Thierno Oumar Sow (Quittance & BAE PAC)",
    email: "to.sow@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 663 66 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:55:00Z")
  },
  {
    id: 50,
    openId: "igs_declarant_ibrahima_bah",
    name: "Ibrahima Bah (Port Autonome Conakry)",
    email: "i.bah.pac@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 664 00 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:35:00Z")
  },
  {
    id: 51,
    openId: "igs_declarant_hady_diallo",
    name: "Mamadou Hady Diallo (SYDONIA Expert)",
    email: "mh.diallo@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 665 44 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:40:00Z")
  },
  {
    id: 52,
    openId: "igs_declarant_salifou_camara",
    name: "Salifou Camara (Terminal Fruiti\xE8re PAC)",
    email: "s.camara.fruit@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 666 88 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:15:00Z")
  },
  {
    id: 53,
    openId: "igs_declarant_yamoussa_bangoura",
    name: "Yamoussa Bangoura (Quai Nord Post 3)",
    email: "y.bangoura@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 667 22 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:25:00Z")
  },
  {
    id: 54,
    openId: "igs_declarant_almamy_toure",
    name: "Almamy Toure (Port Kamsar Nord)",
    email: "a.toure.kamsar@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 668 66 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-19T16:00:00Z")
  },
  {
    id: 55,
    openId: "igs_declarant_ousmane_diallo",
    name: "Ousmane Diallo (Conteneurs 40' PAC)",
    email: "o.diallo.tc@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 669 00 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:45:00Z")
  },
  {
    id: 56,
    openId: "igs_declarant_alpha_amadou_barry",
    name: "Alpha Amadou Barry (Sydonia N3)",
    email: "aa.barry@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 620 55 99 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:20:00Z")
  },
  {
    id: 57,
    openId: "igs_declarant_sory_camara",
    name: "Sory Camara (DDI Express Guceg)",
    email: "s.camara.express@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 621 99 33 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:10:00Z")
  },
  {
    id: 58,
    openId: "igs_declarant_fode_soumah",
    name: "Fode Soumah (Terminal Polyvalent PAC)",
    email: "f.soumah.tp@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 622 33 77 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:20:00Z")
  },
  {
    id: 59,
    openId: "igs_declarant_facinet_camara",
    name: "Facinet Camara (Compte Suspendu)",
    email: "f.camara.suspendu@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 623 77 11 55",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-10T14:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-08-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-10T14:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-10T13:45:00Z")
  },
  {
    id: 60,
    openId: "igs_declarant_karamo_kaba",
    name: "Karamo Kaba (Compte Suspendu)",
    email: "k.kaba.suspendu@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 624 11 55 99",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-12T10:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-08-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-12T10:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-12T09:30:00Z")
  },
  {
    id: 61,
    openId: "igs_declarant_lamine_keita",
    name: "Lamine Keita (Compte Suspendu)",
    email: "l.keita.suspendu@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 625 55 99 33",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-15T09:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-08-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-15T09:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-15T08:50:00Z")
  },
  // --- 4. COMPTABLES & GESTIONNAIRES FINANCIERS (18) ---
  {
    id: 62,
    openId: "igs_comptable_aissatou_diallo",
    name: "Aissatou Bella Diallo (Facturation GNF/USD)",
    email: "ab.diallo.finance@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 626 99 33 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-18T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:00:00Z")
  },
  {
    id: 63,
    openId: "igs_comptable_fode_sylla",
    name: "Mohamed Fode Sylla (D\xE9bours PAC & Surestaries)",
    email: "mf.sylla@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 627 33 77 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:30:00Z")
  },
  {
    id: 64,
    openId: "igs_comptable_mariama_camara",
    name: "Mariama Cir\xE9 Camara (Tr\xE9sorerie & Encaissements)",
    email: "mc.camara.tresor@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 628 77 11 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:15:00Z")
  },
  {
    id: 65,
    openId: "igs_comptable_thierno_barry",
    name: "Thierno Souleymane Barry (Rapprochement Bancaire)",
    email: "ts.barry.finance@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 629 11 55 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:45:00Z")
  },
  {
    id: 66,
    openId: "igs_comptable_fatoumata_diallo",
    name: "Fatoumata Binta Diallo (Droits Douane & DDI)",
    email: "fb.diallo.douane@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 660 55 99 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:30:00Z")
  },
  {
    id: 67,
    openId: "igs_comptable_kalil_kaba",
    name: "Ibrahima Kalil Kaba (Auditeur Factures & Marges)",
    email: "ik.kaba.audit@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 661 99 33 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:50:00Z")
  },
  {
    id: 68,
    openId: "igs_comptable_aminata_traore",
    name: "Aminata Traore (Fournisseurs & Armateurs)",
    email: "a.traore.armateurs@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 662 33 77 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:35:00Z")
  },
  {
    id: 69,
    openId: "igs_comptable_kadiatou_bah",
    name: "Kadiatou Bah (D\xE9bours Portuaires PAC)",
    email: "k.bah.debours@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 663 77 11 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:05:00Z")
  },
  {
    id: 70,
    openId: "igs_comptable_oumou_diallo",
    name: "Oumou Hawa Diallo (Factures D\xE9finitives)",
    email: "oh.diallo.definitif@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 664 11 55 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:15:00Z")
  },
  {
    id: 71,
    openId: "igs_comptable_sekouba_camara",
    name: "Sekouba Camara (Recouvrement Clients)",
    email: "s.camara.recouvrement@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 665 55 99 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:10:00Z")
  },
  {
    id: 72,
    openId: "igs_comptable_hadja_conde",
    name: "Hadja Saran Conde (Quittances Tr\xE9sor)",
    email: "hs.conde.tresor@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 666 99 33 77",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:40:00Z")
  },
  {
    id: 73,
    openId: "igs_comptable_bhoye_diallo",
    name: "Mamadou Bhoye Diallo (Devises USD/EUR)",
    email: "mb.diallo.devises@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 667 33 77 11",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:20:00Z")
  },
  {
    id: 74,
    openId: "igs_comptable_fanta_keita",
    name: "Fanta Keita (Frais Portuaires Conakry Terminal)",
    email: "f.keita.terminal@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 668 77 11 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:30:00Z")
  },
  {
    id: 75,
    openId: "igs_comptable_lamine_diane",
    name: "Mohamed Lamine Diane (Auditeur Comptable)",
    email: "ml.diane.audit@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 669 11 55 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:10:00Z")
  },
  {
    id: 76,
    openId: "igs_comptable_rouguiatou_sow",
    name: "Rouguiatou Sow (Facturation Portuaire)",
    email: "r.sow.port@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 620 33 66 99",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:50:00Z")
  },
  {
    id: 77,
    openId: "igs_comptable_kabinet_kaba",
    name: "Alpha Kabinet Kaba (Surestaries & Magasinage)",
    email: "ak.kaba.surestaries@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 621 77 00 33",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:10:00Z")
  },
  {
    id: 78,
    openId: "igs_comptable_baillo_bah",
    name: "Mamadou Baillo Bah (Compte Inactif)",
    email: "mb.bah.inactif@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 622 11 44 77",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-07-30T10:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-06-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-07-30T10:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-07-30T09:40:00Z")
  },
  {
    id: 79,
    openId: "igs_comptable_mariame_diallo",
    name: "Mariame Diallo (Compte Inactif)",
    email: "m.diallo.inactif@igs-logistics.gn",
    loginMethod: "direct",
    role: "comptable",
    clientCompany: null,
    phone: "+224 623 55 88 11",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-05T12:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-07-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-05T12:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-05T11:20:00Z")
  },
  // --- 5. REPRÉSENTANTS ENTREPRISES CLIENTES (32) ---
  {
    id: 80,
    openId: "client_birimian_aliou",
    name: "Mamadou Aliou Diallo (Birimian Gold)",
    email: "aliou.diallo@birimian-gold.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Guinean Birimian Gold S.A",
    phone: "+224 624 99 22 55",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:40:00Z")
  },
  {
    id: 81,
    openId: "client_topaz_fofana",
    name: "Ibrahima Kassory Fofana (TOPAZ)",
    email: "logistique@topaz.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "TOPAZ Multi-Industries S.A",
    phone: "+224 625 33 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:25:00Z")
  },
  {
    id: 82,
    openId: "client_smb_chen_wei",
    name: "Chen Wei (Soci\xE9t\xE9 Mini\xE8re de Bok\xE9)",
    email: "logistics@smb-boke.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 Mini\xE8re de Bok\xE9 (SMB)",
    phone: "+224 626 77 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:35:00Z")
  },
  {
    id: 83,
    openId: "client_cbg_morvan",
    name: "Pierre Morvan (Compagnie des Bauxites)",
    email: "supply@cbg-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Compagnie des Bauxites de Guin\xE9e (CBG)",
    phone: "+224 627 11 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-01-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:55:00Z")
  },
  {
    id: 84,
    openId: "client_gac_barry",
    name: "Alassane Barry (Guinea Alumina)",
    email: "import@gacguinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Guinea Alumina Corporation (GAC)",
    phone: "+224 628 55 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:00:00Z")
  },
  {
    id: 85,
    openId: "client_cdm_zhang_li",
    name: "Zhang Li (CDM-Chine Guin\xE9e)",
    email: "import@cdm-chine.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "CDM-Chine Guin\xE9e S.A",
    phone: "+224 629 99 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T07:45:00Z")
  },
  {
    id: 86,
    openId: "client_dangote_diop",
    name: "Souleymane Diop (Dangote Cement)",
    email: "transit@dangote-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Dangote Cement Guin\xE9e S.A",
    phone: "+224 660 33 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:05:00Z")
  },
  {
    id: 87,
    openId: "client_sobragui_bangoura",
    name: "Fatoumata Zahra Bangoura (Sobragui)",
    email: "achats@sobragui.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Sobragui S.A",
    phone: "+224 661 77 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:10:00Z")
  },
  {
    id: 88,
    openId: "client_ciments_camara",
    name: "Mamadou Saliou Camara (Ciments de Guin\xE9e)",
    email: "logistique@ciments-guinee.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Ciments de Guin\xE9e S.A",
    phone: "+224 662 11 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:15:00Z")
  },
  {
    id: 89,
    openId: "client_chanimex_chanim",
    name: "Karim Chanim (Chanimex Guin\xE9e)",
    email: "import@chanimex-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Chanimex Guin\xE9e S.A.R.L",
    phone: "+224 663 55 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-02-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:45:00Z")
  },
  {
    id: 90,
    openId: "client_total_dupont",
    name: "Alexandre Dupont (TotalEnergies Guin\xE9e)",
    email: "supply@totalenergies.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "TotalEnergies Marketing Guin\xE9e",
    phone: "+224 664 99 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:20:00Z")
  },
  {
    id: 91,
    openId: "client_soguipah_soumah",
    name: "Hadja M'Mahawa Soumah (SOGUIPAH)",
    email: "transit@soguipah.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "SOGUIPAH S.A",
    phone: "+224 665 33 66 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:50:00Z")
  },
  {
    id: 92,
    openId: "client_sag_cherif",
    name: "Ousmane Cherif (AngloGold Ashanti / SAG)",
    email: "logistics@anglogold-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 Anglogold Ashanti de Guin\xE9e (SAG)",
    phone: "+224 666 77 00 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:10:00Z")
  },
  {
    id: 93,
    openId: "client_belair_diallo",
    name: "Amadou Bailo Diallo (Bel Air Mining)",
    email: "import@belairmining.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Bel Air Mining Guin\xE9e S.A",
    phone: "+224 667 11 44 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:40:00Z")
  },
  {
    id: 94,
    openId: "client_amr_traore",
    name: "Sekou Traore (Alliance Mini\xE8re Responsable)",
    email: "ops@amr-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Alliance Mini\xE8re Responsable (AMR)",
    phone: "+224 668 55 88 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:15:00Z")
  },
  {
    id: 95,
    openId: "client_simfer_wang",
    name: "Wang Yong (Simfer Rio Tinto Simandou)",
    email: "supply.simandou@simfer.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Simfer S.A (Rio Tinto Simandou)",
    phone: "+224 669 99 22 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-03-25T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:45:00Z")
  },
  {
    id: 96,
    openId: "client_sg_bah",
    name: "Mariama Dalanda Bah (Soci\xE9t\xE9 G\xE9n\xE9rale Guin\xE9e)",
    email: "m.bah@socgen.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 G\xE9n\xE9rale Guin\xE9e",
    phone: "+224 620 11 55 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:05:00Z")
  },
  {
    id: 97,
    openId: "client_agl_bernard",
    name: "Christian Bernard (AGL Africa Global Logistics)",
    email: "c.bernard@aglgroup.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Africa Global Logistics Guin\xE9e (AGL)",
    phone: "+224 621 55 99 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-05T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:00:00Z")
  },
  {
    id: 98,
    openId: "client_katata_kaba",
    name: "Mohamed Lamine Kaba (Mining Co of Katata)",
    email: "transit@katatamining.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Mining Company of Katata (MCK)",
    phone: "+224 622 99 33 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:30:00Z")
  },
  {
    id: 99,
    openId: "client_mandiana_diallo",
    name: "Thierno Mamadou Diallo (Or Mandiana)",
    email: "direction@aurifere-mandiana.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 Aurif\xE8re de Mandiana S.A",
    phone: "+224 623 33 77 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:35:00Z")
  },
  {
    id: 100,
    openId: "client_soguicar_cisse",
    name: "Aissatou Cisse (Soguicar Concessionnaire)",
    email: "import@soguicar.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "SOGUICAR Guin\xE9e S.A",
    phone: "+224 624 77 11 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-04-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:20:00Z")
  },
  {
    id: 101,
    openId: "client_gi_camara",
    name: "Aboubacar Camara (Guin\xE9enne d'Industrie)",
    email: "achats@gi-guinee.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Guin\xE9enne d'Industrie (GI)",
    phone: "+224 625 11 55 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:10:00Z")
  },
  {
    id: 102,
    openId: "client_nimba_kpoghomou",
    name: "Julien Kpoghomou (Soci\xE9t\xE9 des Mines de Fer de Guin\xE9e)",
    email: "j.kpoghomou@smfg.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 des Mines de Fer de Guin\xE9e (SMFG)",
    phone: "+224 626 55 99 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:00:00Z")
  },
  {
    id: 103,
    openId: "client_navale_fofana",
    name: "Lansana Fofana (Soci\xE9t\xE9 Navale Guin\xE9enne)",
    email: "transit@navale-guinee.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Soci\xE9t\xE9 Navale Guin\xE9enne (SNG)",
    phone: "+224 627 99 33 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-05-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:05:00Z")
  },
  {
    id: 104,
    openId: "client_hydrocarbures_soumah",
    name: "Fatoumata Yarie Soumah (Continental Hydrocarbures)",
    email: "ops@continental-guinee.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Continental Hydrocarbures Guin\xE9e",
    phone: "+224 628 33 77 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:15:00Z")
  },
  {
    id: 105,
    openId: "client_lng_barry",
    name: "Mamadou Tahirou Barry (West Africa LNG)",
    email: "transit@walng-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "West Africa LNG Guin\xE9e",
    phone: "+224 629 77 11 44",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T10:30:00Z")
  },
  {
    id: 106,
    openId: "client_kimbo_conde",
    name: "Sory Conde (Bauxite Kimbo Guin\xE9e)",
    email: "ops@kimbo-bauxite.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Bauxite Kimbo Guin\xE9e S.A",
    phone: "+224 660 11 55 88",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-06-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T08:55:00Z")
  },
  {
    id: 107,
    openId: "client_kct_diakite",
    name: "Ibrahima Diakite (Kamsar Container Terminal)",
    email: "i.diakite@kct-guinee.com",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Kamsar Container Terminal Partners",
    phone: "+224 661 55 99 22",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T11:40:00Z")
  },
  {
    id: 108,
    openId: "client_agro_toure",
    name: "Abdoulaye Toure (Agro-Industrie Guin\xE9e)",
    email: "transit@agro-guinee.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Agro-Industrie de Guin\xE9e S.A",
    phone: "+224 662 99 33 66",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-10T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T09:25:00Z")
  },
  {
    id: 109,
    openId: "client_tg_diallo",
    name: "Diallo Abdoul Gadirou (Trans-Guin\xE9en Mines)",
    email: "ag.diallo@transguineen.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Trans-Guin\xE9en Chemin de Fer & Mines",
    phone: "+224 663 33 77 00",
    isActive: true,
    sessionRevokedAt: null,
    createdAt: /* @__PURE__ */ new Date("2025-07-15T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-20T08:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-20T12:05:00Z")
  },
  {
    id: 110,
    openId: "client_kipe_camara",
    name: "Naby Camara (Kipe Trading - Compte Suspendu)",
    email: "n.camara.suspendu@kipe-trading.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Kipe Trading & Mining S.A.R.L",
    phone: "+224 664 77 11 44",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-01T15:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-07-20T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-01T15:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-01T14:30:00Z")
  },
  {
    id: 111,
    openId: "client_conakry_bauxite_balde",
    name: "Mamadou Aliou Balde (Conakry Bauxite - Suspendu)",
    email: "ma.balde.suspendu@conakry-bauxite.gn",
    loginMethod: "direct",
    role: "client",
    clientCompany: "Conakry Bauxite Logistics",
    phone: "+224 665 11 55 88",
    isActive: false,
    sessionRevokedAt: /* @__PURE__ */ new Date("2026-08-08T11:00:00Z"),
    createdAt: /* @__PURE__ */ new Date("2025-08-01T08:00:00Z"),
    updatedAt: /* @__PURE__ */ new Date("2026-08-08T11:00:00Z"),
    lastSignedIn: /* @__PURE__ */ new Date("2026-08-08T10:45:00Z")
  }
];

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "igs-dossiers",
  cookieSecret: process.env.JWT_SECRET || "igs-secret-jwt-key-conakry-development-2026",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
var _client = null;
var fromSourceDate = (value) => value ? /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`) : null;
var _memoryUsers = initialUsersData.map((u) => ({ ...u }));
var _memoryReferenceItems = initialImportData.referenceItems.map((item, idx) => ({
  id: idx + 1,
  category: item.category,
  label: item.label,
  sortOrder: item.sortOrder,
  createdAt: /* @__PURE__ */ new Date()
}));
var _memoryDossiers = initialImportData.dossiers.map((source, idx) => {
  const payload = {
    ...source,
    eta: fromSourceDate(source.eta),
    goodsReleaseDate: fromSourceDate(source.goodsReleaseDate)
  };
  const state = calculateDossierState(payload);
  const now = /* @__PURE__ */ new Date();
  return {
    id: idx + 1,
    version: 1,
    dossierNumber: source.dossierNumber,
    clientDossierNumber: source.clientDossierNumber ?? null,
    client: source.client ?? null,
    blLtaNumber: source.blLtaNumber ?? null,
    cargoNature: source.cargoNature ?? null,
    transportMode: source.transportMode ?? null,
    eta: payload.eta,
    originPort: source.originPort ?? null,
    destinationPort: source.destinationPort ?? null,
    container: source.container ?? null,
    bulk: source.bulk ?? null,
    goodsReleaseDate: payload.goodsReleaseDate,
    declarationNumber: source.declarationNumber ?? null,
    bulletinNumber: source.bulletinNumber ?? null,
    finalDeclarationNumber: source.finalDeclarationNumber ?? null,
    ddiGucegNumber: idx % 2 === 0 ? `DDI-2026-GUCEG-${100 + idx + 1}` : null,
    badStatus: idx % 3 === 0 ? "Obtenu" : "En attente",
    baeStatus: idx % 3 === 0 ? "Accord\xE9" : "En attente",
    calculatedStatus: state.calculatedStatus,
    calculatedPriority: state.calculatedPriority,
    completionRate: state.completionRate,
    documentStatus: null,
    customsStatus: null,
    portStatus: null,
    financialStatus: idx % 3 === 0 ? "Factur\xE9" : idx % 3 === 1 ? "Fact. Proforma" : "En attente",
    fieldOperation: null,
    responsible: idx % 2 === 0 ? "Mamadou Diallo" : "Alpha Barry",
    nextAction: null,
    fieldAlert: state.calculatedStatus === "\xC0 r\xE9gulariser" ? "DDI / Bulletin \xE0 fournir" : null,
    deliveryLocation: null,
    declarant: "Mamadou Diallo",
    service: "Transit & D\xE9douanement",
    regime: "IM4 - Mise \xE0 la consommation",
    notes: null,
    portalAccessCode: `IGS-${1e3 + idx + 1}`,
    clientId: null,
    port: "Port Autonome de Conakry (PAC)",
    daysOnQuay: 0,
    createdById: 1,
    updatedById: 1,
    createdAt: now,
    updatedAt: now
  };
});
var _memoryDocuments = [
  {
    id: 1,
    dossierId: 1,
    name: "BL_HLCUNG12604AUQG1_Original.pdf",
    type: "BL",
    fileUrl: "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...",
    fileSize: 142500,
    mimeType: "application/pdf",
    uploadedById: 1,
    uploaderName: "Ibrahima Gold Service",
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 2,
    dossierId: 1,
    name: "Declaration_S142_SydoniaWorld.pdf",
    type: "Declaration_Douane",
    fileUrl: "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...",
    fileSize: 204800,
    mimeType: "application/pdf",
    uploadedById: 2,
    uploaderName: "Mamadou Diallo",
    createdAt: /* @__PURE__ */ new Date()
  }
];
var _memoryHistory = [
  {
    id: 1,
    dossierId: 1,
    changedById: 1,
    authorName: "Syst\xE8me IGS",
    userRole: "admin",
    action: "CREATION_DOSSIER",
    entityType: "dossier",
    entityId: 1,
    fieldChanged: "Cr\xE9ation Dossier",
    previousValue: null,
    newValue: "DOS-0001 import\xE9",
    beforeData: null,
    afterData: JSON.stringify({ dossierNumber: "DOS-0001" }),
    comment: "Initialisation automatique depuis le manifeste maritime",
    ipAddress: "127.0.0.1",
    metadata: null,
    createdAt: new Date(Date.now() - 864e5 * 3)
  },
  {
    id: 2,
    dossierId: 1,
    changedById: 2,
    authorName: "Mamadou Diallo",
    userRole: "declarant",
    action: "SYDONIA_DECLAREE",
    entityType: "dossier",
    entityId: 1,
    fieldChanged: "declarationNumber",
    previousValue: "Non renseign\xE9",
    newValue: "S 142- 27/07/2026",
    beforeData: JSON.stringify({ declarationNumber: null }),
    afterData: JSON.stringify({ declarationNumber: "S 142- 27/07/2026" }),
    comment: "Enregistrement de la d\xE9claration dans Sydonia++",
    ipAddress: "192.168.1.45",
    metadata: null,
    createdAt: new Date(Date.now() - 864e5 * 2)
  }
];
var _currentExchangeRate = 8650;
var _memoryInvoices = [
  {
    id: 1,
    dossierId: 1,
    invoiceNumber: "FAC-2026-0001",
    client: "Guinean Birimian Gold S.A",
    currency: "GNF",
    invoiceType: "Definitive",
    exchangeRate: 8650,
    amountHt: 185e5,
    amountTva: 333e4,
    amountTtc: 2183e4,
    disbursementsAmount: 45e6,
    customsDutiesAmount: 35e6,
    portFeesAmount: 1e7,
    storageAndDemurrageFees: 0,
    estimatedMargin: 55e5,
    paymentMethod: "Virement Bancaire",
    paymentReference: "VIR-2026-0812",
    receiptNumber: "REC-2026-0001",
    status: "\xC9mise",
    dueDate: new Date(Date.now() + 864e5 * 15),
    paidAt: null,
    notes: "Facture transit maritime 4 conteneurs 20 pieds",
    clientId: null,
    pdfUrl: null,
    createdById: 3,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }
];
var _memoryPayments = [
  {
    id: 1,
    invoiceId: 1,
    amount: 2183e4,
    currency: "GNF",
    paymentMethod: "Virement Bancaire",
    paymentReference: "VIR-2026-0812",
    paymentDate: /* @__PURE__ */ new Date(),
    proofUrl: null,
    notes: "Encaissement initial",
    createdById: 3,
    createdAt: /* @__PURE__ */ new Date()
  }
];
var _memoryPacDisbursements = [
  {
    id: 1,
    dossierId: 1,
    invoiceId: 1,
    type: "douane",
    amountAdvanced: 35e6,
    amountReimbursed: 35e6,
    status: "rembourse_total",
    receiptNumber: "REC-DOUANE-2026-01",
    notes: "Droits de douane SYDONIA S 142",
    createdById: 2,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  },
  {
    id: 2,
    dossierId: 1,
    invoiceId: 1,
    type: "port",
    amountAdvanced: 1e7,
    amountReimbursed: 1e7,
    status: "rembourse_total",
    receiptNumber: "REC-PAC-2026-01",
    notes: "Redevance portuaire PAC quai 3",
    createdById: 2,
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }
];
var _memoryTasks = [
  {
    id: 1,
    dossierId: 54,
    title: "D\xE9poser DDI GUCEG urgente pour DOS-0054 (New Japon Mining)",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 864e5 * 1),
    status: "A_faire",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 2,
    dossierId: 23,
    title: "Valider d\xE9claration SYDONIA World pour DOS-0023 (Guinean Birimian Gold)",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 864e5 * 2),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 3,
    dossierId: 21,
    title: "Obtenir Bon \xE0 D\xE9livrer (BAD) Port Autonome de Conakry pour DOS-0021",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 864e5 * 2),
    status: "A_faire",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 4,
    dossierId: 20,
    title: "Inspection physique conteneurs PAC quai terminal pour DOS-0020",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 864e5 * 3),
    status: "A_faire",
    priority: "Normale",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 5,
    dossierId: 3,
    title: "R\xE9gularisation bulletin de liquidation BLD Douane PAC pour DOS-0003",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 864e5 * 1),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 6,
    dossierId: 3,
    title: "Enregistrement paiement d\xE9bours douaniers & taxes PAC pour DOS-0003",
    assignedTo: "Fatoumata Camara",
    dueDate: new Date(Date.now() + 864e5 * 2),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 7,
    dossierId: 1,
    title: "\xC9mission facture d\xE9finitive & quittance pour DOS-0001",
    assignedTo: "Fatoumata Camara",
    dueDate: new Date(Date.now() + 864e5 * 4),
    status: "Termine",
    priority: "Normale",
    completedAt: /* @__PURE__ */ new Date(),
    createdById: 1,
    createdAt: /* @__PURE__ */ new Date()
  }
];
var _memoryComments = [
  {
    id: 1,
    dossierId: 1,
    authorId: 2,
    authorName: "Mamadou Diallo",
    message: "Inspection physique programm\xE9e sur le quai conteneur PAC demain matin \xE0 09h00.",
    createdAt: new Date(Date.now() - 36e5 * 4)
  }
];
var _memoryNotifications = [
  {
    id: 1,
    dossierId: 1,
    dossierNumber: "DOS-0001",
    type: "BULLETIN_MANQUANT",
    title: "Bulletin de liquidation manquant",
    message: "Le dossier DOS-0001 (Guinean Birimian Gold) n\xE9cessite le bulletin L 1774 pour finalisation.",
    recipientEmail: "contact@igs-logistics.gn",
    recipientRole: "declarant",
    isRead: 0,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: 2,
    dossierId: 3,
    dossierNumber: "DOS-0003",
    type: "ETA_DEPASSEE",
    title: "Alerte ETA D\xE9pass\xE9e",
    message: "Le navire du dossier DOS-0003 est arriv\xE9 le 21/07/2026. Risque de surestaries au port de Conakry.",
    recipientEmail: "contact@igs-logistics.gn",
    recipientRole: "manager",
    isRead: 0,
    createdAt: /* @__PURE__ */ new Date()
  }
];
async function withDbTimeout(queryPromise, timeoutMs = 2500) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("DB_QUERY_TIMEOUT")), timeoutMs);
  });
  try {
    const res = await Promise.race([queryPromise, timeout]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      _client = postgres(process.env.DATABASE_URL, {
        max: isServerless ? 2 : 5,
        idle_timeout: 5,
        connect_timeout: 3,
        // 3s fail-fast connection timeout
        prepare: false,
        // Requis pour la compatibilité Supabase Transaction Pooler (Supavisor port 6543)
        onnotice: () => {
        }
      });
      _db = drizzle(_client);
    } catch (e) {
      console.warn("[DB] Fallback memory store actif:", e);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    try {
      const values = {
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        clientCompany: user.clientCompany ?? null,
        phone: user.phone ?? null,
        isActive: user.isActive ?? true,
        sessionRevokedAt: user.sessionRevokedAt ?? null,
        lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date()
      };
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: {
          name: values.name,
          email: values.email,
          role: values.role,
          clientCompany: values.clientCompany,
          phone: values.phone,
          isActive: values.isActive,
          sessionRevokedAt: values.sessionRevokedAt,
          lastSignedIn: values.lastSignedIn
        }
      });
      return;
    } catch (err) {
      console.warn("[DB] Error inserting user in DB, saving in memory:", err);
    }
  }
  const existingIdx = _memoryUsers.findIndex((u) => u.openId === user.openId);
  if (existingIdx >= 0) {
    _memoryUsers[existingIdx] = {
      ..._memoryUsers[existingIdx],
      ...user,
      updatedAt: /* @__PURE__ */ new Date(),
      lastSignedIn: /* @__PURE__ */ new Date()
    };
  } else {
    _memoryUsers.push({
      id: _memoryUsers.length > 0 ? Math.max(..._memoryUsers.map((u) => u.id)) + 1 : 1,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      clientCompany: user.clientCompany ?? null,
      phone: user.phone ?? null,
      isActive: user.isActive ?? true,
      sessionRevokedAt: user.sessionRevokedAt ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      lastSignedIn: /* @__PURE__ */ new Date()
    });
  }
}
async function getUserByOpenId(openId) {
  const mem = _memoryUsers.find((u) => u.openId === openId);
  if (mem) return mem;
  const db = await getDb();
  if (db) {
    try {
      const row = (await withDbTimeout(db.select().from(users).where(eq(users.openId, openId)).limit(1), 1500))[0];
      if (row) {
        _memoryUsers.push(row);
        return row;
      }
    } catch (err) {
      console.warn("[DB] Error fetching user from DB, fallback to memory:", err);
    }
  }
  return void 0;
}
async function getUserById(id) {
  const mem = _memoryUsers.find((u) => u.id === id);
  if (mem) return mem;
  const db = await getDb();
  if (db) {
    try {
      const row = (await withDbTimeout(db.select().from(users).where(eq(users.id, id)).limit(1), 1500))[0];
      if (row) return row;
    } catch (e) {
    }
  }
  return void 0;
}
async function listUsers(filters) {
  let list = [..._memoryUsers];
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(
      (u) => u.name && u.name.toLowerCase().includes(s) || u.email && u.email.toLowerCase().includes(s) || u.phone && u.phone.toLowerCase().includes(s) || u.clientCompany && u.clientCompany.toLowerCase().includes(s) || u.openId && u.openId.toLowerCase().includes(s)
    );
  }
  if (filters?.role && filters.role !== "all") {
    list = list.filter((u) => u.role === filters.role);
  }
  if (filters?.isActive !== void 0) {
    list = list.filter((u) => u.isActive === filters.isActive);
  }
  list.sort((a, b) => a.id - b.id);
  if (filters?.offset !== void 0 || filters?.limit !== void 0) {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? list.length;
    return list.slice(offset, offset + limit);
  }
  return list;
}
async function createUser(data) {
  const now = /* @__PURE__ */ new Date();
  const cleanEmail = data.email.toLowerCase().trim();
  const generatedOpenId = `igs_${data.role}_${cleanEmail.replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`;
  const newUser = {
    id: _memoryUsers.length > 0 ? Math.max(..._memoryUsers.map((u) => u.id)) + 1 : 1,
    openId: generatedOpenId,
    name: data.name.trim(),
    email: cleanEmail,
    loginMethod: "direct",
    role: data.role,
    clientCompany: data.role === "client" ? data.clientCompany ?? null : null,
    phone: data.phone?.trim() ?? null,
    isActive: data.isActive ?? true,
    sessionRevokedAt: data.isActive === false ? now : null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now
  };
  const db = await getDb();
  if (db) {
    try {
      const inserted = await db.insert(users).values({
        openId: newUser.openId,
        name: newUser.name,
        email: newUser.email,
        loginMethod: newUser.loginMethod,
        role: newUser.role,
        clientCompany: newUser.clientCompany,
        phone: newUser.phone,
        isActive: newUser.isActive,
        sessionRevokedAt: newUser.sessionRevokedAt,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        lastSignedIn: newUser.lastSignedIn
      }).returning();
      if (inserted[0]) {
        _memoryUsers.push(inserted[0]);
        return inserted[0];
      }
    } catch (err) {
      console.warn("[DB] Error inserting created user in DB, falling back to memory:", err);
    }
  }
  _memoryUsers.push(newUser);
  return newUser;
}
async function updateUser(id, data) {
  const userIdx = _memoryUsers.findIndex((u) => u.id === id);
  if (userIdx < 0) {
    throw new Error(`Utilisateur avec ID ${id} introuvable`);
  }
  const existing = _memoryUsers[userIdx];
  const now = /* @__PURE__ */ new Date();
  const updatedUser = {
    ...existing,
    name: data.name !== void 0 ? data.name : existing.name,
    email: data.email !== void 0 ? data.email.toLowerCase().trim() : existing.email,
    phone: data.phone !== void 0 ? data.phone : existing.phone,
    role: data.role !== void 0 ? data.role : existing.role,
    clientCompany: data.clientCompany !== void 0 ? data.clientCompany : existing.clientCompany,
    isActive: data.isActive !== void 0 ? data.isActive : existing.isActive,
    sessionRevokedAt: data.isActive === false && existing.isActive !== false ? now : data.isActive === true ? null : existing.sessionRevokedAt,
    updatedAt: now
  };
  const db = await getDb();
  if (db) {
    try {
      await db.update(users).set({
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        clientCompany: updatedUser.clientCompany,
        isActive: updatedUser.isActive,
        sessionRevokedAt: updatedUser.sessionRevokedAt,
        updatedAt: updatedUser.updatedAt
      }).where(eq(users.id, id));
    } catch (err) {
      console.warn("[DB] Error updating user in DB:", err);
    }
  }
  _memoryUsers[userIdx] = updatedUser;
  return updatedUser;
}
async function toggleUserStatus(id, isActive) {
  const userIdx = _memoryUsers.findIndex((u) => u.id === id);
  if (userIdx < 0) {
    throw new Error(`Utilisateur introuvable avec l'ID ${id}`);
  }
  const existing = _memoryUsers[userIdx];
  const now = /* @__PURE__ */ new Date();
  const updatedUser = {
    ...existing,
    isActive,
    sessionRevokedAt: !isActive ? now : null,
    updatedAt: now
  };
  const db = await getDb();
  if (db) {
    try {
      await db.update(users).set({
        isActive,
        sessionRevokedAt: updatedUser.sessionRevokedAt,
        updatedAt: now
      }).where(eq(users.id, id));
    } catch (err) {
      console.warn("[DB] Error toggling user status in DB:", err);
    }
  }
  _memoryUsers[userIdx] = updatedUser;
  return updatedUser;
}
async function getHRStats() {
  const all = _memoryUsers;
  const totalEmployees = all.length;
  const activeDeclarantsAtPort = all.filter((u) => u.role === "declarant" && u.isActive !== false).length;
  const activeComptables = all.filter((u) => u.role === "comptable" && u.isActive !== false).length;
  const connectedClients = all.filter((u) => u.role === "client" && u.isActive !== false).length;
  const totalActive = all.filter((u) => u.isActive !== false).length;
  const totalInactive = all.filter((u) => u.isActive === false).length;
  return {
    totalEmployees,
    activeDeclarantsAtPort,
    activeComptables,
    connectedClients,
    totalActive,
    totalInactive
  };
}
var _dossiersCacheTimestamp = 0;
var DOSSIERS_CACHE_TTL_MS = 3e3;
function invalidateDossiersCache() {
  _dossiersCacheTimestamp = 0;
}
async function listDossiers(filters = {}) {
  const now = Date.now();
  if (now - _dossiersCacheTimestamp > DOSSIERS_CACHE_TTL_MS || _memoryDossiers.length === 0) {
    const db = await getDb();
    if (db) {
      try {
        const dbResults = await withDbTimeout(
          db.select().from(dossiers).orderBy(desc(dossiers.updatedAt), asc(dossiers.dossierNumber)),
          1500
        );
        if (dbResults.length > 0) {
          _memoryDossiers = dbResults;
          _dossiersCacheTimestamp = now;
        }
      } catch (e) {
        console.warn("[DB] listDossiers DB sync failed or timed out, using memory store");
      }
    }
  }
  let list = [..._memoryDossiers];
  if (filters.currentUserCompany) {
    list = list.filter((d) => d.client?.toLowerCase().includes(filters.currentUserCompany.toLowerCase()));
  }
  if (filters.status) list = list.filter((d) => d.calculatedStatus === filters.status);
  if (filters.priority) list = list.filter((d) => d.calculatedPriority === filters.priority);
  if (filters.client) list = list.filter((d) => d.client === filters.client);
  if (filters.responsible) list = list.filter((d) => d.responsible === filters.responsible);
  if (filters.transportMode) list = list.filter((d) => d.transportMode === filters.transportMode);
  if (filters.etaFrom) list = list.filter((d) => d.eta && d.eta >= filters.etaFrom);
  if (filters.etaTo) list = list.filter((d) => d.eta && d.eta <= filters.etaTo);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (d) => d.dossierNumber && d.dossierNumber.toLowerCase().includes(s) || d.clientDossierNumber && d.clientDossierNumber.toLowerCase().includes(s) || d.client && d.client.toLowerCase().includes(s) || d.blLtaNumber && d.blLtaNumber.toLowerCase().includes(s) || d.cargoNature && d.cargoNature.toLowerCase().includes(s) || d.portalAccessCode && d.portalAccessCode.toLowerCase().includes(s)
    );
  }
  return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
async function getDossier(idOrIdentifier) {
  const rawStr = String(idOrIdentifier).trim();
  const numId = Number(idOrIdentifier);
  const isValidNum = !isNaN(numId) && Number.isInteger(numId) && numId > 0;
  const formattedNum = isValidNum ? formatDossierNumber(numId) : null;
  const upperStr = rawStr.toUpperCase();
  const lowerStr = rawStr.toLowerCase();
  let derivedId = null;
  const igsMatch = upperStr.match(/^IGS-(\d+)$/i);
  if (igsMatch) {
    const rawNum = parseInt(igsMatch[1], 10);
    derivedId = rawNum >= 1e3 ? rawNum - 1e3 : rawNum;
  }
  const dosMatch = upperStr.match(/^DOS-(\d+)$/i);
  if (dosMatch) {
    derivedId = parseInt(dosMatch[1], 10);
  }
  if (isValidNum) {
    const memoryById = _memoryDossiers.find((d) => d.id === numId);
    if (memoryById) return memoryById;
  }
  if (derivedId && derivedId > 0) {
    const memoryByDerived = _memoryDossiers.find((d) => d.id === derivedId);
    if (memoryByDerived) return memoryByDerived;
  }
  if (formattedNum) {
    const memoryByFormatted = _memoryDossiers.find((d) => d.dossierNumber?.toUpperCase() === formattedNum.toUpperCase());
    if (memoryByFormatted) return memoryByFormatted;
  }
  const memoryByMatch = _memoryDossiers.find((d) => {
    if (d.dossierNumber?.toUpperCase() === upperStr) return true;
    if (d.portalAccessCode?.toUpperCase() === upperStr) return true;
    if (d.blLtaNumber?.toUpperCase() === upperStr) return true;
    if (d.clientDossierNumber?.toUpperCase() === upperStr) return true;
    const portalCode = `IGS-${1e3 + d.id}`;
    if (portalCode.toUpperCase() === upperStr) return true;
    return false;
  });
  if (memoryByMatch) return memoryByMatch;
  const db = await getDb();
  if (db) {
    try {
      if (isValidNum) {
        const rowById = (await withDbTimeout(db.select().from(dossiers).where(eq(dossiers.id, numId)).limit(1), 1500))[0];
        if (rowById) return rowById;
      }
      if (derivedId && derivedId > 0) {
        const rowByDerived = (await withDbTimeout(db.select().from(dossiers).where(eq(dossiers.id, derivedId)).limit(1), 1500))[0];
        if (rowByDerived) return rowByDerived;
      }
      if (formattedNum) {
        const rowByFormatted = (await withDbTimeout(db.select().from(dossiers).where(eq(dossiers.dossierNumber, formattedNum)).limit(1), 1500))[0];
        if (rowByFormatted) return rowByFormatted;
      }
      const conditions = [
        ilike(dossiers.dossierNumber, upperStr),
        ilike(dossiers.portalAccessCode, upperStr),
        ilike(dossiers.blLtaNumber, upperStr),
        ilike(dossiers.clientDossierNumber, upperStr),
        sql`LOWER(TRIM(${dossiers.portalAccessCode})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.dossierNumber})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.blLtaNumber})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.clientDossierNumber})) = ${lowerStr}`
      ];
      const row = (await withDbTimeout(db.select().from(dossiers).where(or(...conditions)).limit(1), 1500))[0];
      if (row) return row;
    } catch (e) {
      console.warn("[DB] getDossier database query error:", e);
    }
  }
  return void 0;
}
async function getDossierByPortalCode(portalAccessCode) {
  const rawStr = String(portalAccessCode || "").trim();
  if (!rawStr) return void 0;
  const upperStr = rawStr.toUpperCase();
  const lowerStr = rawStr.toLowerCase();
  let derivedId = null;
  const igsMatch = upperStr.match(/^IGS-(\d+)$/i);
  if (igsMatch) {
    const rawNum = parseInt(igsMatch[1], 10);
    derivedId = rawNum >= 1e3 ? rawNum - 1e3 : rawNum;
  }
  const dosMatch = upperStr.match(/^DOS-(\d+)$/i);
  if (dosMatch) {
    derivedId = parseInt(dosMatch[1], 10);
  }
  if (/^\d+$/.test(rawStr)) {
    const rawNum = parseInt(rawStr, 10);
    derivedId = rawNum >= 1e3 ? rawNum - 1e3 : rawNum;
  }
  const memoryMatch = _memoryDossiers.find((d) => {
    if (d.portalAccessCode?.trim().toUpperCase() === upperStr) return true;
    if (d.dossierNumber?.trim().toUpperCase() === upperStr) return true;
    if (d.blLtaNumber?.trim().toUpperCase() === upperStr) return true;
    if (d.clientDossierNumber?.trim().toUpperCase() === upperStr) return true;
    const generatedPortalCode = `IGS-${1e3 + d.id}`;
    if (generatedPortalCode.toUpperCase() === upperStr) return true;
    if (derivedId && d.id === derivedId) return true;
    if (d.portalAccessCode?.trim().toLowerCase() === lowerStr) return true;
    if (d.dossierNumber?.trim().toLowerCase() === lowerStr) return true;
    if (d.blLtaNumber?.trim().toLowerCase() === lowerStr) return true;
    if (d.clientDossierNumber?.trim().toLowerCase() === lowerStr) return true;
    return false;
  });
  if (memoryMatch) return memoryMatch;
  const db = await getDb();
  if (db) {
    try {
      const conditions = [
        ilike(dossiers.portalAccessCode, upperStr),
        ilike(dossiers.portalAccessCode, `%${upperStr}%`),
        ilike(dossiers.dossierNumber, upperStr),
        ilike(dossiers.blLtaNumber, upperStr),
        ilike(dossiers.clientDossierNumber, upperStr),
        sql`LOWER(TRIM(${dossiers.portalAccessCode})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.dossierNumber})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.blLtaNumber})) = ${lowerStr}`,
        sql`LOWER(TRIM(${dossiers.clientDossierNumber})) = ${lowerStr}`
      ];
      if (derivedId && derivedId > 0) {
        conditions.push(eq(dossiers.id, derivedId));
        conditions.push(eq(dossiers.dossierNumber, formatDossierNumber(derivedId)));
      }
      const row = (await withDbTimeout(
        db.select().from(dossiers).where(or(...conditions)).limit(1),
        2e3
      ))[0];
      if (row) return row;
    } catch (e) {
      console.error("[DB] getDossierByPortalCode database query error:", e);
    }
  }
  return void 0;
}
async function createDossier(input, userId, authorName) {
  const sequence = _memoryDossiers.length + 1;
  const num = formatDossierNumber(sequence);
  const state = calculateDossierState(input);
  const portalCode = `IGS-${1e3 + sequence}`;
  const now = /* @__PURE__ */ new Date();
  const newDossier = {
    id: sequence,
    version: 1,
    dossierNumber: num,
    clientDossierNumber: input.clientDossierNumber ?? null,
    client: input.client ?? null,
    blLtaNumber: input.blLtaNumber ?? null,
    cargoNature: input.cargoNature ?? null,
    transportMode: input.transportMode ?? null,
    eta: input.eta ?? null,
    originPort: input.originPort ?? null,
    destinationPort: input.destinationPort ?? null,
    container: input.container ?? null,
    bulk: input.bulk ?? null,
    goodsReleaseDate: input.goodsReleaseDate ?? null,
    declarationNumber: input.declarationNumber ?? null,
    bulletinNumber: input.bulletinNumber ?? null,
    finalDeclarationNumber: input.finalDeclarationNumber ?? null,
    ddiGucegNumber: input.ddiGucegNumber ?? null,
    badStatus: input.badStatus ?? "En attente",
    baeStatus: input.baeStatus ?? "En attente",
    calculatedStatus: state.calculatedStatus,
    calculatedPriority: state.calculatedPriority,
    completionRate: state.completionRate,
    documentStatus: input.documentStatus ?? null,
    customsStatus: input.customsStatus ?? null,
    portStatus: input.portStatus ?? null,
    financialStatus: input.financialStatus ?? "En attente",
    fieldOperation: input.fieldOperation ?? null,
    responsible: input.responsible ?? null,
    nextAction: input.nextAction ?? null,
    fieldAlert: input.fieldAlert ?? null,
    deliveryLocation: input.deliveryLocation ?? null,
    declarant: input.declarant ?? null,
    service: input.service ?? "Transit & D\xE9douanement",
    regime: input.regime ?? "IM4",
    notes: input.notes ?? null,
    portalAccessCode: portalCode,
    clientId: input.clientId ?? null,
    port: input.port ?? "Port Autonome de Conakry (PAC)",
    daysOnQuay: input.daysOnQuay ?? 0,
    createdById: userId ?? 1,
    updatedById: userId ?? 1,
    createdAt: now,
    updatedAt: now
  };
  _memoryDossiers.unshift(newDossier);
  await logAuditEvent({
    dossierId: newDossier.id,
    userId: userId ?? 1,
    userName: authorName ?? "Utilisateur",
    userRole: "declarant",
    action: "DOSSIER_CREE",
    entityType: "dossier",
    entityId: newDossier.id,
    fieldChanged: "Cr\xE9ation Dossier",
    previousValue: null,
    newValue: `Dossier ${num} cr\xE9\xE9`,
    afterData: { dossierNumber: num, client: newDossier.client, blLtaNumber: newDossier.blLtaNumber },
    comment: `Portail client: ${portalCode}`
  });
  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossiers).values({ ...input, version: 1, dossierNumber: num, portalAccessCode: portalCode, ...state, createdById: userId, updatedById: userId });
    } catch (e) {
      console.warn("[DB] Failed to insert dossier in DB, stored in memory");
    }
  }
  invalidateDossiersCache();
  return newDossier;
}
function formatAuditValue(val) {
  if (val === null || val === void 0) return "Vide";
  if (val === "") return "Vide";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}
var dossierMutexMap = /* @__PURE__ */ new Map();
async function runWithDossierLock(dossierId, fn) {
  const previousLock = dossierMutexMap.get(dossierId) || Promise.resolve();
  let releaseLock;
  const currentLock = new Promise((resolve) => {
    releaseLock = resolve;
  });
  dossierMutexMap.set(dossierId, currentLock);
  await previousLock.catch(() => {
  });
  try {
    return await fn();
  } finally {
    releaseLock();
    if (dossierMutexMap.get(dossierId) === currentLock) {
      dossierMutexMap.delete(dossierId);
    }
  }
}
async function updateDossier(id, input, userId, authorName, options) {
  return runWithDossierLock(id, async () => {
    const current = await getDossier(id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });
    if (!options?.forceOverwrite) {
      if (options?.expectedVersion !== void 0 && current.version !== options.expectedVersion) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Conflit d'\xE9dition simultan\xE9e : ce dossier a \xE9t\xE9 modifi\xE9 par un autre utilisateur (version locale: v${options.expectedVersion}, version serveur: v${current.version}). Veuillez recharger ou \xE9craser les modifications.`
        });
      }
      if (options?.expectedUpdatedAt !== void 0) {
        const expectedTime = new Date(options.expectedUpdatedAt).getTime();
        const currentTime = new Date(current.updatedAt).getTime();
        if (!isNaN(expectedTime) && !isNaN(currentTime) && Math.abs(currentTime - expectedTime) > 1e3) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Conflit d'\xE9dition simultan\xE9e : ce dossier a \xE9t\xE9 modifi\xE9 par un autre utilisateur. Veuillez recharger ou \xE9craser les modifications."
          });
        }
      }
    }
    const nextVersion = (current.version || 1) + 1;
    const state = calculateDossierState({ ...current, ...input });
    const now = /* @__PURE__ */ new Date();
    const historyEntries = [];
    const actionMap = {
      ddiGucegNumber: "DDI_MODIFIEE",
      declarationNumber: "SYDONIA_DECLAREE",
      bulletinNumber: "BLD_LIQUIDEE",
      finalDeclarationNumber: "DECLARATION_DEFINITIVE_ENREGISTREE",
      badStatus: "BAD_STATUT_MODIFIE",
      baeStatus: "BAE_STATUT_MODIFIE",
      goodsReleaseDate: "SORTIE_PAC_ENREGISTREE",
      customsStatus: "STATUT_DOUANE_MODIFIE",
      portStatus: "STATUT_PORT_MODIFIE",
      financialStatus: "STATUT_FINANCIER_MODIFIE",
      cargoNature: "CARGAISON_MODIFIEE",
      transportMode: "MODE_TRANSPORT_MODIFIE",
      eta: "ETA_MODIFIEE",
      notes: "NOTE_MODIFIEE"
    };
    for (const [key, val] of Object.entries(input)) {
      const oldVal = current[key];
      if (oldVal !== val && val !== void 0) {
        const action = actionMap[key] || `MODIFICATION_${key.toUpperCase()}`;
        const entry = {
          id: _memoryHistory.length + historyEntries.length + 1,
          dossierId: id,
          changedById: userId ?? 1,
          authorName: authorName ?? "Utilisateur",
          userRole: options?.userRole ?? "declarant",
          action,
          entityType: "dossier",
          entityId: id,
          fieldChanged: key,
          previousValue: formatAuditValue(oldVal),
          newValue: formatAuditValue(val),
          beforeData: JSON.stringify({ [key]: oldVal instanceof Date ? oldVal.toISOString() : oldVal }),
          afterData: JSON.stringify({ [key]: val instanceof Date ? val.toISOString() : val }),
          comment: `Mise \xE0 jour ${key}`,
          ipAddress: options?.ipAddress ?? null,
          metadata: null,
          createdAt: now
        };
        _memoryHistory.unshift(entry);
        historyEntries.push(entry);
      }
    }
    const updated = {
      ...current,
      ...input,
      ...state,
      version: nextVersion,
      updatedById: userId ?? current.updatedById,
      updatedAt: now
    };
    const memIdx = _memoryDossiers.findIndex((d) => d.id === id);
    if (memIdx >= 0) _memoryDossiers[memIdx] = updated;
    const db = await getDb();
    if (db) {
      try {
        await withDbTimeout(
          Promise.all([
            db.update(dossiers).set({ ...input, ...state, version: nextVersion, updatedById: userId, updatedAt: now }).where(eq(dossiers.id, id)),
            historyEntries.length > 0 ? db.insert(dossierStatusHistory).values(historyEntries) : Promise.resolve()
          ]),
          2e3
        );
      } catch (e) {
        console.warn("[DB] updateDossier DB sync error or timeout, saved in memory:", e);
      }
    }
    invalidateDossiersCache();
    return updated;
  });
}
async function importDossiersBatch(items, userId, authorName) {
  if (items.length === 0) {
    return { total: 0, createdCount: 0, updatedCount: 0, duplicatesPrevented: 0, dossiers: [] };
  }
  const db = await getDb();
  const existingMapByBL = /* @__PURE__ */ new Map();
  const existingMapByClientRef = /* @__PURE__ */ new Map();
  for (const d of _memoryDossiers) {
    if (d.blLtaNumber) existingMapByBL.set(d.blLtaNumber.trim().toUpperCase(), d);
    if (d.clientDossierNumber) existingMapByClientRef.set(d.clientDossierNumber.trim().toUpperCase(), d);
  }
  if (db) {
    try {
      const dbAll = await db.select().from(dossiers);
      for (const d of dbAll) {
        if (d.blLtaNumber) existingMapByBL.set(d.blLtaNumber.trim().toUpperCase(), d);
        if (d.clientDossierNumber) existingMapByClientRef.set(d.clientDossierNumber.trim().toUpperCase(), d);
      }
    } catch (e) {
    }
  }
  let createdCount = 0;
  let updatedCount = 0;
  const processed = [];
  const toInsertDB = [];
  const toUpdateDB = [];
  const historyBatch = [];
  let nextSequence = _memoryDossiers.length + 1;
  const now = /* @__PURE__ */ new Date();
  for (const item of items) {
    const cleanBL = item.blLtaNumber?.trim().toUpperCase() || "";
    const cleanClientNum = item.clientDossierNumber?.trim().toUpperCase() || "";
    let existing = void 0;
    if (cleanBL && existingMapByBL.has(cleanBL)) {
      existing = existingMapByBL.get(cleanBL);
    } else if (cleanClientNum && existingMapByClientRef.has(cleanClientNum)) {
      existing = existingMapByClientRef.get(cleanClientNum);
    }
    if (existing) {
      const mergedInput = {
        clientDossierNumber: item.clientDossierNumber || existing.clientDossierNumber,
        client: item.client || existing.client,
        blLtaNumber: item.blLtaNumber || existing.blLtaNumber,
        cargoNature: item.cargoNature || existing.cargoNature,
        transportMode: item.transportMode || existing.transportMode,
        eta: item.eta ?? existing.eta,
        originPort: item.originPort || existing.originPort,
        destinationPort: item.destinationPort || existing.destinationPort,
        container: item.container || existing.container,
        bulk: item.bulk || existing.bulk,
        goodsReleaseDate: item.goodsReleaseDate ?? existing.goodsReleaseDate,
        declarationNumber: item.declarationNumber || existing.declarationNumber,
        bulletinNumber: item.bulletinNumber || existing.bulletinNumber,
        finalDeclarationNumber: item.finalDeclarationNumber || existing.finalDeclarationNumber,
        ddiGucegNumber: item.ddiGucegNumber || existing.ddiGucegNumber,
        badStatus: item.badStatus || existing.badStatus,
        baeStatus: item.baeStatus || existing.baeStatus,
        customsStatus: item.customsStatus || existing.customsStatus,
        portStatus: item.portStatus || existing.portStatus,
        financialStatus: item.financialStatus || existing.financialStatus,
        regime: item.regime || existing.regime,
        fieldAlert: item.fieldAlert || existing.fieldAlert,
        deliveryLocation: item.deliveryLocation || existing.deliveryLocation,
        notes: item.notes || existing.notes,
        responsible: item.responsible || existing.responsible,
        declarant: item.declarant || existing.declarant,
        service: item.service || existing.service,
        documentStatus: item.documentStatus || existing.documentStatus,
        fieldOperation: item.fieldOperation || existing.fieldOperation,
        nextAction: item.nextAction || existing.nextAction
      };
      const state = calculateDossierState({ ...existing, ...mergedInput });
      const nextVer = (existing.version || 1) + 1;
      const updated = {
        ...existing,
        ...mergedInput,
        ...state,
        version: nextVer,
        updatedById: userId ?? existing.updatedById,
        updatedAt: now
      };
      const memIdx = _memoryDossiers.findIndex((d) => d.id === existing.id);
      if (memIdx >= 0) _memoryDossiers[memIdx] = updated;
      else _memoryDossiers.push(updated);
      if (cleanBL) existingMapByBL.set(cleanBL, updated);
      if (cleanClientNum) existingMapByClientRef.set(cleanClientNum, updated);
      toUpdateDB.push({ id: existing.id, data: { ...mergedInput, ...state, version: nextVer, updatedById: userId ?? 1, updatedAt: now } });
      const updateHistoryEntry = {
        id: _memoryHistory.length + 1,
        dossierId: existing.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        userRole: "declarant",
        action: "IMPORT_BATCH_FUSION",
        entityType: "dossier",
        entityId: existing.id,
        fieldChanged: "Mise \xE0 jour Import",
        previousValue: existing.calculatedStatus,
        newValue: state.calculatedStatus,
        beforeData: JSON.stringify({ calculatedStatus: existing.calculatedStatus }),
        afterData: JSON.stringify({ calculatedStatus: state.calculatedStatus }),
        comment: `Fusion automatique (${cleanBL || cleanClientNum})`,
        ipAddress: null,
        metadata: null,
        createdAt: now
      };
      _memoryHistory.unshift(updateHistoryEntry);
      historyBatch.push(updateHistoryEntry);
      processed.push(updated);
      updatedCount++;
    } else {
      const num = formatDossierNumber(nextSequence);
      const portalCode = `IGS-${1e3 + nextSequence}`;
      const state = calculateDossierState(item);
      const newDossier = {
        id: nextSequence,
        version: 1,
        dossierNumber: num,
        clientDossierNumber: item.clientDossierNumber ?? null,
        client: item.client ?? null,
        blLtaNumber: item.blLtaNumber ?? null,
        cargoNature: item.cargoNature ?? null,
        transportMode: item.transportMode ?? "Maritime",
        eta: item.eta ?? null,
        originPort: item.originPort ?? null,
        destinationPort: item.destinationPort ?? "Port Autonome de Conakry",
        container: item.container ?? null,
        bulk: item.bulk ?? null,
        goodsReleaseDate: item.goodsReleaseDate ?? null,
        declarationNumber: item.declarationNumber ?? null,
        bulletinNumber: item.bulletinNumber ?? null,
        finalDeclarationNumber: item.finalDeclarationNumber ?? null,
        ddiGucegNumber: item.ddiGucegNumber ?? null,
        badStatus: item.badStatus ?? "En attente",
        baeStatus: item.baeStatus ?? "En attente",
        calculatedStatus: state.calculatedStatus,
        calculatedPriority: state.calculatedPriority,
        completionRate: state.completionRate,
        documentStatus: item.documentStatus ?? null,
        customsStatus: item.customsStatus ?? null,
        portStatus: item.portStatus ?? null,
        financialStatus: item.financialStatus ?? "En attente",
        fieldOperation: item.fieldOperation ?? null,
        responsible: item.responsible ?? null,
        nextAction: item.nextAction ?? null,
        fieldAlert: item.fieldAlert ?? null,
        deliveryLocation: item.deliveryLocation ?? null,
        declarant: item.declarant ?? null,
        service: item.service ?? "Transit & D\xE9douanement",
        regime: item.regime ?? "IM4",
        notes: item.notes ?? null,
        portalAccessCode: portalCode,
        clientId: item.clientId ?? null,
        port: item.port ?? "Port Autonome de Conakry (PAC)",
        daysOnQuay: item.daysOnQuay ?? 0,
        createdById: userId ?? 1,
        updatedById: userId ?? 1,
        createdAt: now,
        updatedAt: now
      };
      _memoryDossiers.unshift(newDossier);
      if (cleanBL) existingMapByBL.set(cleanBL, newDossier);
      if (cleanClientNum) existingMapByClientRef.set(cleanClientNum, newDossier);
      toInsertDB.push({
        ...item,
        version: 1,
        dossierNumber: num,
        portalAccessCode: portalCode,
        ...state,
        createdById: userId ?? 1,
        updatedById: userId ?? 1,
        createdAt: now,
        updatedAt: now
      });
      const createHistoryEntry = {
        id: _memoryHistory.length + 1,
        dossierId: newDossier.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        userRole: "declarant",
        action: "DOSSIER_CREE",
        entityType: "dossier",
        entityId: newDossier.id,
        fieldChanged: "Cr\xE9ation Dossier",
        previousValue: null,
        newValue: `Dossier ${num} cr\xE9\xE9`,
        beforeData: null,
        afterData: JSON.stringify({ dossierNumber: num, client: newDossier.client, blLtaNumber: newDossier.blLtaNumber }),
        comment: `Import batch automatique`,
        ipAddress: null,
        metadata: null,
        createdAt: now
      };
      _memoryHistory.unshift(createHistoryEntry);
      historyBatch.push(createHistoryEntry);
      processed.push(newDossier);
      createdCount++;
      nextSequence++;
    }
  }
  if (db) {
    try {
      const dbPromises = [];
      if (toInsertDB.length > 0) {
        dbPromises.push(db.insert(dossiers).values(toInsertDB));
      }
      if (toUpdateDB.length > 0) {
        for (const u of toUpdateDB) {
          dbPromises.push(db.update(dossiers).set(u.data).where(eq(dossiers.id, u.id)));
        }
      }
      if (historyBatch.length > 0) {
        dbPromises.push(db.insert(dossierStatusHistory).values(historyBatch));
      }
      await Promise.allSettled(dbPromises);
    } catch (e) {
      console.warn("[DB] Batch sync partial warning:", e);
    }
  }
  return {
    total: processed.length,
    createdCount,
    updatedCount,
    duplicatesPrevented: updatedCount,
    dossiers: processed
  };
}
async function deleteDossier(id) {
  _memoryDossiers = _memoryDossiers.filter((d) => d.id !== id);
  invalidateDossiersCache();
  const db = await getDb();
  if (db) {
    try {
      await db.delete(dossiers).where(eq(dossiers.id, id));
    } catch (e) {
    }
  }
  return { success: true };
}
async function listDocuments(dossierId) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(documents).where(eq(documents.dossierId, dossierId)).orderBy(desc(documents.createdAt));
    } catch (e) {
    }
  }
  return _memoryDocuments.filter((doc) => doc.dossierId === dossierId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
async function createDocument(input) {
  const now = /* @__PURE__ */ new Date();
  const doc = {
    id: _memoryDocuments.length + 1,
    dossierId: input.dossierId,
    name: input.name,
    type: input.type ?? "Autre",
    fileUrl: input.fileUrl,
    fileSize: input.fileSize ?? 0,
    mimeType: input.mimeType ?? "application/octet-stream",
    uploadedById: input.uploadedById ?? 1,
    uploaderName: input.uploaderName ?? "Op\xE9rateur IGS",
    createdAt: now
  };
  _memoryDocuments.unshift(doc);
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.uploadedById ?? 1,
    userName: input.uploaderName ?? "Op\xE9rateur IGS",
    userRole: "declarant",
    action: "DOCUMENT_AJOUTE",
    entityType: "document",
    entityId: doc.id,
    fieldChanged: "Document",
    previousValue: null,
    newValue: `${doc.type}: ${doc.name}`,
    afterData: { name: doc.name, type: doc.type, fileSize: doc.fileSize, mimeType: doc.mimeType },
    metadata: { mimeType: doc.mimeType, fileSize: doc.fileSize },
    comment: `Fichier joint (${Math.round((doc.fileSize || 0) / 1024)} KB)`
  });
  const db = await getDb();
  if (db) {
    try {
      await db.insert(documents).values(input);
    } catch (e) {
    }
  }
  return doc;
}
async function deleteDocument(id, userId, authorName) {
  const targetDoc = _memoryDocuments.find((d) => d.id === id);
  _memoryDocuments = _memoryDocuments.filter((d) => d.id !== id);
  if (targetDoc) {
    await logAuditEvent({
      dossierId: targetDoc.dossierId,
      userId: userId ?? 1,
      userName: authorName ?? "Op\xE9rateur IGS",
      userRole: "declarant",
      action: "DOCUMENT_SUPPRIME",
      entityType: "document",
      entityId: id,
      fieldChanged: "Document",
      previousValue: `${targetDoc.type}: ${targetDoc.name}`,
      newValue: "Supprim\xE9",
      beforeData: { name: targetDoc.name, type: targetDoc.type, fileSize: targetDoc.fileSize },
      comment: `Suppression du document ${targetDoc.name}`
    });
  }
  const db = await getDb();
  if (db) {
    try {
      await db.delete(documents).where(eq(documents.id, id));
    } catch (e) {
    }
  }
  return { success: true };
}
async function logAuditEvent(params) {
  const now = params.createdAt ?? /* @__PURE__ */ new Date();
  const beforeStr = params.beforeData ? typeof params.beforeData === "string" ? params.beforeData : JSON.stringify(params.beforeData) : null;
  const afterStr = params.afterData ? typeof params.afterData === "string" ? params.afterData : JSON.stringify(params.afterData) : null;
  const metaStr = params.metadata ? typeof params.metadata === "string" ? params.metadata : JSON.stringify(params.metadata) : null;
  const entry = {
    id: _memoryHistory.length + 1,
    dossierId: params.dossierId ?? (params.entityType === "dossier" && params.entityId ? params.entityId : 0),
    changedById: params.userId ?? null,
    authorName: params.userName ?? "Syst\xE8me IGS",
    userRole: params.userRole ?? null,
    action: params.action,
    entityType: params.entityType ?? "dossier",
    entityId: params.entityId ?? params.dossierId ?? null,
    fieldChanged: params.fieldChanged ?? params.action,
    previousValue: params.previousValue === null || params.previousValue === void 0 ? null : formatAuditValue(params.previousValue),
    newValue: params.newValue === null || params.newValue === void 0 ? null : formatAuditValue(params.newValue),
    beforeData: beforeStr,
    afterData: afterStr,
    comment: params.comment ?? null,
    ipAddress: params.ipAddress ?? null,
    metadata: metaStr,
    createdAt: now
  };
  _memoryHistory.unshift(entry);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierStatusHistory).values(entry);
    } catch (e) {
      console.warn("[DB] Failed to insert audit log entry into DB:", e);
    }
  }
  return entry;
}
async function listDossierHistory(dossierId) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierStatusHistory).where(eq(dossierStatusHistory.dossierId, dossierId)).orderBy(desc(dossierStatusHistory.createdAt));
    } catch (e) {
    }
  }
  return _memoryHistory.filter((h) => h.dossierId === dossierId || h.entityType === "dossier" && h.entityId === dossierId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
async function listInvoices(dossierId) {
  let list = [..._memoryInvoices];
  if (list.length === 0) {
    const db = await getDb();
    if (db) {
      try {
        const rows = await withDbTimeout(
          db.select().from(invoices).where(dossierId ? eq(invoices.dossierId, dossierId) : void 0).orderBy(desc(invoices.createdAt)),
          1500
        );
        if (rows.length > 0) {
          _memoryInvoices = rows;
          list = [...rows];
        }
      } catch (e) {
        console.warn("[DB] Error or timeout querying invoices from DB, using fallback");
      }
    }
  }
  if (dossierId) list = list.filter((i) => i.dossierId === dossierId);
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
async function createInvoice(input) {
  const sequence = _memoryInvoices.length + 1;
  const invNum = input.invoiceNumber || `FAC-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(sequence).padStart(4, "0")}`;
  const now = /* @__PURE__ */ new Date();
  const customs = input.customsDutiesAmount ?? 0;
  const port = input.portFeesAmount ?? 0;
  const disbursements = input.disbursementsAmount ?? customs + port;
  const amountHt = input.amountHt ?? 0;
  const amountTva = input.amountTva ?? Math.round(amountHt * 0.18);
  const amountTtc = input.amountTtc ?? amountHt + amountTva;
  const isPaid = input.status === "Pay\xE9e";
  const inv = {
    id: sequence,
    dossierId: input.dossierId,
    invoiceNumber: invNum,
    client: input.client,
    currency: input.currency ?? "GNF",
    invoiceType: input.invoiceType ?? "Proforma",
    exchangeRate: input.exchangeRate ?? _currentExchangeRate ?? 8650,
    amountHt,
    amountTva,
    amountTtc,
    disbursementsAmount: disbursements,
    customsDutiesAmount: customs,
    portFeesAmount: port,
    storageAndDemurrageFees: input.storageAndDemurrageFees ?? 0,
    estimatedMargin: input.estimatedMargin ?? Math.round(amountHt * 0.25),
    paymentMethod: input.paymentMethod ?? null,
    paymentReference: input.paymentReference ?? null,
    receiptNumber: input.receiptNumber ?? (isPaid ? `REC-2026-${sequence}` : null),
    status: input.status ?? "Proforma",
    pdfUrl: input.pdfUrl ?? null,
    clientId: input.clientId ?? null,
    dueDate: input.dueDate ?? new Date(Date.now() + 864e5 * 30),
    paidAt: isPaid ? input.paidAt ?? now : null,
    notes: input.notes ?? null,
    createdById: input.createdById ?? 1,
    createdAt: now,
    updatedAt: now
  };
  _memoryInvoices.unshift(inv);
  await updateDossier(input.dossierId, { financialStatus: isPaid ? "Pay\xE9" : inv.invoiceType === "Proforma" ? "Fact. Proforma" : "Factur\xE9" });
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.createdById ?? 1,
    userName: "Service Comptabilit\xE9",
    userRole: "comptable",
    action: "FACTURE_CREEE",
    entityType: "invoice",
    entityId: inv.id,
    fieldChanged: "Facture",
    previousValue: null,
    newValue: `${inv.invoiceType} N\xB0 ${invNum}`,
    beforeData: null,
    afterData: {
      invoiceNumber: invNum,
      client: inv.client,
      amountHt,
      amountTva,
      amountTtc,
      disbursementsAmount: disbursements,
      currency: inv.currency,
      status: inv.status
    },
    comment: `\xC9mission facture ${inv.invoiceType} de ${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency} pour ${inv.client}`
  });
  try {
    await addNotification({
      dossierId: input.dossierId,
      dossierNumber: null,
      type: "FACTURE_GENEREE",
      title: `Facture ${invNum} g\xE9n\xE9r\xE9e`,
      message: `Facture ${inv.invoiceType} de ${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency} \xE9mise pour ${inv.client}.`,
      recipientRole: "comptable"
    });
  } catch (e) {
  }
  const db = await getDb();
  if (db) {
    try {
      await db.insert(invoices).values({ ...input, invoiceNumber: invNum, disbursementsAmount: disbursements, amountHt, amountTva, amountTtc, receiptNumber: inv.receiptNumber, paidAt: inv.paidAt });
    } catch (e) {
    }
  }
  return inv;
}
async function updateInvoice(id, input) {
  const idx = _memoryInvoices.findIndex((i) => i.id === id);
  const current = idx >= 0 ? _memoryInvoices[idx] : null;
  const now = /* @__PURE__ */ new Date();
  const isPaying = input.status === "Pay\xE9e";
  const updatedData = {
    ...input,
    updatedAt: now,
    ...isPaying && !input.paidAt ? { paidAt: now } : {},
    ...isPaying && !input.receiptNumber && (!current || !current.receiptNumber) ? { receiptNumber: `REC-2026-${id}` } : {}
  };
  if (idx >= 0 && current) {
    _memoryInvoices[idx] = {
      ...current,
      ...updatedData,
      status: updatedData.status ?? current.status,
      invoiceType: updatedData.invoiceType ?? current.invoiceType
    };
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(invoices).set(updatedData).where(eq(invoices.id, id));
    } catch (e) {
    }
  }
  let result = idx >= 0 ? _memoryInvoices[idx] : null;
  if (!result && db) {
    try {
      const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      if (rows.length > 0) result = rows[0];
    } catch (e) {
    }
  }
  if (result && result.dossierId) {
    if (result.status === "Pay\xE9e") {
      await updateDossier(result.dossierId, { financialStatus: "Pay\xE9" });
    } else if (result.invoiceType === "Definitive" || result.status === "\xC9mise") {
      await updateDossier(result.dossierId, { financialStatus: "Factur\xE9" });
    }
    await logAuditEvent({
      dossierId: result.dossierId,
      userId: 1,
      userName: "Service Comptabilit\xE9",
      userRole: "comptable",
      action: "FACTURE_MODIFIEE",
      entityType: "invoice",
      entityId: id,
      fieldChanged: "Statut Facture",
      previousValue: current?.status ?? null,
      newValue: result.status,
      afterData: { status: result.status, invoiceType: result.invoiceType },
      comment: `Facture ${result.invoiceNumber} mise \xE0 jour (Statut: ${result.status})`
    });
  }
  return result;
}
async function recordInvoicePayment(id, data) {
  const receiptNumber = "REC-2026-" + id;
  const now = /* @__PURE__ */ new Date();
  const idx = _memoryInvoices.findIndex((i) => i.id === id);
  let invoice = idx >= 0 ? _memoryInvoices[idx] : null;
  const finalAmount = data.paidAmount ?? (invoice?.amountTtc ?? 0);
  const updatePayload = {
    status: "Pay\xE9e",
    invoiceType: "Definitive",
    paidAt: now,
    paymentMethod: data.paymentMethod ?? "Virement Bancaire",
    paymentReference: data.paymentReference ?? `REF-PAY-${id}`,
    receiptNumber,
    ...data.paidAmount ? { amountTtc: data.paidAmount } : {},
    updatedAt: now
  };
  if (invoice) {
    _memoryInvoices[idx] = {
      ...invoice,
      ...updatePayload,
      status: "Pay\xE9e",
      invoiceType: "Definitive"
    };
    invoice = _memoryInvoices[idx];
  }
  const paymentEntry = {
    id: _memoryPayments.length + 1,
    invoiceId: id,
    amount: finalAmount,
    currency: invoice?.currency ?? "GNF",
    paymentMethod: data.paymentMethod ?? "Virement Bancaire",
    paymentReference: data.paymentReference ?? `REF-PAY-${id}`,
    paymentDate: now,
    proofUrl: data.proofUrl ?? null,
    notes: data.notes ?? null,
    createdById: data.userId ?? 1,
    createdAt: now
  };
  _memoryPayments.unshift(paymentEntry);
  const db = await getDb();
  if (db) {
    try {
      await db.update(invoices).set(updatePayload).where(eq(invoices.id, id));
      await db.insert(invoicePayments).values(paymentEntry);
      if (!invoice) {
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        if (rows.length > 0) invoice = rows[0];
      }
    } catch (e) {
    }
  }
  if (invoice?.dossierId) {
    await updateDossier(invoice.dossierId, { financialStatus: "Pay\xE9" });
    await logAuditEvent({
      dossierId: invoice.dossierId,
      userId: data.userId ?? 1,
      userName: "Service Comptabilit\xE9",
      userRole: "comptable",
      action: "PAIEMENT_ENCAISSE",
      entityType: "payment",
      entityId: paymentEntry.id,
      fieldChanged: "Paiement Facture",
      previousValue: "Non pay\xE9e",
      newValue: `Pay\xE9e (Quittance ${receiptNumber})`,
      beforeData: { status: "\xC9mise", paidAt: null },
      afterData: {
        receiptNumber,
        amount: finalAmount,
        currency: invoice.currency,
        paymentMethod: updatePayload.paymentMethod,
        paymentReference: updatePayload.paymentReference,
        paidAt: now
      },
      comment: `Encaissement de ${finalAmount.toLocaleString("fr-FR")} ${invoice.currency} (Mode: ${updatePayload.paymentMethod}, R\xE9f: ${updatePayload.paymentReference}, Quittance: ${receiptNumber})`
    });
    try {
      await addNotification({
        dossierId: invoice.dossierId,
        dossierNumber: null,
        type: "STATUT_MODIFIE",
        title: `Paiement encaiss\xE9 \u2014 Facture ${invoice.invoiceNumber}`,
        message: `Paiement de ${finalAmount.toLocaleString("fr-FR")} ${invoice.currency} enregistr\xE9 pour ${invoice.client} (Quittance ${receiptNumber}).`,
        recipientRole: "comptable"
      });
    } catch (e) {
    }
  }
  return invoice;
}
async function listInvoicePayments(invoiceId) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(invoicePayments).where(invoiceId ? eq(invoicePayments.invoiceId, invoiceId) : void 0).orderBy(desc(invoicePayments.paymentDate));
    } catch (e) {
    }
  }
  if (invoiceId) return _memoryPayments.filter((p) => p.invoiceId === invoiceId);
  return _memoryPayments;
}
async function listPacDisbursements(dossierId) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(pacDisbursements).where(dossierId ? eq(pacDisbursements.dossierId, dossierId) : void 0).orderBy(desc(pacDisbursements.createdAt));
    } catch (e) {
    }
  }
  if (dossierId) return _memoryPacDisbursements.filter((d) => d.dossierId === dossierId);
  return _memoryPacDisbursements;
}
async function createPacDisbursement(input, userId, authorName, userRole = "comptable") {
  const now = /* @__PURE__ */ new Date();
  const entry = {
    id: _memoryPacDisbursements.length + 1,
    dossierId: input.dossierId,
    invoiceId: input.invoiceId ?? null,
    type: input.type ?? "douane",
    amountAdvanced: input.amountAdvanced ?? 0,
    amountReimbursed: input.amountReimbursed ?? 0,
    status: input.status ?? "avance",
    receiptNumber: input.receiptNumber ?? null,
    notes: input.notes ?? null,
    createdById: userId ?? input.createdById ?? 1,
    createdAt: now,
    updatedAt: now
  };
  _memoryPacDisbursements.unshift(entry);
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: userId ?? input.createdById ?? 1,
    userName: authorName ?? "Agent Portuaire PAC",
    userRole,
    action: "DEBOURS_AVANCE",
    entityType: "disbursement",
    entityId: entry.id,
    fieldChanged: "D\xE9bours PAC",
    previousValue: null,
    newValue: `${entry.type.toUpperCase()} : ${entry.amountAdvanced.toLocaleString("fr-FR")} GNF`,
    beforeData: null,
    afterData: {
      type: entry.type,
      amountAdvanced: entry.amountAdvanced,
      receiptNumber: entry.receiptNumber,
      status: entry.status
    },
    metadata: { receiptNumber: entry.receiptNumber, type: entry.type },
    comment: `Avance d\xE9bours ${entry.type} de ${entry.amountAdvanced.toLocaleString("fr-FR")} GNF au Port Autonome de Conakry (Quittance: ${entry.receiptNumber || "N/A"})`
  });
  const db = await getDb();
  if (db) {
    try {
      await db.insert(pacDisbursements).values(entry);
    } catch (e) {
    }
  }
  return entry;
}
async function getExchangeRate() {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(referenceItems).where(eq(referenceItems.category, "exchange_rate")).limit(1);
      if (rows.length > 0) {
        const val = parseInt(rows[0].label, 10) || rows[0].sortOrder || 8650;
        _currentExchangeRate = val;
        return { rate: val, currencyPair: "USD/GNF", lastUpdated: rows[0].createdAt };
      }
    } catch (e) {
    }
  }
  return { rate: _currentExchangeRate, currencyPair: "USD/GNF", lastUpdated: /* @__PURE__ */ new Date() };
}
async function setExchangeRate(rate) {
  _currentExchangeRate = rate;
  const now = /* @__PURE__ */ new Date();
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(referenceItems).where(eq(referenceItems.category, "exchange_rate")).limit(1);
      if (rows.length > 0) {
        await db.update(referenceItems).set({ label: String(rate), sortOrder: rate }).where(eq(referenceItems.id, rows[0].id));
      } else {
        await db.insert(referenceItems).values({ category: "exchange_rate", label: String(rate), sortOrder: rate });
      }
    } catch (e) {
    }
  }
  const refIdx = _memoryReferenceItems.findIndex((r) => r.category === "exchange_rate");
  if (refIdx >= 0) {
    _memoryReferenceItems[refIdx].label = String(rate);
    _memoryReferenceItems[refIdx].sortOrder = rate;
  } else {
    _memoryReferenceItems.push({
      id: _memoryReferenceItems.length + 1,
      category: "exchange_rate",
      label: String(rate),
      sortOrder: rate,
      createdAt: now
    });
  }
  return { rate, currencyPair: "USD/GNF", lastUpdated: now };
}
async function listTasks(filterOrDossierId) {
  let filter = {};
  if (typeof filterOrDossierId === "number") {
    filter = { dossierId: filterOrDossierId };
  } else if (filterOrDossierId) {
    filter = filterOrDossierId;
  }
  const db = await getDb();
  if (db) {
    try {
      const conditions = [];
      if (filter.dossierId) conditions.push(eq(dossierTasks.dossierId, filter.dossierId));
      if (filter.status) conditions.push(eq(dossierTasks.status, filter.status));
      if (filter.assignedTo) conditions.push(like(dossierTasks.assignedTo, `%${filter.assignedTo}%`));
      return await db.select().from(dossierTasks).where(conditions.length > 0 ? and(...conditions) : void 0).orderBy(desc(dossierTasks.createdAt));
    } catch (e) {
    }
  }
  let list = [..._memoryTasks];
  if (filter.dossierId) list = list.filter((t2) => t2.dossierId === filter.dossierId);
  if (filter.status) list = list.filter((t2) => t2.status === filter.status);
  if (filter.assignedTo) {
    const needle = filter.assignedTo.toLowerCase();
    list = list.filter((t2) => t2.assignedTo && t2.assignedTo.toLowerCase().includes(needle));
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
async function createTask(input) {
  const task = {
    id: _memoryTasks.length + 1,
    dossierId: input.dossierId,
    title: input.title,
    assignedTo: input.assignedTo ?? "\xC9quipe Transit",
    dueDate: input.dueDate ?? new Date(Date.now() + 864e5 * 3),
    status: input.status ?? "A_faire",
    priority: input.priority ?? "Normale",
    completedAt: null,
    createdById: input.createdById ?? 1,
    createdAt: /* @__PURE__ */ new Date()
  };
  _memoryTasks.unshift(task);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierTasks).values(input);
    } catch (e) {
    }
  }
  return task;
}
async function updateTaskStatus(id, status) {
  const completedAt = status === "Termine" ? /* @__PURE__ */ new Date() : null;
  const idx = _memoryTasks.findIndex((t2) => t2.id === id);
  if (idx >= 0) {
    _memoryTasks[idx] = {
      ..._memoryTasks[idx],
      status,
      completedAt
    };
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(dossierTasks).set({ status, completedAt }).where(eq(dossierTasks.id, id));
    } catch (e) {
    }
  }
  return _memoryTasks[idx];
}
async function toggleTaskStatus(id, status) {
  const idx = _memoryTasks.findIndex((t2) => t2.id === id);
  const current = idx >= 0 ? _memoryTasks[idx] : null;
  const nextStatus = status || (current?.status === "Termine" ? "A_faire" : "Termine");
  return updateTaskStatus(id, nextStatus);
}
async function listComments(dossierId) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierComments).where(eq(dossierComments.dossierId, dossierId)).orderBy(asc(dossierComments.createdAt));
    } catch (e) {
    }
  }
  return _memoryComments.filter((c) => c.dossierId === dossierId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
async function addComment(input) {
  const comment = {
    id: _memoryComments.length + 1,
    dossierId: input.dossierId,
    authorId: input.authorId ?? 1,
    authorName: input.authorName ?? "Utilisateur IGS",
    message: input.message,
    createdAt: /* @__PURE__ */ new Date()
  };
  _memoryComments.push(comment);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierComments).values(input);
    } catch (e) {
    }
  }
  return comment;
}
var _readNotificationIds = /* @__PURE__ */ new Set();
async function addNotification(input) {
  const now = /* @__PURE__ */ new Date();
  const entry = {
    id: _memoryNotifications.length + 1,
    dossierId: input.dossierId ?? null,
    dossierNumber: input.dossierNumber ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    recipientEmail: input.recipientEmail ?? null,
    recipientRole: input.recipientRole ?? null,
    isRead: 0,
    createdAt: now
  };
  _memoryNotifications.unshift(entry);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(notifications).values(entry);
    } catch (e) {
    }
  }
  return entry;
}
async function listNotifications(limit = 40) {
  const dossiers2 = await listDossiers();
  const alerts = generateProactiveAlerts(dossiers2);
  return alerts.slice(0, limit).map((a) => ({
    ...a,
    isRead: _readNotificationIds.has(a.id) ? 1 : 0
  }));
}
async function markNotificationAsRead(id) {
  _readNotificationIds.add(id);
  const idx = _memoryNotifications.findIndex((n) => n.id === id);
  if (idx >= 0) _memoryNotifications[idx].isRead = 1;
  const db = await getDb();
  if (db) {
    try {
      await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
    } catch (e) {
    }
  }
  return { success: true };
}
async function markAllNotificationsAsRead() {
  const dossiers2 = await listDossiers();
  const alerts = generateProactiveAlerts(dossiers2);
  for (const a of alerts) {
    _readNotificationIds.add(a.id);
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(notifications).set({ isRead: 1 });
    } catch (e) {
    }
  }
  return { success: true };
}
async function getReferenceItems(category) {
  if (_memoryReferenceItems.length > 0) {
    if (!category) return _memoryReferenceItems;
    return _memoryReferenceItems.filter((r) => r.category === category);
  }
  const db = await getDb();
  if (db) {
    try {
      const items = await withDbTimeout(
        db.select().from(referenceItems).where(category ? eq(referenceItems.category, category) : void 0).orderBy(asc(referenceItems.category), asc(referenceItems.sortOrder)),
        1500
      );
      if (items.length > 0) {
        _memoryReferenceItems = items;
        return items;
      }
    } catch (e) {
    }
  }
  if (!category) return _memoryReferenceItems;
  return _memoryReferenceItems.filter((r) => r.category === category);
}
async function createReferenceItem(input) {
  const item = {
    id: _memoryReferenceItems.length + 1,
    category: input.category,
    label: input.label,
    sortOrder: input.sortOrder ?? _memoryReferenceItems.length + 1,
    createdAt: /* @__PURE__ */ new Date()
  };
  _memoryReferenceItems.push(item);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(referenceItems).values(input);
    } catch (e) {
    }
  }
  return item;
}

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname || "";
  const isLocalhost = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  return {
    httpOnly: true,
    path: "/",
    sameSite: isLocalhost ? "lax" : "strict",
    secure: !isLocalhost && isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    if (user.isActive === false) {
      throw ForbiddenError("Ce compte collaborateur est suspendu ou d\xE9sactiv\xE9");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError3 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.isActive === false) {
    throw new TRPCError3({
      code: "FORBIDDEN",
      message: "Votre compte est d\xE9sactiv\xE9. Veuillez contacter un administrateur IGS."
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive === false) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Votre compte est d\xE9sactiv\xE9. Veuillez contacter un administrateur IGS."
      });
    }
    if (ctx.user.role !== "admin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var declarantProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive === false) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Votre compte est d\xE9sactiv\xE9. Veuillez contacter un administrateur IGS."
      });
    }
    if (!["admin", "manager", "declarant"].includes(ctx.user.role)) {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Acc\xE8s refus\xE9 pour ce profil" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var comptableProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive === false) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Votre compte est d\xE9sactiv\xE9. Veuillez contacter un administrateur IGS."
      });
    }
    if (!["admin", "manager", "comptable"].includes(ctx.user.role)) {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Acc\xE8s refus\xE9 pour ce profil" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var internalProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive === false) {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Votre compte est d\xE9sactiv\xE9. Veuillez contacter un administrateur IGS."
      });
    }
    if (!["admin", "manager", "declarant", "comptable"].includes(ctx.user.role)) {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Acc\xE8s refus\xE9 pour ce profil" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/cloudStorageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var BUCKET_NAME = process.env.STORAGE_BUCKET || "dossier-documents";
var S3_ENDPOINT = process.env.STORAGE_ENDPOINT || process.env.SUPABASE_STORAGE_URL;
var S3_REGION = process.env.STORAGE_REGION || "eu-west-3";
var _s3Client = null;
function getS3Client() {
  if (_s3Client) return _s3Client;
  if (process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY) {
    _s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY
      },
      forcePathStyle: true
      // Requis pour Supabase / MinIO
    });
    return _s3Client;
  }
  return null;
}
async function uploadDossierCloudFile(options) {
  const timestamp2 = Date.now();
  const sanitizedName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileKey = `dossiers/${options.dossierId}/${timestamp2}_${sanitizedName}`;
  const client = getS3Client();
  if (client) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: options.fileBuffer,
        ContentType: options.mimeType
      });
      await client.send(command);
      const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
      const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 });
      return {
        fileUrl: signedUrl,
        storageProvider: S3_ENDPOINT?.includes("supabase") ? "supabase" : "s3",
        fileKey
      };
    } catch (err) {
      console.warn("[Storage] Cloud S3 upload error, fallback to resilient local storage:", err);
    }
  }
  const base64Data = Buffer.from(options.fileBuffer).toString("base64");
  const dataUrl = `data:${options.mimeType};base64,${base64Data}`;
  return {
    fileUrl: dataUrl,
    storageProvider: "local_resilient",
    fileKey
  };
}

// server/routers.ts
var optionalText = z2.string().trim().max(2e3).optional().nullable();
var optionalDate = z2.date().optional().nullable();
var dossierPayload = z2.object({
  clientDossierNumber: optionalText,
  client: optionalText,
  blLtaNumber: optionalText,
  cargoNature: optionalText,
  transportMode: optionalText,
  eta: optionalDate,
  originPort: optionalText,
  destinationPort: optionalText,
  container: optionalText,
  bulk: optionalText,
  goodsReleaseDate: optionalDate,
  declarationNumber: optionalText,
  bulletinNumber: optionalText,
  finalDeclarationNumber: optionalText,
  ddiGucegNumber: optionalText,
  badStatus: optionalText,
  baeStatus: optionalText,
  documentStatus: optionalText,
  customsStatus: optionalText,
  portStatus: optionalText,
  financialStatus: optionalText,
  fieldOperation: optionalText,
  responsible: optionalText,
  nextAction: optionalText,
  fieldAlert: optionalText,
  deliveryLocation: optionalText,
  declarant: optionalText,
  service: optionalText,
  regime: optionalText,
  notes: optionalText
});
var filtersSchema = z2.object({
  search: z2.string().trim().max(200).optional(),
  status: z2.enum(["R\xE9gularis\xE9", "\xC0 r\xE9gulariser"]).optional(),
  priority: z2.enum(["Haute", "Normale", "Basse"]).optional(),
  client: z2.string().trim().optional(),
  transportMode: z2.string().trim().optional(),
  responsible: z2.string().trim().optional(),
  myDossiersOnly: z2.boolean().optional(),
  currentUserCompany: z2.string().optional().nullable(),
  etaFrom: z2.date().optional(),
  etaTo: z2.date().optional()
}).optional();
var _cachedDashboard = null;
var DASHBOARD_CACHE_TTL_MS = 3e4;
function invalidateDashboardCache() {
  _cachedDashboard = null;
}
async function getCachedDashboard() {
  const now = Date.now();
  if (_cachedDashboard && now - _cachedDashboard.timestamp < DASHBOARD_CACHE_TTL_MS) {
    return _cachedDashboard.data;
  }
  const dossiers2 = await listDossiers();
  const data = buildDashboard(dossiers2);
  _cachedDashboard = { data, timestamp: now };
  return data;
}
function buildDashboard(dossiers2) {
  const now = /* @__PURE__ */ new Date();
  now.setHours(0, 0, 0, 0);
  const isMissing = (value) => value === null || value === void 0 || String(value).trim() === "";
  const total = dossiers2.length;
  const regularized = dossiers2.filter((dossier) => dossier.calculatedStatus === "R\xE9gularis\xE9").length;
  const overdue = dossiers2.filter((dossier) => dossier.eta && dossier.eta < now && !dossier.goodsReleaseDate).length;
  const lateToRegularize = dossiers2.filter((dossier) => dossier.calculatedStatus === "\xC0 r\xE9gulariser" && dossier.eta && dossier.eta < now).length;
  const etaInSevenDays = dossiers2.filter((dossier) => {
    if (!dossier.eta || dossier.goodsReleaseDate) return false;
    const days = Math.ceil((dossier.eta.getTime() - now.getTime()) / 864e5);
    return days >= 0 && days <= 7;
  }).length;
  const released = dossiers2.filter((dossier) => dossier.goodsReleaseDate).length;
  const delays = dossiers2.filter((dossier) => dossier.eta && dossier.goodsReleaseDate).map((dossier) => Math.round((dossier.goodsReleaseDate.getTime() - dossier.eta.getTime()) / 864e5));
  const averageEtaToRelease = delays.length ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length * 10) / 10 : null;
  const priority = ["Haute", "Normale", "Basse"].map((label) => ({ label, value: dossiers2.filter((dossier) => dossier.calculatedPriority === label).length }));
  const monthlyMap = /* @__PURE__ */ new Map();
  dossiers2.forEach((dossier) => {
    if (!dossier.eta) return;
    const key = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(dossier.eta);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  });
  const monthlyEta = Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, value }));
  const blOccurrences = /* @__PURE__ */ new Map();
  const clientNumberOccurrences = /* @__PURE__ */ new Map();
  dossiers2.forEach((dossier) => {
    if (!isMissing(dossier.blLtaNumber)) blOccurrences.set(dossier.blLtaNumber, (blOccurrences.get(dossier.blLtaNumber) ?? 0) + 1);
    if (!isMissing(dossier.clientDossierNumber)) clientNumberOccurrences.set(dossier.clientDossierNumber, (clientNumberOccurrences.get(dossier.clientDossierNumber) ?? 0) + 1);
  });
  const byClient = /* @__PURE__ */ new Map();
  dossiers2.forEach((dossier) => {
    const client = dossier.client || "Client non renseign\xE9";
    const current = byClient.get(client) ?? { total: 0, toRegularize: 0 };
    current.total += 1;
    if (dossier.calculatedStatus === "\xC0 r\xE9gulariser") current.toRegularize += 1;
    byClient.set(client, current);
  });
  const alertMap = /* @__PURE__ */ new Map();
  dossiers2.forEach((dossier) => {
    if (dossier.fieldAlert) {
      alertMap.set(dossier.fieldAlert, (alertMap.get(dossier.fieldAlert) ?? 0) + 1);
    }
  });
  const fieldAlerts = Array.from(alertMap.entries()).map(([label, count2]) => ({ label, count: count2 })).sort((a, b) => b.count - a.count);
  return {
    metrics: {
      total,
      regularized,
      regularizationRate: total ? Math.round(regularized / total * 1e3) / 10 : 0,
      overdue,
      lateToRegularize,
      etaInSevenDays,
      released,
      releasedShare: total ? Math.round(released / total * 1e3) / 10 : 0,
      averageEtaToRelease,
      missingEta: dossiers2.filter((dossier) => !dossier.eta).length
    },
    priority,
    monthlyEta,
    fieldAlerts,
    quality: {
      duplicateBlLta: Array.from(blOccurrences.values()).filter((value) => value > 1).reduce((sum, value) => sum + value - 1, 0),
      duplicateClientNumber: Array.from(clientNumberOccurrences.values()).filter((value) => value > 1).reduce((sum, value) => sum + value - 1, 0),
      missingClientNumber: dossiers2.filter((dossier) => isMissing(dossier.clientDossierNumber)).length,
      missingEta: dossiers2.filter((dossier) => !dossier.eta).length,
      missingDeclarations: dossiers2.filter((dossier) => isMissing(dossier.declarationNumber)).length,
      missingBulletins: dossiers2.filter((dossier) => isMissing(dossier.bulletinNumber)).length,
      missingRelease: dossiers2.filter((dossier) => !dossier.goodsReleaseDate).length,
      incomplete: dossiers2.filter((dossier) => dossier.calculatedStatus === "\xC0 r\xE9gulariser").length
    },
    clients: Array.from(byClient.entries()).map(([client, values]) => ({ client, ...values })).sort((a, b) => b.total - a.total || b.toRegularize - a.toRegularize)
  };
}
var appRouter = router({
  system: systemRouter,
  // 1. AUTHENTIFICATION & RÔLES
  auth: router({
    me: publicProcedure.query((options) => options.ctx.user),
    listUsers: protectedProcedure.query(async () => listUsers()),
    login: publicProcedure.input(
      z2.object({
        name: z2.string().optional(),
        role: z2.enum(["admin", "declarant", "comptable", "manager", "client", "user"]).optional(),
        clientCompany: z2.string().optional()
      }).optional()
    ).mutation(async ({ ctx, input }) => {
      const role = input?.role || "admin";
      let defaultName = "Ibrahima Gold Service (Admin)";
      if (role === "declarant") defaultName = "Mamadou Diallo (D\xE9clarant)";
      if (role === "comptable") defaultName = "Fatoumata Camara (Comptable)";
      if (role === "manager") defaultName = "Alpha Barry (Manager Op\xE9rations)";
      if (role === "client") defaultName = "Guinean Birimian Gold (Client)";
      const name = input?.name || defaultName;
      const openId = `igs_${role}_${(input?.clientCompany || "conakry").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      await upsertUser({
        openId,
        name,
        email: `${role}@igs-logistics.gn`,
        loginMethod: "direct",
        role,
        clientCompany: input?.clientCompany ?? (role === "client" ? "Guinean Birimian Gold S.A" : null),
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId(openId);
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return user;
    }),
    loginWithPassword: publicProcedure.input(
      z2.object({
        email: z2.string().email(),
        password: z2.string().min(4)
      })
    ).mutation(async ({ ctx, input }) => {
      const emailLower = input.email.toLowerCase().trim();
      let role = "admin";
      let name = "Ibrahima Gold Service (Admin)";
      if (emailLower.includes("declarant")) {
        role = "declarant";
        name = "Mamadou Diallo (D\xE9clarant PAC)";
      } else if (emailLower.includes("comptable") || emailLower.includes("finance")) {
        role = "comptable";
        name = "Fatoumata Camara (Comptable)";
      } else if (emailLower.includes("manager")) {
        role = "manager";
        name = "Alpha Barry (Manager Op\xE9rations)";
      } else if (emailLower.includes("client")) {
        role = "client";
        name = "Guinean Birimian Gold (Client)";
      }
      if (input.password.length < 4) {
        throw new TRPCError4({
          code: "UNAUTHORIZED",
          message: "Mot de passe incorrect. Veuillez v\xE9rifier vos identifiants IGS."
        });
      }
      const openId = `igs_${role}_${emailLower.replace(/[^a-z0-9]/g, "")}`;
      await upsertUser({
        openId,
        name,
        email: emailLower,
        loginMethod: "password",
        role,
        clientCompany: role === "client" ? "Guinean Birimian Gold S.A" : null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId(openId);
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    })
  }),
  // 1.1 GESTION RH & COLLABORATEURS (MODULE D'ADMINISTRATION 100 EMPLOYÉS)
  user: router({
    list: adminProcedure.input(
      z2.object({
        search: z2.string().trim().max(200).optional(),
        role: z2.string().optional(),
        isActive: z2.boolean().optional(),
        limit: z2.number().int().min(1).max(500).optional(),
        offset: z2.number().int().min(0).optional()
      }).nullish()
    ).query(async ({ input }) => listUsers(input || void 0)),
    getHRStats: adminProcedure.query(async () => getHRStats()),
    get: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
      const user = await getUserById(input.id);
      if (!user) {
        throw new TRPCError4({ code: "NOT_FOUND", message: `Collaborateur ${input.id} introuvable` });
      }
      return user;
    }),
    create: adminProcedure.input(
      z2.object({
        name: z2.string().min(2, "Le nom doit comporter au moins 2 caract\xE8res"),
        email: z2.string().email("Adresse email invalide"),
        phone: z2.string().optional().nullable(),
        role: z2.enum(["admin", "declarant", "comptable", "client", "manager", "user"]),
        clientCompany: z2.string().optional().nullable(),
        isActive: z2.boolean().optional().default(true)
      })
    ).mutation(async ({ input }) => {
      return createUser(input);
    }),
    update: adminProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        name: z2.string().min(2).optional(),
        email: z2.string().email().optional(),
        phone: z2.string().optional().nullable(),
        role: z2.enum(["admin", "declarant", "comptable", "client", "manager", "user"]).optional(),
        clientCompany: z2.string().optional().nullable(),
        isActive: z2.boolean().optional()
      })
    ).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateUser(id, data);
    }),
    toggleStatus: adminProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        isActive: z2.boolean()
      })
    ).mutation(async ({ input }) => {
      return toggleUserStatus(input.id, input.isActive);
    })
  }),
  // 2. RÉFÉRENTIELS LOGISTIQUES & DOUANIERS
  reference: router({
    list: protectedProcedure.input(z2.object({ category: z2.string().optional() }).nullish()).query(async ({ input }) => getReferenceItems(input?.category)),
    create: adminProcedure.input(z2.object({ category: z2.string(), label: z2.string(), sortOrder: z2.number().optional() })).mutation(async ({ input }) => createReferenceItem(input))
  }),
  // 3. DOSSIERS & VUES PAR RÔLE
  dossier: router({
    list: protectedProcedure.input(filtersSchema.nullish()).query(async ({ ctx, input }) => {
      const filters = { ...input || {} };
      if (ctx.user?.role === "client" && ctx.user?.clientCompany) {
        filters.currentUserCompany = ctx.user.clientCompany;
      }
      if (filters.myDossiersOnly && ctx.user?.name) {
        filters.responsible = ctx.user.name.split(" ")[0];
      }
      return listDossiers(filters);
    }),
    get: protectedProcedure.input(z2.object({ id: z2.union([z2.number(), z2.string()]) })).query(async ({ ctx, input }) => {
      try {
        const rawId = String(input.id).trim();
        if (!rawId) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: "Identifiant de dossier manquant ou invalide" });
        }
        const dossier = await getDossier(input.id);
        if (!dossier) {
          console.error(`[tRPC] Dossier introuvable pour l'identifiant: "${input.id}"`);
          throw new TRPCError4({ code: "NOT_FOUND", message: `Dossier introuvable pour l'identifiant "${input.id}"` });
        }
        if (ctx.user?.role === "client" && ctx.user?.clientCompany && dossier.client !== ctx.user.clientCompany) {
          throw new TRPCError4({ code: "FORBIDDEN", message: "Acc\xE8s refus\xE9 pour ce dossier" });
        }
        return dossier;
      } catch (err) {
        if (err instanceof TRPCError4) throw err;
        console.error("[tRPC dossier.get Error]", err);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur interne lors de la r\xE9cup\xE9ration du dossier: ${err.message}`
        });
      }
    }),
    create: internalProcedure.input(dossierPayload).mutation(async ({ ctx, input }) => {
      try {
        invalidateDashboardCache();
        return await createDossier(input, ctx.user.id, ctx.user.name || "Op\xE9rateur");
      } catch (err) {
        if (err instanceof TRPCError4) throw err;
        console.error("[tRPC dossier.create Error]", err);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur interne lors de la cr\xE9ation du dossier: ${err.message}`
        });
      }
    }),
    update: internalProcedure.input(
      z2.object({
        id: z2.union([z2.number(), z2.string()]),
        expectedVersion: z2.number().int().positive().optional(),
        expectedUpdatedAt: z2.union([z2.date(), z2.string()]).optional(),
        forceOverwrite: z2.boolean().optional(),
        data: dossierPayload
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        const numId = Number(input.id);
        if (isNaN(numId) || numId <= 0) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: `Identifiant de dossier invalide: ${input.id}` });
        }
        invalidateDashboardCache();
        return await updateDossier(numId, input.data, ctx.user.id, ctx.user.name || "Op\xE9rateur", {
          expectedVersion: input.expectedVersion,
          expectedUpdatedAt: input.expectedUpdatedAt,
          forceOverwrite: input.forceOverwrite,
          userRole: ctx.user.role
        });
      } catch (err) {
        if (err instanceof TRPCError4) throw err;
        console.error("[tRPC dossier.update Error]", err);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur lors de la mise \xE0 jour du dossier: ${err.message}`
        });
      }
    }),
    updateCustoms: declarantProcedure.input(
      z2.object({
        id: z2.union([z2.number(), z2.string()]),
        expectedVersion: z2.number().int().positive().optional(),
        expectedUpdatedAt: z2.union([z2.date(), z2.string()]).optional(),
        forceOverwrite: z2.boolean().optional(),
        data: dossierPayload.partial()
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        const numId = Number(input.id);
        if (isNaN(numId) || numId <= 0) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: `Identifiant de dossier invalide: ${input.id}` });
        }
        invalidateDashboardCache();
        return await updateDossier(numId, input.data, ctx.user.id, ctx.user.name || "D\xE9clarant PAC", {
          expectedVersion: input.expectedVersion,
          expectedUpdatedAt: input.expectedUpdatedAt,
          forceOverwrite: input.forceOverwrite,
          userRole: ctx.user.role
        });
      } catch (err) {
        if (err instanceof TRPCError4) throw err;
        console.error("[tRPC dossier.updateCustoms Error]", err);
        throw new TRPCError4({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur lors de la mise \xE0 jour des contr\xF4les douane: ${err.message}`
        });
      }
    }),
    remove: adminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
      invalidateDashboardCache();
      return deleteDossier(input.id);
    }),
    importBatch: declarantProcedure.input(z2.array(dossierPayload)).mutation(async ({ ctx, input }) => {
      invalidateDashboardCache();
      return importDossiersBatch(input, ctx.user.id, ctx.user.name || "Importateur Excel");
    })
  }),
  // 4. PORTAIL CLIENT PUBLIC / DIRECT
  portal: router({
    track: publicProcedure.input(z2.object({ accessCodeOrNumber: z2.string().trim().min(2) })).query(async ({ input }) => {
      const dossier = await getDossierByPortalCode(input.accessCodeOrNumber);
      if (!dossier) {
        throw new TRPCError4({
          code: "NOT_FOUND",
          message: "Dossier introuvable. Aucun dossier trouv\xE9 pour ce code. V\xE9rifiez le code d'acc\xE8s et r\xE9essayez."
        });
      }
      const docs = await listDocuments(dossier.id);
      const history = await listDossierHistory(dossier.id);
      return {
        dossier,
        documents: docs.map((d) => ({ id: d.id, name: d.name, type: d.type, createdAt: d.createdAt })),
        timeline: history.map((h) => ({ date: h.createdAt, title: h.fieldChanged, detail: h.newValue || h.comment }))
      };
    })
  }),
  // 5. GESTION DOCUMENTAIRE & PREUVES
  document: router({
    list: protectedProcedure.input(z2.object({ dossierId: z2.number().int().positive() })).query(async ({ input }) => listDocuments(input.dossierId)),
    upload: protectedProcedure.input(
      z2.object({
        dossierId: z2.number().int().positive(),
        name: z2.string().min(1),
        type: z2.enum(["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]),
        fileUrl: z2.string().min(1),
        fileSize: z2.number().optional(),
        mimeType: z2.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      return createDocument({
        ...input,
        uploadedById: ctx.user.id,
        uploaderName: ctx.user.name || "Op\xE9rateur IGS"
      });
    }),
    uploadBase64: protectedProcedure.input(
      z2.object({
        dossierId: z2.number().int().positive(),
        name: z2.string().min(1),
        type: z2.enum(["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]),
        base64Content: z2.string().min(1),
        mimeType: z2.string().default("application/pdf")
      })
    ).mutation(async ({ ctx, input }) => {
      const cleanBase64 = input.base64Content.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const uploadRes = await uploadDossierCloudFile({
        dossierId: input.dossierId,
        fileName: input.name,
        fileBuffer: buffer,
        mimeType: input.mimeType
      });
      return createDocument({
        dossierId: input.dossierId,
        name: input.name,
        type: input.type,
        fileUrl: uploadRes.fileUrl,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        uploadedById: ctx.user.id,
        uploaderName: ctx.user.name || "Op\xE9rateur IGS"
      });
    }),
    remove: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => deleteDocument(input.id, ctx.user.id, ctx.user.name || "Op\xE9rateur IGS"))
  }),
  // 6. AUDIT TRAIL / HISTORIQUE
  audit: router({
    list: protectedProcedure.input(z2.object({ dossierId: z2.number().int().positive() })).query(async ({ input }) => listDossierHistory(input.dossierId))
  }),
  // 7. MODULE FINANCIER & FACTURATION
  finance: router({
    listInvoices: comptableProcedure.input(z2.object({ dossierId: z2.number().optional() }).nullish()).query(async ({ input }) => listInvoices(input?.dossierId)),
    createInvoice: comptableProcedure.input(
      z2.object({
        dossierId: z2.number().int().positive(),
        client: z2.string().min(1),
        currency: z2.string().default("GNF"),
        invoiceType: z2.enum(["Proforma", "Definitive"]).default("Proforma"),
        exchangeRate: z2.number().int().positive().default(8650),
        amountHt: z2.number().min(0),
        amountTva: z2.number().min(0).default(0),
        amountTtc: z2.number().min(0),
        disbursementsAmount: z2.number().min(0).default(0),
        customsDutiesAmount: z2.number().min(0).default(0),
        portFeesAmount: z2.number().min(0).default(0),
        storageAndDemurrageFees: z2.number().min(0).default(0),
        status: z2.enum(["Proforma", "\xC9mise", "Pay\xE9e", "En_retard", "Annul\xE9e"]).default("Proforma"),
        dueDate: optionalDate,
        notes: optionalText
      })
    ).mutation(async ({ ctx, input }) => {
      return createInvoice({
        ...input,
        createdById: ctx.user.id
      });
    }),
    updateInvoice: comptableProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        data: z2.object({
          invoiceType: z2.enum(["Proforma", "Definitive"]).optional(),
          currency: z2.string().optional(),
          exchangeRate: z2.number().optional(),
          amountHt: z2.number().min(0).optional(),
          amountTva: z2.number().min(0).optional(),
          amountTtc: z2.number().min(0).optional(),
          disbursementsAmount: z2.number().min(0).optional(),
          customsDutiesAmount: z2.number().min(0).optional(),
          portFeesAmount: z2.number().min(0).optional(),
          storageAndDemurrageFees: z2.number().min(0).optional(),
          estimatedMargin: z2.number().optional(),
          paymentMethod: optionalText,
          paymentReference: optionalText,
          receiptNumber: optionalText,
          status: z2.enum(["Proforma", "\xC9mise", "Pay\xE9e", "En_retard", "Annul\xE9e"]).optional(),
          dueDate: optionalDate,
          paidAt: optionalDate,
          notes: optionalText
        })
      })
    ).mutation(async ({ input }) => updateInvoice(input.id, input.data)),
    recordPayment: comptableProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        paymentMethod: optionalText,
        paymentReference: optionalText,
        paidAmount: z2.number().min(0).optional().nullable(),
        proofUrl: optionalText,
        notes: optionalText
      })
    ).mutation(async ({ ctx, input }) => recordInvoicePayment(input.id, { ...input, userId: ctx.user.id })),
    listPayments: comptableProcedure.input(z2.object({ invoiceId: z2.number().optional() }).nullish()).query(async ({ input }) => listInvoicePayments(input?.invoiceId)),
    listDebours: comptableProcedure.input(z2.object({ dossierId: z2.number().optional() }).nullish()).query(async ({ input }) => listPacDisbursements(input?.dossierId)),
    createDebour: comptableProcedure.input(
      z2.object({
        dossierId: z2.number().int().positive(),
        invoiceId: z2.number().optional(),
        type: z2.string().default("douane"),
        amountAdvanced: z2.number().min(0),
        amountReimbursed: z2.number().min(0).default(0),
        status: z2.string().default("avance"),
        receiptNumber: optionalText,
        notes: optionalText
      })
    ).mutation(async ({ ctx, input }) => createPacDisbursement({ ...input, createdById: ctx.user.id })),
    saveInvoicePdf: comptableProcedure.input(
      z2.object({
        invoiceId: z2.number().int().positive(),
        invoiceNumber: z2.string(),
        pdfBase64: z2.string()
      })
    ).mutation(async ({ input }) => {
      try {
        const { uploadInvoicePdf: uploadInvoicePdf2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
        const buffer = Buffer.from(input.pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
        const url = await uploadInvoicePdf2(input.invoiceNumber, buffer);
        if (url) {
          await updateInvoice(input.invoiceId, { pdfUrl: url });
        }
        return { success: true, pdfUrl: url };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }),
    uploadProof: comptableProcedure.input(
      z2.object({
        invoiceId: z2.number().int().positive(),
        fileName: z2.string(),
        fileBase64: z2.string(),
        mimeType: z2.string().default("image/jpeg")
      })
    ).mutation(async ({ input }) => {
      try {
        const { uploadPaymentProof: uploadPaymentProof2 } = await Promise.resolve().then(() => (init_supabase(), supabase_exports));
        const buffer = Buffer.from(input.fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
        const url = await uploadPaymentProof2(input.invoiceId, buffer, input.fileName, input.mimeType);
        return { success: true, proofUrl: url };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }),
    getExchangeRate: internalProcedure.query(async () => getExchangeRate()),
    setExchangeRate: comptableProcedure.input(z2.object({ rate: z2.number().int().positive() })).mutation(async ({ input }) => setExchangeRate(input.rate)),
    summary: comptableProcedure.query(async () => {
      const allInvoices = await listInvoices();
      const allDossiers = await listDossiers();
      const { rate } = await getExchangeRate();
      const totalCA_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);
      const totalCA_USD = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc : Math.round(i.amountTtc / rate)), 0);
      const totalMargin_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.estimatedMargin || 0) * rate : i.estimatedMargin || 0), 0);
      const totalMargin_USD = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.estimatedMargin || 0 : Math.round((i.estimatedMargin || 0) / rate)), 0);
      const totalDisbursements_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.disbursementsAmount || 0) * rate : i.disbursementsAmount || 0), 0);
      const totalCustomsDuties_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.customsDutiesAmount || 0) * rate : i.customsDutiesAmount || 0), 0);
      const totalPortFees_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.portFeesAmount || 0) * rate : i.portFeesAmount || 0), 0);
      const pendingInvoices = allInvoices.filter((i) => i.status !== "Pay\xE9e").length;
      const paidInvoices = allInvoices.filter((i) => i.status === "Pay\xE9e").length;
      const totalDemurrageRisk = allDossiers.filter((d) => d.eta && !d.goodsReleaseDate && (/* @__PURE__ */ new Date()).getTime() - d.eta.getTime() > 864e5 * 7).length;
      return {
        totalCA_GNF,
        totalCA_USD,
        totalMargin_GNF,
        totalMargin_USD,
        totalDisbursements_GNF,
        totalCustomsDuties_GNF,
        totalPortFees_GNF,
        pendingInvoices,
        paidInvoices,
        totalDemurrageRisk,
        exchangeRate: rate,
        invoices: allInvoices
      };
    })
  }),
  // 8. TÂCHES & COLLABORATION D'ÉQUIPE
  task: router({
    list: protectedProcedure.input(
      z2.object({
        dossierId: z2.number().optional(),
        assignedTo: z2.string().optional(),
        status: z2.enum(["A_faire", "En_cours", "Termine", "Bloque"]).optional()
      }).nullish()
    ).query(async ({ input }) => listTasks(input || void 0)),
    create: internalProcedure.input(
      z2.object({
        dossierId: z2.number().int().positive(),
        title: z2.string().min(1),
        assignedTo: z2.string().optional(),
        dueDate: optionalDate,
        priority: z2.enum(["Haute", "Normale", "Basse"]).default("Normale")
      })
    ).mutation(async ({ ctx, input }) => {
      return createTask({
        ...input,
        createdById: ctx.user.id
      });
    }),
    updateStatus: internalProcedure.input(z2.object({ id: z2.number().int().positive(), status: z2.enum(["A_faire", "En_cours", "Termine", "Bloque"]) })).mutation(async ({ input }) => updateTaskStatus(input.id, input.status)),
    toggleStatus: internalProcedure.input(z2.object({ id: z2.number().int().positive(), status: z2.enum(["A_faire", "En_cours", "Termine", "Bloque"]).optional() })).mutation(async ({ input }) => toggleTaskStatus(input.id, input.status))
  }),
  // 9. COMMENTAIRES
  comment: router({
    list: protectedProcedure.input(z2.object({ dossierId: z2.number().int().positive() })).query(async ({ input }) => listComments(input.dossierId)),
    add: protectedProcedure.input(z2.object({ dossierId: z2.number().int().positive(), message: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      return addComment({
        dossierId: input.dossierId,
        authorId: ctx.user.id,
        authorName: ctx.user.name || "Op\xE9rateur",
        message: input.message
      });
    })
  }),
  // 10. NOTIFICATIONS PROACTIVES & CANAUX EXTERNES
  notification: router({
    list: protectedProcedure.query(async () => listNotifications(40)),
    markAsRead: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => markNotificationAsRead(input.id)),
    markAllAsRead: protectedProcedure.mutation(async () => markAllNotificationsAsRead()),
    sendWhatsApp: protectedProcedure.input(
      z2.object({
        dossierNumber: z2.string().min(1),
        recipientPhone: z2.string().min(4),
        clientName: z2.string().min(1),
        messageText: z2.string().min(1)
      })
    ).mutation(async ({ input }) => sendDossierWhatsAppAlert(input)),
    sendEmail: protectedProcedure.input(
      z2.object({
        dossierNumber: z2.string().min(1),
        recipientEmail: z2.string().email(),
        clientName: z2.string().min(1),
        subject: z2.string().min(1),
        htmlContent: z2.string().min(1)
      })
    ).mutation(async ({ input }) => sendDossierEmailAlert(input))
  }),
  // TABLEAU DE BORD OPÉRATIONNEL
  dashboard: router({
    get: protectedProcedure.query(async () => getCachedDashboard())
  })
});

// server/restRoutes.ts
function registerRestRoutes(app2) {
  app2.get("/api/dossiers", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const search = typeof req.query.search === "string" ? req.query.search : void 0;
      const status = req.query.status === "R\xE9gularis\xE9" || req.query.status === "\xC0 r\xE9gulariser" ? req.query.status : void 0;
      const priority = req.query.priority === "Haute" || req.query.priority === "Normale" || req.query.priority === "Basse" ? req.query.priority : void 0;
      const client = typeof req.query.client === "string" ? req.query.client : void 0;
      const dossiers2 = await listDossiers({
        search,
        status,
        priority,
        client
      });
      return res.status(200).json({
        success: true,
        count: dossiers2.length,
        data: dossiers2
      });
    } catch (err) {
      console.error("[REST GET /api/dossiers Error]", err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la r\xE9cup\xE9ration des dossiers",
        details: err.message
      });
    }
  });
  app2.get("/api/dossiers/:id", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      if (!rawId || rawId.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide ou manquant"
        });
      }
      const dossier = await getDossier(rawId.trim());
      if (!dossier) {
        return res.status(404).json({
          success: false,
          error: `Dossier introuvable pour l'identifiant \xAB ${rawId} \xBB`,
          id: rawId
        });
      }
      return res.status(200).json({
        success: true,
        data: dossier
      });
    } catch (err) {
      console.error(`[REST GET /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la lecture du dossier",
        details: err.message
      });
    }
  });
  app2.post("/api/dossiers", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({
          success: false,
          error: "Corps de requ\xEAte invalide ou manquant"
        });
      }
      invalidateDashboardCache();
      const created = await createDossier(body, 1, "API REST");
      return res.status(201).json({
        success: true,
        message: `Dossier ${created.dossierNumber} cr\xE9\xE9 avec succ\xE8s`,
        data: created
      });
    } catch (err) {
      console.error("[REST POST /api/dossiers Error]", err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la cr\xE9ation du dossier",
        details: err.message
      });
    }
  });
  const updateHandler = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      const numId = Number(rawId);
      if (!rawId || isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide (doit \xEAtre un entier strictement positif)",
          received: rawId
        });
      }
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({
          success: false,
          error: "Corps de requ\xEAte invalide"
        });
      }
      const existing = await getDossier(numId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Dossier #${numId} introuvable pour la mise \xE0 jour`,
          id: numId
        });
      }
      invalidateDashboardCache();
      const updated = await updateDossier(numId, body, 1, "API REST");
      return res.status(200).json({
        success: true,
        message: `Dossier ${updated.dossierNumber} mis \xE0 jour avec succ\xE8s`,
        data: updated
      });
    } catch (err) {
      console.error(`[REST PUT/PATCH /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la sauvegarde du dossier",
        details: err.message
      });
    }
  };
  app2.put("/api/dossiers/:id", updateHandler);
  app2.patch("/api/dossiers/:id", updateHandler);
  app2.delete("/api/dossiers/:id", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      const numId = Number(rawId);
      if (!rawId || isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide",
          received: rawId
        });
      }
      const existing = await getDossier(numId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Dossier #${numId} introuvable`,
          id: numId
        });
      }
      invalidateDashboardCache();
      const deleted = await deleteDossier(numId);
      return res.status(200).json({
        success: true,
        message: `Dossier ${existing.dossierNumber || numId} supprim\xE9 avec succ\xE8s`,
        data: deleted
      });
    } catch (err) {
      console.error(`[REST DELETE /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la suppression du dossier",
        details: err.message
      });
    }
  });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  if (!user) {
    user = await getUserByOpenId("igs_admin_conakry") || null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApp() {
  const app2 = express();
  app2.use(compression({ threshold: 1024 }));
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  registerRestRoutes(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, req }) {
        console.error(`[tRPC Router Error on ${path}]:`, error);
      }
    })
  );
  app2.use((err, req, res, next) => {
    console.error(`[Unhandled Server Error on ${req.method} ${req.url}]:`, err);
    if (res.headersSent) {
      return next(err);
    }
    res.setHeader("Content-Type", "application/json");
    const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Une erreur serveur interne est survenue.",
      details: process.env.NODE_ENV === "development" ? err.stack : void 0
    });
  });
  return app2;
}

// server/vercel-entry.ts
var app = createApp();
var vercel_entry_default = app;
export {
  vercel_entry_default as default
};
