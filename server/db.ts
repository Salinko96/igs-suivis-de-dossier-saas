import { and, asc, count, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { TRPCError } from "@trpc/server";
import { 
  Dossier, dossiers, InsertDossier, 
  User, users, InsertUser, 
  ReferenceItem, referenceItems,
  Document, documents, InsertDocument,
  DossierStatusHistory, dossierStatusHistory, InsertDossierStatusHistory,
  Invoice, invoices, InsertInvoice,
  InvoicePayment, invoicePayments, InsertInvoicePayment,
  PacDisbursement, pacDisbursements, InsertPacDisbursement,
  Client, clients, InsertClient,
  ExchangeRate, exchangeRates, InsertExchangeRate,
  DossierTask, dossierTasks, InsertDossierTask,
  DossierComment, dossierComments, InsertDossierComment,
  Notification, notifications, InsertNotification
} from "../drizzle/schema";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";
import { generateProactiveAlerts } from "./alertsService";
import { initialImportData } from "./initialImportData";
import { initialUsersData } from "./initialUsersData";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

const fromSourceDate = (value?: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;

// Mémoire persistée en session — 100+ Collaborateurs Guinéens & Rôles
let _memoryUsers: User[] = initialUsersData.map(u => ({ ...u }));

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
    baeStatus: idx % 3 === 0 ? "Accordé" : "En attente",
    calculatedStatus: state.calculatedStatus,
    calculatedPriority: state.calculatedPriority,
    completionRate: state.completionRate,
    documentStatus: null,
    customsStatus: null,
    portStatus: null,
    financialStatus: idx % 3 === 0 ? "Facturé" : idx % 3 === 1 ? "Fact. Proforma" : "En attente",
    fieldOperation: null,
    responsible: idx % 2 === 0 ? "Mamadou Diallo" : "Alpha Barry",
    nextAction: null,
    fieldAlert: state.calculatedStatus === "À régulariser" ? "DDI / Bulletin à fournir" : null,
    deliveryLocation: null,
    declarant: "Mamadou Diallo",
    service: "Transit & Dédouanement",
    regime: "IM4 - Mise à la consommation",
    notes: null,
    portalAccessCode: `IGS-${1000 + idx + 1}`,
    clientId: null,
    port: "Port Autonome de Conakry (PAC)",
    daysOnQuay: 0,
    createdById: 1,
    updatedById: 1,
    createdAt: now,
    updatedAt: now,
  };
});

let _memoryDocuments: Document[] = [
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
    createdAt: new Date(),
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
    createdAt: new Date(),
  }
];

let _memoryHistory: DossierStatusHistory[] = [
  {
    id: 1,
    dossierId: 1,
    changedById: 1,
    authorName: "Système IGS",
    userRole: "admin",
    action: "CREATION_DOSSIER",
    entityType: "dossier",
    entityId: 1,
    fieldChanged: "Création Dossier",
    previousValue: null,
    newValue: "DOS-0001 importé",
    beforeData: null,
    afterData: JSON.stringify({ dossierNumber: "DOS-0001" }),
    comment: "Initialisation automatique depuis le manifeste maritime",
    ipAddress: "127.0.0.1",
    metadata: null,
    createdAt: new Date(Date.now() - 86400000 * 3),
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
    previousValue: "Non renseigné",
    newValue: "S 142- 27/07/2026",
    beforeData: JSON.stringify({ declarationNumber: null }),
    afterData: JSON.stringify({ declarationNumber: "S 142- 27/07/2026" }),
    comment: "Enregistrement de la déclaration dans Sydonia++",
    ipAddress: "192.168.1.45",
    metadata: null,
    createdAt: new Date(Date.now() - 86400000 * 2),
  }
];

let _currentExchangeRate = 8650;

let _memoryInvoices: Invoice[] = [
  {
    id: 1,
    dossierId: 1,
    invoiceNumber: "FAC-2026-0001",
    client: "Guinean Birimian Gold S.A",
    currency: "GNF",
    invoiceType: "Definitive",
    exchangeRate: 8650,
    amountHt: 18500000,
    amountTva: 3330000,
    amountTtc: 21830000,
    disbursementsAmount: 45000000,
    customsDutiesAmount: 35000000,
    portFeesAmount: 10000000,
    storageAndDemurrageFees: 0,
    estimatedMargin: 5500000,
    paymentMethod: "Virement Bancaire",
    paymentReference: "VIR-2026-0812",
    receiptNumber: "REC-2026-0001",
    status: "Émise",
    dueDate: new Date(Date.now() + 86400000 * 15),
    paidAt: null,
    notes: "Facture transit maritime 4 conteneurs 20 pieds",
    clientId: null,
    pdfUrl: null,
    createdById: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

let _memoryPayments: InvoicePayment[] = [
  {
    id: 1,
    invoiceId: 1,
    amount: 21830000,
    currency: "GNF",
    paymentMethod: "Virement Bancaire",
    paymentReference: "VIR-2026-0812",
    paymentDate: new Date(),
    proofUrl: null,
    notes: "Encaissement initial",
    createdById: 3,
    createdAt: new Date(),
  }
];

let _memoryPacDisbursements: PacDisbursement[] = [
  {
    id: 1,
    dossierId: 1,
    invoiceId: 1,
    type: "douane",
    amountAdvanced: 35000000,
    amountReimbursed: 35000000,
    status: "rembourse_total",
    receiptNumber: "REC-DOUANE-2026-01",
    notes: "Droits de douane SYDONIA S 142",
    createdById: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    dossierId: 1,
    invoiceId: 1,
    type: "port",
    amountAdvanced: 10000000,
    amountReimbursed: 10000000,
    status: "rembourse_total",
    receiptNumber: "REC-PAC-2026-01",
    notes: "Redevance portuaire PAC quai 3",
    createdById: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

let _memoryTasks: DossierTask[] = [
  {
    id: 1,
    dossierId: 54,
    title: "Déposer DDI GUCEG urgente pour DOS-0054 (New Japon Mining)",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 1),
    status: "A_faire",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 2,
    dossierId: 23,
    title: "Valider déclaration SYDONIA World pour DOS-0023 (Guinean Birimian Gold)",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 2),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 3,
    dossierId: 21,
    title: "Obtenir Bon à Délivrer (BAD) Port Autonome de Conakry pour DOS-0021",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 2),
    status: "A_faire",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 4,
    dossierId: 20,
    title: "Inspection physique conteneurs PAC quai terminal pour DOS-0020",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 3),
    status: "A_faire",
    priority: "Normale",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 5,
    dossierId: 3,
    title: "Régularisation bulletin de liquidation BLD Douane PAC pour DOS-0003",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 1),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 6,
    dossierId: 3,
    title: "Enregistrement paiement débours douaniers & taxes PAC pour DOS-0003",
    assignedTo: "Fatoumata Camara",
    dueDate: new Date(Date.now() + 86400000 * 2),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 7,
    dossierId: 1,
    title: "Émission facture définitive & quittance pour DOS-0001",
    assignedTo: "Fatoumata Camara",
    dueDate: new Date(Date.now() + 86400000 * 4),
    status: "Termine",
    priority: "Normale",
    completedAt: new Date(),
    createdById: 1,
    createdAt: new Date(),
  }
];

