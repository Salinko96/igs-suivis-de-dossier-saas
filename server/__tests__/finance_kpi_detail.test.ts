import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";

function createComptableContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 3,
      openId: "comptable_conakry",
      name: "Fatoumata Camara",
      email: "finance@igs-logistics.gn",
      role: "comptable",
    } as any,
  };
}

describe("R - Finance KPI Cards Live Breakdown & Recalculation Integrity Suite", () => {
  const caller = appRouter.createCaller(createComptableContext());

  it("1. Verifies that Chiffre d'Affaires Global (totalCA_GNF) strictly equals the sum of line items", async () => {
    const summary = await caller.finance.summary();
    const invoices = await caller.finance.listInvoices({});
    const { rate } = await db.getExchangeRate();

    expect(summary).toBeDefined();
    expect(invoices.length).toBeGreaterThan(0);

    // Somme dynamique des lignes
    const calculatedSumGnf = invoices.reduce((sum, inv) => {
      const val = inv.currency === "USD" ? inv.amountTtc * rate : inv.amountTtc;
      return sum + val;
    }, 0);

    expect(summary.totalCA_GNF).toBe(calculatedSumGnf);
    expect(summary.totalCA_GNF).toBeGreaterThan(0);
  });

  it("2. Verifies that Marge Brute Estimée (totalMargin_GNF) strictly equals the sum of line margins", async () => {
    const summary = await caller.finance.summary();
    const invoices = await caller.finance.listInvoices({});
    const { rate } = await db.getExchangeRate();

    const calculatedMarginSum = invoices.reduce((sum, inv) => {
      const margin = inv.estimatedMargin ?? Math.round((inv.amountHt || 0) * 0.25);
      const val = inv.currency === "USD" ? margin * rate : margin;
      return sum + val;
    }, 0);

    expect(summary.totalMargin_GNF).toBe(calculatedMarginSum);
    expect(summary.totalMargin_GNF).toBeGreaterThan(0);
  });

  it("3. Verifies that Débours Avancés PAC (totalDisbursements_GNF) strictly equals the sum of disbursements", async () => {
    const summary = await caller.finance.summary();
    const invoices = await caller.finance.listInvoices({});
    const { rate } = await db.getExchangeRate();

    const calculatedDisbursementsSum = invoices.reduce((sum, inv) => {
      const disb = inv.disbursementsAmount ?? (Number(inv.customsDutiesAmount || 0) + Number(inv.portFeesAmount || 0) + Number(inv.storageAndDemurrageFees || 0));
      const val = inv.currency === "USD" ? disb * rate : disb;
      return sum + val;
    }, 0);

    expect(summary.totalDisbursements_GNF).toBe(calculatedDisbursementsSum);
  });

  it("4. Verifies that Risque Surestaries PAC strictly matches dossiers with ETA > 7 days without release date", async () => {
    const summary = await caller.finance.summary();
    const dossiers = await db.listDossiers();
    const now = Date.now();

    const manualAtRiskDossiers = dossiers.filter(d => {
      if (!d.eta || d.goodsReleaseDate) return false;
      const etaTime = new Date(d.eta).getTime();
      return (now - etaTime) > (86400000 * 7);
    });

    expect(summary.totalDemurrageRisk).toBe(manualAtRiskDossiers.length);
  });

  it("5. Verifies live recalculation consistency after creating a new invoice", async () => {
    const initialSummary = await caller.finance.summary();
    const initialCA = initialSummary.totalCA_GNF;
    const initialMargin = initialSummary.totalMargin_GNF;

    const newAmountHt = 10000000;
    const newTva = Math.round(newAmountHt * 0.18);
    const newAmountTtc = newAmountHt + newTva;
    const estimatedMargin = 2500000;

    const created = await caller.finance.createInvoice({
      dossierId: 1,
      client: "Test Client Mining",
      amountHt: newAmountHt,
      amountTva: newTva,
      amountTtc: newAmountTtc,
      disbursementsAmount: 5000000,
      customsDutiesAmount: 3000000,
      portFeesAmount: 2000000,
      storageAndDemurrageFees: 0,
      estimatedMargin,
      status: "Émise",
      currency: "GNF",
    });

    expect(created).toBeDefined();

    const updatedSummary = await caller.finance.summary();
    expect(updatedSummary.totalCA_GNF).toBe(initialCA + newAmountTtc);
    expect(updatedSummary.totalMargin_GNF).toBe(initialMargin + estimatedMargin);
  });
});
