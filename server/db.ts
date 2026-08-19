import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  Dossier, dossiers, InsertDossier, 
  User, users, InsertUser, 
  ReferenceItem, referenceItems,
  Document, documents, InsertDocument,
  DossierStatusHistory, dossierStatusHistory, InsertDossierStatusHistory,
  Invoice, invoices, InsertInvoice,
  DossierTask, dossierTasks, InsertDossierTask,
  DossierComment, dossierComments, InsertDossierComment,
  Notification, notifications, InsertNotification
} from "../drizzle/schema";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";
import { generateProactiveAlerts } from "./alertsService";
import { initialImportData } from "./initialImportData";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

const fromSourceDate = (value?: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;

// Mémoire persistée en session
let _memoryUsers: User[] = [
  {
    id: 1,
    openId: "igs_admin_conakry",
    name: "Ibrahima Gold Service (Admin)",
    email: "contact@igs-logistics.gn",
    loginMethod: "direct",
    role: "admin",
    clientCompany: null,
    phone: "+224 620 00 00 00",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  {
    id: 2,
    openId: "declarant_conakry",
    name: "Mamadou Diallo (Déclarant PAC)",
    email: "declarant@igs-logistics.gn",
    loginMethod: "direct",
    role: "declarant",
    clientCompany: null,
    phone: "+224 621 11 22 33",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  }
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
    fieldChanged: "Création Dossier",
    previousValue: null,
    newValue: "DOS-0001 importé",
    comment: "Initialisation automatique depuis le manifeste maritime",
    createdAt: new Date(Date.now() - 86400000 * 3),
  },
  {
    id: 2,
    dossierId: 1,
    changedById: 2,
    authorName: "Mamadou Diallo",
    fieldChanged: "declarationNumber",
    previousValue: "Non renseigné",
    newValue: "S 142- 27/07/2026",
    comment: "Enregistrement de la déclaration dans Sydonia++",
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
    createdById: 3,
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
      id: _memoryUsers.length + 1,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      clientCompany: user.clientCompany ?? null,
      phone: user.phone ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (db) {
    try {
      const row = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
      if (row) return row;
    } catch (err) {
      console.warn("[DB] Error fetching user from DB, fallback to memory:", err);
    }
  }
  return _memoryUsers.find(u => u.openId === openId);
}

export async function listUsers() {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(users).orderBy(asc(users.name));
    } catch (e) {}
  }
  return _memoryUsers;
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

export async function listDossiers(filters: DossierFilters = {}) {
  let list = [..._memoryDossiers];
  const db = await getDb();
  if (db) {
    try {
      const clauses = [];
      if (filters.status) clauses.push(eq(dossiers.calculatedStatus, filters.status));
      if (filters.priority) clauses.push(eq(dossiers.calculatedPriority, filters.priority));
      if (filters.client) clauses.push(eq(dossiers.client, filters.client));
      if (filters.currentUserCompany) clauses.push(eq(dossiers.client, filters.currentUserCompany));
      if (filters.responsible) clauses.push(eq(dossiers.responsible, filters.responsible));
      if (filters.transportMode) clauses.push(eq(dossiers.transportMode, filters.transportMode));
      if (filters.etaFrom) clauses.push(sql`${dossiers.eta} >= ${filters.etaFrom}`);
      if (filters.etaTo) clauses.push(sql`${dossiers.eta} <= ${filters.etaTo}`);
      if (filters.search) {
        const term = `%${filters.search}%`;
        clauses.push(or(like(dossiers.dossierNumber, term), like(dossiers.clientDossierNumber, term), like(dossiers.client, term), like(dossiers.blLtaNumber, term), like(dossiers.cargoNature, term), like(dossiers.portalAccessCode, term))!);
      }
      const dbResults = await withDbTimeout(
        db.select().from(dossiers).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(dossiers.updatedAt), asc(dossiers.dossierNumber)),
        2500
      );
      if (dbResults.length > 0) return dbResults;
    } catch (e) {
      console.warn("[DB] listDossiers query failed or timed out, using memory fallback");
    }
  }

  // Filtrage mémoire
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
  const db = await getDb();
  const rawStr = String(idOrIdentifier).trim();
  const numId = Number(idOrIdentifier);
  const isValidNum = !isNaN(numId) && Number.isInteger(numId) && numId > 0;
  const formattedNum = isValidNum ? formatDossierNumber(numId) : null;
  const upperStr = rawStr.toUpperCase();

  if (db) {
    try {
      // 1. Direct primary key index lookup first if input is a valid numeric ID
      if (isValidNum) {
        const rowById = (await db.select().from(dossiers).where(eq(dossiers.id, numId)).limit(1))[0];
        if (rowById) return rowById;
      }

      // 2. Direct lookup by formatted dossier number if applicable (e.g. DOS-0001)
      if (formattedNum) {
        const rowByFormatted = (await db.select().from(dossiers).where(eq(dossiers.dossierNumber, formattedNum)).limit(1))[0];
        if (rowByFormatted) return rowByFormatted;
      }

      // 3. Fallback query on string identifier fields
      const conditions = [
        eq(dossiers.dossierNumber, upperStr),
        eq(dossiers.portalAccessCode, upperStr),
        eq(dossiers.blLtaNumber, upperStr),
        eq(dossiers.clientDossierNumber, upperStr),
      ];

      const row = (await db.select().from(dossiers).where(or(...conditions)).limit(1))[0];
      if (row) return row;
    } catch (e) {
      console.error("[DB] getDossier database query error:", e);
    }
  }

  // In-memory fallback: 1. Direct PK lookup first
  if (isValidNum) {
    const memoryById = _memoryDossiers.find(d => d.id === numId);
    if (memoryById) return memoryById;
  }

  // 2. Formatted number match
  if (formattedNum) {
    const memoryByFormatted = _memoryDossiers.find(d => d.dossierNumber?.toUpperCase() === formattedNum.toUpperCase());
    if (memoryByFormatted) return memoryByFormatted;
  }

  // 3. String identifier scan fallback
  return _memoryDossiers.find(d => {
    if (d.dossierNumber?.toUpperCase() === upperStr) return true;
    if (d.portalAccessCode?.toUpperCase() === upperStr) return true;
    if (d.blLtaNumber?.toUpperCase() === upperStr) return true;
    if (d.clientDossierNumber?.toUpperCase() === upperStr) return true;
    return false;
  });
}