let _memoryComments: DossierComment[] = [
  {
    id: 1,
    dossierId: 1,
    authorId: 2,
    authorName: "Mamadou Diallo",
    message: "Inspection physique programmée sur le quai conteneur PAC demain matin à 09h00.",
    createdAt: new Date(Date.now() - 3600000 * 4),
  }
];

let _memoryNotifications: Notification[] = [
  {
    id: 1,
    dossierId: 1,
    dossierNumber: "DOS-0001",
    type: "BULLETIN_MANQUANT",
    title: "Bulletin de liquidation manquant",
    message: "Le dossier DOS-0001 (Guinean Birimian Gold) nécessite le bulletin L 1774 pour finalisation.",
    recipientEmail: "contact@igs-logistics.gn",
    recipientRole: "declarant",
    isRead: 0,
    createdAt: new Date(),
  },
  {
    id: 2,
    dossierId: 3,
    dossierNumber: "DOS-0003",
    type: "ETA_DEPASSEE",
    title: "Alerte ETA Dépassée",
    message: "Le navire du dossier DOS-0003 est arrivé le 21/07/2026. Risque de surestaries au port de Conakry.",
    recipientEmail: "contact@igs-logistics.gn",
    recipientRole: "manager",
    isRead: 0,
    createdAt: new Date(),
  }
];

export async function withDbTimeout<T>(queryPromise: Promise<T>, timeoutMs = 2500): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
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

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      _client = postgres(process.env.DATABASE_URL, { 
        max: isServerless ? 2 : 5, 
        idle_timeout: 5,
        connect_timeout: 3, // 3s fail-fast connection timeout
        prepare: false, // Requis pour la compatibilité Supabase Transaction Pooler (Supavisor port 6543)
        onnotice: () => {},
      });
      _db = drizzle(_client);
    } catch (e) {
      console.warn("[DB] Fallback memory store actif:", e);
      _db = null;
    }
  }
  return _db;
}

// ----------------- USERS & AUTH -----------------
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    try {
      const values: InsertUser = {
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        clientCompany: user.clientCompany ?? null,
        phone: user.phone ?? null,
        isActive: user.isActive ?? true,
        sessionRevokedAt: user.sessionRevokedAt ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
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
          lastSignedIn: values.lastSignedIn,
        },
      });
      return;
    } catch (err) {
      console.warn("[DB] Error inserting user in DB, saving in memory:", err);
    }
  }

  const existingIdx = _memoryUsers.findIndex(u => u.openId === user.openId);
  if (existingIdx >= 0) {
    _memoryUsers[existingIdx] = {
      ..._memoryUsers[existingIdx],
      ...user,
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else {
    _memoryUsers.push({
      id: _memoryUsers.length > 0 ? Math.max(..._memoryUsers.map(u => u.id)) + 1 : 1,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      clientCompany: user.clientCompany ?? null,
      phone: user.phone ?? null,
      isActive: user.isActive ?? true,
      sessionRevokedAt: user.sessionRevokedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const mem = _memoryUsers.find(u => u.openId === openId);
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
  return undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const mem = _memoryUsers.find(u => u.id === id);
  if (mem) return mem;
  const db = await getDb();
  if (db) {
    try {
      const row = (await withDbTimeout(db.select().from(users).where(eq(users.id, id)).limit(1), 1500))[0];
      if (row) return row;
    } catch (e) {}
  }
  return undefined;
}

export type UserFilters = {
  search?: string;
  role?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

export async function listUsers(filters?: UserFilters): Promise<User[]> {
  let list = [..._memoryUsers];

  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(u =>
      (u.name && u.name.toLowerCase().includes(s)) ||
      (u.email && u.email.toLowerCase().includes(s)) ||
      (u.phone && u.phone.toLowerCase().includes(s)) ||
      (u.clientCompany && u.clientCompany.toLowerCase().includes(s)) ||
      (u.openId && u.openId.toLowerCase().includes(s))
    );
  }

  if (filters?.role && filters.role !== "all") {
    list = list.filter(u => u.role === filters.role);
  }

  if (filters?.isActive !== undefined) {
    list = list.filter(u => u.isActive === filters.isActive);
  }

  list.sort((a, b) => a.id - b.id);

  if (filters?.offset !== undefined || filters?.limit !== undefined) {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? list.length;
    return list.slice(offset, offset + limit);
  }

  return list;
}

export async function createUser(data: {
  name: string;
  email: string;
  phone?: string | null;
  role: "admin" | "declarant" | "comptable" | "client" | "manager" | "user";
  clientCompany?: string | null;
  isActive?: boolean;
}): Promise<User> {
  const now = new Date();
  const cleanEmail = data.email.toLowerCase().trim();
  const generatedOpenId = `igs_${data.role}_${cleanEmail.replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`;

  const newUser: User = {
    id: _memoryUsers.length > 0 ? Math.max(..._memoryUsers.map(u => u.id)) + 1 : 1,
    openId: generatedOpenId,
    name: data.name.trim(),
    email: cleanEmail,
    loginMethod: "direct",
    role: data.role,
    clientCompany: data.role === "client" ? (data.clientCompany ?? null) : null,
    phone: data.phone?.trim() ?? null,
    isActive: data.isActive ?? true,
    sessionRevokedAt: data.isActive === false ? now : null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
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
        lastSignedIn: newUser.lastSignedIn,
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

export async function updateUser(
  id: number,
  data: Partial<{
    name: string;
    email: string;
    phone: string | null;
    role: "admin" | "declarant" | "comptable" | "client" | "manager" | "user";
    clientCompany: string | null;
    isActive: boolean;
  }>
): Promise<User> {
  const userIdx = _memoryUsers.findIndex(u => u.id === id);
  if (userIdx < 0) {
    throw new Error(`Utilisateur avec ID ${id} introuvable`);
  }

  const existing = _memoryUsers[userIdx];
  const now = new Date();
  const updatedUser: User = {
    ...existing,
    name: data.name !== undefined ? data.name : existing.name,
    email: data.email !== undefined ? data.email.toLowerCase().trim() : existing.email,
    phone: data.phone !== undefined ? data.phone : existing.phone,
    role: data.role !== undefined ? data.role : existing.role,
    clientCompany: data.clientCompany !== undefined ? data.clientCompany : existing.clientCompany,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    sessionRevokedAt:
      data.isActive === false && existing.isActive !== false
        ? now
        : data.isActive === true
        ? null
        : existing.sessionRevokedAt,
    updatedAt: now,
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
        updatedAt: updatedUser.updatedAt,
      }).where(eq(users.id, id));
    } catch (err) {
      console.warn("[DB] Error updating user in DB:", err);
    }
  }

  _memoryUsers[userIdx] = updatedUser;
  return updatedUser;
}

export async function toggleUserStatus(id: number, isActive: boolean): Promise<User> {
  const userIdx = _memoryUsers.findIndex(u => u.id === id);
  if (userIdx < 0) {
    throw new Error(`Utilisateur introuvable avec l'ID ${id}`);
  }

  const existing = _memoryUsers[userIdx];
  const now = new Date();
  const updatedUser: User = {
    ...existing,
    isActive,
    sessionRevokedAt: !isActive ? now : null,
    updatedAt: now,
  };

  const db = await getDb();
  if (db) {
    try {
      await db.update(users).set({
        isActive,
        sessionRevokedAt: updatedUser.sessionRevokedAt,
        updatedAt: now,
      }).where(eq(users.id, id));
    } catch (err) {
      console.warn("[DB] Error toggling user status in DB:", err);
    }
  }

  _memoryUsers[userIdx] = updatedUser;
  return updatedUser;
}

export async function getHRStats() {
  const all = _memoryUsers;
  const totalEmployees = all.length;
  const activeDeclarantsAtPort = all.filter(u => u.role === "declarant" && u.isActive !== false).length;
  const activeComptables = all.filter(u => u.role === "comptable" && u.isActive !== false).length;
  const connectedClients = all.filter(u => u.role === "client" && u.isActive !== false).length;
  const totalActive = all.filter(u => u.isActive !== false).length;
  const totalInactive = all.filter(u => u.isActive === false).length;

  return {
    totalEmployees,
    activeDeclarantsAtPort,
    activeComptables,
    connectedClients,
    totalActive,
    totalInactive,
  };
}

// ----------------- DOSSIERS -----------------
export type DossierFilters = {
  search?: string;
  status?: "Régularisé" | "À régulariser";
  priority?: "Haute" | "Normale" | "Basse";
  client?: string;
  transportMode?: string;
  responsible?: string;
  myDossiersOnly?: boolean;
  currentUserCompany?: string | null;
  etaFrom?: Date;
  etaTo?: Date;
};

let _dossiersCacheTimestamp = 0;
const DOSSIERS_CACHE_TTL_MS = 3_000; // 3s sync TTL between serverless instances

export function invalidateDossiersCache() {
  _dossiersCacheTimestamp = 0;
}

export async function listDossiers(filters: DossierFilters = {}) {
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

  // Filtrage mémoire ultra-rapide (0.05ms)
  if (filters.currentUserCompany) {
    list = list.filter(d => d.client?.toLowerCase().includes(filters.currentUserCompany!.toLowerCase()));
  }
  if (filters.status) list = list.filter(d => d.calculatedStatus === filters.status);
  if (filters.priority) list = list.filter(d => d.calculatedPriority === filters.priority);
  if (filters.client) list = list.filter(d => d.client === filters.client);
  if (filters.responsible) list = list.filter(d => d.responsible === filters.responsible);
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
      (d.cargoNature && d.cargoNature.toLowerCase().includes(s)) ||
      (d.portalAccessCode && d.portalAccessCode.toLowerCase().includes(s))
    );
  }
  return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getDossier(idOrIdentifier: number | string) {
  const rawStr = String(idOrIdentifier).trim();
  const numId = Number(idOrIdentifier);
  const isValidNum = !isNaN(numId) && Number.isInteger(numId) && numId > 0;
  const formattedNum = isValidNum ? formatDossierNumber(numId) : null;
  const upperStr = rawStr.toUpperCase();
  const lowerStr = rawStr.toLowerCase();

  // Dérivation d'ID si format IGS-1xxx
  let derivedId: number | null = null;
  const igsMatch = upperStr.match(/^IGS-(\d+)$/i);
  if (igsMatch) {
    const rawNum = parseInt(igsMatch[1], 10);
    derivedId = rawNum >= 1000 ? rawNum - 1000 : rawNum;
  }
  const dosMatch = upperStr.match(/^DOS-(\d+)$/i);
  if (dosMatch) {
    derivedId = parseInt(dosMatch[1], 10);
  }

  // 1. Instant In-Memory Lookup (< 0.05ms)
  if (isValidNum) {
    const memoryById = _memoryDossiers.find(d => d.id === numId);
    if (memoryById) return memoryById;
  }
  if (derivedId && derivedId > 0) {
    const memoryByDerived = _memoryDossiers.find(d => d.id === derivedId);
    if (memoryByDerived) return memoryByDerived;
  }
  if (formattedNum) {
    const memoryByFormatted = _memoryDossiers.find(d => d.dossierNumber?.toUpperCase() === formattedNum.toUpperCase());
    if (memoryByFormatted) return memoryByFormatted;
  }
  const memoryByMatch = _memoryDossiers.find(d => {
    if (d.dossierNumber?.toUpperCase() === upperStr) return true;
    if (d.portalAccessCode?.toUpperCase() === upperStr) return true;
    if (d.blLtaNumber?.toUpperCase() === upperStr) return true;
    if (d.clientDossierNumber?.toUpperCase() === upperStr) return true;
    const portalCode = `IGS-${1000 + d.id}`;
    if (portalCode.toUpperCase() === upperStr) return true;
    return false;
  });
  if (memoryByMatch) return memoryByMatch;

  // 2. Database Lookup if not found in memory
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
        sql`LOWER(TRIM(${dossiers.clientDossierNumber})) = ${lowerStr}`,
      ];
      const row = (await withDbTimeout(db.select().from(dossiers).where(or(...conditions)).limit(1), 1500))[0];
      if (row) return row;
    } catch (e) {
      console.warn("[DB] getDossier database query error:", e);
    }
  }

  return undefined;
}

