import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
  etaFrom: z.date().optional(),
  etaTo: z.date().optional(),
}).optional();

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
  auth: router({
    me: publicProcedure.query(options => options.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  reference: router({
    list: protectedProcedure.input(z.object({ category: z.string().optional() }).optional()).query(async ({ input }) => db.getReferenceItems(input?.category)),
  }),
  dossier: router({
    list: protectedProcedure.input(filtersSchema).query(async ({ input }) => db.listDossiers(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => db.getDossier(input.id)),
    create: adminProcedure.input(dossierPayload).mutation(async ({ ctx, input }) => db.createDossier(input, ctx.user.id)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: dossierPayload })).mutation(async ({ ctx, input }) => db.updateDossier(input.id, input.data, ctx.user.id)),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => db.deleteDossier(input.id)),
  }),
  dashboard: router({
    get: protectedProcedure.query(async () => buildDashboard(await db.listDossiers())),
  }),
});

export type AppRouter = typeof appRouter;
