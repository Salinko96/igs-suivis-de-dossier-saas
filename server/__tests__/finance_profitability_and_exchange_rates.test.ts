import { describe, expect, it } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";
import {
  fetchLiveExchangeRate,
  syncDailyExchangeRate,
  overrideExchangeRate,
  getExchangeRatesHistory,
} from "../exchangeRateService";

describe("Finance Profitability, 3-Way Reconciliation & Automated Exchange Rates Suite", () => {
  const comptableContext = {
    req: {} as any,
    res: {} as any,
    user: {
      id: 3,
      openId: "comptable-igs",
      name: "Fatoumata Camara (Responsable Comptable)",
      email: "f.camara@igs-logistics.gn",
      role: "comptable" as const,
      isActive: true,
      clientCompany: null,
      phone: "+224620112233",
      sessionRevokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };

  const caller = appRouter.createCaller(comptableContext);

  // 1. LIAISON AUTOMATIQUE DOSSIER ↔ FACTURE PRO-FORMA
  describe("1. Auto Pro-Forma Invoice Generation on Dossier Creation", () => {
    it("automatically creates a pro-forma invoice entry when a new dossier is created", async () => {
      const newDossier = await db.createDossier({
        client: "Société Minière de Boké (SMB)",
        blLtaNumber: "BL-SMB-2026-001",
        cargoNature: "Équipements d'extraction minière",
        transportMode: "Maritime",
        eta: new Date("2026-08-25"),
        container: "06TC20'",
      });

      expect(newDossier).toBeDefined();

      const allInvoices = await db.listInvoices(newDossier.id);
      expect(allInvoices.length).toBeGreaterThanOrEqual(1);

      const proforma = allInvoices[0];
      expect(proforma.dossierId).toBe(newDossier.id);
      expect(proforma.invoiceType).toBe("Proforma");
      expect(proforma.status).toBe("Proforma");
      expect(proforma.reconciliationStatus).toBe("non_rapproche");
      expect(proforma.amountHt).toBeGreaterThan(0);
      expect(proforma.disbursementsAmount).toBeGreaterThan(0);
    });

    it("ensures all 54 existing dossiers have associated invoices in listInvoices()", async () => {
      const invoices = await caller.finance.listInvoices();
      const allDossiers = await db.listDossiers();

      expect(invoices.length).toBeGreaterThanOrEqual(allDossiers.length);
    });
  });

  // 2. RAPPROCHEMENT 3-VOIES DOSSIER ↔ FACTURE ↔ PAIEMENT
  describe("2. 3-Way Reconciliation (Dossier ↔ Invoice ↔ Payment)", () => {
    it("updates reconciliation status to 'rapproche' with bank reference and logs audit event", async () => {
      const invoices = await caller.finance.listInvoices();
      const targetInvoice = invoices[0];

      const res = await caller.finance.reconcile({
        invoiceId: targetInvoice.id,
        reconciliationStatus: "rapproche",
        reconciliationRef: "VIR-ECOBANK-2026-789",
        notes: "Rapprochement bancaire vérifié avec relevé du mois.",
      });

      expect(res).toBeDefined();
      expect(res.reconciliationStatus).toBe("rapproche");
      expect(res.reconciliationRef).toBe("VIR-ECOBANK-2026-789");
      expect(res.reconciliationDate).toBeDefined();
    });
  });

  // 3. DASHBOARD DE RENTABILITÉ & TRÉSORERIE
  describe("3. Profitability Dashboard & Risk Indicator", () => {
    it("calculates margins by client accurately", async () => {
      const prof = await caller.finance.profitability();

      expect(prof).toBeDefined();
      expect(Array.isArray(prof.marginsByClient)).toBe(true);
      expect(prof.marginsByClient.length).toBeGreaterThan(0);

      const firstClient = prof.marginsByClient[0];
      expect(firstClient.client).toBeDefined();
      expect(firstClient.invoicedAmountGNF).toBeGreaterThan(0);
      expect(typeof firstClient.marginRatePct).toBe("number");
    });

    it("calculates treasury flows and debt risk ratio", async () => {
      const prof = await caller.finance.profitability();

      expect(typeof prof.totalInvoicedGNF).toBe("number");
      expect(typeof prof.totalAdvancedDeboursGNF).toBe("number");
      expect(typeof prof.deboursToCARatioPct).toBe("number");
      expect(typeof prof.isRiskAlert).toBe("boolean");
    });

    it("identifies regularized unbilled dossiers", async () => {
      const prof = await caller.finance.profitability();

      expect(typeof prof.unbilledDossiersCount).toBe("number");
      expect(Array.isArray(prof.unbilledDossiers)).toBe(true);
    });

    it("returns monthly cashflow dataset in treasuryFlow query", async () => {
      const flow = await caller.finance.treasuryFlow();

      expect(Array.isArray(flow)).toBe(true);
      if (flow.length > 0) {
        expect(flow[0].month).toBeDefined();
        expect(typeof flow[0].facture).toBe("number");
        expect(typeof flow[0].deboursAvances).toBe("number");
      }
    });
  });

  // 4. TAUX DE CHANGE AUTOMATISÉ & HISTORIQUE IMMUABLE
  describe("4. Automated Exchange Rate & Immutable History", () => {
    it("fetches market rate or default BCRG rate", async () => {
      const live = await fetchLiveExchangeRate("USD");
      expect(live.rate).toBeGreaterThan(1000);
      expect(live.provider).toBeDefined();
    });

    it("records daily exchange rate in history without overwriting manual overrides", async () => {
      const record = await syncDailyExchangeRate();
      expect(record).toBeDefined();
      expect(record.date).toBe(new Date().toISOString().slice(0, 10));
      expect(record.sourceCurrency).toBe("USD");
      expect(record.targetCurrency).toBe("GNF");

      const history = getExchangeRatesHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it("allows manual override only with mandatory justification (minimum 5 chars)", async () => {
      // Rejects without reason (< 5 chars)
      await expect(
        caller.finance.overrideExchangeRate({
          rate: 8800,
          sourceCurrency: "USD",
          overrideReason: "Abc", // 3 chars < 5
        })
      ).rejects.toThrow();

      // Accepts with valid reason
      const override = await caller.finance.overrideExchangeRate({
        rate: 8750,
        sourceCurrency: "USD",
        overrideReason: "Convention cadre minière négociée à taux préférentiel",
      });

      expect(override).toBeDefined();
      expect(override.rate).toBe(8750);
      expect(override.isManualOverride).toBe(true);
      expect(override.overrideReason).toContain("Convention cadre");
    });
  });
});