export async function getDossierByPortalCode(portalAccessCode: string) {
  const rawStr = String(portalAccessCode || "").trim();
  if (!rawStr) return undefined;

  const upperStr = rawStr.toUpperCase();
  const lowerStr = rawStr.toLowerCase();

  // Dérivation d'identifiant numérique pour formats "IGS-1001" ou "DOS-0001"
  let derivedId: number | null = null;
  const igsMatch = upperStr.match(/^IGS-(\d+)$/i);
  if (igsMatch) {
    const rawNum = parseInt(igsMatch[1], 10);
    derivedId = rawNum >= 1000 ? rawNum - 1000 : rawNum;
  }
  const dosMatch = upperStr.match(/^DOS-(\d+)$/i);
  if (dosMatch) {
    derivedId = parseInt(dosMatch[1], 10);
  }
  if (/^\d+$/.test(rawStr)) {
    const rawNum = parseInt(rawStr, 10);
    derivedId = rawNum >= 1000 ? rawNum - 1000 : rawNum;
  }

  // 1. Recherche instantanée en mémoire
  const memoryMatch = _memoryDossiers.find(d => {
    if (d.portalAccessCode?.trim().toUpperCase() === upperStr) return true;
    if (d.dossierNumber?.trim().toUpperCase() === upperStr) return true;
    if (d.blLtaNumber?.trim().toUpperCase() === upperStr) return true;
    if (d.clientDossierNumber?.trim().toUpperCase() === upperStr) return true;

    // Correspondance avec le code de portail généré IGS-1000+id
    const generatedPortalCode = `IGS-${1000 + d.id}`;
    if (generatedPortalCode.toUpperCase() === upperStr) return true;

    if (derivedId && d.id === derivedId) return true;

    // Comparaison insensible à la casse
    if (d.portalAccessCode?.trim().toLowerCase() === lowerStr) return true;
    if (d.dossierNumber?.trim().toLowerCase() === lowerStr) return true;
    if (d.blLtaNumber?.trim().toLowerCase() === lowerStr) return true;
    if (d.clientDossierNumber?.trim().toLowerCase() === lowerStr) return true;

    return false;
  });

  if (memoryMatch) return memoryMatch;

  // 2. Recherche complète en base de données Supabase / PostgreSQL (insensible à la casse & espaces)
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
        sql`LOWER(TRIM(${dossiers.clientDossierNumber})) = ${lowerStr}`,
      ];

      if (derivedId && derivedId > 0) {
        conditions.push(eq(dossiers.id, derivedId));
        conditions.push(eq(dossiers.dossierNumber, formatDossierNumber(derivedId)));
      }

      const row = (
        await withDbTimeout(
          db
            .select()
            .from(dossiers)
            .where(or(...conditions))
            .limit(1),
          2000
        )
      )[0];

      if (row) return row;
    } catch (e) {
      console.error("[DB] getDossierByPortalCode database query error:", e);
    }
  }

  return undefined;
}

