import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { 
  adminProcedure, 
  comptableProcedure, 
  declarantProcedure, 
  internalProcedure, 
  protectedProcedure, 
  publicProcedure, 
  router 
} from "./_core/trpc";
import * as db from "./db";

const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalDate = z.date().optional().nullable();

const dossierPayload = z.object({
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
  notes: optionalText,
});

const filtersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["Régularisé", "À régulariser"]).optional(),
  priority: z.enum(["Haute", "Normale", "Basse"]).optional(),
  client: z.string().trim().optional(),
  transportMode: z.string().trim().optional(),
  responsible: z.string().trim().optional(),
  myDossiersOnly: z.boolean().optional(),
  currentUserCompany: z.string().optional().nullable(),
  etaFrom: z.date().optional(),
  etaTo: z.date().optional(),
}).optional();

let _cachedDashboard: { data: any; timestamp: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 30_000; // 30 secondes de cache en mémoire

export function invalidateDashboardCache() {
  _cachedDashboard = null;
}

export async function getCachedDashboard() {
  const now = Date.now();
  if (_cachedDashboard && (now - _cachedDashboard.timestamp) < DASHBOARD_CACHE_TTL_MS) {
    return _cachedDashboard.data;
  }
  const dossiers = await db.listDossiers();
  const data = buildDashboard(dossiers);
  _cachedDashboard = { data, timestamp: now };
  return data;
}

function buildDashboard(dossiers: Awaited<ReturnType<typeof db.listDossiers>>) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isMissing = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
  const total = dossiers.length;
  const regularized = dossiers.filter(dossier => dossier.calculatedStatus === "Régularisé").length;
  const overdue = dossiers.filter(dossier => dossier.eta && dossier.eta < now && !dossier.goodsReleaseDate).length;
  const lateToRegularize = dossiers.filter(dossier => dossier.calculatedStatus === "À régulariser" && dossier.eta && dossier.eta < now).length;
  const etaInSevenDays = dossiers.filter(dossier => {
    if (!dossier.eta || dossier.goodsReleaseDate) return false;
    const days = Math.ceil((dossier.eta.getTime() - now.getTime()) / 86_400_000);
    return days >= 0 && days <= 7;
  }).length;
  const released = dossiers.filter(dossier => dossier.goodsReleaseDate).length;
  const delays = dossiers
    .filter(dossier => dossier.eta && dossier.goodsReleaseDate)
    .map(dossier => Math.round((dossier.goodsReleaseDate!.getTime() - dossier.eta!.getTime()) / 86_400_000));
  const averageEtaToRelease = delays.length ? Math.round((delays.reduce((sum, value) => sum + value, 0) / delays.length) * 10) / 10 : null;
  const priority = ["Haute", "Normale", "Basse"].map(label => ({ label, value: dossiers.filter(dossier => dossier.calculatedPriority === label).length }));
  
  const monthlyMap = new Map<string, number>();
  dossiers.forEach(dossier => {
    if (!dossier.eta) return;
    const key = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(dossier.eta);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  });
  const monthlyEta = Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, value }));
  
  const blOccurrences = new Map<string, number>();
  const clientNumberOccurrences = new Map<string, number>();
  dossiers.forEach(dossier => {
    if (!isMissing(dossier.blLtaNumber)) blOccurrences.set(dossier.blLtaNumber!, (blOccurrences.get(dossier.blLtaNumber!) ?? 0) + 1);
    if (!isMissing(dossier.clientDossierNumber)) clientNumberOccurrences.set(dossier.clientDossierNumber!, (clientNumberOccurrences.get(dossier.clientDossierNumber!) ?? 0) + 1);
  });
  
  const byClient = new Map<string, { total: number; toRegularize: number }>();
  dossiers.forEach(dossier => {
    const client = dossier.client || "Client non renseigné";
    const current = byClient.get(client) ?? { total: 0, toRegularize: 0 };
    current.total += 1;
    if (dossier.calculatedStatus === "À régulariser") current.toRegularize += 1;
    byClient.set(client, current);
  });

  const alertMap = new Map<string, number>();
  dossiers.forEach(dossier => {
    if (dossier.fieldAlert) {
      alertMap.set(dossier.fieldAlert, (alertMap.get(dossier.fieldAlert) ?? 0) + 1);
    }
  });
  const fieldAlerts = Array.from(alertMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    metrics: {
      total,
      regularized,
      regularizationRate: total ? Math.round((regularized / total) * 1000) / 10 : 0,
      overdue,
      lateToRegularize,
      etaInSevenDays,
      released,
      releasedShare: total ? Math.round((released / total) * 1000) / 10 : 0,
      averageEtaToRelease,
      missingEta: dossiers.filter(dossier => !dossier.eta).length,
    },
    priority,
    monthlyEta,
    fieldAlerts,
    quality: {
      duplicateBlLta: Array.from(blOccurrences.values()).filter(value => value > 1).reduce((sum, value) => sum + value - 1, 0),
      duplicateClientNumber: Array.from(clientNumberOccurrences.values()).filter(value => value > 1).reduce((sum, value) => sum + value - 1, 0),
      missingClientNumber: dossiers.filter(dossier => isMissing(dossier.clientDossierNumber)).length,
      missingEta: dossiers.filter(dossier => !dossier.eta).length,
      missingDeclarations: dossiers.filter(dossier => isMissing(dossier.declarationNumber)).length,
      missingBulletins: dossiers.filter(dossier => isMissing(dossier.bulletinNumber)).length,
      missingRelease: dossiers.filter(dossier => !dossier.goodsReleaseDate).length,
      incomplete: dossiers.filter(dossier => dossier.calculatedStatus === "À régulariser").length,
    },
    clients: Array.from(byClient.entries())
      .map(([client, values]) => ({ client, ...values }))
      .sort((a, b) => b.total - a.total || b.toRegularize - a.toRegularize),
  };
}

