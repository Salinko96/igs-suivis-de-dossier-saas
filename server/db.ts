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
  Notification, notifications, InsertNotification,
  ClientAccessSession, clientAccessSessions, InsertClientAccessSession,
  PortalAccessLog, portalAccessLogs, InsertPortalAccessLog,
  ApprovalRequest, approvalRequests, InsertApprovalRequest,
  WhatsappMessageLog, whatsappMessageLogs, InsertWhatsappMessageLog
} from "../drizzle/schema";
import { SignJWT, jwtVerify } from "jose";
import { calculateDossierState, formatDossierNumber } from "./dossierRules";
import { generateProactiveAlerts } from "./alertsService";
import { initialImportData } from "./initialImportData";
import { initialUsersData } from "./initialUsersData";
import { ENV } from "./_core/env";

const PORTAL_JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "igs_secure_portal_jwt_secret_2026_conakry");

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

export function computeDaysOnQuay(
  eta: Date | string | null | undefined,
  goodsReleaseDate: Date | string | null | undefined,
  now: Date = new Date()
): number {
  if (!eta) return 0;
  const etaDate = new Date(eta);
  if (isNaN(etaDate.getTime())) return 0;

  if (goodsReleaseDate) {
    const releaseDate = new Date(goodsReleaseDate);
    if (!isNaN(releaseDate.getTime())) {
      return Math.max(0, Math.floor((releaseDate.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  if (now.getTime() < etaDate.getTime()) {
    return 0; // Navire pas encore accosté
  }
  return Math.max(0, Math.floor((now.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24)));
}

export function enrichDossierFields(dossier: Dossier, now: Date = new Date()): Dossier {
  const daysOnQuay = computeDaysOnQuay(dossier.eta, dossier.goodsReleaseDate, now);
  const state = calculateDossierState({
    clientDossierNumber: dossier.clientDossierNumber,
    client: dossier.client,
    blLtaNumber: dossier.blLtaNumber,
    cargoNature: dossier.cargoNature,
    transportMode: dossier.transportMode,
    eta: dossier.eta,
    originPort: dossier.originPort,
    destinationPort: dossier.destinationPort,
    container: dossier.container,
    bulk: dossier.bulk,
    goodsReleaseDate: dossier.goodsReleaseDate,
    declarationNumber: dossier.declarationNumber,
    bulletinNumber: dossier.bulletinNumber,
  });

  let calculatedPriority: "Basse" | "Normale" | "Haute" = state.calculatedPriority;
  if (!dossier.goodsReleaseDate && daysOnQuay >= 5) {
    calculatedPriority = "Haute";
  }

  let portStatus = dossier.portStatus;
  let customsStatus = dossier.customsStatus;
  let fieldAlert = dossier.fieldAlert;
  let badStatus = dossier.badStatus;
  let baeStatus = dossier.baeStatus;

  if (dossier.goodsReleaseDate) {
    portStatus = "Marchandise Sortie de Quai (PAC)";
    customsStatus = "BAE Accordé & Régularisé";
    badStatus = "Obtenu";
    baeStatus = "Accordé";
    fieldAlert = null;
  } else if (daysOnQuay > 7) {
    portStatus = `🚨 Dépassement Franchise (+${daysOnQuay - 7}j Surestaries)`;
    customsStatus = dossier.declarationNumber ? "Déclaration SYDONIA en cours" : "En attente DDI / SYDONIA";
    badStatus = dossier.blLtaNumber ? "Obtenu" : "En cours";
    baeStatus = "En attente validation";
    fieldAlert = `🚨 Dépassement franchise quai PAC (+${daysOnQuay - 7}j)`;
  } else if (daysOnQuay >= 5) {
    portStatus = `⚠️ Franchise Quai Expire Bientôt (J-${Math.max(1, 7 - daysOnQuay)})`;
    customsStatus = dossier.declarationNumber ? "Déclaration SYDONIA en cours" : "En attente DDI / SYDONIA";
    badStatus = dossier.blLtaNumber ? "Obtenu" : "En cours";
    baeStatus = "En cours";
    fieldAlert = `⚠️ Risque expiration franchise sous ${Math.max(1, 7 - daysOnQuay) * 24}h`;
  } else if (daysOnQuay > 0) {
    portStatus = `Navire à quai / Franchise PAC en cours (${daysOnQuay}/7j)`;
    customsStatus = dossier.declarationNumber ? "Déclaration SYDONIA en cours" : "En attente DDI";
    badStatus = dossier.blLtaNumber ? "Obtenu" : "En cours";
    baeStatus = "En cours";
    fieldAlert = state.calculatedStatus === "À régulariser" ? "DDI / Bulletin à fournir" : null;
  } else if (dossier.eta) {
    portStatus = `En mer / Arrivée prévue (${new Date(dossier.eta).toLocaleDateString("fr-FR")})`;
    customsStatus = "Documents préalables";
    badStatus = "En attente";
    baeStatus = "En attente";
    fieldAlert = state.calculatedStatus === "À régulariser" ? "DDI / Connaissement à finaliser" : null;
  }

  const financialStatus = dossier.goodsReleaseDate
    ? "Facturé & Recouvrable"
    : (dossier.financialStatus || "Fact. Proforma / En attente débours");

  return {
    ...dossier,
    daysOnQuay,
    calculatedStatus: state.calculatedStatus,
    calculatedPriority,
    completionRate: state.completionRate,
    portStatus,
    customsStatus,
    badStatus,
    baeStatus,
    fieldAlert,
    financialStatus,
  };
}

let _memoryDossiers: Dossier[] = initialImportData.dossiers.map((source, idx) => {
  const payload = {
    ...source,
    eta: fromSourceDate(source.eta),
    goodsReleaseDate: fromSourceDate(source.goodsReleaseDate),
  };
  const now = new Date();
  const rawDossier: Dossier = {
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
    calculatedStatus: "À régulariser",
    calculatedPriority: "Normale",
    completionRate: 50,
    documentStatus: null,
    customsStatus: null,
    portStatus: null,
    financialStatus: idx % 3 === 0 ? "Facturé" : idx % 3 === 1 ? "Fact. Proforma" : "En attente",
    fieldOperation: null,
    responsible: idx % 2 === 0 ? "Mamadou Diallo" : "Alpha Barry",
    nextAction: null,
    fieldAlert: null,
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

  return enrichDossierFields(rawDossier, now);
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
    version: 1,
    isPublic: true,
    previousVersions: "[]",
    description: "Connaissement maritime original émis par Hapag-Lloyd",
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
    version: 1,
    isPublic: true,
    previousVersions: "[]",
    description: "Déclaration d'importation SYDONIA World validée",
    uploadedById: 2,
    uploaderName: "Mamadou Diallo",
    createdAt: new Date(),
  }
];

let _memoryApprovals: ApprovalRequest[] = [
  {
    id: 1,
    entityType: "disbursement",
    entityId: 1,
    dossierId: 1,
    amount: 14500000,
    currency: "GNF",
    thresholdAmount: 5000000,
    requestedById: 2,
    requestedByName: "Mamadou Diallo",
    approverId: 1,
    approverName: "Alpha Barry (Manager)",
    status: "APPROUVE",
    rejectionReason: null,
    comment: "Débours Droits de douane liquidation Trésor Public",
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 86400000),
    resolvedAt: new Date(Date.now() - 86400000),
  }
];

let _memoryWhatsappLogs: WhatsappMessageLog[] = [];

let _memoryClients: Client[] = [
  {
    id: 1,
    name: "Guinean Birimian Gold (GBG)",
    contactPerson: "Ousmane Camara",
    email: "transit@gbg-mining.gn",
    phone: "+224622001122",
    whatsappPhone: "+224622001122",
    country: "Guinée",
    taxId: "NIF-8901234",
    address: "Boffa / Conakry, République de Guinée",
    preferredChannel: "whatsapp",
    optInNotifications: true,
    monthlyReportEnabled: true,
    accountCategory: "mining_major",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "Guinee Gold Exploration (GGE)",
    contactPerson: "Amadou Diallo",
    email: "direction@gge-gold.gn",
    phone: "+224621234567",
    whatsappPhone: "+224621234567",
    country: "Guinée",
    taxId: "NIF-782190",
    address: "Kamsar / Conakry, République de Guinée",
    preferredChannel: "whatsapp",
    optInNotifications: true,
    monthlyReportEnabled: true,
    accountCategory: "mining_major",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "New Japon Mining (NJP)",
    contactPerson: "Kenji Sato",
    email: "operations@njp-mining.gn",
    phone: "+224623344556",
    whatsappPhone: "+224623344556",
    country: "Guinée",
    taxId: "NIF-654321",
    address: "Boké, République de Guinée",
    preferredChannel: "whatsapp",
    optInNotifications: true,
    monthlyReportEnabled: true,
    accountCategory: "mining_major",
    createdAt: new Date(),
    updatedAt: new Date(),
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
    reconciliationStatus: "rapproche",
    reconciliationDate: new Date(),
    reconciliationRef: "VIR-2026-0812",
    rateLockedAt: new Date(),
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

let _memoryPortalLogs: PortalAccessLog[] = [];
let _memoryClientSessions: ClientAccessSession[] = [];

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
      await withDbTimeout(
        db.insert(users).values(values).onConflictDoUpdate({
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
        }),
        1500
      );
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

export async function listUsersPaginated(filters: {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  
  const isActive = filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;
  
  const allFiltered = await listUsers({
    role: filters.role,
    isActive,
    search: filters.search,
  });

  const total = allFiltered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = allFiltered.slice(startIndex, startIndex + limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
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
      const inserted = await withDbTimeout(
        db.insert(users).values({
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
        }).returning(),
        1500
      );
      if (inserted && inserted[0]) {
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
  idOrIdentifier: number | string,
  data: Partial<{
    name: string;
    email: string;
    phone: string | null;
    role: "admin" | "declarant" | "comptable" | "client" | "manager" | "user";
    clientCompany: string | null;
    isActive: boolean;
  }>
): Promise<User> {
  const targetId = Number(idOrIdentifier);
  const targetStr = String(idOrIdentifier).trim();

  let userIdx = _memoryUsers.findIndex(u =>
    (!isNaN(targetId) && Number(u.id) === targetId) ||
    (u.openId && u.openId === targetStr) ||
    (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
  );

  let existing = userIdx >= 0 ? _memoryUsers[userIdx] : undefined;
  const db = await getDb();
  if (!existing && db) {
    try {
      const rows = await withDbTimeout(
        db.select().from(users).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, targetStr)
        ).limit(1),
        1500
      );
      if (rows && rows[0]) {
        existing = rows[0];
        _memoryUsers.push(existing);
        userIdx = _memoryUsers.length - 1;
      }
    } catch (e) {}
  }

  if (!existing) {
    const initialMatch = initialUsersData.find(u =>
      (!isNaN(targetId) && Number(u.id) === targetId) ||
      (u.openId && u.openId === targetStr) ||
      (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
    );
    if (initialMatch) {
      existing = { ...initialMatch };
      _memoryUsers.push(existing);
      userIdx = _memoryUsers.length - 1;
    }
  }

  if (!existing) {
    throw new Error(`Collaborateur introuvable avec l'ID ${idOrIdentifier}`);
  }

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

  if (db) {
    try {
      await withDbTimeout(
        db.update(users).set({
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          clientCompany: updatedUser.clientCompany,
          isActive: updatedUser.isActive,
          sessionRevokedAt: updatedUser.sessionRevokedAt,
          updatedAt: updatedUser.updatedAt,
        }).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, existing.openId)
        ),
        1500
      );
    } catch (err) {
      console.warn("[DB] Error updating user in DB:", err);
    }
  }

  if (userIdx >= 0) {
    _memoryUsers[userIdx] = updatedUser;
  }
  return updatedUser;
}

export async function toggleUserStatus(idOrIdentifier: number | string, isActive: boolean): Promise<User> {
  const targetId = Number(idOrIdentifier);
  const targetStr = String(idOrIdentifier).trim();

  let userIdx = _memoryUsers.findIndex(u =>
    (!isNaN(targetId) && Number(u.id) === targetId) ||
    (u.openId && u.openId === targetStr) ||
    (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
  );

  let existing = userIdx >= 0 ? _memoryUsers[userIdx] : undefined;
  const db = await getDb();
  if (!existing && db) {
    try {
      const rows = await withDbTimeout(
        db.select().from(users).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, targetStr)
        ).limit(1),
        1500
      );
      if (rows && rows[0]) {
        existing = rows[0];
        _memoryUsers.push(existing);
        userIdx = _memoryUsers.length - 1;
      }
    } catch (e) {}
  }

  if (!existing) {
    const initialMatch = initialUsersData.find(u =>
      (!isNaN(targetId) && Number(u.id) === targetId) ||
      (u.openId && u.openId === targetStr) ||
      (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
    );
    if (initialMatch) {
      existing = { ...initialMatch };
      _memoryUsers.push(existing);
      userIdx = _memoryUsers.length - 1;
    }
  }

  if (!existing) {
    throw new Error(`Collaborateur introuvable avec l'ID ${idOrIdentifier}`);
  }

  const now = new Date();
  const updatedUser: User = {
    ...existing,
    isActive,
    sessionRevokedAt: !isActive ? now : null,
    updatedAt: now,
  };

  if (db) {
    try {
      await withDbTimeout(
        db.update(users).set({
          isActive,
          sessionRevokedAt: updatedUser.sessionRevokedAt,
          updatedAt: now,
        }).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, existing.openId)
        ),
        1500
      );
    } catch (err) {
      console.warn("[DB] Error toggling user status in DB:", err);
    }
  }

  if (userIdx >= 0) {
    _memoryUsers[userIdx] = updatedUser;
  }
  return updatedUser;
}

export async function deleteUser(idOrIdentifier: number | string): Promise<{ success: boolean; user: User }> {
  const targetId = Number(idOrIdentifier);
  const targetStr = String(idOrIdentifier).trim();

  let userIdx = _memoryUsers.findIndex(u =>
    (!isNaN(targetId) && Number(u.id) === targetId) ||
    (u.openId && u.openId === targetStr) ||
    (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
  );

  let existing = userIdx >= 0 ? _memoryUsers[userIdx] : undefined;
  const db = await getDb();
  if (!existing && db) {
    try {
      const rows = await withDbTimeout(
        db.select().from(users).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, targetStr)
        ).limit(1),
        1500
      );
      if (rows && rows[0]) {
        existing = rows[0];
      }
    } catch (e) {}
  }

  if (!existing) {
    const initialMatch = initialUsersData.find(u =>
      (!isNaN(targetId) && Number(u.id) === targetId) ||
      (u.openId && u.openId === targetStr) ||
      (u.email && u.email.toLowerCase() === targetStr.toLowerCase())
    );
    if (initialMatch) {
      existing = { ...initialMatch };
    }
  }

  if (!existing) {
    throw new Error(`Collaborateur introuvable avec l'ID ${idOrIdentifier}`);
  }

  if (existing.role === "admin" && (existing.id === 1 || existing.openId === "igs_admin_root")) {
    throw new Error("Impossible de supprimer le compte Administrateur Principal IGS.");
  }

  if (db) {
    try {
      await withDbTimeout(
        db.delete(users).where(
          !isNaN(targetId) ? eq(users.id, targetId) : eq(users.openId, existing.openId)
        ),
        1500
      );
    } catch (err) {
      console.warn("[DB] Error deleting user in DB:", err);
    }
  }

  if (userIdx >= 0) {
    _memoryUsers.splice(userIdx, 1);
  } else {
    _memoryUsers = _memoryUsers.filter(u =>
      Number(u.id) !== targetId &&
      u.openId !== existing?.openId &&
      u.email !== existing?.email
    );
  }

  return { success: true, user: existing };
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

export async function listDossiersPaginated(filters: DossierFilters & { page?: number; limit?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

  const allFiltered = await listDossiers(filters);
  const total = allFiltered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = allFiltered.slice(startIndex, startIndex + limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
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

// ----------------- SÉCURITÉ PORTAIL CLIENT (JWT & OTP) -----------------

export async function generatePortalToken(payload: {
  dossierId: number;
  dossierNumber: string;
  clientCompany?: string;
  clientDossierNumber?: string;
}, expiresIn = "7d"): Promise<string> {
  return new SignJWT({ ...payload, scope: "portal_tracking" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(PORTAL_JWT_SECRET);
}

export async function verifyPortalToken(token: string): Promise<{
  dossierId: number;
  dossierNumber: string;
  clientCompany?: string;
  clientDossierNumber?: string;
  scope: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, PORTAL_JWT_SECRET);
    if (payload.scope !== "portal_tracking") return null;
    return payload as any;
  } catch (e) {
    return null;
  }
}

export async function logPortalAccess(input: {
  dossierId?: number | null;
  accessCodeUsed: string;
  tokenIdentifier?: string | null;
  clientCompany?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  errorReason?: string | null;
}): Promise<PortalAccessLog> {
  const logEntry: PortalAccessLog = {
    id: _memoryPortalLogs.length + 1,
    dossierId: input.dossierId ?? null,
    accessCodeUsed: input.accessCodeUsed,
    tokenIdentifier: input.tokenIdentifier ?? null,
    clientCompany: input.clientCompany ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    accessedAt: new Date(),
    success: input.success !== false,
    errorReason: input.errorReason ?? null,
  };

  _memoryPortalLogs.unshift(logEntry);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(portalAccessLogs).values(logEntry);
    } catch (e) {
      console.warn("[DB] Failed to insert portal access log to database:", e);
    }
  }

  return logEntry;
}

export async function listPortalAccessLogs(dossierId?: number) {
  let list = [..._memoryPortalLogs];
  if (list.length === 0) {
    const db = await getDb();
    if (db) {
      try {
        const rows = await withDbTimeout(
          db.select().from(portalAccessLogs).where(dossierId ? eq(portalAccessLogs.dossierId, dossierId) : undefined).orderBy(desc(portalAccessLogs.accessedAt)),
          1500
        );
        if (rows.length > 0) {
          _memoryPortalLogs = rows;
          list = [...rows];
        }
      } catch (e) {}
    }
  }
  if (dossierId) list = list.filter(l => l.dossierId === dossierId);
  return list.sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());
}

export async function requestClientOtp(input: {
  clientCompany: string;
  phone?: string;
  email?: string;
  dossierId?: number;
}) {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiration
  const session: ClientAccessSession = {
    id: _memoryClientSessions.length + 1,
    dossierId: input.dossierId ?? null,
    clientCompany: input.clientCompany,
    clientPhone: input.phone ?? null,
    clientEmail: input.email ?? null,
    otpCode,
    sessionToken: null,
    expiresAt,
    verifiedAt: null,
    attemptsCount: 0,
    createdAt: new Date(),
  };

  _memoryClientSessions.unshift(session);

  const db = await getDb();
  if (db) {
    try {
      await db.insert(clientAccessSessions).values(session);
    } catch (e) {}
  }

  return {
    success: true,
    message: `Code OTP généré avec succès pour ${input.clientCompany}`,
    expiresInSeconds: 900,
    debugOtpCode: process.env.NODE_ENV !== "production" ? otpCode : undefined,
  };
}

export async function verifyClientOtp(input: {
  clientCompany: string;
  otpCode: string;
}) {
  const now = new Date();
  const session = _memoryClientSessions.find(
    s => s.clientCompany.toLowerCase() === input.clientCompany.trim().toLowerCase() && s.expiresAt > now
  );

  if (!session) {
    return { success: false, error: "Code OTP expiré ou demande introuvable. Veuillez renvoyer une demande." };
  }

  session.attemptsCount += 1;
  if (session.otpCode !== input.otpCode.trim()) {
    return { success: false, error: "Code OTP incorrect. Veuillez vérifier le code à 6 chiffres." };
  }

  session.verifiedAt = now;
  const token = await generatePortalToken({
    dossierId: session.dossierId || 1,
    dossierNumber: "PORTAL_ALL",
    clientCompany: session.clientCompany,
  }, "7d");

  session.sessionToken = token;
  return {
    success: true,
    token,
    clientCompany: session.clientCompany,
  };
}

export async function listAuditLogs(filters?: {
  dossierId?: number;
  authorName?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  let list = [..._memoryHistory];
  if (list.length === 0) {
    const db = await getDb();
    if (db) {
      try {
        const rows = await withDbTimeout(
          db.select().from(dossierStatusHistory).orderBy(desc(dossierStatusHistory.createdAt)),
          2000
        );
        if (rows.length > 0) {
          _memoryHistory = rows;
          list = [...rows];
        }
      } catch (e) {}
    }
  }

  if (filters?.dossierId) list = list.filter(l => l.dossierId === filters.dossierId);
  if (filters?.authorName) {
    const a = filters.authorName.toLowerCase();
    list = list.filter(l => l.authorName?.toLowerCase().includes(a));
  }
  if (filters?.action) list = list.filter(l => l.action === filters.action);
  if (filters?.from) list = list.filter(l => l.createdAt >= filters.from!);
  if (filters?.to) list = list.filter(l => l.createdAt <= filters.to!);

  const sorted = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters?.limit) return sorted.slice(0, filters.limit);
  return sorted;
}

export type EditableDossier = Omit<typeof dossiers.$inferInsert, "id" | "version" | "dossierNumber" | "calculatedStatus" | "calculatedPriority" | "completionRate" | "createdAt" | "updatedAt"> & {
  isDraft?: boolean;
};

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

  // Génération automatique d'une entrée pro-forma dans le module finances
  await ensureProformaInvoiceForDossier(newDossier);

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

/**
 * Analyse générale et mise à jour de tous les états opérationnels, douaniers,
 * délais de quai (PAC), risques de surestaries et rapprochements financiers.
 */
export async function syncAllDossierStates(): Promise<{
  timestamp: string;
  totalAnalyzed: number;
  updatedCount: number;
  regularizedCount: number;
  toRegularizeCount: number;
  overdueDemurrageCount: number;
  warningJ2Count: number;
  details: Array<{
    dossierId: number;
    dossierNumber: string;
    client: string;
    calculatedStatus: string;
    calculatedPriority: string;
    daysOnQuay: number;
    portStatus: string | null;
    customsStatus: string | null;
    financialStatus: string | null;
  }>;
}> {
  const now = new Date();
  let updatedCount = 0;
  let regularizedCount = 0;
  let toRegularizeCount = 0;
  let overdueDemurrageCount = 0;
  let warningJ2Count = 0;
  const details: any[] = [];

  for (let i = 0; i < _memoryDossiers.length; i++) {
    const original = _memoryDossiers[i];
    const enriched = enrichDossierFields(original, now);

    const hasChanged =
      original.calculatedStatus !== enriched.calculatedStatus ||
      original.calculatedPriority !== enriched.calculatedPriority ||
      original.daysOnQuay !== enriched.daysOnQuay ||
      original.completionRate !== enriched.completionRate ||
      original.portStatus !== enriched.portStatus ||
      original.customsStatus !== enriched.customsStatus ||
      original.financialStatus !== enriched.financialStatus ||
      original.fieldAlert !== enriched.fieldAlert;

    if (hasChanged) {
      updatedCount++;
      _memoryDossiers[i] = {
        ...enriched,
        updatedAt: now,
      };

      // Consignation dans l'historique d'audit
      await logAuditEvent({
        dossierId: enriched.id,
        userName: "Système IGS (Analyse & Mise à Jour Globale)",
        userRole: "system",
        action: "SYNCHRONISATION_STATUTS_GLOBAL",
        fieldChanged: "Statuts, Délais Quai & Priorité",
        previousValue: `${original.calculatedStatus} (${original.daysOnQuay ?? 0}j quai - ${original.calculatedPriority})`,
        newValue: `${enriched.calculatedStatus} (${enriched.daysOnQuay ?? 0}j quai - ${enriched.calculatedPriority})`,
        comment: `Mise à jour automatique par le moteur d'analyse opérationnelle IGS (${now.toLocaleDateString("fr-FR")})`,
      });
    }

    if (enriched.calculatedStatus === "Régularisé") regularizedCount++;
    else toRegularizeCount++;

    const daysOnQuayNum = enriched.daysOnQuay ?? 0;
    if (!enriched.goodsReleaseDate && daysOnQuayNum > 7) overdueDemurrageCount++;
    else if (!enriched.goodsReleaseDate && daysOnQuayNum >= 5) warningJ2Count++;

    // S'assurer qu'une pro-forma existe pour ce dossier
    await ensureProformaInvoiceForDossier(_memoryDossiers[i]);

    details.push({
      dossierId: enriched.id,
      dossierNumber: enriched.dossierNumber,
      client: enriched.client || "Client IGS",
      calculatedStatus: enriched.calculatedStatus,
      calculatedPriority: enriched.calculatedPriority,
      daysOnQuay: enriched.daysOnQuay,
      portStatus: enriched.portStatus,
      customsStatus: enriched.customsStatus,
      financialStatus: enriched.financialStatus,
    });
  }

  // Également déclencher la mise à jour des surestaries PAC
  try {
    const { runDemurrageReminderJob } = await import("./cronDemurrageReminders");
    await runDemurrageReminderJob();
  } catch (e) {}

  invalidateDossiersCache();

  return {
    timestamp: now.toISOString(),
    totalAnalyzed: _memoryDossiers.length,
    updatedCount,
    regularizedCount,
    toRegularizeCount,
    overdueDemurrageCount,
    warningJ2Count,
    details,
  };
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

// ----------------- DOCUMENTS & VERSIONNING -----------------
export async function listDocuments(dossierId: number, isExternalClient?: boolean) {
  let list = _memoryDocuments.filter(doc => doc.dossierId === dossierId);
  if (isExternalClient) {
    list = list.filter(doc => doc.isPublic !== false);
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function uploadDocumentWithVersion(input: {
  dossierId: number;
  name: string;
  type?: Document["type"];
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  isPublic?: boolean;
  description?: string | null;
  uploadedById?: number;
  uploaderName?: string;
  replaceExistingType?: boolean;
}) {
  const now = new Date();
  const docType = input.type ?? "Autre";
  
  // Recherche d'un document existant de même type sur le dossier si remplacement demandé
  const existingIdx = input.replaceExistingType
    ? _memoryDocuments.findIndex(d => d.dossierId === input.dossierId && d.type === docType)
    : -1;

  if (existingIdx >= 0) {
    const existing = _memoryDocuments[existingIdx];
    const prevHistory: Array<any> = (() => {
      try {
        return existing.previousVersions ? JSON.parse(existing.previousVersions) : [];
      } catch {
        return [];
      }
    })();

    // Archiver la version actuelle
    prevHistory.unshift({
      version: existing.version || 1,
      name: existing.name,
      fileUrl: existing.fileUrl,
      fileSize: existing.fileSize,
      mimeType: existing.mimeType,
      uploadedAt: existing.createdAt,
      uploaderName: existing.uploaderName,
    });

    const nextVersion = (existing.version || 1) + 1;
    const updatedDoc: Document = {
      ...existing,
      name: input.name,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize ?? existing.fileSize,
      mimeType: input.mimeType ?? existing.mimeType,
      version: nextVersion,
      isPublic: input.isPublic !== undefined ? input.isPublic : existing.isPublic,
      description: input.description !== undefined ? input.description : existing.description,
      previousVersions: JSON.stringify(prevHistory),
      uploadedById: input.uploadedById ?? existing.uploadedById,
      uploaderName: input.uploaderName ?? existing.uploaderName,
      createdAt: now,
    };

    _memoryDocuments[existingIdx] = updatedDoc;

    await logAuditEvent({
      dossierId: input.dossierId,
      userId: input.uploadedById ?? 1,
      userName: input.uploaderName ?? "Opérateur IGS",
      userRole: "declarant",
      action: "DOCUMENT_NOUVELLE_VERSION",
      entityType: "document",
      entityId: updatedDoc.id,
      fieldChanged: "Document Version",
      previousValue: `v${existing.version || 1}: ${existing.name}`,
      newValue: `v${nextVersion}: ${updatedDoc.name}`,
      afterData: { name: updatedDoc.name, type: updatedDoc.type, version: nextVersion },
      comment: `Mise à jour version v${nextVersion} pour ${updatedDoc.type} (${Math.round((updatedDoc.fileSize || 0) / 1024)} KB)`,
    });

    return updatedDoc;
  }

  // Création initiale (version 1)
  const doc: Document = {
    id: _memoryDocuments.length + 1,
    dossierId: input.dossierId,
    name: input.name,
    type: docType,
    fileUrl: input.fileUrl,
    fileSize: input.fileSize ?? 0,
    mimeType: input.mimeType ?? "application/octet-stream",
    version: 1,
    isPublic: input.isPublic !== undefined ? input.isPublic : true,
    previousVersions: "[]",
    description: input.description ?? null,
    uploadedById: input.uploadedById ?? 1,
    uploaderName: input.uploaderName ?? "Opérateur IGS",
    createdAt: now,
  };

  _memoryDocuments.unshift(doc);

  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.uploadedById ?? 1,
    userName: input.uploaderName ?? "Opérateur IGS",
    userRole: "declarant",
    action: "DOCUMENT_AJOUTE",
    entityType: "document",
    entityId: doc.id,
    fieldChanged: "Document",
    newValue: `${doc.type}: ${doc.name}`,
    afterData: { name: doc.name, type: doc.type, fileSize: doc.fileSize, mimeType: doc.mimeType, version: doc.version, isPublic: doc.isPublic },
    metadata: { mimeType: doc.mimeType, fileSize: doc.fileSize, version: doc.version },
    comment: `Dépôt document v1 (${Math.round((doc.fileSize || 0) / 1024)} KB) - Visibilité: ${doc.isPublic ? "Publique" : "Interne"}`,
  });

  return doc;
}

export async function createDocument(input: InsertDocument) {
  return uploadDocumentWithVersion({
    dossierId: input.dossierId,
    name: input.name,
    type: input.type as any,
    fileUrl: input.fileUrl,
    fileSize: input.fileSize,
    mimeType: input.mimeType || undefined,
    isPublic: input.isPublic,
    description: input.description,
    uploadedById: input.uploadedById || undefined,
    uploaderName: input.uploaderName || undefined,
  });
}

// ----------------- WORKFLOW D'APPROBATION FINANCIÈRE -----------------
export const APPROVAL_THRESHOLDS = {
  DISBURSEMENT_GNF: 5_000_000,
  INVOICE_GNF: 10_000_000,
};

export async function listApprovalRequests(filters?: {
  status?: string;
  entityType?: string;
  dossierId?: number;
}) {
  let list = [..._memoryApprovals];
  if (filters?.status && filters.status !== "all") {
    list = list.filter(r => r.status === filters.status);
  }
  if (filters?.entityType && filters.entityType !== "all") {
    list = list.filter(r => r.entityType === filters.entityType);
  }
  if (filters?.dossierId) {
    list = list.filter(r => r.dossierId === filters.dossierId);
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createApprovalRequest(input: {
  entityType: "invoice" | "disbursement";
  entityId: number;
  dossierId: number;
  amount: number;
  currency?: string;
  thresholdAmount?: number;
  requestedById?: number;
  requestedByName?: string;
  comment?: string;
}) {
  const now = new Date();
  const defaultThreshold = input.entityType === "disbursement"
    ? APPROVAL_THRESHOLDS.DISBURSEMENT_GNF
    : APPROVAL_THRESHOLDS.INVOICE_GNF;

  const req: ApprovalRequest = {
    id: _memoryApprovals.length + 1,
    entityType: input.entityType,
    entityId: input.entityId,
    dossierId: input.dossierId,
    amount: input.amount,
    currency: input.currency ?? "GNF",
    thresholdAmount: input.thresholdAmount ?? defaultThreshold,
    requestedById: input.requestedById ?? 1,
    requestedByName: input.requestedByName ?? "Comptabilité IGS",
    approverId: null,
    approverName: null,
    status: "EN_ATTENTE",
    rejectionReason: null,
    comment: input.comment ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };

  _memoryApprovals.unshift(req);

  // Notification aux Managers & Direction
  try {
    await addNotification({
      dossierId: input.dossierId,
      dossierNumber: null,
      type: "STATUT_MODIFIE",
      title: `Approbation requise — ${input.entityType === 'invoice' ? 'Facture' : 'Débours'} de ${input.amount.toLocaleString('fr-FR')} ${input.currency || 'GNF'}`,
      message: `Demande soumise par ${req.requestedByName}. Seuil de validation (${req.thresholdAmount.toLocaleString('fr-FR')} GNF) dépassé.`,
      recipientRole: "manager",
    });
  } catch (e) {}

  await logAuditEvent({
    dossierId: input.dossierId,
    userId: input.requestedById ?? 1,
    userName: req.requestedByName,
    userRole: "comptable",
    action: "DEMANDE_APPROBATION_CREEE",
    entityType: input.entityType,
    entityId: input.entityId,
    fieldChanged: "Approbation",
    previousValue: null,
    newValue: `EN_ATTENTE (${input.amount.toLocaleString("fr-FR")} GNF)`,
    comment: `Demande d'approbation soumise pour ${input.entityType} #${input.entityId}`,
  });

  return req;
}

export async function approveRequest(
  requestId: number,
  approverId: number = 1,
  approverName: string = "Alpha Barry (Manager)"
) {
  const idx = _memoryApprovals.findIndex(r => r.id === requestId);
  if (idx < 0) throw new Error(`Demande d'approbation #${requestId} introuvable.`);

  const now = new Date();
  _memoryApprovals[idx] = {
    ..._memoryApprovals[idx],
    status: "APPROUVE",
    approverId,
    approverName,
    rejectionReason: null,
    updatedAt: now,
    resolvedAt: now,
  };

  const req = _memoryApprovals[idx];

  // Si facture approuvée, débloquer le statut en "Émise"
  if (req.entityType === "invoice") {
    const invIdx = _memoryInvoices.findIndex(i => i.id === req.entityId);
    if (invIdx >= 0 && _memoryInvoices[invIdx].status === "Proforma") {
      _memoryInvoices[invIdx].status = "Émise";
    }
  }

  await logAuditEvent({
    dossierId: req.dossierId,
    userId: approverId,
    userName: approverName,
    userRole: "manager",
    action: "DEMANDE_APPROUVEE",
    entityType: req.entityType,
    entityId: req.entityId,
    fieldChanged: "Approbation",
    previousValue: "EN_ATTENTE",
    newValue: "APPROUVE",
    comment: `Demande #${requestId} de ${req.amount.toLocaleString("fr-FR")} GNF validée par ${approverName}`,
  });

  invalidateFinanceCache();
  return req;
}

export async function rejectRequest(
  requestId: number,
  approverId: number = 1,
  approverName: string = "Alpha Barry (Manager)",
  rejectionReason: string = ""
) {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new Error("Un motif explicite est strictement obligatoire pour rejeter une demande.");
  }

  const idx = _memoryApprovals.findIndex(r => r.id === requestId);
  if (idx < 0) throw new Error(`Demande d'approbation #${requestId} introuvable.`);

  const now = new Date();
  _memoryApprovals[idx] = {
    ..._memoryApprovals[idx],
    status: "REJETE",
    approverId,
    approverName,
    rejectionReason: rejectionReason.trim(),
    updatedAt: now,
    resolvedAt: now,
  };

  const req = _memoryApprovals[idx];

  await logAuditEvent({
    dossierId: req.dossierId,
    userId: approverId,
    userName: approverName,
    userRole: "manager",
    action: "DEMANDE_REJETEE",
    entityType: req.entityType,
    entityId: req.entityId,
    fieldChanged: "Approbation",
    previousValue: "EN_ATTENTE",
    newValue: "REJETE",
    comment: `Demande #${requestId} rejetée par ${approverName}. Motif : ${rejectionReason}`,
  });

  invalidateFinanceCache();
  return req;
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
export async function ensureProformaInvoiceForDossier(dossier: Dossier): Promise<Invoice> {
  const existing = _memoryInvoices.find(i => i.dossierId === dossier.id);
  if (existing) return existing;

  const sequence = _memoryInvoices.length + 1;
  const invNum = `PRO-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`;
  const now = dossier.createdAt || new Date();
  
  const isLarge = Boolean(dossier.container && (dossier.container.includes("04") || dossier.container.includes("06") || dossier.container.includes("40")));
  const isBulk = Boolean(dossier.bulk);
  
  const amountHt = isLarge ? 25000000 : isBulk ? 35000000 : 18500000;
  const amountTva = Math.round(amountHt * 0.18);
  const amountTtc = amountHt + amountTva;
  
  const customs = isLarge ? 45000000 : isBulk ? 60000000 : 30000000;
  const port = isLarge ? 12000000 : isBulk ? 15000000 : 8000000;
  const disbursements = customs + port;
  const estimatedMargin = Math.round(amountHt * 0.28);

  const inv: Invoice = {
    id: sequence,
    dossierId: dossier.id,
    invoiceNumber: invNum,
    client: dossier.client || "Client IGS",
    currency: "GNF",
    invoiceType: "Proforma",
    exchangeRate: _currentExchangeRate,
    amountHt,
    amountTva,
    amountTtc,
    disbursementsAmount: disbursements,
    customsDutiesAmount: customs,
    portFeesAmount: port,
    storageAndDemurrageFees: 0,
    estimatedMargin,
    paymentMethod: null,
    paymentReference: null,
    receiptNumber: null,
    status: "Proforma",
    pdfUrl: null,
    clientId: dossier.clientId ?? null,
    dueDate: new Date(now.getTime() + 86400000 * 30),
    paidAt: null,
    reconciliationStatus: "non_rapproche",
    reconciliationDate: null,
    reconciliationRef: null,
    rateLockedAt: now,
    notes: `Facture Pro-Forma générée automatiquement à l'ouverture du dossier ${dossier.dossierNumber}`,
    createdById: 1,
    createdAt: now,
    updatedAt: now,
  };

  _memoryInvoices.push(inv);

  // Enregistrer une avance débours provisionnelle PAC si pas déjà fait
  if (!_memoryPacDisbursements.some(p => p.dossierId === dossier.id)) {
    _memoryPacDisbursements.push({
      id: _memoryPacDisbursements.length + 1,
      dossierId: dossier.id,
      invoiceId: inv.id,
      type: "douane",
      amountAdvanced: customs,
      amountReimbursed: 0,
      status: "avance",
      receiptNumber: null,
      notes: `Provision débours douane ${dossier.dossierNumber}`,
      createdById: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return inv;
}

export async function listInvoices(dossierId?: number) {
  // Synchroniser les dossiers n'ayant pas encore de pro-forma
  for (const d of _memoryDossiers) {
    if (!_memoryInvoices.some(i => i.dossierId === d.id)) {
      await ensureProformaInvoiceForDossier(d);
    }
  }

  let list = [..._memoryInvoices];
  if (dossierId) list = list.filter(i => i.dossierId === dossierId);
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listInvoicesPaginated(filters: {
  page?: number;
  limit?: number;
  status?: string;
  reconciliationStatus?: string;
  search?: string;
  dossierId?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

  let all = await listInvoices(filters.dossierId);

  if (filters.status && filters.status !== "all") {
    all = all.filter(i => i.status === filters.status);
  }
  if (filters.reconciliationStatus && filters.reconciliationStatus !== "all") {
    all = all.filter(i => i.reconciliationStatus === filters.reconciliationStatus);
  }
  if (filters.search) {
    const s = filters.search.toLowerCase().trim();
    all = all.filter(i => 
      i.invoiceNumber.toLowerCase().includes(s) ||
      i.client.toLowerCase().includes(s) ||
      (i.receiptNumber && i.receiptNumber.toLowerCase().includes(s)) ||
      (i.paymentReference && i.paymentReference.toLowerCase().includes(s))
    );
  }

  const total = all.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = all.slice(startIndex, startIndex + limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
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
    reconciliationStatus: (input as any).reconciliationStatus ?? (isPaid ? "rapproche" : "non_rapproche"),
    reconciliationDate: isPaid ? now : null,
    reconciliationRef: (input as any).reconciliationRef ?? (isPaid ? input.paymentReference : null),
    rateLockedAt: now,
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
  invalidateFinanceCache();
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
  invalidateFinanceCache();
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

  invalidateFinanceCache();
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

export async function reconcileInvoice(
  invoiceId: number,
  input: {
    reconciliationStatus: "non_rapproche" | "partiel" | "rapproche";
    reconciliationRef?: string | null;
    notes?: string | null;
    userId?: number;
    userName?: string;
  }
) {
  const idx = _memoryInvoices.findIndex(i => i.id === invoiceId);
  if (idx < 0) throw new Error(`Facture #${invoiceId} introuvable`);
  const current = _memoryInvoices[idx];
  const now = new Date();

  _memoryInvoices[idx] = {
    ...current,
    reconciliationStatus: input.reconciliationStatus,
    reconciliationDate: input.reconciliationStatus !== "non_rapproche" ? now : null,
    reconciliationRef: input.reconciliationRef || current.reconciliationRef || null,
    updatedAt: now,
  };

  await logAuditEvent({
    dossierId: current.dossierId,
    userId: input.userId || 1,
    userName: input.userName || "Service Comptabilité",
    userRole: "comptable",
    action: "RAPPROCHEMENT_FACTURE",
    entityType: "invoice",
    entityId: invoiceId,
    fieldChanged: "Rapprochement Bancaire",
    previousValue: current.reconciliationStatus || "non_rapproche",
    newValue: input.reconciliationStatus,
    comment: `Rapprochement bancaire 3-voies mis à jour : ${input.reconciliationStatus} (Réf: ${input.reconciliationRef || "N/A"})`,
  });

  invalidateFinanceCache();
  return _memoryInvoices[idx];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const _heavyAggregateCache = new Map<string, CacheEntry<any>>();
const AGGREGATE_CACHE_TTL_MS = 60 * 1000; // 60s TTL

export function getCachedAggregate<T>(key: string): T | null {
  const entry = _heavyAggregateCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AGGREGATE_CACHE_TTL_MS) {
    _heavyAggregateCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedAggregate<T>(key: string, data: T): void {
  _heavyAggregateCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateFinanceCache(): void {
  _heavyAggregateCache.delete("finance_profitability");
  _heavyAggregateCache.delete("finance_treasury_flow");
  _heavyAggregateCache.delete("finance_summary");
}

export function invalidateDashboardCache(): void {
  _heavyAggregateCache.delete("dashboard_metrics");
}

export function invalidateUsersCache(): void {
  _heavyAggregateCache.delete("hr_stats");
}

export async function listUnbilledRegularizedDossiers(daysThreshold: number = 3) {
  const [allDossiers, allInvoices] = await Promise.all([
    listDossiers(),
    listInvoices(),
  ]);
  const now = new Date();

  return allDossiers.filter(d => {
    if (d.calculatedStatus !== "Régularisé" && !d.goodsReleaseDate) return false;
    const refDate = d.goodsReleaseDate || d.updatedAt || d.createdAt;
    const elapsedDays = Math.floor((now.getTime() - new Date(refDate).getTime()) / 86400000);
    if (elapsedDays < daysThreshold) return false;

    const relatedInvoices = allInvoices.filter(i => i.dossierId === d.id);
    const hasDefinitiveInvoice = relatedInvoices.some(i => i.invoiceType === "Definitive" || i.status === "Payée" || i.status === "Émise");
    return !hasDefinitiveInvoice;
  });
}

export async function getProfitabilityMetrics() {
  const cached = getCachedAggregate<any>("finance_profitability");
  if (cached) return cached;

  const [allInvoices, allDossiers, allDebours, { rate }, unbilledDossiers] = await Promise.all([
    listInvoices(),
    listDossiers(),
    listPacDisbursements(),
    getExchangeRate(),
    listUnbilledRegularizedDossiers(3),
  ]);

  const clientMap = new Map<string, {
    client: string;
    invoicedAmountGNF: number;
    disbursementsGNF: number;
    marginGNF: number;
    marginRatePct: number;
    dossiersCount: number;
    invoicesCount: number;
  }>();

  allInvoices.forEach(i => {
    const client = i.client || "Client IGS";
    const cur = clientMap.get(client) || {
      client,
      invoicedAmountGNF: 0,
      disbursementsGNF: 0,
      marginGNF: 0,
      marginRatePct: 0,
      dossiersCount: 0,
      invoicesCount: 0,
    };

    const ttc = i.currency === "USD" ? i.amountTtc * rate : i.amountTtc;
    const deb = i.currency === "USD" ? (i.disbursementsAmount || 0) * rate : (i.disbursementsAmount || 0);
    const margin = i.currency === "USD" ? (i.estimatedMargin || 0) * rate : (i.estimatedMargin || 0);

    cur.invoicedAmountGNF += ttc;
    cur.disbursementsGNF += deb;
    cur.marginGNF += margin;
    cur.invoicesCount += 1;

    clientMap.set(client, cur);
  });

  const marginsByClient = Array.from(clientMap.values()).map(c => {
    const marginRatePct = c.invoicedAmountGNF > 0
      ? Math.round(((c.invoicedAmountGNF - c.disbursementsGNF) / c.invoicedAmountGNF) * 1000) / 10
      : 0;
    const clientDossiers = allDossiers.filter(d => d.client === c.client);
    return {
      ...c,
      marginRatePct,
      dossiersCount: clientDossiers.length,
    };
  }).sort((a, b) => b.invoicedAmountGNF - a.invoicedAmountGNF);

  const totalInvoicedGNF = allInvoices.reduce((s, i) => s + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);
  const totalPaidGNF = allInvoices.filter(i => i.status === "Payée").reduce((s, i) => s + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);
  
  const totalAdvancedDeboursGNF = allDebours.reduce((s, d) => s + d.amountAdvanced, 0);
  const totalReimbursedDeboursGNF = allDebours.reduce((s, d) => s + d.amountReimbursed, 0);
  const unrecoveredDeboursGNF = Math.max(0, totalAdvancedDeboursGNF - totalReimbursedDeboursGNF);

  const deboursToCARatioPct = totalInvoicedGNF > 0 ? Math.round((totalAdvancedDeboursGNF / totalInvoicedGNF) * 100) : 0;
  const isRiskAlert = deboursToCARatioPct > 150;

  const result = {
    marginsByClient,
    totalInvoicedGNF,
    totalPaidGNF,
    totalAdvancedDeboursGNF,
    totalReimbursedDeboursGNF,
    unrecoveredDeboursGNF,
    deboursToCARatioPct,
    isRiskAlert,
    unbilledDossiersCount: unbilledDossiers.length,
    unbilledDossiers: unbilledDossiers.map(d => ({
      id: d.id,
      dossierNumber: d.dossierNumber,
      client: d.client,
      blLtaNumber: d.blLtaNumber,
      goodsReleaseDate: d.goodsReleaseDate,
      calculatedStatus: d.calculatedStatus,
    })),
    exchangeRate: rate,
  };

  setCachedAggregate("finance_profitability", result);
  return result;
}

export async function getTreasuryFlow() {
  const cached = getCachedAggregate<any>("finance_treasury_flow");
  if (cached) return cached;

  const [{ rate }, allInvoices, allDebours] = await Promise.all([
    getExchangeRate(),
    listInvoices(),
    listPacDisbursements(),
  ]);

  const monthlyMap = new Map<string, {
    month: string;
    facture: number;
    encaisse: number;
    deboursAvances: number;
    deboursRecouvres: number;
  }>();

  allInvoices.forEach(i => {
    const key = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(i.createdAt);
    const cur = monthlyMap.get(key) || { month: key, facture: 0, encaisse: 0, deboursAvances: 0, deboursRecouvres: 0 };
    const ttc = i.currency === "USD" ? i.amountTtc * rate : i.amountTtc;
    cur.facture += ttc;
    if (i.status === "Payée") {
      cur.encaisse += ttc;
    }
    monthlyMap.set(key, cur);
  });

  allDebours.forEach(d => {
    const key = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(d.createdAt);
    const cur = monthlyMap.get(key) || { month: key, facture: 0, encaisse: 0, deboursAvances: 0, deboursRecouvres: 0 };
    cur.deboursAvances += d.amountAdvanced;
    cur.deboursRecouvres += d.amountReimbursed;
    monthlyMap.set(key, cur);
  });

  return Array.from(monthlyMap.values());
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

// ----------------- PRÉFÉRENCES CLIENTS & COMMUNICATIONS -----------------
export async function getClientPreferences(clientNameOrId: string | number) {
  let client = typeof clientNameOrId === "number"
    ? _memoryClients.find(c => c.id === clientNameOrId)
    : _memoryClients.find(c => c.name.toLowerCase().trim() === String(clientNameOrId).toLowerCase().trim() || c.name.toLowerCase().includes(String(clientNameOrId).toLowerCase()));

  if (!client) {
    const cleanName = typeof clientNameOrId === "string" ? clientNameOrId : `Client #${clientNameOrId}`;
    const newClient: Client = {
      id: _memoryClients.length + 1,
      name: cleanName,
      contactPerson: "Direction Logistique",
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "")}@client-igs.gn`,
      phone: "+224620000000",
      whatsappPhone: "+224620000000",
      country: "Guinée",
      taxId: null,
      address: "Conakry, République de Guinée",
      preferredChannel: "whatsapp",
      optInNotifications: true,
      monthlyReportEnabled: true,
      accountCategory: cleanName.toUpperCase().includes("GOLD") || cleanName.toUpperCase().includes("MINING") ? "mining_major" : "standard",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    _memoryClients.push(newClient);
    return newClient;
  }

  return client;
}

export async function updateClientPreferences(
  clientId: number,
  data: {
    preferredChannel?: string;
    optInNotifications?: boolean;
    monthlyReportEnabled?: boolean;
    whatsappPhone?: string | null;
    email?: string | null;
    contactPerson?: string | null;
  }
) {
  const idx = _memoryClients.findIndex(c => c.id === clientId);
  if (idx < 0) throw new Error(`Client #${clientId} introuvable.`);

  _memoryClients[idx] = {
    ..._memoryClients[idx],
    ...data,
    updatedAt: new Date(),
  };

  return _memoryClients[idx];
}