export type EditableDossier = Omit<typeof dossiers.$inferInsert, "id" | "version" | "dossierNumber" | "calculatedStatus" | "calculatedPriority" | "completionRate" | "createdAt" | "updatedAt">;

export interface UpdateDossierOptions {
  expectedVersion?: number;
  expectedUpdatedAt?: string | Date;
  forceOverwrite?: boolean;
  userRole?: string;
  ipAddress?: string;
}

export async function createDossier(input: EditableDossier, userId?: number, authorName?: string) {
  const sequence = _memoryDossiers.length + 1;
  const num = formatDossierNumber(sequence);
  const state = calculateDossierState(input);
  const portalCode = `IGS-${1000 + sequence}`;
  const now = new Date();

  const newDossier: Dossier = {
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
    service: input.service ?? "Transit & Dédouanement",
    regime: input.regime ?? "IM4",
    notes: input.notes ?? null,
    portalAccessCode: portalCode,
    clientId: input.clientId ?? null,
    port: input.port ?? "Port Autonome de Conakry (PAC)",
    daysOnQuay: input.daysOnQuay ?? 0,
    createdById: userId ?? 1,
    updatedById: userId ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  _memoryDossiers.unshift(newDossier);

  // Historique & Audit Trail
  await logAuditEvent({
    dossierId: newDossier.id,
    userId: userId ?? 1,
    userName: authorName ?? "Utilisateur",
    userRole: "declarant",
    action: "DOSSIER_CREE",
    entityType: "dossier",
    entityId: newDossier.id,
    fieldChanged: "Création Dossier",
    previousValue: null,
    newValue: `Dossier ${num} créé`,
    afterData: { dossierNumber: num, client: newDossier.client, blLtaNumber: newDossier.blLtaNumber },
    comment: `Portail client: ${portalCode}`,
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

export function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "Vide";
  if (val === "") return "Vide";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

const dossierMutexMap = new Map<number, Promise<void>>();

async function runWithDossierLock<T>(dossierId: number, fn: () => Promise<T>): Promise<T> {
  const previousLock = dossierMutexMap.get(dossierId) || Promise.resolve();

  let releaseLock: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  dossierMutexMap.set(dossierId, currentLock);

  await previousLock.catch(() => {});

  try {
    return await fn();
  } finally {
    releaseLock!();
    if (dossierMutexMap.get(dossierId) === currentLock) {
      dossierMutexMap.delete(dossierId);
    }
  }
}

export async function updateDossier(
  id: number,
  input: Partial<EditableDossier>,
  userId?: number,
  authorName?: string,
  options?: UpdateDossierOptions
) {
  return runWithDossierLock(id, async () => {
    const current = await getDossier(id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });

    // 1. Contrôle de Concurrence Optimiste (Optimistic Locking)
    if (!options?.forceOverwrite) {
      if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Conflit d'édition simultanée : ce dossier a été modifié par un autre utilisateur (version locale: v${options.expectedVersion}, version serveur: v${current.version}). Veuillez recharger ou écraser les modifications.`,
        });
      }

      if (options?.expectedUpdatedAt !== undefined) {
        const expectedTime = new Date(options.expectedUpdatedAt).getTime();
        const currentTime = new Date(current.updatedAt).getTime();
        if (!isNaN(expectedTime) && !isNaN(currentTime) && Math.abs(currentTime - expectedTime) > 1000) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Conflit d'édition simultanée : ce dossier a été modifié par un autre utilisateur. Veuillez recharger ou écraser les modifications.",
          });
        }
      }
    }

    const nextVersion = (current.version || 1) + 1;
    const state = calculateDossierState({ ...current, ...input });
    const now = new Date();

    // 2. Détection et journalisation des transitions & changements
    const historyEntries: InsertDossierStatusHistory[] = [];
    const actionMap: Record<string, string> = {
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
      notes: "NOTE_MODIFIEE",
    };

    for (const [key, val] of Object.entries(input)) {
      const oldVal = (current as any)[key];
      if (oldVal !== val && val !== undefined) {
        const action = actionMap[key] || `MODIFICATION_${key.toUpperCase()}`;
        const entry: DossierStatusHistory = {
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
          comment: `Mise à jour ${key}`,
          ipAddress: options?.ipAddress ?? null,
          metadata: null,
          createdAt: now,
        };
        _memoryHistory.unshift(entry);
        historyEntries.push(entry);
      }
    }

    // 3. Mise à jour instantanée du cache mémoire avec version incrémentée
    const updated: Dossier = {
      ...current,
      ...input,
      ...state,
      version: nextVersion,
      updatedById: userId ?? current.updatedById,
      updatedAt: now,
    };

    const memIdx = _memoryDossiers.findIndex(d => d.id === id);
    if (memIdx >= 0) _memoryDossiers[memIdx] = updated;

    // 4. Persistance DB parallèle et non-bloquante avec timeout
    const db = await getDb();
    if (db) {
      try {
        await withDbTimeout(
          Promise.all([
            db.update(dossiers).set({ ...input, ...state, version: nextVersion, updatedById: userId, updatedAt: now }).where(eq(dossiers.id, id)),
            historyEntries.length > 0 ? db.insert(dossierStatusHistory).values(historyEntries) : Promise.resolve(),
          ]),
          2000
        );
      } catch (e) {
        console.warn("[DB] updateDossier DB sync error or timeout, saved in memory:", e);
      }
    }
    invalidateDossiersCache();
    return updated;
  });
}

