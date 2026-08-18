import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import * as db from "../../db";

function makeContext(
  role: "admin" | "declarant" | "comptable" | "client" | "manager" | "user" | null,
  clientCompany: string | null = null
): TrpcContext {
  if (!role) {
    return {
      req: { headers: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: null as any,
    };
  }

  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: role === "admin" ? 1 : role === "declarant" ? 2 : role === "comptable" ? 3 : role === "manager" ? 5 : role === "client" ? 4 : 6,
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

describe("Empirical Challenger 1 — Milestone 1 Backend & RBAC Adversarial Matrix", () => {
  const anonCaller = appRouter.createCaller(makeContext(null));
  const userCaller = appRouter.createCaller(makeContext("user"));
  const clientCaller = appRouter.createCaller(makeContext("client", "Guinean Birimian Gold S.A"));
  const foreignClientCaller = appRouter.createCaller(makeContext("client", "Société Minière de Boké"));
  const declarantCaller = appRouter.createCaller(makeContext("declarant"));
  const comptableCaller = appRouter.createCaller(makeContext("comptable"));
  const managerCaller = appRouter.createCaller(makeContext("manager"));
  const adminCaller = appRouter.createCaller(makeContext("admin"));

  describe("DIMENSION 1: Strict RBAC Boundaries & Unauthorized Access Rejection", () => {
    it("Anonymous (unauthenticated) requests are rejected with UNAUTHORIZED on all protected endpoints", async () => {
      // Dossier endpoints
      await expect(anonCaller.dossier.list()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.get({ id: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.create({ client: "Test" })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.update({ id: 1, data: { client: "Test" } })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.updateCustoms({ id: 1, data: { badStatus: "Obtenu" } })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.remove({ id: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dossier.importBatch([])).rejects.toThrow(UNAUTHED_ERR_MSG);

      // Finance endpoints
      await expect(anonCaller.finance.listInvoices()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.createInvoice({ dossierId: 1, client: "Test", amountHt: 1000, amountTtc: 1180 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.updateInvoice({ id: 1, data: { notes: "Test" } })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.recordPayment({ id: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.getExchangeRate()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.setExchangeRate({ rate: 8700 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.finance.summary()).rejects.toThrow(UNAUTHED_ERR_MSG);

      // Task endpoints
      await expect(anonCaller.task.list()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.task.create({ dossierId: 1, title: "Test" })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.task.updateStatus({ id: 1, status: "Termine" })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.task.toggleStatus({ id: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);

      // Reference, Document, Audit, Notification, Dashboard
      await expect(anonCaller.reference.list()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.reference.create({ category: "test", label: "test" })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.document.list({ dossierId: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.audit.list({ dossierId: 1 })).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.notification.list()).rejects.toThrow(UNAUTHED_ERR_MSG);
      await expect(anonCaller.dashboard.get()).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("Anonymous can access public endpoints (auth.me, portal.track)", async () => {
      const me = await anonCaller.auth.me();
      expect(me).toBeNull();

      // Public tracking endpoint
      const trackRes = await anonCaller.portal.track({ accessCodeOrNumber: "DOS-0001" });
      expect(trackRes.dossier).toBeDefined();
      expect(trackRes.timeline).toBeDefined();
      expect(trackRes.documents).toBeDefined();
    });

    it("Role 'declarant' is forbidden from all financial management actions and admin deletions", async () => {
      await expect(declarantCaller.finance.listInvoices()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.createInvoice({
        dossierId: 1,
        client: "Birimian Gold",
        amountHt: 5000000,
        amountTtc: 5900000,
      })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.updateInvoice({ id: 1, data: { status: "Payée" } })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.recordPayment({ id: 1 })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.setExchangeRate({ rate: 8900 })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");

      // Admin only
      await expect(declarantCaller.dossier.remove({ id: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
      await expect(declarantCaller.reference.create({ category: "test", label: "test" })).rejects.toThrow(NOT_ADMIN_ERR_MSG);

      // Declarant is allowed to read exchange rate (internalProcedure)
      const rateInfo = await declarantCaller.finance.getExchangeRate();
      expect(rateInfo.rate).toBeGreaterThan(0);
    });

    it("Role 'comptable' is forbidden from customs updates, batch imports, and admin deletions", async () => {
      await expect(comptableCaller.dossier.updateCustoms({
        id: 1,
        data: { ddiGucegNumber: "DDI-FORBIDDEN-01", badStatus: "Obtenu" },
      })).rejects.toThrow("Accès refusé pour ce profil");

      await expect(comptableCaller.dossier.importBatch([
        { client: "Test", transportMode: "Maritime", blLtaNumber: "BL-FORBIDDEN" }
      ])).rejects.toThrow("Accès refusé pour ce profil");

      await expect(comptableCaller.dossier.remove({ id: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
      await expect(comptableCaller.reference.create({ category: "test", label: "test" })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
    });

    it("Role 'client' is strictly isolated and forbidden from all internal operational actions", async () => {
      // Forbidden mutations
      await expect(clientCaller.dossier.create({ client: "Hacked Company" })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.dossier.update({ id: 1, data: { cargoNature: "Illegal" } })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.dossier.updateCustoms({ id: 1, data: { badStatus: "Obtenu" } })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.dossier.remove({ id: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
      await expect(clientCaller.dossier.importBatch([])).rejects.toThrow("Accès refusé pour ce profil");

      // Forbidden task actions
      await expect(clientCaller.task.create({ dossierId: 1, title: "Client Task" })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.task.updateStatus({ id: 1, status: "Termine" })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.task.toggleStatus({ id: 1 })).rejects.toThrow("Accès refusé pour ce profil");

      // Forbidden finance actions
      await expect(clientCaller.finance.listInvoices()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.finance.createInvoice({ dossierId: 1, client: "Test", amountHt: 1000, amountTtc: 1180 })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.finance.getExchangeRate()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(clientCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");
    });

    it("Role 'client' cannot access another company's dossier via dossier.get", async () => {
      const allDossiers = await adminCaller.dossier.list();
      const foreignDossier = allDossiers.find(d => d.client && !d.client.includes("Birimian"));
      expect(foreignDossier).toBeDefined();

      if (foreignDossier) {
        await expect(clientCaller.dossier.get({ id: foreignDossier.id })).rejects.toThrow("Accès refusé pour ce dossier");
      }
    });

    it("Generic 'user' role is blocked by declarantProcedure, comptableProcedure, and internalProcedure", async () => {
      await expect(userCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(userCaller.dossier.updateCustoms({ id: 1, data: { badStatus: "Obtenu" } })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(userCaller.dossier.create({ client: "User Co" })).rejects.toThrow("Accès refusé pour ce profil");
      await expect(userCaller.task.create({ dossierId: 1, title: "User Task" })).rejects.toThrow("Accès refusé pour ce profil");
    });
  });

  describe("DIMENSION 2: Operational Tasks Lifecycle, Status Toggling & Persistence", () => {
    it("creates, toggles, updates status and verifies completedAt state transitions and query persistence", async () => {
      // 1. Create a task assigned to Mamadou Diallo
      const created = await declarantCaller.task.create({
        dossierId: 3,
        title: "Vérifier déclaration Sydonia pour DOS-0003",
        assignedTo: "Mamadou Diallo",
        priority: "Haute",
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe("A_faire");
      expect(created.completedAt).toBeNull();

      // 2. Toggle to Termine without passing explicit status
      const toggled1 = await declarantCaller.task.toggleStatus({ id: created.id });
      expect(toggled1.status).toBe("Termine");
      expect(toggled1.completedAt).toBeInstanceOf(Date);

      // 3. Toggle back to A_faire without passing explicit status
      const toggled2 = await declarantCaller.task.toggleStatus({ id: created.id });
      expect(toggled2.status).toBe("A_faire");
      expect(toggled2.completedAt).toBeNull();

      // 4. Update status explicitly to 'En_cours'
      const updatedEnCours = await declarantCaller.task.updateStatus({ id: created.id, status: "En_cours" });
      expect(updatedEnCours.status).toBe("En_cours");
      expect(updatedEnCours.completedAt).toBeNull();

      // 5. Update status explicitly to 'Bloque'
      const updatedBloque = await declarantCaller.task.updateStatus({ id: created.id, status: "Bloque" });
      expect(updatedBloque.status).toBe("Bloque");
      expect(updatedBloque.completedAt).toBeNull();

      // 6. Update status explicitly to 'Termine'
      const updatedTermine = await declarantCaller.task.updateStatus({ id: created.id, status: "Termine" });
      expect(updatedTermine.status).toBe("Termine");
      expect(updatedTermine.completedAt).toBeInstanceOf(Date);

      // 7. Verify persistence across task.list with specific filters
      const listByDossierAndUser = await declarantCaller.task.list({
        dossierId: 3,
        assignedTo: "Mamadou",
        status: "Termine",
      });
      const found = listByDossierAndUser.find(t => t.id === created.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe("Termine");
      expect(found?.completedAt).toBeInstanceOf(Date);
    });

    it("verifies task filtering by assignedTo is case-insensitive and supports substring matching", async () => {
      await declarantCaller.task.create({
        dossierId: 1,
        title: "Tâche filtre Diallo lowercase",
        assignedTo: "Mamadou Diallo",
      });

      const resultsLower = await declarantCaller.task.list({ assignedTo: "mamadou" });
      expect(resultsLower.length).toBeGreaterThan(0);
      expect(resultsLower.every(t => t.assignedTo?.toLowerCase().includes("mamadou"))).toBe(true);

      const resultsUpper = await declarantCaller.task.list({ assignedTo: "MAMADOU" });
      expect(resultsUpper.length).toBe(resultsLower.length);
    });
  });

  describe("DIMENSION 3: Financial Engine, Multi-Currency, Débours & Payment Quittance", () => {
    it("handles GNF & USD currency rates, TVA 18%, débours separation and summary calculations", async () => {
      // 1. Set known exchange rate
      await comptableCaller.finance.setExchangeRate({ rate: 8650 });
      const rateInfo = await comptableCaller.finance.getExchangeRate();
      expect(rateInfo.rate).toBe(8650);

      // 2. Create GNF invoice
      const gnfInvoice = await comptableCaller.finance.createInvoice({
        dossierId: 10,
        client: "Birimian Mining GNF",
        currency: "GNF",
        invoiceType: "Proforma",
        amountHt: 20_000_000,
        amountTva: 3_600_000, // 18% of 20M
        amountTtc: 23_600_000,
        customsDutiesAmount: 40_000_000,
        portFeesAmount: 10_000_000,
        disbursementsAmount: 50_000_000,
        status: "Proforma",
      });
      expect(gnfInvoice.amountTva).toBe(3_600_000);
      expect(gnfInvoice.amountTtc).toBe(23_600_000);
      expect(gnfInvoice.disbursementsAmount).toBe(50_000_000);

      // 3. Create USD invoice
      const usdInvoice = await comptableCaller.finance.createInvoice({
        dossierId: 11,
        client: "Overseas Freight USD",
        currency: "USD",
        exchangeRate: 8650,
        invoiceType: "Proforma",
        amountHt: 10_000,
        amountTva: 1_800,
        amountTtc: 11_800,
        customsDutiesAmount: 5_000,
        portFeesAmount: 2_000,
        disbursementsAmount: 7_000,
        status: "Proforma",
      });
      expect(usdInvoice.currency).toBe("USD");
      expect(usdInvoice.amountTtc).toBe(11_800);

      // 4. Verify finance.summary aggregates
      const summary = await comptableCaller.finance.summary();
      expect(summary.exchangeRate).toBe(8650);
      expect(summary.totalCA_GNF).toBeGreaterThanOrEqual(23_600_000 + 11_800 * 8650);
      expect(summary.totalCA_USD).toBeGreaterThanOrEqual(11_800 + Math.round(23_600_000 / 8650));
      expect(summary.totalCustomsDuties_GNF).toBeGreaterThan(0);
      expect(summary.totalPortFees_GNF).toBeGreaterThan(0);
    });

    it("records payment, generates receiptNumber REC-2026-X, sets definitive status, and synchronizes dossier", async () => {
      // 1. Create proforma invoice for dossier 12
      const invoice = await comptableCaller.finance.createInvoice({
        dossierId: 12,
        client: "Mining Corp Guinée",
        currency: "GNF",
        invoiceType: "Proforma",
        amountHt: 15_000_000,
        amountTtc: 17_700_000,
        status: "Proforma",
      });

      // Initial dossier financialStatus should be 'Fact. Proforma'
      const initialDossier = await adminCaller.dossier.get({ id: 12 });
      expect(initialDossier.financialStatus).toBe("Fact. Proforma");

      // 2. Record payment
      const payment = await comptableCaller.finance.recordPayment({
        id: invoice.id,
        paymentMethod: "Chèque Écocash BCI Guinée",
        paymentReference: "CHQ-BCI-99281",
        paidAmount: 17_700_000,
      });

      expect(payment.status).toBe("Payée");
      expect(payment.invoiceType).toBe("Definitive");
      expect(payment.receiptNumber).toBe(`REC-2026-${invoice.id}`);
      expect(payment.paymentMethod).toBe("Chèque Écocash BCI Guinée");
      expect(payment.paymentReference).toBe("CHQ-BCI-99281");
      expect(payment.paidAt).toBeInstanceOf(Date);

      // 3. Verify associated dossier financialStatus is synchronized to 'Payé'
      const updatedDossier = await adminCaller.dossier.get({ id: 12 });
      expect(updatedDossier.financialStatus).toBe("Payé");

      // 4. Verify audit trail has recorded the payment
      const history = await adminCaller.audit.list({ dossierId: 12 });
      const paymentHistory = history.find(h => h.fieldChanged === "Paiement Facture");
      expect(paymentHistory).toBeDefined();
      expect(paymentHistory?.newValue).toContain(`REC-2026-${invoice.id}`);
    });
  });

  describe("DIMENSION 4: Customs Lifecycle & Déclarant PAC Capabilities", () => {
    it("allows declarant to update customs fields (DDI GUCEG, Sydonia, BAD, BAE) and recalculates completion", async () => {
      const created = await declarantCaller.dossier.create({
        clientDossierNumber: "CLT-REF-2026-99",
        client: "Birimian Gold",
        transportMode: "Maritime",
        cargoNature: "Conteneurs Réactifs",
        blLtaNumber: "BL-CUSTOMS-M1-ADV",
        eta: new Date("2026-08-01"),
        originPort: "Anvers",
        destinationPort: "Port Autonome de Conakry",
        container: "4x 20ft DRY",
      });

      expect(created.calculatedStatus).toBe("À régulariser");

      // Declarant updates remaining required customs IDs & release date
      const updated = await declarantCaller.dossier.updateCustoms({
        id: created.id,
        data: {
          ddiGucegNumber: "DDI-2026-GUCEG-777",
          declarationNumber: "S 777- 18/08/2026",
          bulletinNumber: "L 777- 18/08/2026",
          badStatus: "Obtenu",
          baeStatus: "Accordé",
          goodsReleaseDate: new Date("2026-08-05"),
        },
      });

      expect(updated.ddiGucegNumber).toBe("DDI-2026-GUCEG-777");
      expect(updated.declarationNumber).toBe("S 777- 18/08/2026");
      expect(updated.bulletinNumber).toBe("L 777- 18/08/2026");
      expect(updated.badStatus).toBe("Obtenu");
      expect(updated.baeStatus).toBe("Accordé");
      expect(updated.calculatedStatus).toBe("Régularisé");
      expect(updated.completionRate).toBe(100);
    });
  });
});
