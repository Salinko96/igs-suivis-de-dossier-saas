import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Dossier, dossiers, InsertDossier, InsertUser, ReferenceItem, referenceItems, User, users } from "../drizzle/schema";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";
import { initialImportData } from "./initialImportData";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Fallback in-memory store initialized with initial data
const fromSourceDate = (value?: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;

let _memoryUsers: User[] = [
  {
    id: 1,
    openId: "igs_admin_conakry",
    name: "Ibrahima Gold Service (Admin)",
    email: "contact@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
];

let _memoryReferenceItems: ReferenceItem[] = initialImportData.referenceItems.map((item, idx) => ({
  id: idx + 1,
  category: item.category,
  label: item.label,
  sortOrder: item.sortOrder,
  createdAt: new Date(),
}));

let _memoryDossiers: Dossier[] = initialImportData.dossiers.map((source, idx) => {
  const payload = {
    ...source,
    eta: fromSourceDate(source.eta),
    goodsReleaseDate: fromSourceDate(source.goodsReleaseDate),
  };
  const state = calculateDossierState(payload);
  const now = new Date();
  return {
    id: idx + 1,
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
    calculatedStatus: state.calculatedStatus,
    calculatedPriority: state.calculatedPriority,
    completionRate: state.completionRate,
    documentStatus: null,
    customsStatus: null,
    portStatus: null,
    financialStatus: null,
    fieldOperation: null,
    responsible: null,
    nextAction: null,
    fieldAlert: null,
    deliveryLocation: null,
    declarant: null,
    service: null,
    regime: null,
    notes: null,
    createdById: 1,
    updatedById: 1,
    createdAt: now,
    updatedAt: now,
  };
});

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      _client = postgres(process.env.DATABASE_URL, { 
        max: isServerless ? 5 : 10, 
        idle_timeout: isServerless ? 10 : 20,
        connect_timeout: 10,
        onnotice: () => {}, // Suppress notices
      });
      _db = drizzle(_client);
    } catch (e) {
      console.warn("[DB] Failed to initialize postgres client, falling back to memory store:", e);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  
  // Update in-memory store
  const existingIdx = _memoryUsers.findIndex(u => u.openId === user.openId);
  const now = new Date();
  const role = user.role ?? (user.openId === ENV.ownerOpenId || user.openId.includes("admin") ? "admin" : "user");
  
  if (existingIdx >= 0) {
    _memoryUsers[existingIdx] = {
      ..._memoryUsers[existingIdx],
      name: user.name !== undefined ? (user.name ?? null) : _memoryUsers[existingIdx].name,
      email: user.email !== undefined ? (user.email ?? null) : _memoryUsers[existingIdx].email,
      loginMethod: user.loginMethod !== undefined ? (user.loginMethod ?? null) : _memoryUsers[existingIdx].loginMethod,
      role,
      lastSignedIn: user.lastSignedIn ?? now,
      updatedAt: now,
    };
  } else {
    _memoryUsers.push({
      id: _memoryUsers.length + 1,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    });
  }

  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? now };
    const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
    for (const field of ["name", "email", "loginMethod"] as const) {
      if (user[field] !== undefined) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    }
    values.role = role;
    updateSet.role = role;
    
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (err) {
    console.warn("[DB] upsertUser database write failed:", err);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const res = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (res.length > 0) return res[0];
    } catch (err) {
      console.warn("[DB] getUserByOpenId database query failed:", err);
    }
  }
  return _memoryUsers.find(u => u.openId === openId);
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