export async function importDossiersBatch(
  items: EditableDossier[],
  userId?: number,
  authorName?: string
) {
  if (items.length === 0) {
    return { total: 0, createdCount: 0, updatedCount: 0, duplicatesPrevented: 0, dossiers: [] };
  }

  const db = await getDb();
  
  // 1. Initialiser / Synchroniser l'index des dossiers existants en O(1)
  const existingMapByBL = new Map<string, Dossier>();
  const existingMapByClientRef = new Map<string, Dossier>();

  // Alimenter depuis le cache mémoire local
  for (const d of _memoryDossiers) {
    if (d.blLtaNumber) existingMapByBL.set(d.blLtaNumber.trim().toUpperCase(), d);
    if (d.clientDossierNumber) existingMapByClientRef.set(d.clientDossierNumber.trim().toUpperCase(), d);
  }

  // Si DB connectée, précharger en 1 SEULE requête bulk tous les dossiers pertinents
  if (db) {
    try {
      const dbAll = await db.select().from(dossiers);
      for (const d of dbAll) {
        if (d.blLtaNumber) existingMapByBL.set(d.blLtaNumber.trim().toUpperCase(), d);
        if (d.clientDossierNumber) existingMapByClientRef.set(d.clientDossierNumber.trim().toUpperCase(), d);
      }
    } catch (e) {}
  }

  let createdCount = 0;
  let updatedCount = 0;
  const processed: Dossier[] = [];
  const toInsertDB: any[] = [];
  const toUpdateDB: { id: number; data: any }[] = [];
  const historyBatch: InsertDossierStatusHistory[] = [];

  let nextSequence = _memoryDossiers.length + 1;
  const now = new Date();

  for (const item of items) {
    const cleanBL = item.blLtaNumber?.trim().toUpperCase() || "";
    const cleanClientNum = item.clientDossierNumber?.trim().toUpperCase() || "";

    // Recherche instantanée O(1)
    let existing: Dossier | undefined = undefined;
    if (cleanBL && existingMapByBL.has(cleanBL)) {
      existing = existingMapByBL.get(cleanBL);
    } else if (cleanClientNum && existingMapByClientRef.has(cleanClientNum)) {
      existing = existingMapByClientRef.get(cleanClientNum);
    }

    if (existing) {
      // 2. Mise à jour / Merge
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
        nextAction: item.nextAction || existing.nextAction,
      };

      const state = calculateDossierState({ ...existing, ...mergedInput });
      const nextVer = (existing.version || 1) + 1;
      const updated: Dossier = {
        ...existing,
        ...mergedInput,
        ...state,
        version: nextVer,
        updatedById: userId ?? existing.updatedById,
        updatedAt: now,
      };

      // Mettre à jour le cache mémoire
      const memIdx = _memoryDossiers.findIndex(d => d.id === existing!.id);
      if (memIdx >= 0) _memoryDossiers[memIdx] = updated;
      else _memoryDossiers.push(updated);

      if (cleanBL) existingMapByBL.set(cleanBL, updated);
      if (cleanClientNum) existingMapByClientRef.set(cleanClientNum, updated);

      toUpdateDB.push({ id: existing.id, data: { ...mergedInput, ...state, version: nextVer, updatedById: userId ?? 1, updatedAt: now } });

      const updateHistoryEntry: DossierStatusHistory = {
        id: _memoryHistory.length + 1,
        dossierId: existing.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        userRole: "declarant",
        action: "IMPORT_BATCH_FUSION",
        entityType: "dossier",
        entityId: existing.id,
        fieldChanged: "Mise à jour Import",
        previousValue: existing.calculatedStatus,
        newValue: state.calculatedStatus,
        beforeData: JSON.stringify({ calculatedStatus: existing.calculatedStatus }),
        afterData: JSON.stringify({ calculatedStatus: state.calculatedStatus }),
        comment: `Fusion automatique (${cleanBL || cleanClientNum})`,
        ipAddress: null,
        metadata: null,
        createdAt: now,
      };
      _memoryHistory.unshift(updateHistoryEntry);
      historyBatch.push(updateHistoryEntry);

      processed.push(updated);
      updatedCount++;
    } else {
      // 3. Création Nouveau Dossier
      const num = formatDossierNumber(nextSequence);
      const portalCode = `IGS-${1000 + nextSequence}`;
      const state = calculateDossierState(item);

      const newDossier: Dossier = {
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
        service: item.service ?? "Transit & Dédouanement",
        regime: item.regime ?? "IM4",
        notes: item.notes ?? null,
        portalAccessCode: portalCode,
        clientId: item.clientId ?? null,
        port: item.port ?? "Port Autonome de Conakry (PAC)",
        daysOnQuay: item.daysOnQuay ?? 0,
        createdById: userId ?? 1,
        updatedById: userId ?? 1,
        createdAt: now,
        updatedAt: now,
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
        updatedAt: now,
      });

      const createHistoryEntry: DossierStatusHistory = {
        id: _memoryHistory.length + 1,
        dossierId: newDossier.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        userRole: "declarant",
        action: "DOSSIER_CREE",
        entityType: "dossier",
        entityId: newDossier.id,
        fieldChanged: "Création Dossier",
        previousValue: null,
        newValue: `Dossier ${num} créé`,
        beforeData: null,
        afterData: JSON.stringify({ dossierNumber: num, client: newDossier.client, blLtaNumber: newDossier.blLtaNumber }),
        comment: `Import batch automatique`,
        ipAddress: null,
        metadata: null,
        createdAt: now,
      };
      _memoryHistory.unshift(createHistoryEntry);
      historyBatch.push(createHistoryEntry);

      processed.push(newDossier);
      createdCount++;
      nextSequence++;
    }
  }

  // 4. Exécution DB en parallèle (Ultra Rapide)
  if (db) {
    try {
      const dbPromises = [];

      // Multi-row INSERT pour les nouveaux dossiers
      if (toInsertDB.length > 0) {
        dbPromises.push(db.insert(dossiers).values(toInsertDB));
      }

      // Updates exécutés en parallèle par lots
      if (toUpdateDB.length > 0) {
        for (const u of toUpdateDB) {
          dbPromises.push(db.update(dossiers).set(u.data).where(eq(dossiers.id, u.id)));
        }
      }

      // Multi-row INSERT pour l'historique
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
    dossiers: processed,
  };
}

export async function deleteDossier(id: number) {
  _memoryDossiers = _memoryDossiers.filter(d => d.id !== id);
  invalidateDossiersCache();
  const db = await getDb();
  if (db) {
    try {
      await db.delete(dossiers).where(eq(dossiers.id, id));
    } catch (e) {}
  }
  return { success: true } as const;
}

// ----------------- DOCUMENTS & PREUVES -----------------
export async function listDocuments(dossierId: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(documents).where(eq(documents.dossierId, dossierId)).orderBy(desc(documents.createdAt));
    } catch (e) {}
  }
  return _memoryDocuments.filter(doc => doc.dossierId === dossierId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createDocument(input: InsertDocument) {
  const now = new Date();
  const doc: Document = {
    id: _memoryDocuments.length + 1,
    dossierId: input.dossierId,
    name: input.name,
    type: input.type ?? "Autre",
    fileUrl: input.fileUrl,
    fileSize: input.fileSize ?? 0,
    mimeType: input.mimeType ?? "application/octet-stream",
    uploadedById: input.uploadedById ?? 1,
    uploaderName: input.uploaderName ?? "Opérateur IGS",
    createdAt: now,
  };
  _memoryDocuments.unshift(doc);

  // Traçabilité & notification
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.uploadedById ?? 1,
    userName: input.uploaderName ?? "Opérateur IGS",
    userRole: "declarant",
    action: "DOCUMENT_AJOUTE",
    entityType: "document",
    entityId: doc.id,
    fieldChanged: "Document",
    previousValue: null,
    newValue: `${doc.type}: ${doc.name}`,
    afterData: { name: doc.name, type: doc.type, fileSize: doc.fileSize, mimeType: doc.mimeType },
    metadata: { mimeType: doc.mimeType, fileSize: doc.fileSize },
    comment: `Fichier joint (${Math.round((doc.fileSize || 0) / 1024)} KB)`,
  });

  const db = await getDb();
  if (db) {
    try {
      await db.insert(documents).values(input);
    } catch (e) {}
  }
  return doc;
}