export async function getDossierByPortalCode(portalAccessCode: string) {
  const cleanCode = portalAccessCode.trim().toUpperCase();
  const db = await getDb();
  if (db) {
    try {
      const row = (
        await db
          .select()
          .from(dossiers)
          .where(
            or(
              eq(dossiers.portalAccessCode, cleanCode),
              eq(dossiers.dossierNumber, cleanCode),
              eq(dossiers.blLtaNumber, cleanCode),
              eq(dossiers.clientDossierNumber, cleanCode)
            )
          )
          .limit(1)
      )[0];
      if (row) return row;
    } catch (e) {
      console.error("[DB] getDossierByPortalCode database query error:", e);
    }
  }
  return _memoryDossiers.find(
    d =>
      d.portalAccessCode?.toUpperCase() === cleanCode ||
      d.dossierNumber?.toUpperCase() === cleanCode ||
      d.blLtaNumber?.toUpperCase() === cleanCode ||
      d.clientDossierNumber?.toUpperCase() === cleanCode
  );
}

export type EditableDossier = Omit<typeof dossiers.$inferInsert, "id" | "dossierNumber" | "calculatedStatus" | "calculatedPriority" | "completionRate" | "createdAt" | "updatedAt">;

export async function createDossier(input: EditableDossier, userId?: number, authorName?: string) {
  const sequence = _memoryDossiers.length + 1;
  const num = formatDossierNumber(sequence);
  const state = calculateDossierState(input);
  const portalCode = `IGS-${1000 + sequence}`;
  const now = new Date();

  const newDossier: Dossier = {
    id: sequence,
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
    createdById: userId ?? 1,
    updatedById: userId ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  _memoryDossiers.unshift(newDossier);

  // Historique
  await addDossierHistory({
    dossierId: newDossier.id,
    changedById: userId ?? 1,
    authorName: authorName ?? "Utilisateur",
    fieldChanged: "Création Dossier",
    previousValue: null,
    newValue: `Dossier ${num} créé`,
    comment: `Portail client: ${portalCode}`,
  });

  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossiers).values({ ...input, dossierNumber: num, portalAccessCode: portalCode, ...state, createdById: userId, updatedById: userId });
    } catch (e) {
      console.warn("[DB] Failed to insert dossier in DB, stored in memory");
    }
  }

  return newDossier;
}

