import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";

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
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 622 44 55 66",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Tier 2 - tRPC Server RBAC & Integration: Comptable Finance Workflow (R3)", () => {
  const ctx = createComptableContext();
  const caller = appRouter.createCaller(ctx);

  describe("1. Cycle de Vie Facturation (Proforma -> Émise -> Payée) & Débours", () => {
    it("permet à la comptable de créer une facture Proforma en GNF avec débours douaniers", async () => {
      const invoice = await caller.finance.createInvoice({
        dossierId: 1,
        client: "Guinean Birimian Gold S.A",
        currency: "GNF",
        amountHt: 20_000_000,
        amountTva: 3_600_000, // 18%
        amountTtc: 23_600_000,
        disbursementsAmount: 55_000_000, // Débours Douane + PAC
        status: "Proforma",
        notes: "Proforma transit maritime matériel minier",
      });

      expect(invoice).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^FAC-\d{4}-\d+/);
      expect(invoice.client).toBe("Guinean Birimian Gold S.A");
      expect(invoice.currency).toBe("GNF");
      expect(invoice.amountHt).toBe(20_000_000);
      expect(invoice.amountTva).toBe(3_600_000);
      expect(invoice.disbursementsAmount).toBe(55_000_000);
      expect(invoice.status).toBe("Proforma");
    });

    it("permet de créer une facture définitive en USD", async () => {
      const invoiceUsd = await caller.finance.createInvoice({
        dossierId: 2,
        client: "New Japon Mining Corporation",
        currency: "USD",
        amountHt: 5_000,
        amountTva: 900,
        amountTtc: 5_900,
        disbursementsAmount: 12_000,
        status: "Émise",
        notes: "Invoice USD for offshore equipment transit",
      });

      expect(invoiceUsd.currency).toBe("USD");
      expect(invoiceUsd.amountHt).toBe(5_000);
      expect(invoiceUsd.status).toBe("Émise");
    });

    it("permet d'enregistrer une facture réglée (Payée) et met à jour le statut financier du dossier", async () => {
      const paidInvoice = await caller.finance.createInvoice({
        dossierId: 3,
        client: "Boké Alumina Consortium",
        currency: "GNF",
        amountHt: 15_000_000,
        amountTva: 2_700_000,
        amountTtc: 17_700_000,
        disbursementsAmount: 40_000_000,
        status: "Payée",
        notes: "Règlement complet reçu par virement bancaire BCRG",
      });

      expect(paidInvoice.status).toBe("Payée");
      expect(paidInvoice.paidAt).not.toBeNull();

      // Vérifie que le dossier 3 est maintenant marqué comme "Payé"
      const dossier = await caller.dossier.get({ id: 3 });
      expect(dossier?.financialStatus).toBe("Payé");
    });
  });

  describe("2. Synthèse Financière & Agrégations Multi-Devises", () => {
    it("fournit une synthèse consolidée du CA en GNF, USD et marge brute estimée", async () => {
      const summary = await caller.finance.summary();

      expect(summary).toBeDefined();
      expect(typeof summary.totalCA_GNF).toBe("number");
      expect(typeof summary.totalCA_USD).toBe("number");
      expect(typeof summary.totalMargin_GNF).toBe("number");
      expect(typeof summary.pendingInvoices).toBe("number");
      expect(Array.isArray(summary.invoices)).toBe(true);

      // Le CA GNF doit intégrer les factures GNF
      expect(summary.totalCA_GNF).toBeGreaterThanOrEqual(23_600_000);
      // Le CA USD doit intégrer la facture USD de 5 900
      expect(summary.totalCA_USD).toBeGreaterThanOrEqual(5_900);
    });

    it("liste les factures associées à un dossier spécifique", async () => {
      const invoicesDossier1 = await caller.finance.listInvoices({ dossierId: 1 });
      expect(Array.isArray(invoicesDossier1)).toBe(true);
      expect(invoicesDossier1.every(i => i.dossierId === 1)).toBe(true);
    });
  });

  describe("3. Bouclier de Sécurité Comptable (RBAC Protection)", () => {
    it("interdit à la comptable de supprimer un dossier opérationnel (réservé admin - 403 Forbidden)", async () => {
      await expect(caller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);
    });

    it("interdit à la comptable d'altérer les référentiels système (réservé admin - 403 Forbidden)", async () => {
      await expect(
        caller.reference.create({ category: "regime_douanier", label: "Régime Spécial 4000" })
      ).rejects.toThrow(/permission|forbidden/i);
    });
  });
});