export async function deleteDocument(id: number, userId?: number, authorName?: string) {
  const targetDoc = _memoryDocuments.find(d => d.id === id);
  _memoryDocuments = _memoryDocuments.filter(d => d.id !== id);

  if (targetDoc) {
    await logAuditEvent({
      dossierId: targetDoc.dossierId,
      userId: userId ?? 1,
      userName: authorName ?? "Opérateur IGS",
      userRole: "declarant",
      action: "DOCUMENT_SUPPRIME",
      entityType: "document",
      entityId: id,
      fieldChanged: "Document",
      previousValue: `${targetDoc.type}: ${targetDoc.name}`,
      newValue: "Supprimé",
      beforeData: { name: targetDoc.name, type: targetDoc.type, fileSize: targetDoc.fileSize },
      comment: `Suppression du document ${targetDoc.name}`,
    });
  }

  const db = await getDb();
  if (db) {
    try {
      await db.delete(documents).where(eq(documents.id, id));
    } catch (e) {}
  }
  return { success: true };
}

// ----------------- AUDIT TRAIL / HISTORIQUE -----------------
export interface LogAuditParams {
  dossierId?: number | null;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  fieldChanged?: string | null;
  previousValue?: any;
  newValue?: any;
  beforeData?: any;
  afterData?: any;
  comment?: string | null;
  ipAddress?: string | null;
  metadata?: any;
  createdAt?: Date;
}

