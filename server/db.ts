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

let _memoryInvoices: Invoice[] = [
  {
    id: 1,
    dossierId: 1,
    invoiceNumber: "FAC-2026-0001",
    client: "Guinean Birimian Gold S.A",
    currency: "GNF",
    amountHt: 18500000,
    amountTva: 3330000,
    amountTtc: 21830000,
    disbursementsAmount: 45000000,
    storageAndDemurrageFees: 0,
    estimatedMargin: 5500000,
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
    dossierId: 1,
    title: "Obtenir le Bon à Enlever (BAE) aux douanes du Port",
    assignedTo: "Mamadou Diallo",
    dueDate: new Date(Date.now() + 86400000 * 2),
    status: "En_cours",
    priority: "Haute",
    completedAt: null,
    createdById: 1,
    createdAt: new Date(),
  },
  {
    id: 2,
    dossierId: 1,
    title: "Vérifier le paiement de la redevance PAC",
    assignedTo: "Fatoumata Camara",
    dueDate: new Date(Date.now() + 86400000 * 1),
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

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      _client = postgres(process.env.DATABASE_URL, { 
        max: isServerless ? 5 : 10, 
        idle_timeout: isServerless ? 10 : 20,
        connect_timeout: 10,
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
      const dbResults = await db.select().from(dossiers).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(dossiers.updatedAt), asc(dossiers.dossierNumber));
      if (dbResults.length > 0) return dbResults;
    } catch (e) {
      console.warn("[DB] listDossiers query failed, using memory fallback");
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

export async function getDossier(id: number) {
  const db = await getDb();
  if (db) {
    try {
      const row = (await db.select().from(dossiers).where(eq(dossiers.id, id)).limit(1))[0];
      if (row) return row;
    } catch (e) {}
  }
  return _memoryDossiers.find(d => d.id === id);
}

export async function getDossierByPortalCode(portalAccessCode: string) {
  const cleanCode = portalAccessCode.trim().toUpperCase();
  const db = await getDb();
  if (db) {
    try {
      const row = (await db.select().from(dossiers).where(eq(dossiers.portalAccessCode, cleanCode)).limit(1))[0];
      if (row) return row;
    } catch (e) {}
  }
  return _memoryDossiers.find(d => d.portalAccessCode?.toUpperCase() === cleanCode || d.dossierNumber?.toUpperCase() === cleanCode || d.blLtaNumber?.toUpperCase() === cleanCode);
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
      return await db.select().from(invoices).where(dossierId ? eq(invoices.dossierId, dossierId) : undefined).orderBy(desc(invoices.createdAt));
    } catch (e) {}
  }
  if (dossierId) list = list.filter(i => i.dossierId === dossierId);
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createInvoice(input: Omit<InsertInvoice, "invoiceNumber"> & { invoiceNumber?: string }) {
  const sequence = _memoryInvoices.length + 1;
  const invNum = input.invoiceNumber || `FAC-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`;
  const now = new Date();
  const inv: Invoice = {
    id: sequence,
    dossierId: input.dossierId,
    invoiceNumber: invNum,
    client: input.client,
    currency: input.currency ?? "GNF",
    amountHt: input.amountHt ?? 0,
    amountTva: input.amountTva ?? 0,
    amountTtc: input.amountTtc ?? (input.amountHt || 0) + (input.amountTva || 0),
    disbursementsAmount: input.disbursementsAmount ?? 0,
    storageAndDemurrageFees: input.storageAndDemurrageFees ?? 0,
    estimatedMargin: input.estimatedMargin ?? Math.round((input.amountHt || 0) * 0.25),
    status: input.status ?? "Proforma",
    dueDate: input.dueDate ?? new Date(Date.now() + 86400000 * 30),
    paidAt: input.status === "Payée" ? now : null,
    notes: input.notes ?? null,
    createdById: input.createdById ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  _memoryInvoices.unshift(inv);

  // Mise à jour du statut financier du dossier
  await updateDossier(input.dossierId, { financialStatus: inv.status === "Payée" ? "Payé" : "Facturé" });

  const db = await getDb();
  if (db) {
    try {
      await db.insert(invoices).values({ ...input, invoiceNumber: invNum });
    } catch (e) {}
  }
  return inv;
}

// ----------------- TÂCHES & COLLABORATION -----------------
export async function listTasks(dossierId?: number) {
  let list = [..._memoryTasks];
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(dossierTasks).where(dossierId ? eq(dossierTasks.dossierId, dossierId) : undefined).orderBy(desc(dossierTasks.createdAt));
    } catch (e) {}
  }
  if (dossierId) list = list.filter(t => t.dossierId === dossierId);
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
  const idx = _memoryTasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    _memoryTasks[idx] = {
      ..._memoryTasks[idx],
      status,
      completedAt: status === "Termine" ? new Date() : null,
    };
  }
  const db = await getDb();
  if (db) {
    try {
      await db.update(dossierTasks).set({ status, completedAt: status === "Termine" ? new Date() : null }).where(eq(dossierTasks.id, id));
    } catch (e) {}
  }
  return _memoryTasks[idx];
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
export async function listNotifications(limit = 20) {
  const db = await getDb();
  if (db) {
    try {
      return await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
    } catch (e) {}
  }
  return _memoryNotifications.slice(0, limit).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function markNotificationAsRead(id: number) {
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