export const appRouter = router({
  system: systemRouter,
  
  // 1. AUTHENTIFICATION & RÔLES
  auth: router({
    me: publicProcedure.query(options => options.ctx.user),
    listUsers: protectedProcedure.query(async () => db.listUsers()),
    login: publicProcedure
      .input(
        z.object({
          name: z.string().optional(),
          role: z.enum(["admin", "declarant", "comptable", "manager", "client", "user"]).optional(),
          clientCompany: z.string().optional(),
        }).optional()
      )
      .mutation(async ({ ctx, input }) => {
        const role = input?.role || "admin";
        let defaultName = "Ibrahima Gold Service (Admin)";
        if (role === "declarant") defaultName = "Mamadou Diallo (Déclarant)";
        if (role === "comptable") defaultName = "Fatoumata Camara (Comptable)";
        if (role === "manager") defaultName = "Alpha Barry (Manager Opérations)";
        if (role === "client") defaultName = "Guinean Birimian Gold (Client)";

        const name = input?.name || defaultName;
        const openId = `igs_${role}_${(input?.clientCompany || "conakry").toLowerCase().replace(/[^a-z0-9]/g, "")}`;

        await db.upsertUser({
          openId,
          name,
          email: `${role}@igs-logistics.gn`,
          loginMethod: "direct",
          role,
          clientCompany: input?.clientCompany ?? (role === "client" ? "Guinean Birimian Gold S.A" : null),
          lastSignedIn: new Date(),
        });

        const user = await db.getUserByOpenId(openId);
        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 2. RÉFÉRENTIELS LOGISTIQUES & DOUANIERS
  reference: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => db.getReferenceItems(input?.category)),
    create: adminProcedure
      .input(z.object({ category: z.string(), label: z.string(), sortOrder: z.number().optional() }))
      .mutation(async ({ input }) => db.createReferenceItem(input)),
  }),

  // 3. DOSSIERS & VUES PAR RÔLE
  dossier: router({
    list: protectedProcedure
      .input(filtersSchema)
      .query(async ({ ctx, input }) => {
        const filters = { ...input };
        // Si l'utilisateur est un client externe, forcer le filtre sur sa société
        if (ctx.user?.role === "client" && ctx.user?.clientCompany) {
          filters.currentUserCompany = ctx.user.clientCompany;
        }
        // Si filtre "Mes dossiers" activé pour un déclarant ou responsable
        if (filters.myDossiersOnly && ctx.user?.name) {
          filters.responsible = ctx.user.name.split(" ")[0]; // Matching flexible
        }
        return db.listDossiers(filters);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]) }))
      .query(async ({ ctx, input }) => {
        const dossier = await db.getDossier(input.id);
        if (!dossier) {
          console.error(`[tRPC] Dossier introuvable pour l'identifiant: "${input.id}"`);
          throw new TRPCError({ code: "NOT_FOUND", message: `Dossier introuvable pour l'identifiant "${input.id}"` });
        }
        if (ctx.user?.role === "client" && ctx.user?.clientCompany && dossier.client !== ctx.user.clientCompany) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce dossier" });
        }
        return dossier;
      }),
    create: internalProcedure
      .input(dossierPayload)
      .mutation(async ({ ctx, input }) => {
        invalidateDashboardCache();
        return db.createDossier(input, ctx.user.id, ctx.user.name || "Opérateur");
      }),
    update: internalProcedure
      .input(z.object({ id: z.number().int().positive(), data: dossierPayload }))
      .mutation(async ({ ctx, input }) => {
        invalidateDashboardCache();
        return db.updateDossier(input.id, input.data, ctx.user.id, ctx.user.name || "Opérateur");
      }),
    updateCustoms: declarantProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: dossierPayload.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        invalidateDashboardCache();
        return db.updateDossier(input.id, input.data, ctx.user.id, ctx.user.name || "Déclarant PAC");
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        invalidateDashboardCache();
        return db.deleteDossier(input.id);
      }),
    importBatch: declarantProcedure
      .input(z.array(dossierPayload))
      .mutation(async ({ ctx, input }) => {
        invalidateDashboardCache();
        return db.importDossiersBatch(input, ctx.user.id, ctx.user.name || "Importateur Excel");
      }),
  }),

  // 4. PORTAIL CLIENT PUBLIC / DIRECT
  portal: router({
    track: publicProcedure
      .input(z.object({ accessCodeOrNumber: z.string().trim().min(2) }))
      .query(async ({ input }) => {
        const dossier = await db.getDossierByPortalCode(input.accessCodeOrNumber);
        if (!dossier) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dossier introuvable. Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.",
          });
        }
        const docs = await db.listDocuments(dossier.id);
        const history = await db.listDossierHistory(dossier.id);
        return {
          dossier,
          documents: docs.map(d => ({ id: d.id, name: d.name, type: d.type, createdAt: d.createdAt })),
          timeline: history.map(h => ({ date: h.createdAt, title: h.fieldChanged, detail: h.newValue || h.comment })),
        };
      }),
  }),

  // 5. GESTION DOCUMENTAIRE & PREUVES
  document: router({
    list: protectedProcedure
      .input(z.object({ dossierId: z.number().int().positive() }))
      .query(async ({ input }) => db.listDocuments(input.dossierId)),
    upload: protectedProcedure
      .input(
        z.object({
          dossierId: z.number().int().positive(),
          name: z.string().min(1),
          type: z.enum(["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]),
          fileUrl: z.string().min(1),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createDocument({
          ...input,
          uploadedById: ctx.user.id,
          uploaderName: ctx.user.name || "Opérateur IGS",
        });
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => db.deleteDocument(input.id)),
  }),

  // 6. AUDIT TRAIL / HISTORIQUE
  audit: router({
    list: protectedProcedure
      .input(z.object({ dossierId: z.number().int().positive() }))
      .query(async ({ input }) => db.listDossierHistory(input.dossierId)),
  }),

  // 7. MODULE FINANCIER & FACTURATION
  finance: router({
    listInvoices: comptableProcedure
      .input(z.object({ dossierId: z.number().optional() }).optional())
      .query(async ({ input }) => db.listInvoices(input?.dossierId)),
    createInvoice: comptableProcedure
      .input(
        z.object({
          dossierId: z.number().int().positive(),
          client: z.string().min(1),
          currency: z.string().default("GNF"),
          invoiceType: z.enum(["Proforma", "Definitive"]).default("Proforma"),
          exchangeRate: z.number().int().positive().default(8650),
          amountHt: z.number().min(0),
          amountTva: z.number().min(0).default(0),
          amountTtc: z.number().min(0),
          disbursementsAmount: z.number().min(0).default(0),
          customsDutiesAmount: z.number().min(0).default(0),
          portFeesAmount: z.number().min(0).default(0),
          storageAndDemurrageFees: z.number().min(0).default(0),
          status: z.enum(["Proforma", "Émise", "Payée", "En_retard", "Annulée"]).default("Proforma"),
          dueDate: optionalDate,
          notes: optionalText,
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createInvoice({
          ...input,
          createdById: ctx.user.id,
        });
      }),
    updateInvoice: comptableProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: z.object({
            invoiceType: z.enum(["Proforma", "Definitive"]).optional(),
            currency: z.string().optional(),
            exchangeRate: z.number().optional(),
            amountHt: z.number().min(0).optional(),
            amountTva: z.number().min(0).optional(),
            amountTtc: z.number().min(0).optional(),
            disbursementsAmount: z.number().min(0).optional(),
            customsDutiesAmount: z.number().min(0).optional(),
            portFeesAmount: z.number().min(0).optional(),
            storageAndDemurrageFees: z.number().min(0).optional(),
            estimatedMargin: z.number().optional(),
            paymentMethod: optionalText,
            paymentReference: optionalText,
            receiptNumber: optionalText,
            status: z.enum(["Proforma", "Émise", "Payée", "En_retard", "Annulée"]).optional(),
            dueDate: optionalDate,
            paidAt: optionalDate,
            notes: optionalText,
          }),
        })
      )
      .mutation(async ({ input }) => db.updateInvoice(input.id, input.data)),
    recordPayment: comptableProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          paymentMethod: optionalText,
          paymentReference: optionalText,
          paidAmount: z.number().min(0).optional().nullable(),
        })
      )
      .mutation(async ({ input }) => db.recordInvoicePayment(input.id, input)),
    getExchangeRate: internalProcedure.query(async () => db.getExchangeRate()),
    setExchangeRate: comptableProcedure
      .input(z.object({ rate: z.number().int().positive() }))
      .mutation(async ({ input }) => db.setExchangeRate(input.rate)),
    summary: comptableProcedure.query(async () => {
      const allInvoices = await db.listInvoices();
      const allDossiers = await db.listDossiers();
      const { rate } = await db.getExchangeRate();
      
      const totalCA_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);
      const totalCA_USD = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc : Math.round(i.amountTtc / rate)), 0);
      const totalMargin_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.estimatedMargin || 0) * rate : (i.estimatedMargin || 0)), 0);
      const totalMargin_USD = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.estimatedMargin || 0) : Math.round((i.estimatedMargin || 0) / rate)), 0);
      const totalDisbursements_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.disbursementsAmount || 0) * rate : (i.disbursementsAmount || 0)), 0);
      const totalCustomsDuties_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.customsDutiesAmount || 0) * rate : (i.customsDutiesAmount || 0)), 0);
      const totalPortFees_GNF = allInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.portFeesAmount || 0) * rate : (i.portFeesAmount || 0)), 0);
      const pendingInvoices = allInvoices.filter(i => i.status !== "Payée").length;
      const paidInvoices = allInvoices.filter(i => i.status === "Payée").length;
      const totalDemurrageRisk = allDossiers.filter(d => d.eta && !d.goodsReleaseDate && (new Date().getTime() - d.eta.getTime()) > 86400000 * 7).length;

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
        invoices: allInvoices,
      };
    }),
  }),

  // 8. TÂCHES & COLLABORATION D'ÉQUIPE
  task: router({
    list: protectedProcedure
      .input(
        z.object({ 
          dossierId: z.number().optional(),
          assignedTo: z.string().optional(),
          status: z.enum(["A_faire", "En_cours", "Termine", "Bloque"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => db.listTasks(input)),
    create: internalProcedure
      .input(
        z.object({
          dossierId: z.number().int().positive(),
          title: z.string().min(1),
          assignedTo: z.string().optional(),
          dueDate: optionalDate,
          priority: z.enum(["Haute", "Normale", "Basse"]).default("Normale"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createTask({
          ...input,
          createdById: ctx.user.id,
        });
      }),
    updateStatus: internalProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["A_faire", "En_cours", "Termine", "Bloque"]) }))
      .mutation(async ({ input }) => db.updateTaskStatus(input.id, input.status)),
    toggleStatus: internalProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["A_faire", "En_cours", "Termine", "Bloque"]).optional() }))
      .mutation(async ({ input }) => db.toggleTaskStatus(input.id, input.status)),
  }),

  // 9. COMMENTAIRES
  comment: router({
    list: protectedProcedure
      .input(z.object({ dossierId: z.number().int().positive() }))
      .query(async ({ input }) => db.listComments(input.dossierId)),
    add: protectedProcedure
      .input(z.object({ dossierId: z.number().int().positive(), message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return db.addComment({
          dossierId: input.dossierId,
          authorId: ctx.user.id,
          authorName: ctx.user.name || "Opérateur",
          message: input.message,
        });
      }),
  }),

  // 10. NOTIFICATIONS PROACTIVES
  notification: router({
    list: protectedProcedure.query(async () => db.listNotifications(40)),
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => db.markNotificationAsRead(input.id)),
    markAllAsRead: protectedProcedure
      .mutation(async () => db.markAllNotificationsAsRead()),
  }),

  // TABLEAU DE BORD OPÉRATIONNEL
  dashboard: router({
    get: protectedProcedure.query(async () => getCachedDashboard()),
  }),
});

export type AppRouter = typeof appRouter;