export async function logAuditEvent(params: LogAuditParams): Promise<DossierStatusHistory> {
  const now = params.createdAt ?? new Date();
  const beforeStr = params.beforeData ? (typeof params.beforeData === "string" ? params.beforeData : JSON.stringify(params.beforeData)) : null;
  const afterStr = params.afterData ? (typeof params.afterData === "string" ? params.afterData : JSON.stringify(params.afterData)) : null;
  const metaStr = params.metadata ? (typeof params.metadata === "string" ? params.metadata : JSON.stringify(params.metadata)) : null;

  const entry: DossierStatusHistory = {
    id: _memoryHistory.length + 1,
    dossierId: params.dossierId ?? (params.entityType === "dossier" && params.entityId ? params.entityId : 0),
    changedById: params.userId ?? null,
    authorName: params.userName ?? "Système IGS",
    userRole: params.userRole ?? null,
    action: params.action,
    entityType: params.entityType ?? "dossier",
    entityId: params.entityId ?? params.dossierId ?? null,
    fieldChanged: params.fieldChanged ?? params.action,
    previousValue: params.previousValue === null || params.previousValue === undefined ? null : formatAuditValue(params.previousValue),
    newValue: params.newValue === null || params.newValue === undefined ? null : formatAuditValue(params.newValue),
    beforeData: beforeStr,
    afterData: afterStr,
    comment: params.comment ?? null,
    ipAddress: params.ipAddress ?? null,
    metadata: metaStr,
    createdAt: now,
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

export async function listDossierHistory(dossierId: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierStatusHistory).where(eq(dossierStatusHistory.dossierId, dossierId)).orderBy(desc(dossierStatusHistory.createdAt));
    } catch (e) {}
  }
  return _memoryHistory.filter(h => h.dossierId === dossierId || (h.entityType === "dossier" && h.entityId === dossierId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function addDossierHistory(input: InsertDossierStatusHistory) {
  return logAuditEvent({
    dossierId: input.dossierId,
    userId: input.changedById ?? null,
    userName: input.authorName ?? "Utilisateur IGS",
    userRole: input.userRole ?? null,
    action: input.action ?? input.fieldChanged ?? "STATUT_MODIFIE",
    entityType: input.entityType ?? "dossier",
    entityId: input.entityId ?? input.dossierId,
    fieldChanged: input.fieldChanged,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    comment: input.comment ?? null,
    ipAddress: input.ipAddress ?? null,
    metadata: input.metadata ?? null,
  });
}

// ----------------- FACTURATION & FINANCE -----------------
export async function listInvoices(dossierId?: number) {
  let list = [..._memoryInvoices];
  if (list.length === 0) {
    const db = await getDb();
    if (db) {
      try {
        const rows = await withDbTimeout(
          db.select().from(invoices).where(dossierId ? eq(invoices.dossierId, dossierId) : undefined).orderBy(desc(invoices.createdAt)),
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
  if (dossierId) list = list.filter(i => i.dossierId === dossierId);
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createInvoice(input: Omit<InsertInvoice, "invoiceNumber"> & { invoiceNumber?: string }) {
  const sequence = _memoryInvoices.length + 1;
  const invNum = input.invoiceNumber || `FAC-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`;
  const now = new Date();
  const customs = input.customsDutiesAmount ?? 0;
  const port = input.portFeesAmount ?? 0;
  const disbursements = input.disbursementsAmount ?? (customs + port);
  const amountHt = input.amountHt ?? 0;
  const amountTva = input.amountTva ?? Math.round(amountHt * 0.18);
  const amountTtc = input.amountTtc ?? (amountHt + amountTva);
  const isPaid = input.status === "Payée";

  const inv: Invoice = {
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
    dueDate: input.dueDate ?? new Date(Date.now() + 86400000 * 30),
    paidAt: isPaid ? (input.paidAt ?? now) : null,
    notes: input.notes ?? null,
    createdById: input.createdById ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  _memoryInvoices.unshift(inv);

  // Mise à jour du statut financier du dossier
  await updateDossier(input.dossierId, { financialStatus: isPaid ? "Payé" : inv.invoiceType === "Proforma" ? "Fact. Proforma" : "Facturé" });

  // Audit log pour traçabilité réglementaire
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.createdById ?? 1,
    userName: "Service Comptabilité",
    userRole: "comptable",
    action: "FACTURE_CREEE",
    entityType: "invoice",
    entityId: inv.id,
    fieldChanged: "Facture",
    previousValue: null,
    newValue: `${inv.invoiceType} N° ${invNum}`,
    beforeData: null,
    afterData: {
      invoiceNumber: invNum,
      client: inv.client,
      amountHt,
      amountTva,
      amountTtc,
      disbursementsAmount: disbursements,
      currency: inv.currency,
      status: inv.status,
    },
    comment: `Émission facture ${inv.invoiceType} de ${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency} pour ${inv.client}`,
  });

  // Notification automatique de facturation
  try {
    await addNotification({
      dossierId: input.dossierId,
      dossierNumber: null,
      type: "FACTURE_GENEREE",
      title: `Facture ${invNum} générée`,
      message: `Facture ${inv.invoiceType} de ${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency} émise pour ${inv.client}.`,
      recipientRole: "comptable",
    });
  } catch (e) {}

  const db = await getDb();
  if (db) {
    try {
      await db.insert(invoices).values({ ...input, invoiceNumber: invNum, disbursementsAmount: disbursements, amountHt, amountTva, amountTtc, receiptNumber: inv.receiptNumber, paidAt: inv.paidAt });
    } catch (e) {}
  }
  return inv;
}

export async function updateInvoice(id: number, input: Partial<InsertInvoice>) {
  const idx = _memoryInvoices.findIndex(i => i.id === id);
  const current = idx >= 0 ? _memoryInvoices[idx] : null;
  const now = new Date();
  const isPaying = input.status === "Payée";

  const updatedData = {
    ...input,
    updatedAt: now,
    ...(isPaying && !input.paidAt ? { paidAt: now } : {}),
    ...(isPaying && !input.receiptNumber && (!current || !current.receiptNumber) ? { receiptNumber: `REC-2026-${id}` } : {}),
  };

  if (idx >= 0 && current) {
    _memoryInvoices[idx] = {
      ...current,
      ...updatedData,
      status: (updatedData.status ?? current.status) as Invoice["status"],
      invoiceType: (updatedData.invoiceType ?? current.invoiceType) as Invoice["invoiceType"],
    };
  }

  const db = await getDb();
  if (db) {
    try {
      await db.update(invoices).set(updatedData).where(eq(invoices.id, id));
    } catch (e) {}
  }

  let result = idx >= 0 ? _memoryInvoices[idx] : null;
  if (!result && db) {
    try {
      const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      if (rows.length > 0) result = rows[0];
    } catch (e) {}
  }

  if (result && result.dossierId) {
    if (result.status === "Payée") {
      await updateDossier(result.dossierId, { financialStatus: "Payé" });
    } else if (result.invoiceType === "Definitive" || result.status === "Émise") {
      await updateDossier(result.dossierId, { financialStatus: "Facturé" });
    }

    await logAuditEvent({
      dossierId: result.dossierId,
      userId: 1,
      userName: "Service Comptabilité",
      userRole: "comptable",
      action: "FACTURE_MODIFIEE",
      entityType: "invoice",
      entityId: id,
      fieldChanged: "Statut Facture",
      previousValue: current?.status ?? null,
      newValue: result.status,
      afterData: { status: result.status, invoiceType: result.invoiceType },
      comment: `Facture ${result.invoiceNumber} mise à jour (Statut: ${result.status})`,
    });
  }
  return result!;
}

export async function recordInvoicePayment(
  id: number,
  data: {
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paidAmount?: number | null;
    proofUrl?: string | null;
    notes?: string | null;
    userId?: number;
  }
) {
  const receiptNumber = "REC-2026-" + id;
  const now = new Date();
  const idx = _memoryInvoices.findIndex(i => i.id === id);
  let invoice = idx >= 0 ? _memoryInvoices[idx] : null;

  const finalAmount = data.paidAmount ?? (invoice?.amountTtc ?? 0);

  const updatePayload: Partial<InsertInvoice> = {
    status: "Payée",
    invoiceType: "Definitive",
    paidAt: now,
    paymentMethod: data.paymentMethod ?? "Virement Bancaire",
    paymentReference: data.paymentReference ?? `REF-PAY-${id}`,
    receiptNumber,
    ...(data.paidAmount ? { amountTtc: data.paidAmount } : {}),
    updatedAt: now,
  };

  if (invoice) {
    _memoryInvoices[idx] = {
      ...invoice,
      ...updatePayload,
      status: "Payée",
      invoiceType: "Definitive",
    };
    invoice = _memoryInvoices[idx];
  }

  // Enregistrer l'encaissement
  const paymentEntry: InvoicePayment = {
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
    createdAt: now,
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
    } catch (e) {}
  }

  if (invoice?.dossierId) {
    await updateDossier(invoice.dossierId, { financialStatus: "Payé" });
    await logAuditEvent({
      dossierId: invoice.dossierId,
      userId: data.userId ?? 1,
      userName: "Service Comptabilité",
      userRole: "comptable",
      action: "PAIEMENT_ENCAISSE",
      entityType: "payment",
      entityId: paymentEntry.id,
      fieldChanged: "Paiement Facture",
      previousValue: "Non payée",
      newValue: `Payée (Quittance ${receiptNumber})`,
      beforeData: { status: "Émise", paidAt: null },
      afterData: {
        receiptNumber,
        amount: finalAmount,
        currency: invoice.currency,
        paymentMethod: updatePayload.paymentMethod,
        paymentReference: updatePayload.paymentReference,
        paidAt: now,
      },
      comment: `Encaissement de ${finalAmount.toLocaleString("fr-FR")} ${invoice.currency} (Mode: ${updatePayload.paymentMethod}, Réf: ${updatePayload.paymentReference}, Quittance: ${receiptNumber})`,
    });

    try {
      await addNotification({
        dossierId: invoice.dossierId,
        dossierNumber: null,
        type: "STATUT_MODIFIE",
        title: `Paiement encaissé — Facture ${invoice.invoiceNumber}`,
        message: `Paiement de ${finalAmount.toLocaleString("fr-FR")} ${invoice.currency} enregistré pour ${invoice.client} (Quittance ${receiptNumber}).`,
        recipientRole: "comptable",
      });
    } catch (e) {}
  }

  return invoice!;
}

export async function listInvoicePayments(invoiceId?: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(invoicePayments)
        .where(invoiceId ? eq(invoicePayments.invoiceId, invoiceId) : undefined)
        .orderBy(desc(invoicePayments.paymentDate));
    } catch (e) {}
  }
  if (invoiceId) return _memoryPayments.filter(p => p.invoiceId === invoiceId);
  return _memoryPayments;
}

export async function listPacDisbursements(dossierId?: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(pacDisbursements)
        .where(dossierId ? eq(pacDisbursements.dossierId, dossierId) : undefined)
        .orderBy(desc(pacDisbursements.createdAt));
    } catch (e) {}
  }
  if (dossierId) return _memoryPacDisbursements.filter(d => d.dossierId === dossierId);
  return _memoryPacDisbursements;
}

export async function createPacDisbursement(
  input: InsertPacDisbursement,
  userId?: number,
  authorName?: string,
  userRole: string = "comptable"
) {
  const now = new Date();
  const entry: PacDisbursement = {
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
    updatedAt: now,
  };
  _memoryPacDisbursements.unshift(entry);

  // Traçabilité réglementaire des débours PAC
  await logAuditEvent({
    dossierId: input.dossierId,
    userId: userId ?? input.createdById ?? 1,
    userName: authorName ?? "Agent Portuaire PAC",
    userRole: userRole,
    action: "DEBOURS_AVANCE",
    entityType: "disbursement",
    entityId: entry.id,
    fieldChanged: "Débours PAC",
    previousValue: null,
    newValue: `${entry.type.toUpperCase()} : ${entry.amountAdvanced.toLocaleString("fr-FR")} GNF`,
    beforeData: null,
    afterData: {
      type: entry.type,
      amountAdvanced: entry.amountAdvanced,
      receiptNumber: entry.receiptNumber,
      status: entry.status,
    },
    metadata: { receiptNumber: entry.receiptNumber, type: entry.type },
    comment: `Avance débours ${entry.type} de ${entry.amountAdvanced.toLocaleString("fr-FR")} GNF au Port Autonome de Conakry (Quittance: ${entry.receiptNumber || "N/A"})`,
  });

  const db = await getDb();
  if (db) {
    try {
      await db.insert(pacDisbursements).values(entry);
    } catch (e) {}
  }
  return entry;
}

export async function getExchangeRate() {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(referenceItems).where(eq(referenceItems.category, "exchange_rate")).limit(1);
      if (rows.length > 0) {
        const val = parseInt(rows[0].label, 10) || rows[0].sortOrder || 8650;
        _currentExchangeRate = val;
        return { rate: val, currencyPair: "USD/GNF" as const, lastUpdated: rows[0].createdAt };
      }
    } catch (e) {}
  }
  return { rate: _currentExchangeRate, currencyPair: "USD/GNF" as const, lastUpdated: new Date() };
}