export async function updateDossier(id: number, input: Partial<EditableDossier>, userId?: number, authorName?: string) {
  const current = await getDossier(id);
  if (!current) throw new Error("Dossier introuvable");
  const state = calculateDossierState({ ...current, ...input });
  const now = new Date();

  // Détection des changements majeurs pour l'audit
  for (const [key, val] of Object.entries(input)) {
    const oldVal = (current as any)[key];
    if (oldVal !== val && val !== undefined) {
      await addDossierHistory({
        dossierId: id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Utilisateur",
        fieldChanged: key,
        previousValue: oldVal ? String(oldVal) : "Vide",
        newValue: val ? String(val) : "Vide",
        comment: `Mise à jour statut ${key}`,
      });
    }
  }

  const updated: Dossier = {
    ...current,
    ...input,
    ...state,
    updatedById: userId ?? current.updatedById,
    updatedAt: now,
  };

  const memIdx = _memoryDossiers.findIndex(d => d.id === id);
  if (memIdx >= 0) _memoryDossiers[memIdx] = updated;

  const db = await getDb();
  if (db) {
    try {
      await db.update(dossiers).set({ ...input, ...state, updatedById: userId, updatedAt: now }).where(eq(dossiers.id, id));
    } catch (e) {}
  }
  return updated;
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
      const updated: Dossier = {
        ...existing,
        ...mergedInput,
        ...state,
        updatedById: userId ?? existing.updatedById,
        updatedAt: now,
      };

      // Mettre à jour le cache mémoire
      const memIdx = _memoryDossiers.findIndex(d => d.id === existing!.id);
      if (memIdx >= 0) _memoryDossiers[memIdx] = updated;
      else _memoryDossiers.push(updated);

      if (cleanBL) existingMapByBL.set(cleanBL, updated);
      if (cleanClientNum) existingMapByClientRef.set(cleanClientNum, updated);

      toUpdateDB.push({ id: existing.id, data: { ...mergedInput, ...state, updatedById: userId ?? 1, updatedAt: now } });

      historyBatch.push({
        dossierId: existing.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        fieldChanged: "Mise à jour Import",
        previousValue: existing.calculatedStatus,
        newValue: state.calculatedStatus,
        comment: `Fusion automatique (${cleanBL || cleanClientNum})`,
        createdAt: now,
      });

      processed.push(updated);
      updatedCount++;
    } else {
      // 3. Création Nouveau Dossier
      const num = formatDossierNumber(nextSequence);
      const portalCode = `IGS-${1000 + nextSequence}`;
      const state = calculateDossierState(item);

      const newDossier: Dossier = {
        id: nextSequence,
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
        dossierNumber: num,
        portalAccessCode: portalCode,
        ...state,
        createdById: userId ?? 1,
        updatedById: userId ?? 1,
        createdAt: now,
        updatedAt: now,
      });

      historyBatch.push({
        dossierId: newDossier.id,
        changedById: userId ?? 1,
        authorName: authorName ?? "Importateur Excel",
        fieldChanged: "Création Dossier",
        previousValue: null,
        newValue: `Dossier ${num} créé`,
        comment: `Import batch automatique`,
        createdAt: now,
      });

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
  await addDossierHistory({
    dossierId: input.dossierId,
    changedById: input.uploadedById ?? 1,
    authorName: input.uploaderName ?? "Opérateur IGS",
    fieldChanged: "Document",
    previousValue: null,
    newValue: `${doc.type}: ${doc.name}`,
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

export async function deleteDocument(id: number) {
  _memoryDocuments = _memoryDocuments.filter(d => d.id !== id);
  const db = await getDb();
  if (db) {
    try {
      await db.delete(documents).where(eq(documents.id, id));
    } catch (e) {}
  }
  return { success: true };
}

// ----------------- AUDIT TRAIL / HISTORIQUE -----------------
export async function listDossierHistory(dossierId: number) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierStatusHistory).where(eq(dossierStatusHistory.dossierId, dossierId)).orderBy(desc(dossierStatusHistory.createdAt));
    } catch (e) {}
  }
  return _memoryHistory.filter(h => h.dossierId === dossierId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function addDossierHistory(input: InsertDossierStatusHistory) {
  const entry: DossierStatusHistory = {
    id: _memoryHistory.length + 1,
    dossierId: input.dossierId,
    changedById: input.changedById ?? null,
    authorName: input.authorName ?? "Utilisateur IGS",
    fieldChanged: input.fieldChanged,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    comment: input.comment ?? null,
    createdAt: new Date(),
  };
  _memoryHistory.unshift(entry);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(dossierStatusHistory).values(input);
    } catch (e) {}
  }
  return entry;
}

// ----------------- FACTURATION & FINANCE -----------------
export async function listInvoices(dossierId?: number) {
  let list = [..._memoryInvoices];
  const db = await getDb();
  if (db) {
    try {
      return await withDbTimeout(
        db.select().from(invoices).where(dossierId ? eq(invoices.dossierId, dossierId) : undefined).orderBy(desc(invoices.createdAt)),
        2500
      );
    } catch (e) {
      console.warn("[DB] Error or timeout querying invoices from DB, using fallback");
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
  }
  return result!;
}

export async function recordInvoicePayment(id: number, data: { paymentMethod?: string | null; paymentReference?: string | null; paidAmount?: number | null }) {
  const receiptNumber = "REC-2026-" + id;
  const now = new Date();
  const idx = _memoryInvoices.findIndex(i => i.id === id);
  let invoice = idx >= 0 ? _memoryInvoices[idx] : null;

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

  const db = await getDb();
  if (db) {
    try {
      await db.update(invoices).set(updatePayload).where(eq(invoices.id, id));
      if (!invoice) {
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        if (rows.length > 0) invoice = rows[0];
      }
    } catch (e) {}
  }

  if (invoice?.dossierId) {
    await updateDossier(invoice.dossierId, { financialStatus: "Payé" });
    await addDossierHistory({
      dossierId: invoice.dossierId,
      fieldChanged: "Paiement Facture",
      previousValue: "Non payée",
      newValue: `Payée (Quittance ${receiptNumber})`,
      comment: `Mode: ${updatePayload.paymentMethod}, Réf: ${updatePayload.paymentReference}, Montant: ${invoice.amountTtc} ${invoice.currency}`,
    });
  }

  return invoice!;
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
  const db = await getDb();
  if (db) {
    try {
      const items = await db.select().from(referenceItems).where(category ? eq(referenceItems.category, category) : undefined).orderBy(asc(referenceItems.category), asc(referenceItems.sortOrder));
      if (items.length > 0) return items;
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