export async function listDossiers(filters: DossierFilters = {}): Promise<Dossier[]> {
  const db = await getDb();
  if (db) {
    try {
      const clauses = [];
      if (filters.status) clauses.push(eq(dossiers.calculatedStatus, filters.status));
      if (filters.priority) clauses.push(eq(dossiers.calculatedPriority, filters.priority));
      if (filters.client) clauses.push(eq(dossiers.client, filters.client));
      if (filters.transportMode) clauses.push(eq(dossiers.transportMode, filters.transportMode));
      if (filters.etaFrom) clauses.push(sql`${dossiers.eta} >= ${filters.etaFrom}`);
      if (filters.etaTo) clauses.push(sql`${dossiers.eta} <= ${filters.etaTo}`);
      if (filters.search) {
        const term = `%${filters.search}%`;
        clauses.push(or(
          like(dossiers.dossierNumber, term),
          like(dossiers.clientDossierNumber, term),
          like(dossiers.client, term),
          like(dossiers.blLtaNumber, term),
          like(dossiers.cargoNature, term)
        )!);
      }
      const results = await db.select().from(dossiers).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(dossiers.updatedAt), asc(dossiers.dossierNumber));
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("[DB] listDossiers database query failed, using memory store:", err);
    }
  }

  // Filter in-memory dossiers
  let list = [..._memoryDossiers];
  if (filters.status) list = list.filter(d => d.calculatedStatus === filters.status);
  if (filters.priority) list = list.filter(d => d.calculatedPriority === filters.priority);
  if (filters.client) list = list.filter(d => d.client === filters.client);
  if (filters.transportMode) list = list.filter(d => d.transportMode === filters.transportMode);
  if (filters.etaFrom) list = list.filter(d => d.eta && d.eta >= filters.etaFrom!);
  if (filters.etaTo) list = list.filter(d => d.eta && d.eta <= filters.etaTo!);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(d => 
      (d.dossierNumber && d.dossierNumber.toLowerCase().includes(s)) ||
      (d.clientDossierNumber && d.clientDossierNumber.toLowerCase().includes(s)) ||
      (d.client && d.client.toLowerCase().includes(s)) ||
      (d.blLtaNumber && d.blLtaNumber.toLowerCase().includes(s)) ||
      (d.cargoNature && d.cargoNature.toLowerCase().includes(s))
    );
  }
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getDossier(id: number): Promise<Dossier | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const res = await db.select().from(dossiers).where(eq(dossiers.id, id)).limit(1);
      if (res.length > 0) return res[0];
    } catch (err) {
      console.warn("[DB] getDossier database query failed:", err);
    }
  }
  return _memoryDossiers.find(d => d.id === id);
}

export async function getReferenceItems(category?: string): Promise<ReferenceItem[]> {
  const db = await getDb();
  if (db) {
    try {
      const res = await db.select().from(referenceItems).where(category ? eq(referenceItems.category, category) : undefined).orderBy(asc(referenceItems.category), asc(referenceItems.sortOrder));
      if (res.length > 0) return res;
    } catch (err) {
      console.warn("[DB] getReferenceItems database query failed:", err);
    }
  }
  let items = [..._memoryReferenceItems];
  if (category) items = items.filter(i => i.category === category);
  return items.sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
}

export type EditableDossier = Omit<typeof dossiers.$inferInsert, "id" | "dossierNumber" | "calculatedStatus" | "calculatedPriority" | "completionRate" | "createdAt" | "updatedAt">;

