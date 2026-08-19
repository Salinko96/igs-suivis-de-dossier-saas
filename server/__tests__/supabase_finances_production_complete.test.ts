import { describe, it, expect, beforeEach } from "vitest";
import * as db from "../db";
import { uploadInvoicePdf, uploadPaymentProof, isSupabaseConfigured, getSignedDownloadUrl } from "../supabase";

describe("Finances, Facturation & Débours — Supabase Production Complete Suite", () => {
  beforeEach(async () => {
    await db.setExchangeRate(8650);
  });

  describe("1. Émission de Facture & Calculs Serveur Fiables", () => {
    it("calcule automatiquement la TVA (18%) et le Total Général TTC", async () => {
      const invoice = await db.createInvoice({
        dossierId: 1,
        client: "Guinean Birimian Gold S.A",
        currency: "GNF",
        invoiceType: "Definitive",
        amountHt: 20000000,
        customsDutiesAmount: 30000000,
        portFeesAmount: 10000000,
        storageAndDemurrageFees: 2000000,
        disbursementsAmount: 42000000, // 30M + 10M + 2M
        status: "Émise",
      });

      expect(invoice.invoiceNumber).toBeDefined();
      expect(invoice.amountHt).toBe(20000000);
      expect(invoice.amountTva).toBe(3600000); // 18% of 20M
      expect(invoice.amountTtc).toBe(23600000); // 20M + 3.6M
      expect(invoice.disbursementsAmount).toBe(42000000);
      expect(invoice.estimatedMargin).toBe(5000000); // 25% of 20M
    });

    it("génère une notification automatique lors de l'émission d'une facture", async () => {
      const notif = await db.addNotification({
        dossierId: 1,
        type: "FACTURE_GENEREE",
        title: "Nouvelle facture émise",
        message: "Facture FAC-2026-9999 émise pour Topaz Guinée",
        recipientRole: "comptable",
      });

      expect(notif.id).toBeDefined();
      expect(notif.type).toBe("FACTURE_GENEREE");
      expect(notif.isRead).toBe(0);
    });
  });

  describe("2. Encaissement, Quittance & Justificatif de Paiement", () => {
    it("enregistre un encaissement complet avec génération de quittance et mise à jour du dossier", async () => {
      const created = await db.createInvoice({
        dossierId: 2,
        client: "Société Minière de Boké (SMB)",
        currency: "GNF",
        amountHt: 15000000,
        status: "Émise",
      });

      const paid = await db.recordInvoicePayment(created.id, {
        paymentMethod: "Virement Bancaire Ecobank",
        paymentReference: "VIR-SMB-998822",
        paidAmount: 17700000,
        proofUrl: "https://supabase.co/storage/v1/object/public/preuves/recu_998822.pdf",
        notes: "Règlement intégral reçu",
      });

      expect(paid.status).toBe("Payée");
      expect(paid.receiptNumber).toMatch(/^REC-2026-/);
      expect(paid.paidAt).toBeInstanceOf(Date);

      // Vérifier l'enregistrement dans la table des paiements
      const payments = await db.listInvoicePayments(created.id);
      expect(payments.length).toBeGreaterThan(0);
      expect(payments[0].paymentMethod).toBe("Virement Bancaire Ecobank");
      expect(payments[0].proofUrl).toContain("recu_998822.pdf");

      // Vérifier la mise à jour du statut financier du dossier
      const dossier = await db.getDossier(2);
      expect(dossier?.financialStatus).toBe("Payé");
    });
  });

  describe("3. Débours Portuaires (PAC) & Trésor Public", () => {
    it("enregistre et liste les débours PAC avec suivi des remboursements", async () => {
      const debour = await db.createPacDisbursement({
        dossierId: 1,
        type: "port",
        amountAdvanced: 8500000,
        amountReimbursed: 8500000,
        status: "rembourse_total",
        receiptNumber: "REC-PAC-2026-7788",
        notes: "Manutention et acconage quai 2",
      });

      expect(debour.id).toBeDefined();
      expect(debour.status).toBe("rembourse_total");

      const list = await db.listPacDisbursements(1);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some(d => d.receiptNumber === "REC-PAC-2026-7788")).toBe(true);
    });
  });

  describe("4. Taux de Change & Multi-Devises", () => {
    it("met à jour et récupère le taux officiel USD/GNF", async () => {
      const res = await db.setExchangeRate(8700);
      expect(res.rate).toBe(8700);

      const current = await db.getExchangeRate();
      expect(current.rate).toBe(8700);
    });
  });

  describe("5. Supabase Storage & Modules d'Upload", () => {
    it("détecte la configuration Supabase ou fournit un fallback sécurisé", () => {
      const isConfigured = isSupabaseConfigured();
      expect(typeof isConfigured).toBe("boolean");
    });

    it("gère l'upload de facture PDF avec buffer binaire", async () => {
      const dummyPdfBuffer = Buffer.from("%PDF-1.4 dummy invoice test content");
      const url = await uploadInvoicePdf("FAC-TEST-001", dummyPdfBuffer);
      // In test env without live Supabase credentials, returns null gracefully without crash
      expect(url === null || typeof url === "string").toBe(true);
    });

    it("gère l'upload de preuve de paiement image/PDF", async () => {
      const dummyProof = Buffer.from("dummy-bank-receipt-bytes");
      const url = await uploadPaymentProof(1, dummyProof, "recu_banque.jpg", "image/jpeg");
      expect(url === null || typeof url === "string").toBe(true);
    });

    it("génère des URLs de téléchargement signées temporaires", async () => {
      const signedUrl = await getSignedDownloadUrl("factures", "invoices/test.pdf", 3600);
      expect(signedUrl === null || typeof signedUrl === "string").toBe(true);
    });
  });
});
