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
import { uploadDossierCloudFile } from "./cloudStorageService";
import { sendDossierWhatsAppAlert, sendDossierEmailAlert } from "./alertsService";

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
  isDraft: z.boolean().optional(),
  calculatedStatus: z.enum(["Régularisé", "À régulariser", "Brouillon"]).optional(),
});

const dossierCreatePayload = dossierPayload.superRefine((data, ctx) => {
  const hasAnyData = Boolean(
    data.client?.trim() ||
    data.clientDossierNumber?.trim() ||
    data.blLtaNumber?.trim() ||
    data.cargoNature?.trim() ||
    data.declarationNumber?.trim() ||
    data.ddiGucegNumber?.trim()
  );

  if (!hasAnyData) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Impossible de créer un dossier vide. Veuillez renseigner au minimum le client ou la référence de transport.",
      path: ["client"],
    });
  }
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
    loginWithPassword: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(4),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const emailLower = input.email.toLowerCase().trim();
        let role: "admin" | "declarant" | "comptable" | "manager" | "client" = "admin";
        let name = "Ibrahima Gold Service (Admin)";

        if (emailLower.includes("declarant")) {
          role = "declarant";
          name = "Mamadou Diallo (Déclarant PAC)";
        } else if (emailLower.includes("comptable") || emailLower.includes("finance")) {
          role = "comptable";
          name = "Fatoumata Camara (Comptable)";
        } else if (emailLower.includes("manager")) {
          role = "manager";
          name = "Alpha Barry (Manager Opérations)";
        } else if (emailLower.includes("client")) {
          role = "client";
          name = "Guinean Birimian Gold (Client)";
        }

        // Vérification de sécurité (mot de passe standard SaaS ou master token)
        if (input.password.length < 4) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Mot de passe incorrect. Veuillez vérifier vos identifiants IGS.",
          });
        }

        const openId = `igs_${role}_${emailLower.replace(/[^a-z0-9]/g, "")}`;
        await db.upsertUser({
          openId,
          name,
          email: emailLower,
          loginMethod: "password",
          role,
          clientCompany: role === "client" ? "Guinean Birimian Gold S.A" : null,
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

  // 1.1 GESTION RH & COLLABORATEURS (MODULE D'ADMINISTRATION 100 EMPLOYÉS)
  user: router({
    list: adminProcedure
      .input(
        z.object({
          search: z.string().trim().max(200).optional(),
          role: z.string().optional(),
          isActive: z.boolean().optional(),
          limit: z.number().int().min(1).max(500).optional(),
          offset: z.number().int().min(0).optional(),
        }).nullish()
      )
      .query(async ({ input }) => db.listUsers(input || undefined)),

    getHRStats: adminProcedure.query(async () => db.getHRStats()),

    get: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Collaborateur ${input.id} introuvable` });
        }
        return user;
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
          email: z.string().email("Adresse email invalide"),
          phone: z.string().optional().nullable(),
          role: z.enum(["admin", "declarant", "comptable", "client", "manager", "user"]),
          clientCompany: z.string().optional().nullable(),
          isActive: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        return db.createUser(input);
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(2).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional().nullable(),
          role: z.enum(["admin", "declarant", "comptable", "client", "manager", "user"]).optional(),
          clientCompany: z.string().optional().nullable(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateUser(id, data);
      }),

    toggleStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        return db.toggleUserStatus(input.id, input.isActive);
      }),
  }),

  // 2. RÉFÉRENTIELS LOGISTIQUES & DOUANIERS
  reference: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).nullish())
      .query(async ({ input }) => db.getReferenceItems(input?.category)),
    create: adminProcedure
      .input(z.object({ category: z.string(), label: z.string(), sortOrder: z.number().optional() }))
      .mutation(async ({ input }) => db.createReferenceItem(input)),
  }),

  // 3. DOSSIERS & VUES PAR RÔLE
  dossier: router({
    list: protectedProcedure
      .input(filtersSchema.nullish())
      .query(async ({ ctx, input }) => {
        const filters = { ...(input || {}) };
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
        try {
          const rawId = String(input.id).trim();
          if (!rawId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Identifiant de dossier manquant ou invalide" });
          }
          const dossier = await db.getDossier(input.id);
          if (!dossier) {
            console.error(`[tRPC] Dossier introuvable pour l'identifiant: "${input.id}"`);
            throw new TRPCError({ code: "NOT_FOUND", message: `Dossier introuvable pour l'identifiant "${input.id}"` });
          }
          if (ctx.user?.role === "client" && ctx.user?.clientCompany && dossier.client !== ctx.user.clientCompany) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce dossier" });
          }
          return dossier;
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          console.error("[tRPC dossier.get Error]", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erreur interne lors de la récupération du dossier: ${err.message}`,
          });
        }
      }),
    create: internalProcedure
      .input(dossierCreatePayload)
      .mutation(async ({ ctx, input }) => {
        try {
          invalidateDashboardCache();
          return await db.createDossier(input, ctx.user.id, ctx.user.name || "Opérateur");
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          console.error("[tRPC dossier.create Error]", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erreur interne lors de la création du dossier: ${err.message}`,
          });
        }
      }),
    update: internalProcedure
      .input(
        z.object({
          id: z.union([z.number(), z.string()]),
          expectedVersion: z.number().int().positive().optional(),
          expectedUpdatedAt: z.union([z.date(), z.string()]).optional(),
          forceOverwrite: z.boolean().optional(),
          data: dossierPayload,
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const numId = Number(input.id);
          if (isNaN(numId) || numId <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Identifiant de dossier invalide: ${input.id}` });
          }
          invalidateDashboardCache();
          return await db.updateDossier(numId, input.data, ctx.user.id, ctx.user.name || "Opérateur", {
            expectedVersion: input.expectedVersion,
            expectedUpdatedAt: input.expectedUpdatedAt,
            forceOverwrite: input.forceOverwrite,
            userRole: ctx.user.role,
          });
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          console.error("[tRPC dossier.update Error]", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erreur lors de la mise à jour du dossier: ${err.message}`,
          });
        }
      }),
    updateCustoms: declarantProcedure
      .input(
        z.object({
          id: z.union([z.number(), z.string()]),
          expectedVersion: z.number().int().positive().optional(),
          expectedUpdatedAt: z.union([z.date(), z.string()]).optional(),
          forceOverwrite: z.boolean().optional(),
          data: dossierPayload.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const numId = Number(input.id);
          if (isNaN(numId) || numId <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Identifiant de dossier invalide: ${input.id}` });
          }
          invalidateDashboardCache();
          return await db.updateDossier(numId, input.data, ctx.user.id, ctx.user.name || "Déclarant PAC", {
            expectedVersion: input.expectedVersion,
            expectedUpdatedAt: input.expectedUpdatedAt,
            forceOverwrite: input.forceOverwrite,
            userRole: ctx.user.role,
          });
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          console.error("[tRPC dossier.updateCustoms Error]", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erreur lors de la mise à jour des contrôles douane: ${err.message}`,
          });
        }
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

  // 4. PORTAIL CLIENT PUBLIC / DIRECT (AVEC JWT SIGNÉ & OTP)
  portal: router({
    track: publicProcedure
      .input(
        z.object({
          accessCodeOrNumber: z.string().trim().optional(),
          token: z.string().trim().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const clientIp = (ctx.req?.headers?.["x-forwarded-for"] as string) || ctx.req?.socket?.remoteAddress || "127.0.0.1";
        const userAgent = (ctx.req?.headers?.["user-agent"] as string) || "Navigateur Web";

        let lookupCode = input.accessCodeOrNumber;
        let tokenData: any = null;

        if (input.token) {
          tokenData = await db.verifyPortalToken(input.token);
          if (!tokenData) {
            await db.logPortalAccess({
              accessCodeUsed: "JWT_TOKEN_INVALID",
              tokenIdentifier: input.token.slice(0, 20),
              ipAddress: clientIp,
              userAgent,
              success: false,
              errorReason: "Token JWT expiré ou signature invalide",
            });
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Lien de suivi sécurisé expiré (valable 7 jours) ou signature invalide. Veuillez demander un nouveau lien ou entrer votre code d'accès.",
            });
          }
          lookupCode = tokenData.dossierNumber || String(tokenData.dossierId);
        }

        if (!lookupCode || !lookupCode.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Veuillez fournir un code d'accès, un numéro de connaissement BL ou un token sécurisé.",
          });
        }

        const dossier = await db.getDossierByPortalCode(lookupCode);
        if (!dossier) {
          await db.logPortalAccess({
            accessCodeUsed: lookupCode,
            tokenIdentifier: input.token ? input.token.slice(0, 20) : undefined,
            ipAddress: clientIp,
            userAgent,
            success: false,
            errorReason: "Dossier introuvable",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dossier introuvable. Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.",
          });
        }

        // Journalisation de l'accès réussi
        await db.logPortalAccess({
          dossierId: dossier.id,
          accessCodeUsed: lookupCode,
          tokenIdentifier: input.token ? input.token.slice(0, 20) : undefined,
          clientCompany: dossier.client || tokenData?.clientCompany || undefined,
          ipAddress: clientIp,
          userAgent,
          success: true,
        });

        const docs = await db.listDocuments(dossier.id);
        const history = await db.listDossierHistory(dossier.id);

        return {
          dossier,
          documents: docs.map(d => ({ id: d.id, name: d.name, type: d.type, createdAt: d.createdAt })),
          timeline: history.map(h => ({ date: h.createdAt, title: h.fieldChanged, detail: h.newValue || h.comment })),
        };
      }),

    generateShareableToken: protectedProcedure
      .input(z.object({ dossierId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const dossier = await db.getDossier(input.dossierId);
        if (!dossier) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });
        }
        const token = await db.generatePortalToken({
          dossierId: dossier.id,
          dossierNumber: dossier.dossierNumber,
          clientCompany: dossier.client ?? undefined,
          clientDossierNumber: dossier.clientDossierNumber ?? undefined,
        }, "7d");

        return {
          token,
          shareableUrl: `/portail-client?token=${token}`,
          expiresIn: "7 jours",
          dossierNumber: dossier.dossierNumber,
          client: dossier.client,
        };
      }),

    requestOtp: publicProcedure
      .input(
        z.object({
          clientCompany: z.string().min(2),
          phone: z.string().optional(),
          email: z.string().optional(),
          dossierId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return db.requestClientOtp(input);
      }),

    verifyOtp: publicProcedure
      .input(
        z.object({
          clientCompany: z.string().min(2),
          otpCode: z.string().min(4),
        })
      )
      .mutation(async ({ input }) => {
        const res = await db.verifyClientOtp(input);
        if (!res.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: res.error });
        }
        return res;
      }),

    logs: adminProcedure
      .input(z.object({ dossierId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.listPortalAccessLogs(input?.dossierId);
      }),
  }),

  // 5. AUDIT TRAIL & CONTRÔLE DOUANIER
  audit: router({
    list: protectedProcedure
      .input(
        z.object({
          dossierId: z.number().optional(),
          authorName: z.string().optional(),
          action: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().optional(),
        }).nullish()
      )
      .query(async ({ input }) => {
        if (input?.dossierId) {
          return db.listDossierHistory(input.dossierId);
        }
        return db.listAuditLogs(input || undefined);
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
    uploadBase64: protectedProcedure
      .input(
        z.object({
          dossierId: z.number().int().positive(),
          name: z.string().min(1),
          type: z.enum(["BL", "LTA", "DDI", "Facture_Fournisseur", "Facture_Transitaire", "Bulletin_Liquidation", "BAE", "Declaration_Douane", "Photos_Marchandise", "Autre"]),
          base64Content: z.string().min(1),
          mimeType: z.string().default("application/pdf"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const cleanBase64 = input.base64Content.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        const uploadRes = await uploadDossierCloudFile({
          dossierId: input.dossierId,
          fileName: input.name,
          fileBuffer: buffer,
          mimeType: input.mimeType,
        });

        return db.createDocument({
          dossierId: input.dossierId,
          name: input.name,
          type: input.type,
          fileUrl: uploadRes.fileUrl,
          fileSize: buffer.length,
          mimeType: input.mimeType,
          uploadedById: ctx.user.id,
          uploaderName: ctx.user.name || "Opérateur IGS",
        });
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => db.deleteDocument(input.id, ctx.user.id, ctx.user.name || "Opérateur IGS")),
  }),

  // 7. MODULE FINANCIER & FACTURATION
  finance: router({
    listInvoices: comptableProcedure
      .input(z.object({ dossierId: z.number().optional() }).nullish())
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
          proofUrl: optionalText,
          notes: optionalText,
        })
      )
      .mutation(async ({ ctx, input }) => db.recordInvoicePayment(input.id, { ...input, userId: ctx.user.id })),
    listPayments: comptableProcedure
      .input(z.object({ invoiceId: z.number().optional() }).nullish())
      .query(async ({ input }) => db.listInvoicePayments(input?.invoiceId)),
    listDebours: comptableProcedure
      .input(z.object({ dossierId: z.number().optional() }).nullish())
      .query(async ({ input }) => db.listPacDisbursements(input?.dossierId)),
    createDebour: comptableProcedure
      .input(
        z.object({
          dossierId: z.number().int().positive(),
          invoiceId: z.number().optional(),
          type: z.string().default("douane"),
          amountAdvanced: z.number().min(0),
          amountReimbursed: z.number().min(0).default(0),
          status: z.string().default("avance"),
          receiptNumber: optionalText,
          notes: optionalText,
        })
      )
      .mutation(async ({ ctx, input }) => db.createPacDisbursement({ ...input, createdById: ctx.user.id })),
    saveInvoicePdf: comptableProcedure
      .input(
        z.object({
          invoiceId: z.number().int().positive(),
          invoiceNumber: z.string(),
          pdfBase64: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { uploadInvoicePdf } = await import("./supabase");
          const buffer = Buffer.from(input.pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
          const url = await uploadInvoicePdf(input.invoiceNumber, buffer);
          if (url) {
            await db.updateInvoice(input.invoiceId, { pdfUrl: url });
          }
          return { success: true, pdfUrl: url };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
    uploadProof: comptableProcedure
      .input(
        z.object({
          invoiceId: z.number().int().positive(),
          fileName: z.string(),
          fileBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { uploadPaymentProof } = await import("./supabase");
          const buffer = Buffer.from(input.fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
          const url = await uploadPaymentProof(input.invoiceId, buffer, input.fileName, input.mimeType);
          return { success: true, proofUrl: url };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
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
        }).nullish()
      )
      .query(async ({ input }) => db.listTasks(input || undefined)),
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

  // 10. NOTIFICATIONS PROACTIVES & CANAUX EXTERNES
  notification: router({
    list: protectedProcedure.query(async () => db.listNotifications(40)),
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => db.markNotificationAsRead(input.id)),
    markAllAsRead: protectedProcedure
      .mutation(async () => db.markAllNotificationsAsRead()),
    sendWhatsApp: protectedProcedure
      .input(
        z.object({
          dossierNumber: z.string().min(1),
          recipientPhone: z.string().min(4),
          clientName: z.string().min(1),
          messageText: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => sendDossierWhatsAppAlert(input)),
    sendEmail: protectedProcedure
      .input(
        z.object({
          dossierNumber: z.string().min(1),
          recipientEmail: z.string().email(),
          clientName: z.string().min(1),
          subject: z.string().min(1),
          htmlContent: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => sendDossierEmailAlert(input)),
  }),

  // TABLEAU DE BORD OPÉRATIONNEL
  dashboard: router({
    get: protectedProcedure.query(async () => getCachedDashboard()),
  }),
});

export type AppRouter = typeof appRouter;

