import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dossiers, InsertUser, referenceItems, users } from "../drizzle/schema";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";

import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    // Use postgres.js driver for better performance and compatibility with Supabase
    // For serverless environments (Vercel), use a smaller pool and shorter timeout
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    _client = postgres(process.env.DATABASE_URL, { 
      max: isServerless ? 5 : 10, 
      idle_timeout: isServerless ? 10 : 20,
      connect_timeout: 10
    });
    _db = drizzle(_client);
  }
  return _db;
}

const fromSourceDate = (value?: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  
  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}


export type DossierFilters = {
  search?: string;
  status?: "Régularisé" | "À régulariser";
  priority?: "Haute" | "Normale" | "Basse";
  client?: string;
  transportMode?: string;
  etaFrom?: Date;
  etaTo?: Date;
};

export async function listDossiers(filters: DossierFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const clauses = [];
  if (filters.status) clauses.push(eq(dossiers.calculatedStatus, filters.status));
  if (filters.priority) clauses.push(eq(dossiers.calculatedPriority, filters.priority));
  if (filters.client) clauses.push(eq(dossiers.client, filters.client));
  if (filters.transportMode) clauses.push(eq(dossiers.transportMode, filters.transportMode));
  if (filters.etaFrom) clauses.push(sql`${dossiers.eta} >= ${filters.etaFrom}`);
  if (filters.etaTo) clauses.push(sql`${dossiers.eta} <= ${filters.etaTo}`);
  if (filters.search) {
    const term = `%${filters.search}%`;
    clauses.push(or(like(dossiers.dossierNumber, term), like(dossiers.clientDossierNumber, term), like(dossiers.client, term), like(dossiers.blLtaNumber, term), like(dossiers.cargoNature, term))!);
  }
  return db.select().from(dossiers).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(dossiers.updatedAt), asc(dossiers.dossierNumber));
}

export async function getDossier(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(dossiers).where(eq(dossiers.id, id)).limit(1))[0];
}

export async function getReferenceItems(category?: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referenceItems).where(category ? eq(referenceItems.category, category) : undefined).orderBy(asc(referenceItems.category), asc(referenceItems.sortOrder));
}

export type EditableDossier = Omit<typeof dossiers.$inferInsert, "id" | "dossierNumber" | "calculatedStatus" | "calculatedPriority" | "completionRate" | "createdAt" | "updatedAt">;

export async function createDossier(input: EditableDossier, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  const last = (await db.select({ dossierNumber: dossiers.dossierNumber }).from(dossiers).orderBy(desc(dossiers.dossierNumber)).limit(1))[0];
  const sequence = (last?.dossierNumber ? Number(last.dossierNumber.replace("DOS-", "")) : 0) + 1;
  const state = calculateDossierState(input);
  await db.insert(dossiers).values({ ...input, dossierNumber: formatDossierNumber(sequence), ...state, createdById: userId, updatedById: userId });
  return (await db.select().from(dossiers).where(eq(dossiers.dossierNumber, formatDossierNumber(sequence))).limit(1))[0];
}

export async function updateDossier(id: number, input: Partial<EditableDossier>, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  const current = await getDossier(id);
  if (!current) throw new Error("Dossier introuvable");
  const state = calculateDossierState({ ...current, ...input });
  await db.update(dossiers).set({ ...input, ...state, updatedById: userId, updatedAt: new Date() }).where(eq(dossiers.id, id));
  return getDossier(id);
}

export async function deleteDossier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  await db.delete(dossiers).where(eq(dossiers.id, id));
  return { success: true } as const;
}
