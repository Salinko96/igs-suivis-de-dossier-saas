import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "declarant", "comptable", "manager", "client", "admin"]);
export const calculatedStatusEnum = pgEnum("calculated_status", ["Régularisé", "À régulariser", "Brouillon"]);
export const calculatedPriorityEnum = pgEnum("calculated_priority", ["Haute", "Normale", "Basse"]);
export const documentTypeEnum = pgEnum("document_type", ["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["Proforma", "Émise", "Payée", "En_retard", "Annulée"]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["Proforma", "Definitive"]);
export const taskStatusEnum = pgEnum("task_status", ["A_faire", "En_cours", "Termine", "Bloque"]);
export const notificationTypeEnum = pgEnum("notification_type", ["ETA_DEPASSEE", "DDI_MANQUANTE", "BULLETIN_MANQUANT", "SURESTARIES_RISQUE", "STATUT_MODIFIE", "DOCUMENT_AJOUTE", "FACTURE_GENEREE"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  clientCompany: varchar("clientCompany", { length: 255 }), // Pour le portail client
  phone: varchar("phone", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  sessionRevokedAt: timestamp("sessionRevokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 160 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  country: varchar("country", { length: 100 }).default("Guinée"),
  taxId: varchar("taxId", { length: 80 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("clients_name_unique").on(table.name),
]);

export const dossiers = pgTable("dossiers", {
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
  daysOnQuay: integer("daysOnQuay").default(0), // Jours de séjour quai (alerte si > 7j)
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
  portalAccessCode: varchar("portalAccessCode", { length: 32 }), // Code direct de suivi pour le client
  createdById: integer("createdById"),
  updatedById: integer("updatedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("dossiers_number_unique").on(table.dossierNumber),
  index("dossiers_client_idx").on(table.client),
  index("dossiers_status_idx").on(table.calculatedStatus),
  index("dossiers_priority_idx").on(table.calculatedPriority),
  index("dossiers_eta_idx").on(table.eta),
  index("dossiers_bl_lta_idx").on(table.blLtaNumber),
  index("dossiers_responsible_idx").on(table.responsible),
  index("dossiers_portal_code_idx").on(table.portalAccessCode),
]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: documentTypeEnum("type").notNull().default("Autre"),
  fileUrl: text("fileUrl").notNull(), // Base64 Data URI ou URL externe/S3/Supabase Storage
  fileSize: integer("fileSize").notNull().default(0), // en octets
  mimeType: varchar("mimeType", { length: 120 }),
  uploadedById: integer("uploadedById"),
  uploaderName: varchar("uploaderName", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("documents_dossier_idx").on(table.dossierId),
]);

export const dossierStatusHistory = pgTable("dossier_status_history", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("dossier_history_dossier_idx").on(table.dossierId),
  index("dossier_history_action_idx").on(table.action),
  index("dossier_history_entity_idx").on(table.entityType, table.entityId),
  index("dossier_history_created_idx").on(table.createdAt),
]);

export const auditLogs = dossierStatusHistory;

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  clientId: integer("clientId"),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  client: varchar("client", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("GNF"), // GNF, USD, EUR
  invoiceType: invoiceTypeEnum("invoiceType").notNull().default("Proforma"),
  exchangeRate: integer("exchangeRate").notNull().default(8650),
  amountHt: integer("amountHt").notNull().default(0),
  amountTva: integer("amountTva").notNull().default(0),
  amountTtc: integer("amountTtc").notNull().default(0),
  disbursementsAmount: integer("disbursementsAmount").notNull().default(0), // Débours totaux (douane + PAC)
  customsDutiesAmount: integer("customsDutiesAmount").notNull().default(0), // Droits de douane
  portFeesAmount: integer("portFeesAmount").notNull().default(0), // Redevance portuaire PAC
  storageAndDemurrageFees: integer("storageAndDemurrageFees").notNull().default(0), // Surestaries / magasinage
  estimatedMargin: integer("estimatedMargin").notNull().default(0), // Marge brute estimée
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  paymentReference: varchar("paymentReference", { length: 120 }),
  receiptNumber: varchar("receiptNumber", { length: 64 }),
  status: invoiceStatusEnum("status").notNull().default("Proforma"),
  pdfUrl: text("pdfUrl"), // URL Supabase Storage du PDF généré
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  reconciliationStatus: varchar("reconciliationStatus", { length: 32 }).default("non_rapproche"), // non_rapproche, partiel, rapproche
  reconciliationDate: timestamp("reconciliationDate"),
  reconciliationRef: varchar("reconciliationRef", { length: 120 }),
  notes: text("notes"),
  rateLockedAt: timestamp("rateLockedAt"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("invoices_number_unique").on(table.invoiceNumber),
  index("invoices_dossier_idx").on(table.dossierId),
  index("invoices_client_idx").on(table.client),
  index("invoices_status_idx").on(table.status),
  index("invoices_reconciliation_idx").on(table.reconciliationStatus),
]);

export const invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("GNF"),
  paymentMethod: varchar("paymentMethod", { length: 64 }).notNull(),
  paymentReference: varchar("paymentReference", { length: 120 }),
  paymentDate: timestamp("paymentDate").defaultNow().notNull(),
  proofUrl: text("proofUrl"), // URL Supabase Storage du justificatif bancaire / quittance
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("invoice_payments_invoice_idx").on(table.invoiceId),
]);

export const pacDisbursements = pgTable("pac_disbursements", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  invoiceId: integer("invoiceId"),
  type: varchar("type", { length: 64 }).notNull().default("douane"), // douane, port, surestaries, acconage, autre
  amountAdvanced: integer("amountAdvanced").notNull().default(0), // Montant avancé par IGS
  amountReimbursed: integer("amountReimbursed").notNull().default(0), // Montant remboursé par le client
  status: varchar("status", { length: 32 }).notNull().default("avance"), // avance, rembourse_partiel, rembourse_total
  receiptNumber: varchar("receiptNumber", { length: 64 }),
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  index("pac_disbursements_dossier_idx").on(table.dossierId),
  index("pac_disbursements_invoice_idx").on(table.invoiceId),
]);

export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }), // Format YYYY-MM-DD
  sourceCurrency: varchar("sourceCurrency", { length: 8 }).notNull().default("USD"),
  targetCurrency: varchar("targetCurrency", { length: 8 }).notNull().default("GNF"),
  rate: integer("rate").notNull().default(8650),
  provider: varchar("provider", { length: 64 }).default("BCRG"), // BCRG, exchangerate.host, Manuel
  isManualOverride: boolean("isManualOverride").default(false).notNull(),
  overrideReason: text("overrideReason"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  index("exchange_rates_date_idx").on(table.date),
  index("exchange_rates_currency_idx").on(table.sourceCurrency, table.targetCurrency),
]);

