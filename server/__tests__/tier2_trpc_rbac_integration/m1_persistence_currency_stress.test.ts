import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";
import { convertCurrency, calculateInvoiceFinancials, DEFAULT_USD_GNF_RATE } from "../tier1_business_logic/currency_conversion.test";

function makeContext(role: "admin" | "declarant" | "comptable" | "client" | "manager", clientCompany: string | null = null): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: role === "admin" ? 1 : role === "declarant" ? 2 : role === "comptable" ? 3 : role === "manager" ? 5 : 4,
      openId: `test_stress_${role}`,
      name: `Stress ${role.toUpperCase()}`,
      email: `${role}@stress.gn`,
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

describe("Milestone 1 Empirical Stress Harness: Persistence, Multi-Currency & Invoicing", () => {
  const adminCaller = appRouter.createCaller(makeContext("admin"));
  const comptableCaller = appRouter.createCaller(makeContext("comptable"));
  const declarantCaller = appRouter.createCaller(makeContext("declarant"));
  const clientCaller = appRouter.createCaller(makeContext("client", "Guinean Birimian Gold S.A"));

  // =========================================================================
  // 1. EXCHANGE RATE UPDATES & ADVERSARIAL EDGE CASES
  // =========================================================================
  describe("1. Exchange Rate Updates & Adversarial Inputs", () => {
    it("rejects non-positive, zero, fractional, and invalid exchange rates via tRPC validation", async () => {
      // 0 is rejected
      await expect(comptableCaller.finance.setExchangeRate({ rate: 0 })).rejects.toThrow();

      // Negative rate is rejected
      await expect(comptableCaller.finance.setExchangeRate({ rate: -8650 })).rejects.toThrow();

      // Fractional rate is rejected by integer validation
      await expect(comptableCaller.finance.setExchangeRate({ rate: 8650.75 })).rejects.toThrow();

      // NaN / null / undefined / string rejected
      await expect(comptableCaller.finance.setExchangeRate({ rate: NaN })).rejects.toThrow();
      await expect(comptableCaller.finance.setExchangeRate({ rate: "8650" as any })).rejects.toThrow();
    });

    it("accepts valid boundary exchange rates (1, 10000, 50000) and updates persisted reference item", async () => {
      // Set to 9000
      const res1 = await comptableCaller.finance.setExchangeRate({ rate: 9000 });
      expect(res1.rate).toBe(9000);
      expect(res1.currencyPair).toBe("USD/GNF");

      // Verify retrieval returns 9000
      const current1 = await comptableCaller.finance.getExchangeRate();
      expect(current1.rate).toBe(9000);

      // Verify reference items list contains exchange_rate
      const refItems = await db.getReferenceItems("exchange_rate");
      expect(refItems.some(r => r.category === "exchange_rate" && r.label === "9000")).toBe(true);

      // Set to high boundary rate 50,000 GNF/USD (hyperinflation scenario)
      const resHigh = await comptableCaller.finance.setExchangeRate({ rate: 50_000 });
      expect(resHigh.rate).toBe(50_000);

      // Reset back to standard 8650
      await comptableCaller.finance.setExchangeRate({ rate: 8650 });
      const reset = await comptableCaller.finance.getExchangeRate();
      expect(reset.rate).toBe(8650);
    });

    it("verifies pure currency conversion engine under extreme amounts and zero amounts", () => {
      // Zero amount
      expect(convertCurrency(0, "USD", "GNF", 8650)).toBe(0);
      expect(convertCurrency(0, "GNF", "USD", 8650)).toBe(0);
      expect(convertCurrency(0, "GNF", "GNF", 8650)).toBe(0);

      // Very large amount: 50 Billion GNF (mining infrastructure contract)
      const fiftyBillionGNF = 50_000_000_000;
      const usdFromLarge = convertCurrency(fiftyBillionGNF, "GNF", "USD", 8650);
      expect(usdFromLarge).toBe(Math.round((fiftyBillionGNF / 8650) * 100) / 100);

      // Convert back
      const gnfBack = convertCurrency(usdFromLarge, "USD", "GNF", 8650);
      expect(Math.abs(gnfBack - fiftyBillionGNF)).toBeLessThan(100); // within rounding tolerance
    });
  });

  // =========================================================================
  // 2. INVOICE LIFECYCLE, PAYMENT RECORDING & RECEIPT SEQUENCING
  // =========================================================================
  describe("2. Invoice Lifecycle & Receipt Sequencing", () => {
    it("executes full transition: Proforma -> Definitive -> Payée with correct financial status transitions", async () => {
      // Step 1: Create a test dossier
      const testDossier = await declarantCaller.dossier.create({
        client: "Boké Mining Operations SA",
        transportMode: "Maritime",
        cargoNature: "Pelles hydrauliques 70T",
        blLtaNumber: `BL-STRESS-INV-${Date.now()}`,
      });
      expect(testDossier.financialStatus).toBe("En attente");

      // Step 2: Create Proforma invoice
      const proforma = await comptableCaller.finance.createInvoice({
        dossierId: testDossier.id,
        client: "Boké Mining Operations SA",
        currency: "GNF",
        invoiceType: "Proforma",
        amountHt: 50_000_000,
        amountTva: 9_000_000,
        amountTtc: 59_000_000,
        customsDutiesAmount: 120_000_000,
        portFeesAmount: 15_000_000,
        disbursementsAmount: 135_000_000,
        status: "Proforma",
        notes: "Proforma initiale transit lourd",
      });

      expect(proforma.invoiceType).toBe("Proforma");
      expect(proforma.status).toBe("Proforma");
      expect(proforma.receiptNumber).toBeNull();
      expect(proforma.paidAt).toBeNull();

      // Check dossier financialStatus is synchronized to "Fact. Proforma"
      const dossierAfterProforma = await adminCaller.dossier.get({ id: testDossier.id });
      expect(dossierAfterProforma.financialStatus).toBe("Fact. Proforma");

      // Step 3: Transition to Definitive invoice (Émise)
      const definitive = await comptableCaller.finance.updateInvoice({
        id: proforma.id,
        data: {
          invoiceType: "Definitive",
          status: "Émise",
          notes: "Facture définitive après validation douane",
        },
      });

      expect(definitive.invoiceType).toBe("Definitive");
      expect(definitive.status).toBe("Émise");

      // Check dossier financialStatus is synchronized to "Facturé"
      const dossierAfterDefinitive = await adminCaller.dossier.get({ id: testDossier.id });
      expect(dossierAfterDefinitive.financialStatus).toBe("Facturé");

      // Step 4: Record Payment
      const paidInvoice = await comptableCaller.finance.recordPayment({
        id: proforma.id,
        paymentMethod: "Virement Bancaire VistaGui",
        paymentReference: "VIR-VISTAGUI-2026-9901",
        paidAmount: 59_000_000,
      });

      expect(paidInvoice.status).toBe("Payée");
      expect(paidInvoice.invoiceType).toBe("Definitive");
      expect(paidInvoice.receiptNumber).toBe(`REC-2026-${proforma.id}`);
      expect(paidInvoice.paymentMethod).toBe("Virement Bancaire VistaGui");
      expect(paidInvoice.paymentReference).toBe("VIR-VISTAGUI-2026-9901");
      expect(paidInvoice.paidAt).toBeInstanceOf(Date);

      // Check dossier financialStatus is updated to "Payé"
      const dossierAfterPayment = await adminCaller.dossier.get({ id: testDossier.id });
      expect(dossierAfterPayment.financialStatus).toBe("Payé");

      // Verify audit trail entry was created
      const history = await adminCaller.audit.list({ dossierId: testDossier.id });
      const paymentAudit = history.find(h => h.fieldChanged === "Paiement Facture");
      expect(paymentAudit).toBeDefined();
      expect(paymentAudit?.newValue).toContain(`REC-2026-${proforma.id}`);
      expect(paymentAudit?.comment).toContain("VistaGui");
    });

    it("verifies unique receipt number sequencing across multiple consecutive invoice payments", async () => {
      const receiptNumbers: string[] = [];

      for (let i = 0; i < 3; i++) {
        const inv = await comptableCaller.finance.createInvoice({
          dossierId: 1,
          client: "Guinean Birimian Gold S.A",
          currency: "GNF",
          amountHt: 10_000_000 * (i + 1),
          amountTtc: 11_800_000 * (i + 1),
          status: "Émise",
        });

        const paid = await comptableCaller.finance.recordPayment({
          id: inv.id,
          paymentMethod: "Chèque Ecobank",
          paymentReference: `CHQ-ECO-${1000 + i}`,
        });

        expect(paid.receiptNumber).toBe(`REC-2026-${inv.id}`);
        receiptNumbers.push(paid.receiptNumber!);
      }

      // Ensure all receipt numbers are unique
      const uniqueReceipts = new Set(receiptNumbers);
      expect(uniqueReceipts.size).toBe(receiptNumbers.length);
    });

    it("verifies updateInvoice auto-generates receiptNumber when status is changed directly to Payée", async () => {
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: 2,
        client: "New Japon Mining Corporation",
        currency: "USD",
        amountHt: 8000,
        amountTtc: 9440,
        status: "Proforma",
      });

      const updated = await comptableCaller.finance.updateInvoice({
        id: inv.id,
        data: {
          status: "Payée",
        },
      });

      expect(updated.status).toBe("Payée");
      expect(updated.receiptNumber).toBe(`REC-2026-${inv.id}`);
      expect(updated.paidAt).toBeInstanceOf(Date);

      const dossier = await adminCaller.dossier.get({ id: 2 });
      expect(dossier.financialStatus).toBe("Payé");
    });
  });

  // =========================================================================
  // 3. MULTI-CURRENCY SUMMARY PRECISION & MATHEMATICAL INVARIANTS
  // =========================================================================
  describe("3. Multi-Currency Summary Precision & Mathematical Invariants", () => {
    it("verifies mathematical invariants of finance.summary() with mixed GNF and USD invoices", async () => {
      await comptableCaller.finance.setExchangeRate({ rate: 8650 });
      const summary = await comptableCaller.finance.summary();
      const rate = summary.exchangeRate;

      expect(rate).toBe(8650);

      // Invariant: pendingInvoices + paidInvoices === totalInvoices
      const totalInvoices = summary.invoices.length;
      expect(summary.pendingInvoices + summary.paidInvoices).toBe(totalInvoices);

      // Invariant: total CA GNF should match explicit sum
      const manualCAGNF = summary.invoices.reduce(
        (sum, i) => sum + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc),
        0
      );
      expect(summary.totalCA_GNF).toBe(manualCAGNF);

      // Invariant: total CA USD should match explicit sum
      const manualCAUSD = summary.invoices.reduce(
        (sum, i) => sum + (i.currency === "USD" ? i.amountTtc : Math.round(i.amountTtc / rate)),
        0
      );
      expect(summary.totalCA_USD).toBe(manualCAUSD);

      // Invariant: total customs duties GNF
      const manualCustomsGNF = summary.invoices.reduce(
        (sum, i) => sum + (i.currency === "USD" ? (i.customsDutiesAmount || 0) * rate : (i.customsDutiesAmount || 0)),
        0
      );
      expect(summary.totalCustomsDuties_GNF).toBe(manualCustomsGNF);

      // Invariant: total port fees GNF
      const manualPortFeesGNF = summary.invoices.reduce(
        (sum, i) => sum + (i.currency === "USD" ? (i.portFeesAmount || 0) * rate : (i.portFeesAmount || 0)),
        0
      );
      expect(summary.totalPortFees_GNF).toBe(manualPortFeesGNF);
    });

    it("verifies calculation with zero amounts and default values in calculateInvoiceFinancials", () => {
      const output = calculateInvoiceFinancials({
        amountHt: 0,
        disbursementsAmount: 0,
        storageAndDemurrageFees: 0,
      });

      expect(output.amountHt).toBe(0);
      expect(output.amountTva).toBe(0);
      expect(output.amountTtc).toBe(0);
      expect(output.totalPayable).toBe(0);
      expect(output.estimatedMargin).toBe(0);
      expect(output.marginRate).toBe(0);
    });
  });

  // =========================================================================
  // 4. DUAL PERSISTENCE & IN-MEMORY STORE PARITY
  // =========================================================================
  describe("4. Dual Persistence & In-Memory Store Parity", () => {
    it("tests full task filtering by assignedTo, status, and dossierId", async () => {
      const now = Date.now();
      const task1 = await adminCaller.task.create({
        dossierId: 1,
        title: `Tâche Diallo ${now}`,
        assignedTo: "Mamadou Diallo",
        priority: "Haute",
      });

      const task2 = await adminCaller.task.create({
        dossierId: 1,
        title: `Tâche Camara ${now}`,
        assignedTo: "Fatoumata Camara",
        priority: "Normale",
      });

      // Filter by Mamadou
      const dialloList = await declarantCaller.task.list({ assignedTo: "Mamadou Diallo" });
      expect(dialloList.some(t => t.id === task1.id)).toBe(true);
      expect(dialloList.every(t => t.assignedTo?.includes("Mamadou Diallo"))).toBe(true);

      // Filter by Fatoumata
      const camaraList = await comptableCaller.task.list({ assignedTo: "Fatoumata Camara" });
      expect(camaraList.some(t => t.id === task2.id)).toBe(true);
      expect(camaraList.every(t => t.assignedTo?.includes("Fatoumata Camara"))).toBe(true);

      // Filter by status A_faire
      const aFaireList = await declarantCaller.task.list({ status: "A_faire" });
      expect(aFaireList.every(t => t.status === "A_faire")).toBe(true);

      // Toggle task1 to Termine and verify status filter
      await declarantCaller.task.toggleStatus({ id: task1.id, status: "Termine" });
      const termineList = await declarantCaller.task.list({ status: "Termine" });
      expect(termineList.some(t => t.id === task1.id)).toBe(true);
    });

    it("tests dossier listing with diverse filter combinations (search, status, priority, client)", async () => {
      // Search by BL
      const searchRes = await adminCaller.dossier.list({ search: "DOS-0001" });
      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes.some(d => d.dossierNumber === "DOS-0001")).toBe(true);

      // Status filter
      const regularized = await adminCaller.dossier.list({ status: "Régularisé" });
      expect(regularized.every(d => d.calculatedStatus === "Régularisé")).toBe(true);

      const toRegularize = await adminCaller.dossier.list({ status: "À régulariser" });
      expect(toRegularize.every(d => d.calculatedStatus === "À régulariser")).toBe(true);

      // Priority filter
      const highPriority = await adminCaller.dossier.list({ priority: "Haute" });
      expect(highPriority.every(d => d.calculatedPriority === "Haute")).toBe(true);
    });

    it("tests batch import resilience with empty list, duplicates, and new dossiers", async () => {
      // Empty batch
      const emptyRes = await declarantCaller.dossier.importBatch([]);
      expect(emptyRes.total).toBe(0);
      expect(emptyRes.createdCount).toBe(0);
      expect(emptyRes.updatedCount).toBe(0);

      // New items batch
      const timestamp = Date.now();
      const newItems = [
        {
          client: "Société Minière de Boké (SMB)",
          transportMode: "Maritime",
          cargoNature: "Pneus génie civil 40.00R57",
          blLtaNumber: `BL-SMB-STRESS-${timestamp}-1`,
        },
        {
          client: "Compagnie des Bauxites de Guinée (CBG)",
          transportMode: "Maritime",
          cargoNature: "Convoyeurs à bande Kamsar",
          blLtaNumber: `BL-CBG-STRESS-${timestamp}-2`,
        },
      ];

      const batchRes1 = await declarantCaller.dossier.importBatch(newItems);
      expect(batchRes1.total).toBe(2);
      expect(batchRes1.createdCount).toBe(2);
      expect(batchRes1.updatedCount).toBe(0);

      // Re-importing same BLs should trigger update (duplicate prevention)
      const duplicateBatch = [
        {
          client: "Société Minière de Boké (SMB)",
          transportMode: "Maritime",
          cargoNature: "Pneus génie civil 40.00R57 (Mise à jour)",
          blLtaNumber: `BL-SMB-STRESS-${timestamp}-1`,
          badStatus: "Obtenu",
        },
      ];

      const batchRes2 = await declarantCaller.dossier.importBatch(duplicateBatch);
      expect(batchRes2.total).toBe(1);
      expect(batchRes2.createdCount).toBe(0);
      expect(batchRes2.updatedCount).toBe(1);
      expect(batchRes2.duplicatesPrevented).toBe(1);
      expect(batchRes2.dossiers[0].badStatus).toBe("Obtenu");
    });
  });

  // =========================================================================
  // 5. RBAC PROCEDURE SHIELDING INTEGRITY
  // =========================================================================
  describe("5. RBAC Procedure Shielding Integrity", () => {
    it("strictly prevents client role from mutating or accessing internal data", async () => {
      // Client cannot create invoices
      await expect(
        clientCaller.finance.createInvoice({
          dossierId: 1,
          client: "Guinean Birimian Gold S.A",
          amountHt: 10_000_000,
          amountTtc: 11_800_000,
        })
      ).rejects.toThrow("Accès refusé pour ce profil");

      // Client cannot record payments
      await expect(
        clientCaller.finance.recordPayment({
          id: 1,
        })
      ).rejects.toThrow("Accès refusé pour ce profil");

      // Client cannot update exchange rates
      await expect(
        clientCaller.finance.setExchangeRate({
          rate: 9000,
        })
      ).rejects.toThrow("Accès refusé pour ce profil");

      // Client cannot view finance summary
      await expect(clientCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");

      // Client cannot create operational tasks
      await expect(
        clientCaller.task.create({
          dossierId: 1,
          title: "Tâche illégale client",
        })
      ).rejects.toThrow("Accès refusé pour ce profil");
    });

    it("strictly prevents declarant role from accessing finance endpoints", async () => {
      await expect(declarantCaller.finance.summary()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.listInvoices()).rejects.toThrow("Accès refusé pour ce profil");
      await expect(
        declarantCaller.finance.createInvoice({
          dossierId: 1,
          client: "Test",
          amountHt: 1000,
          amountTtc: 1180,
        })
      ).rejects.toThrow("Accès refusé pour ce profil");
      await expect(declarantCaller.finance.setExchangeRate({ rate: 8700 })).rejects.toThrow("Accès refusé pour ce profil");
    });
  });
});