export async function createDossier(input: EditableDossier, userId?: number): Promise<Dossier> {
  // Determine next sequence
  const currentMax = _memoryDossiers.reduce((max, d) => {
    const num = Number(d.dossierNumber?.replace("DOS-", "") || 0);
    return num > max ? num : max;
  }, 0);

  const db = await getDb();
  let sequence = currentMax + 1;
  
  if (db) {
    try {
      const last = (await db.select({ dossierNumber: dossiers.dossierNumber }).from(dossiers).orderBy(desc(dossiers.dossierNumber)).limit(1))[0];
      if (last?.dossierNumber) {
        const dbMax = Number(last.dossierNumber.replace("DOS-", ""));
        if (dbMax >= sequence) sequence = dbMax + 1;
      }
    } catch (err) {
      console.warn("[DB] Could not fetch last dossier sequence from DB:", err);
    }
  }

  const dossierNumber = formatDossierNumber(sequence);
  const state = calculateDossierState(input);
  const now = new Date();

  const newDossier: Dossier = {
    id: _memoryDossiers.length > 0 ? Math.max(..._memoryDossiers.map(d => d.id)) + 1 : 1,
    dossierNumber,
    clientDossierNumber: input.clientDossierNumber ?? null,
    client: input.client ?? null,
    blLtaNumber: input.blLtaNumber ?? null,
    cargoNature: input.cargoNature ?? null,
    transportMode: input.transportMode ?? null,
    eta: input.eta ? new Date(input.eta) : null,
    originPort: input.originPort ?? null,
    destinationPort: input.destinationPort ?? null,
    container: input.container ?? null,
    bulk: input.bulk ?? null,
    goodsReleaseDate: input.goodsReleaseDate ? new Date(input.goodsReleaseDate) : null,
    declarationNumber: input.declarationNumber ?? null,
    bulletinNumber: input.bulletinNumber ?? null,
    finalDeclarationNumber: input.finalDeclarationNumber ?? null,
    calculatedStatus: state.calculatedStatus,
    calculatedPriority: state.calculatedPriority,
    completionRate: state.completionRate,
    documentStatus: input.documentStatus ?? null,
    customsStatus: input.customsStatus ?? null,
    portStatus: input.portStatus ?? null,
    financialStatus: input.financialStatus ?? null,
    fieldOperation: input.fieldOperation ?? null,
    responsible: input.responsible ?? null,
    nextAction: input.nextAction ?? null,
    fieldAlert: input.fieldAlert ?? null,
    deliveryLocation: input.deliveryLocation ?? null,
    declarant: input.declarant ?? null,
    service: input.service ?? null,
    regime: input.regime ?? null,
    notes: input.notes ?? null,
    createdById: userId ?? 1,
    updatedById: userId ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  _memoryDossiers.unshift(newDossier);

  if (db) {
    try {
      await db.insert(dossiers).values({ ...input, dossierNumber, ...state, createdById: userId, updatedById: userId });
      const inserted = (await db.select().from(dossiers).where(eq(dossiers.dossierNumber, dossierNumber)).limit(1))[0];
      if (inserted) {
        newDossier.id = inserted.id;
        return inserted;
      }
    } catch (err) {
      console.warn("[DB] createDossier DB write failed, saved in memory:", err);
    }
  }

  return newDossier;
}

export async function createDossiersBatch(items: EditableDossier[], userId?: number): Promise<{ count: number; created: Dossier[] }> {
  const created: Dossier[] = [];
  for (const item of items) {
    const d = await createDossier(item, userId);
    created.push(d);
  }
  return { count: created.length, created };
}

export async function updateDossier(id: number, input: Partial<EditableDossier>, userId?: number): Promise<Dossier | undefined> {
  const memIdx = _memoryDossiers.findIndex(d => d.id === id);
  if (memIdx === -1) {
    const db = await getDb();
    if (!db) throw new Error("Dossier introuvable");
  }

  const current = _memoryDossiers[memIdx] || (await getDossier(id));
  if (!current) throw new Error("Dossier introuvable");

  const state = calculateDossierState({ ...current, ...input });
  const now = new Date();

  const updated: Dossier = {
    ...current,
    ...input,
    ...state,
    eta: input.eta !== undefined ? (input.eta ? new Date(input.eta) : null) : current.eta,
    goodsReleaseDate: input.goodsReleaseDate !== undefined ? (input.goodsReleaseDate ? new Date(input.goodsReleaseDate) : null) : current.goodsReleaseDate,
    updatedById: userId ?? current.updatedById,
    updatedAt: now,
  };

  if (memIdx >= 0) {
    _memoryDossiers[memIdx] = updated;
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(dossiers).set({ ...input, ...state, updatedById: userId, updatedAt: now }).where(eq(dossiers.id, id));
    } catch (err) {
      console.warn("[DB] updateDossier DB write failed:", err);
    }
  }

  return updated;
}

export async function deleteDossier(id: number): Promise<{ success: boolean }> {
  const memIdx = _memoryDossiers.findIndex(d => d.id === id);
  if (memIdx >= 0) {
    _memoryDossiers.splice(memIdx, 1);
  }

  const db = await getDb();
  if (db) {
    try {
      await db.delete(dossiers).where(eq(dossiers.id, id));
    } catch (err) {
      console.warn("[DB] deleteDossier DB delete failed:", err);
    }
  }

  return { success: true };
}