export const dossierTasks = pgTable("dossier_tasks", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  assignedTo: varchar("assignedTo", { length: 120 }),
  dueDate: timestamp("dueDate"),
  status: taskStatusEnum("status").notNull().default("A_faire"),
  priority: calculatedPriorityEnum("priority").notNull().default("Normale"),
  completedAt: timestamp("completedAt"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("dossier_tasks_dossier_idx").on(table.dossierId),
  index("dossier_tasks_status_idx").on(table.status),
]);

export const dossierComments = pgTable("dossier_comments", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  authorId: integer("authorId"),
  authorName: varchar("authorName", { length: 120 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("dossier_comments_dossier_idx").on(table.dossierId),
]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId"),
  dossierNumber: varchar("dossierNumber", { length: 16 }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  recipientRole: varchar("recipientRole", { length: 64 }),
  isRead: integer("isRead").notNull().default(0), // 0 ou 1
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("notifications_dossier_idx").on(table.dossierId),
  index("notifications_is_read_idx").on(table.isRead),
  index("notifications_created_idx").on(table.createdAt),
]);

export const referenceItems = pgTable("reference_items", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("reference_category_label_unique").on(table.category, table.label),
  index("reference_category_idx").on(table.category),
]);

export const clientAccessSessions = pgTable("client_access_sessions", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossier_id"),
  clientCompany: varchar("client_company", { length: 255 }).notNull(),
  clientPhone: varchar("client_phone", { length: 32 }),
  clientEmail: varchar("client_email", { length: 320 }),
  otpCode: varchar("otp_code", { length: 12 }).notNull(),
  sessionToken: text("session_token"),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  attemptsCount: integer("attempts_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [
  index("client_sessions_dossier_idx").on(table.dossierId),
  index("client_sessions_phone_idx").on(table.clientPhone),
  index("client_sessions_expires_idx").on(table.expiresAt),
]);

export const portalAccessLogs = pgTable("portal_access_logs", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossier_id"),
  accessCodeUsed: varchar("access_code_used", { length: 64 }).notNull(),
  tokenIdentifier: varchar("token_identifier", { length: 120 }),
  clientCompany: varchar("client_company", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
  success: boolean("success").notNull().default(true),
  errorReason: text("error_reason"),
}, table => [
  index("portal_logs_dossier_idx").on(table.dossierId),
  index("portal_logs_time_idx").on(table.accessedAt),
  index("portal_logs_code_idx").on(table.accessCodeUsed),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type Dossier = typeof dossiers.$inferSelect;
export type InsertDossier = typeof dossiers.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DossierStatusHistory = typeof dossierStatusHistory.$inferSelect;
export type InsertDossierStatusHistory = typeof dossierStatusHistory.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = typeof invoicePayments.$inferInsert;
export type PacDisbursement = typeof pacDisbursements.$inferSelect;
export type InsertPacDisbursement = typeof pacDisbursements.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;
export type DossierTask = typeof dossierTasks.$inferSelect;
export type InsertDossierTask = typeof dossierTasks.$inferInsert;
export type DossierComment = typeof dossierComments.$inferSelect;
export type InsertDossierComment = typeof dossierComments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type ReferenceItem = typeof referenceItems.$inferSelect;
export type ClientAccessSession = typeof clientAccessSessions.$inferSelect;
export type InsertClientAccessSession = typeof clientAccessSessions.$inferInsert;
export type PortalAccessLog = typeof portalAccessLogs.$inferSelect;
export type InsertPortalAccessLog = typeof portalAccessLogs.$inferInsert;
export type AuditLog = DossierStatusHistory;
export type InsertAuditLog = InsertDossierStatusHistory;