export async function setExchangeRate(rate: number) {
  _currentExchangeRate = rate;
  const now = new Date();
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(referenceItems).where(eq(referenceItems.category, "exchange_rate")).limit(1);
      if (rows.length > 0) {
        await db.update(referenceItems).set({ label: String(rate), sortOrder: rate }).where(eq(referenceItems.id, rows[0].id));
      } else {
        await db.insert(referenceItems).values({ category: "exchange_rate", label: String(rate), sortOrder: rate });
      }
    } catch (e) {}
  }
  const refIdx = _memoryReferenceItems.findIndex(r => r.category === "exchange_rate");
  if (refIdx >= 0) {
    _memoryReferenceItems[refIdx].label = String(rate);
    _memoryReferenceItems[refIdx].sortOrder = rate;
  } else {
    _memoryReferenceItems.push({
      id: _memoryReferenceItems.length + 1,
      category: "exchange_rate",
      label: String(rate),
      sortOrder: rate,
      createdAt: now,
    });
  }
  return { rate, currencyPair: "USD/GNF" as const, lastUpdated: now };
}

// ----------------- TÂCHES & COLLABORATION -----------------
export type TaskFilter = {
  dossierId?: number;
  assignedTo?: string;
  status?: DossierTask["status"] | string;
};

export async function listTasks(filterOrDossierId?: number | TaskFilter) {
  let filter: TaskFilter = {};
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
      if (filter.status) conditions.push(eq(dossierTasks.status, filter.status as any));
      if (filter.assignedTo) conditions.push(like(dossierTasks.assignedTo, `%${filter.assignedTo}%`));

      return await db.select().from(dossierTasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(dossierTasks.createdAt));
    } catch (e) {}
  }

  let list = [..._memoryTasks];
  if (filter.dossierId) list = list.filter(t => t.dossierId === filter.dossierId);
  if (filter.status) list = list.filter(t => t.status === filter.status);
  if (filter.assignedTo) {
    const needle = filter.assignedTo.toLowerCase();
    list = list.filter(t => t.assignedTo && t.assignedTo.toLowerCase().includes(needle));
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createTask(input: InsertDossierTask) {
  const task: DossierTask = {
    id: _memoryTasks.length + 1,
    dossierId: input.dossierId,
    title: input.title,
    assignedTo: input.assignedTo ?? "Équipe Transit",
    dueDate: input.dueDate ?? new Date(Date.now() + 86400000 * 3),
    status: input.status ?? "A_faire",
    priority: input.priority ?? "Normale",
    completedAt: null,
    createdById: input.createdById ?? 1,
    createdAt: new Date(),
  };
  _memoryTasks.unshift(task);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierTasks).values(input);
    } catch (e) {}
  }
  return task;
}

export async function updateTaskStatus(id: number, status: DossierTask["status"]) {
  const completedAt = status === "Termine" ? new Date() : null;
  const idx = _memoryTasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    _memoryTasks[idx] = {
      ..._memoryTasks[idx],
      status,
      completedAt,
    };
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(dossierTasks).set({ status, completedAt }).where(eq(dossierTasks.id, id));
    } catch (e) {}
  }
  return _memoryTasks[idx];
}

export async function toggleTaskStatus(id: number, status?: DossierTask["status"]) {
  const idx = _memoryTasks.findIndex(t => t.id === id);
  const current = idx >= 0 ? _memoryTasks[idx] : null;
  const nextStatus: DossierTask["status"] = status || (current?.status === "Termine" ? "A_faire" : "Termine");
  return updateTaskStatus(id, nextStatus);
}

// ----------------- COMMENTAIRES D'ÉQUIPE -----------------
export async function listComments(dossierId: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierComments).where(eq(dossierComments.dossierId, dossierId)).orderBy(asc(dossierComments.createdAt));
    } catch (e) {}
  }
  return _memoryComments.filter(c => c.dossierId === dossierId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function addComment(input: InsertDossierComment) {
  const comment: DossierComment = {
    id: _memoryComments.length + 1,
    dossierId: input.dossierId,
    authorId: input.authorId ?? 1,
    authorName: input.authorName ?? "Utilisateur IGS",
    message: input.message,
    createdAt: new Date(),
  };
  _memoryComments.push(comment);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierComments).values(input);
    } catch (e) {}
  }
  return comment;
}

// ----------------- NOTIFICATIONS PROACTIVES -----------------
const _readNotificationIds = new Set<number>();

export async function addNotification(input: InsertNotification) {
  const now = new Date();
  const entry: Notification = {
    id: _memoryNotifications.length + 1,
    dossierId: input.dossierId ?? null,
    dossierNumber: input.dossierNumber ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    recipientEmail: input.recipientEmail ?? null,
    recipientRole: input.recipientRole ?? null,
    isRead: 0,
    createdAt: now,
  };
  _memoryNotifications.unshift(entry);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(notifications).values(entry);
    } catch (e) {}
  }
  return entry;
}

export async function listNotifications(limit = 40) {
  const dossiers = await listDossiers();
  const alerts = generateProactiveAlerts(dossiers);

  return alerts.slice(0, limit).map(a => ({
    ...a,
    isRead: _readNotificationIds.has(a.id) ? 1 : 0,
  }));
}

export async function markNotificationAsRead(id: number) {
  _readNotificationIds.add(id);
  const idx = _memoryNotifications.findIndex(n => n.id === id);
  if (idx >= 0) _memoryNotifications[idx].isRead = 1;
  const db = await getDb();
  if (db) {
    try {
      await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
    } catch (e) {}
  }
  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const dossiers = await listDossiers();
  const alerts = generateProactiveAlerts(dossiers);
  for (const a of alerts) {
    _readNotificationIds.add(a.id);
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(notifications).set({ isRead: 1 });
    } catch (e) {}
  }
  return { success: true };
}

// ----------------- RÉFÉRENTIELS -----------------
export async function getReferenceItems(category?: string) {
  if (_memoryReferenceItems.length > 0) {
    if (!category) return _memoryReferenceItems;
    return _memoryReferenceItems.filter(r => r.category === category);
  }
  const db = await getDb();
  if (db) {
    try {
      const items = await withDbTimeout(
        db.select().from(referenceItems).where(category ? eq(referenceItems.category, category) : undefined).orderBy(asc(referenceItems.category), asc(referenceItems.sortOrder)),
        1500
      );
      if (items.length > 0) {
        _memoryReferenceItems = items;
        return items;
      }
    } catch (e) {}
  }
  if (!category) return _memoryReferenceItems;
  return _memoryReferenceItems.filter(r => r.category === category);
}

export async function createReferenceItem(input: { category: string; label: string; sortOrder?: number }) {
  const item: ReferenceItem = {
    id: _memoryReferenceItems.length + 1,
    category: input.category,
    label: input.label,
    sortOrder: input.sortOrder ?? _memoryReferenceItems.length + 1,
    createdAt: new Date(),
  };
  _memoryReferenceItems.push(item);
  const db = await getDb();
  if (db) {
    try {
      await db.insert(referenceItems).values(input);
    } catch (e) {}
  }
  return item;
}
