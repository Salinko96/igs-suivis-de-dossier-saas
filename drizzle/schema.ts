import { index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const calculatedStatusEnum = pgEnum("calculated_status", ["Régularisé", "À régulariser"]);
export const calculatedPriorityEnum = pgEnum("calculated_priority", ["Haute", "Normale", "Basse"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
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
export type ReferenceItem = typeof referenceItems.$inferSelect;
