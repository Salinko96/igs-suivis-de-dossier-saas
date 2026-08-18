import { index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "declarant", "comptable", "manager", "client", "admin"]);
export const calculatedStatusEnum = pgEnum("calculated_status", ["Régularisé", "À régulariser"]);
export const calculatedPriorityEnum = pgEnum("calculated_priority", ["Haute", "Normale", "Basse"]);
export const documentTypeEnum = pgEnum("document_type", ["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["Proforma", "Émise", "Payée", "En_retard", "Annulée"]);
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const dossiers = pgTable("dossiers", {
  id: serial("id").primaryKey(),
  dossierNumber: varchar("dossierNumber", { length: 16 }).notNull(),
  clientDossierNumber: varchar("clientDossierNumber", { length: 120 }),
  client: varchar("client", { length: 255 }),
  blLtaNumber: varchar("blLtaNumber", { length: 160 }),
  cargoNature: text("cargoNature"),
  transportMode: varchar("transportMode", { length: 64 }),
  eta: timestamp("eta"),
  originPort: varchar("originPort", { length: 255 }),
  destinationPort: varchar("destinationPort", { length: 255 }),
  container: varchar("container", { length: 255 }),
  bulk: varchar("bulk", { length: 255 }),
  goodsReleaseDate: timestamp("goodsReleaseDate"),
  declarationNumber: varchar("declarationNumber", { length: 160 }),
  bulletinNumber: varchar("bulletinNumber", { length: 160 }),
  finalDeclarationNumber: varchar("finalDeclarationNumber", { length: 160 }),
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
  fieldChanged: varchar("fieldChanged", { length: 80 }).notNull(),
  previousValue: text("previousValue"),
  newValue: text("newValue"),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("dossier_history_dossier_idx").on(table.dossierId),
  index("dossier_history_created_idx").on(table.createdAt),
]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  client: varchar("client", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("GNF"), // GNF, USD, EUR
  amountHt: integer("amountHt").notNull().default(0),
  amountTva: integer("amountTva").notNull().default(0),
  amountTtc: integer("amountTtc").notNull().default(0),
  disbursementsAmount: integer("disbursementsAmount").notNull().default(0), // Débours (douane, PAC)
  storageAndDemurrageFees: integer("storageAndDemurrageFees").notNull().default(0), // Surestaries / magasinage
  estimatedMargin: integer("estimatedMargin").notNull().default(0), // Marge brute estimée
  status: invoiceStatusEnum("status").notNull().default("Proforma"),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdById: integer("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("invoices_number_unique").on(table.invoiceNumber),
  index("invoices_dossier_idx").on(table.dossierId),
  index("invoices_client_idx").on(table.client),
  index("invoices_status_idx").on(table.status),
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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Dossier = typeof dossiers.$inferSelect;
export type InsertDossier = typeof dossiers.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DossierStatusHistory = typeof dossierStatusHistory.$inferSelect;
export type InsertDossierStatusHistory = typeof dossierStatusHistory.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type DossierTask = typeof dossierTasks.$inferSelect;
export type InsertDossierTask = typeof dossierTasks.$inferInsert;
export type DossierComment = typeof dossierComments.$inferSelect;
export type InsertDossierComment = typeof dossierComments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type ReferenceItem = typeof referenceItems.$inferSelect;
