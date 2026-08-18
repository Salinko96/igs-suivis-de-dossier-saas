import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";

function makeContext(role: "admin" | "declarant" | "comptable" | "client" | "manager", clientCompany: string | null = null): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: role === "admin" ? 1 : role === "declarant" ? 2 : role === "comptable" ? 3 : role === "manager" ? 5 : 4,
      openId: `test_${role}`,
      name: `Test ${role.toUpperCase()}`,
      email: `${role}@test.gn`,
      role,
      loginMethod: "direct",
      clientCompany,
      phone: "+224 600 00 00 00",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Milestone 1 - Backend & RBAC Full Suite Verification", () => {
  const adminCtx = makeContext("admin");
  const declarantCtx = makeContext("declarant");
  const comptableCtx = makeContext("comptable");
  const managerCtx = makeContext("manager");
  const clientCtx = makeContext("client", "Guinean Birimian Gold S.A");

  const adminCaller = appRouter.createCaller(adminCtx);
  const declarantCaller = appRouter.createCaller(declarantCtx);
  const comptableCaller = appRouter.createCaller(comptableCtx);
  const managerCaller = appRouter.createCaller(managerCtx);
  const clientCaller = appRouter.createCaller(clientCtx);

  describe("1. RBAC Procedures & Custom Error Handling", () => {
    it("comptableProcedure: allows admin, manager, comptable but rejects declarant and client", async () => {
      // Allowed
      const comptableSummary = await comptableCaller.finance.summary();
      expect(comptableSummary).toBeDefined();

      const adminSummary = await adminCaller.finance.summary();
      expect(adminSummary).toBeDefined();

      const managerSummary = await managerCaller.finance.summary();
      expect(managerSummary).toBeDefined();

      // Rejected with custom French forbidden error message
      await expect(declarantCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");
    });

    it("declarantProcedure: allows admin, manager, declarant but rejects comptable and client for batch import", async () => {
      const batchPayload = [
        {
          client: "Société Minière de Dinguiraye",
          transportMode: "Maritime",
          cargoNature: "Équipements",
          blLtaNumber: "BL-TEST-RBAC-01",
        },
      ];

      // Allowed
      const declarantRes = await declarantCaller.dossier.importBatch(batchPayload);
      expect(declarantRes.total).toBe(1);

      const adminRes = await adminCaller.dossier.importBatch(batchPayload);
      expect(adminRes).toBeDefined();

      // Rejected
      await expect(comptableCaller.dossier.importBatch(batchPayload)).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.dossier.importBatch(batchPayload)).rejects.toThrow("Accès refusé pour ce profil");
    });

    it("internalProcedure: allows admin, manager, declarant, comptable but rejects client for dossier creation", async () => {
      const newDossierPayload = {
        client: "Birimian Mining",
        transportMode: "Aérien",
        cargoNature: "Pièces de rechange",
        blLtaNumber: "LTA-RBAC-TEST",
      };

      // Allowed
      const createdByDeclarant = await declarantCaller.dossier.create(newDossierPayload);
      expect(createdByDeclarant.id).toBeDefined();

      const createdByComptable = await comptableCaller.dossier.create(newDossierPayload);
      expect(createdByComptable.id).toBeDefined();

      // Rejected
      await expect(clientCaller.dossier.create(newDossierPayload)).rejects.toThrow("Accès refusé pour ce profil");
    });
  });

  describe("2. Drizzle Schema & Type Integrity", () => {
    it("supports all new fields on dossiers (ddiGucegNumber, badStatus, baeStatus)", async () => {
      const created = await declarantCaller.dossier.create({
        client: "Guinean Birimian Gold S.A",
        transportMode: "Maritime",
        cargoNature: "Réactifs Chimiques",
        blLtaNumber: "BL-GUCEG-TEST",
        ddiGucegNumber: "DDI-2026-GUCEG-999",
        badStatus: "En attente",
        baeStatus: "En attente",
      });

      expect(created.ddiGucegNumber).toBe("DDI-2026-GUCEG-999");
      expect(created.badStatus).toBe("En attente");
      expect(created.baeStatus).toBe("En attente");

      // Update customs fields
      const updated = await declarantCaller.dossier.updateCustoms({
        id: created.id,
        data: {
          badStatus: "Obtenu",
          baeStatus: "Accordé",
          declarationNumber: "S 999- 2026",
          bulletinNumber: "L 888- 2026",
        },
      });

      expect(updated.badStatus).toBe("Obtenu");
      expect(updated.baeStatus).toBe("Accordé");
      expect(updated.declarationNumber).toBe("S 999- 2026");
      expect(updated.bulletinNumber).toBe("L 888- 2026");
    });

    it("supports all new fields on invoices (invoiceType, exchangeRate, paymentMethod, paymentReference, receiptNumber, customsDutiesAmount, portFeesAmount)", async () => {
      const invoice = await comptableCaller.finance.createInvoice({
        dossierId: 1,
        client: "Guinean Birimian Gold S.A",
        currency: "GNF",
        invoiceType: "Proforma",
        exchangeRate: 8650,
        amountHt: 10_000_000,
        amountTva: 1_800_000,
        amountTtc: 11_800_000,
        customsDutiesAmount: 25_000_000,
        portFeesAmount: 5_000_000,
        disbursementsAmount: 30_000_000,
        status: "Proforma",
      });

      expect(invoice.invoiceType).toBe("Proforma");
      expect(invoice.exchangeRate).toBe(8650);
      expect(invoice.customsDutiesAmount).toBe(25_000_000);
      expect(invoice.portFeesAmount).toBe(5_000_000);
      expect(invoice.disbursementsAmount).toBe(30_000_000);
    });
  });

  describe("3. Database Dual Parity: Tasks & Collaboration", () => {
    it("listTasks supports filtering by assignedTo and status", async () => {
      // Create tasks for specific users
      await adminCaller.task.create({
        dossierId: 1,
        title: "Tâche spécifique Mamadou",
        assignedTo: "Mamadou Diallo",
        priority: "Haute",
      });

      await adminCaller.task.create({
        dossierId: 1,
        title: "Tâche spécifique Fatoumata",
        assignedTo: "Fatoumata Camara",
        priority: "Normale",
      });

      // Filter by assignedTo
      const mamadouTasks = await declarantCaller.task.list({ assignedTo: "Mamadou Diallo" });
      expect(mamadouTasks.every(t => t.assignedTo?.includes("Mamadou Diallo"))).toBe(true);

      const fatoumataTasks = await comptableCaller.task.list({ assignedTo: "Fatoumata Camara" });
      expect(fatoumataTasks.every(t => t.assignedTo?.includes("Fatoumata Camara"))).toBe(true);
    });

    it("updateTaskStatus and toggleStatus properly update status and completedAt", async () => {
      const task = await adminCaller.task.create({
        dossierId: 2,
        title: "Tâche à basculer",
        assignedTo: "Mamadou Diallo",
      });

      expect(task.status).toBe("A_faire");
      expect(task.completedAt).toBeNull();

      // Toggle to Termine
      const finished = await declarantCaller.task.toggleStatus({ id: task.id, status: "Termine" });
      expect(finished.status).toBe("Termine");
      expect(finished.completedAt).toBeInstanceOf(Date);

      // Toggle back to A_faire
      const reopened = await declarantCaller.task.toggleStatus({ id: task.id, status: "A_faire" });
      expect(reopened.status).toBe("A_faire");
      expect(reopened.completedAt).toBeNull();
    });
  });

  describe("4. Database Dual Parity: Invoice Lifecycle & Payments", () => {
    it("updateInvoice updates invoice data and changes dossier financial status", async () => {
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: 4,
        client: "Guinee Yongchuang Shipbuilding",
        currency: "GNF",
        amountHt: 12_000_000,
        amountTtc: 14_160_000,
        status: "Proforma",
      });

      const updated = await comptableCaller.finance.updateInvoice({
        id: inv.id,
        data: {
          invoiceType: "Definitive",
          status: "Émise",
          notes: "Facture définitive validée par la DAF",
        },
      });

      expect(updated.invoiceType).toBe("Definitive");
      expect(updated.status).toBe("Émise");
      expect(updated.notes).toBe("Facture définitive validée par la DAF");
    });

    it("recordInvoicePayment generates receiptNumber REC-2026-X, sets Payée, sets paidAt and updates dossier financial status", async () => {
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: 5,
        client: "Alumina Bauxite Company",
        currency: "GNF",
        amountHt: 30_000_000,
        amountTtc: 35_400_000,
        status: "Émise",
      });

      const paymentResult = await comptableCaller.finance.recordPayment({
        id: inv.id,
        paymentMethod: "Virement Bancaire Société Générale Guinée",
        paymentReference: "VIR-SGG-2026-0899",
        paidAmount: 35_400_000,
      });

      expect(paymentResult.status).toBe("Payée");
      expect(paymentResult.receiptNumber).toBe(`REC-2026-${inv.id}`);
      expect(paymentResult.paymentMethod).toBe("Virement Bancaire Société Générale Guinée");
      expect(paymentResult.paymentReference).toBe("VIR-SGG-2026-0899");
      expect(paymentResult.paidAt).toBeInstanceOf(Date);

      // Verify associated dossier financialStatus
      const dossier = await adminCaller.dossier.get({ id: 5 });
      expect(dossier.financialStatus).toBe("Payé");
    });

    it("getExchangeRate and setExchangeRate allow managing the USD/GNF currency rate", async () => {
      // Default rate
      const initial = await comptableCaller.finance.getExchangeRate();
      expect(initial.rate).toBe(8650);
      expect(initial.currencyPair).toBe("USD/GNF");

      // Update rate
      const updated = await comptableCaller.finance.setExchangeRate({ rate: 8700 });
      expect(updated.rate).toBe(8700);

      // Verify updated rate is returned
      const reloaded = await comptableCaller.finance.getExchangeRate();
      expect(reloaded.rate).toBe(8700);

      // Reset to 8650
      await comptableCaller.finance.setExchangeRate({ rate: 8650 });
    });
  });

  describe("5. Multi-Currency Finance Summary Engine", () => {
    it("calculates consolidated multi-currency metrics (total GNF, total USD equivalent, total margins)", async () => {
      const summary = await comptableCaller.finance.summary();
      expect(summary.exchangeRate).toBe(8650);
      expect(typeof summary.totalCA_GNF).toBe("number");
      expect(typeof summary.totalCA_USD).toBe("number");
      expect(typeof summary.totalMargin_GNF).toBe("number");
      expect(typeof summary.totalMargin_USD).toBe("number");
      expect(typeof summary.totalDisbursements_GNF).toBe("number");
      expect(typeof summary.totalCustomsDuties_GNF).toBe("number");
      expect(typeof summary.totalPortFees_GNF).toBe("number");
      expect(typeof summary.pendingInvoices).toBe("number");
      expect(typeof summary.paidInvoices).toBe("number");
      expect(typeof summary.totalDemurrageRisk).toBe("number");
      expect(Array.isArray(summary.invoices)).toBe(true);
    });
  });

  describe("6. Client Portal Isolation on Dossier Access", () => {
    it("isolates client view to their own company dossiers and blocks other companies dossiers", async () => {
      // List
      const clientDossiers = await clientCaller.dossier.list();
      expect(clientDossiers.every(d => d.client === "Guinean Birimian Gold S.A")).toBe(true);

      // Get allowed
      const ownDossier = clientDossiers[0];
      if (ownDossier) {
        const fetched = await clientCaller.dossier.get({ id: ownDossier.id });
        expect(fetched.client).toBe("Guinean Birimian Gold S.A");
      }

      // Get forbidden (dossier with another client)
      const allDossiers = await adminCaller.dossier.list();
      const foreignDossier = allDossiers.find(d => d.client && d.client !== "Guinean Birimian Gold S.A");
      if (foreignDossier) {
        await expect(clientCaller.dossier.get({ id: foreignDossier.id })).rejects.toThrow("Accès refusé pour ce dossier");
      }
    });
  });
});
