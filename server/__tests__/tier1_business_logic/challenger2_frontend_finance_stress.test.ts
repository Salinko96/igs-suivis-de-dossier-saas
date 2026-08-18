import { describe, expect, it } from "vitest";
import { resolvePermissions, getRoleBadge } from "@/hooks/usePermissions";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";
import * as db from "../../db";

function makeContext(role: "admin" | "declarant" | "comptable" | "client" | "manager"): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: role === "admin" ? 1 : role === "declarant" ? 2 : role === "comptable" ? 3 : role === "manager" ? 5 : 4,
      openId: `challenger2_${role}`,
      name: `Challenger2 ${role.toUpperCase()}`,
      email: `${role}@igs-logistics.gn`,
      role,
      loginMethod: "direct",
      clientCompany: role === "client" ? "Guinean Birimian Gold S.A" : null,
      phone: "+224 620 00 00 00",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

/**
 * Pure reproduction of FinancesPage formatting and calculation functions
 * to test exact invariants and mathematical behaviors under stress.
 */
function formatMoneyHelper(
  amountInOriginal: number,
  originalCurrency: string = "GNF",
  displayCurrency: "GNF" | "USD" = "GNF",
  activeRate: number = 8650
): string {
  if (displayCurrency === "USD") {
    const inUsd = originalCurrency === "USD" ? amountInOriginal : amountInOriginal / activeRate;
    return `$ ${inUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    const inGnf = originalCurrency === "USD" ? amountInOriginal * activeRate : amountInOriginal;
    return `${Math.round(inGnf).toLocaleString("fr-FR")} GNF`;
  }
}

function calculateFinancesPageInvoice({
  amountHt,
  customsDuties,
  portFees,
  storageDemurrage,
}: {
  amountHt: number;
  customsDuties?: number;
  portFees?: number;
  storageDemurrage?: number;
}) {
  const computedTva = Math.round(amountHt * 0.18);
  const computedTotalDisbursements = Number(customsDuties || 0) + Number(portFees || 0) + Number(storageDemurrage || 0);
  const computedAmountTtc = Number(amountHt || 0) + computedTva;
  const computedGrandTotal = computedAmountTtc + computedTotalDisbursements;

  return {
    computedTva,
    computedTotalDisbursements,
    computedAmountTtc,
    computedGrandTotal,
  };
}

function generatePrintReceiptHtml(inv: {
  invoiceNumber: string;
  receiptNumber?: string | null;
  client: string;
  dossierId: number;
  currency: string;
  amountHt: number;
  amountTva: number;
  amountTtc: number;
  customsDutiesAmount?: number | null;
  portFeesAmount?: number | null;
  storageAndDemurrageFees?: number | null;
  disbursementsAmount?: number | null;
  status: string;
  paymentMethod?: string | null;
  exchangeRate?: number;
  createdAt: Date | string;
}, activeRate = 8650): string {
  const isPaid = inv.status === "Payée";
  const totalDisb = inv.disbursementsAmount || 0;
  const grandTotal = inv.amountTtc + totalDisb;
  const rate = inv.exchangeRate || activeRate;
  const usdEquiv = (grandTotal / rate).toFixed(2);

  return `
    <!DOCTYPE html>
    <html>
    <head><title>${isPaid ? "Quittance de Paiement" : "Facture Proforma"} - ${inv.invoiceNumber}</title></head>
    <body>
      <div class="logo-title">IBRAHIMA GOLD SERVICE (IGS) S.A.R.L</div>
      <div class="doc-badge">${isPaid ? "QUITTANCE DE PAIEMENT" : "FACTURE PROFORMA"}</div>
      <div>N° ${inv.invoiceNumber}</div>
      ${inv.receiptNumber ? `<div>Réf. Reçu : ${inv.receiptNumber}</div>` : ""}
      <div>Client : ${inv.client}</div>
      <div>Dossier #${inv.dossierId}</div>
      <div>Honoraires HT : ${inv.amountHt.toLocaleString("fr-FR")} ${inv.currency}</div>
      <div>TVA (18%) : ${inv.amountTva.toLocaleString("fr-FR")} ${inv.currency}</div>
      <div>Total TTC : ${inv.amountTtc.toLocaleString("fr-FR")} ${inv.currency}</div>
      <div>Total Débours : ${totalDisb.toLocaleString("fr-FR")} ${inv.currency}</div>
      <div>TOTAL GÉNÉRAL : ${grandTotal.toLocaleString("fr-FR")} ${inv.currency}</div>
      <div>USD Equiv : $ ${usdEquiv} USD</div>
      <div>STATUT : ${inv.status.toUpperCase()}</div>
    </body>
    </html>
  `;
}

describe("Empirical Challenger 2: Finances & Role Simulator UI Verification Suite", () => {
  const comptableCaller = appRouter.createCaller(makeContext("comptable"));
  const adminCaller = appRouter.createCaller(makeContext("admin"));
  const declarantCaller = appRouter.createCaller(makeContext("declarant"));
  const clientCaller = appRouter.createCaller(makeContext("client"));

  // =========================================================================
  // 1. MULTI-CURRENCY SWITCHING & FORMATTING (FinancesPage)
  // =========================================================================
  describe("1. Multi-Currency Switching & formatMoney Invariants", () => {
    it("formats GNF correctly when displayCurrency is GNF", () => {
      const formatted = formatMoneyHelper(25_000_000, "GNF", "GNF", 8650);
      expect(formatted).toMatch(/25[\s\u202f]000[\s\u202f]000 GNF/);
    });

    it("formats GNF correctly when displayCurrency is USD (GNF -> USD conversion)", () => {
      const gnf = 8_650_000;
      const formatted = formatMoneyHelper(gnf, "GNF", "USD", 8650);
      expect(formatted).toBe("$ 1,000.00");
    });

    it("formats USD correctly when displayCurrency is USD (no conversion)", () => {
      const usd = 5400.5;
      const formatted = formatMoneyHelper(usd, "USD", "USD", 8650);
      expect(formatted).toBe("$ 5,400.50");
    });

    it("formats USD correctly when displayCurrency is GNF (USD -> GNF conversion)", () => {
      const usd = 1000;
      const formatted = formatMoneyHelper(usd, "USD", "GNF", 8650);
      expect(formatted).toMatch(/8[\s\u202f]650[\s\u202f]000 GNF/);
    });

    it("handles dynamic exchange rate modifications (ex: 9 200 GNF/USD)", () => {
      const customRate = 9200;
      // 18.4M GNF at 9200 = 2000 USD
      expect(formatMoneyHelper(18_400_000, "GNF", "USD", customRate)).toBe("$ 2,000.00");
      // 3000 USD at 9200 = 27.6M GNF
      expect(formatMoneyHelper(3000, "USD", "GNF", customRate)).toMatch(/27[\s\u202f]600[\s\u202f]000 GNF/);
    });

    it("handles zero and fractional edge cases gracefully", () => {
      expect(formatMoneyHelper(0, "GNF", "GNF", 8650)).toMatch(/0 GNF/);
      expect(formatMoneyHelper(0, "GNF", "USD", 8650)).toBe("$ 0.00");
      expect(formatMoneyHelper(0, "USD", "GNF", 8650)).toMatch(/0 GNF/);
      expect(formatMoneyHelper(0, "USD", "USD", 8650)).toBe("$ 0.00");
    });
  });

  // =========================================================================
  // 2. INVOICE CALCULATION LOGIC & DÉBOURS SEPARATION (FinancesPage)
  // =========================================================================
  describe("2. FinancesPage Invoice Calculations & Débours Invariants", () => {
    it("computes 18% VAT, disbursements total, TTC and grand total accurately", () => {
      const calc = calculateFinancesPageInvoice({
        amountHt: 25_000_000,
        customsDuties: 45_000_000,
        portFees: 12_000_000,
        storageDemurrage: 3_000_000,
      });

      expect(calc.computedTva).toBe(4_500_000); // 25M * 0.18
      expect(calc.computedAmountTtc).toBe(29_500_000); // 25M + 4.5M
      expect(calc.computedTotalDisbursements).toBe(60_000_000); // 45M + 12M + 3M
      expect(calc.computedGrandTotal).toBe(89_500_000); // 29.5M + 60M
    });

    it("verifies that VAT is strictly 0 when amountHt is 0 even with large débours", () => {
      const calc = calculateFinancesPageInvoice({
        amountHt: 0,
        customsDuties: 150_000_000,
        portFees: 30_000_000,
        storageDemurrage: 0,
      });

      expect(calc.computedTva).toBe(0);
      expect(calc.computedAmountTtc).toBe(0);
      expect(calc.computedTotalDisbursements).toBe(180_000_000);
      expect(calc.computedGrandTotal).toBe(180_000_000);
    });

    it("verifies that undefined or null optional débours default to 0 without NaN", () => {
      const calc = calculateFinancesPageInvoice({
        amountHt: 10_000_000,
        customsDuties: undefined,
        portFees: undefined,
        storageDemurrage: undefined,
      });

      expect(calc.computedTva).toBe(1_800_000);
      expect(calc.computedAmountTtc).toBe(11_800_000);
      expect(calc.computedTotalDisbursements).toBe(0);
      expect(calc.computedGrandTotal).toBe(11_800_000);
    });
  });

  // =========================================================================
  // 3. PAYMENT RECEIPT & QUITTANCE GENERATION (FinancesPage)
  // =========================================================================
  describe("3. Payment Receipt & Quittance Generation", () => {
    it("generates correct receipt reference and printable HTML document for paid invoice", async () => {
      // Create invoice via Comptable
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: 1,
        client: "Guinean Birimian Gold S.A",
        currency: "GNF",
        amountHt: 30_000_000,
        amountTva: 5_400_000,
        amountTtc: 35_400_000,
        customsDutiesAmount: 80_000_000,
        portFeesAmount: 20_000_000,
        disbursementsAmount: 100_000_000,
        status: "Émise",
      });

      // Record payment
      const paid = await comptableCaller.finance.recordPayment({
        id: inv.id,
        paymentMethod: "Virement bancaire Ecobank / Vistabank",
        paymentReference: "VIR-ECOBANK-2026-CHALLENGER",
        paidAmount: 35_400_000,
      });

      expect(paid.status).toBe("Payée");
      expect(paid.receiptNumber).toBe(`REC-2026-${inv.id}`);
      expect(paid.paymentMethod).toBe("Virement bancaire Ecobank / Vistabank");

      // Generate HTML receipt
      const html = generatePrintReceiptHtml(paid, 8650);
      expect(html).toContain("QUITTANCE DE PAIEMENT");
      expect(html).toContain(paid.invoiceNumber);
      expect(html).toContain(`Réf. Reçu : REC-2026-${inv.id}`);
      expect(html).toContain("Guinean Birimian Gold S.A");
      expect(html).toContain("IBRAHIMA GOLD SERVICE (IGS) S.A.R.L");
      expect(html).toContain("TOTAL GÉNÉRAL : 135");
      expect(html).toContain("STATUT : PAYÉE");
    });

    it("generates proforma title when invoice is not paid", async () => {
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: 2,
        client: "New Japon Mining Corporation",
        currency: "USD",
        invoiceType: "Proforma",
        amountHt: 4000,
        amountTva: 720,
        amountTtc: 4720,
        disbursementsAmount: 10000,
        status: "Proforma",
      });

      const html = generatePrintReceiptHtml(inv, 8650);
      expect(html).toContain("FACTURE PROFORMA");
      expect(html).not.toContain("Réf. Reçu :");
      expect(html).toContain("STATUT : PROFORMA");
    });
  });

  // =========================================================================
  // 4. FRONTEND RBAC & ROLE SIMULATOR INTEGRATION (usePermissions)
  // =========================================================================
  describe("4. usePermissions Capabilities & Routing Shielding", () => {
    it("enforces strict separation between Déclarant, Comptable, and Client", () => {
      const declarant = resolvePermissions("declarant");
      const comptable = resolvePermissions("comptable");
      const client = resolvePermissions("client");
      const admin = resolvePermissions("admin");

      // Déclarant PAC
      expect(declarant.canViewPlanning).toBe(true);
      expect(declarant.canViewControls).toBe(true);
      expect(declarant.canEditCustoms).toBe(true);
      expect(declarant.canViewFinances).toBe(false);
      expect(declarant.canManageInvoices).toBe(false);
      expect(declarant.canViewMargin).toBe(false);
      expect(declarant.defaultRoute).toBe("/planning");

      // Comptable
      expect(comptable.canViewFinances).toBe(true);
      expect(comptable.canManageInvoices).toBe(true);
      expect(comptable.canViewMargin).toBe(true);
      expect(comptable.canViewPlanning).toBe(false);
      expect(comptable.canViewControls).toBe(false);
      expect(comptable.canEditCustoms).toBe(false);
      expect(comptable.defaultRoute).toBe("/finances");

      // Client
      expect(client.canViewFinances).toBe(false);
      expect(client.canViewControls).toBe(false);
      expect(client.canViewPlanning).toBe(false);
      expect(client.canEditCustoms).toBe(false);
      expect(client.canManageInvoices).toBe(false);
      expect(client.canCreateDossier).toBe(false);
      expect(client.canDeleteDossier).toBe(false);
      expect(client.canViewMargin).toBe(false);
      expect(client.defaultRoute).toBe("/portail-client");

      // Admin
      expect(admin.isAdmin).toBe(true);
      expect(admin.canDeleteDossier).toBe(true);
      expect(admin.canViewFinances).toBe(true);
      expect(admin.canViewControls).toBe(true);
      expect(admin.canViewPlanning).toBe(true);
      expect(admin.defaultRoute).toBe("/");
    });
  });
});
