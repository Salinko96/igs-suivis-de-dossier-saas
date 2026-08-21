import { describe, it, expect, beforeEach } from "vitest";
import * as db from "../db";
import { renderWhatsappHsmTemplate, sendWhatsappBusinessMessage } from "../whatsappService";
import { generateClientConsolidatedReport, generateClientReportHtml } from "../clientReportService";

describe("Enterprise Suite : Gestion Documentaire, Approbations, Reporting Minier & WhatsApp API", () => {
  // -------------------------------------------------------------
  // PILLAR 1: GESTION DOCUMENTAIRE & VERSIONNING
  // -------------------------------------------------------------
  describe("Pillar 1: Gestion Documentaire & Versionning Avancé", () => {
    it("téléverse un document v1 avec visibilité publique par défaut", async () => {
      const docV1 = await db.uploadDocumentWithVersion({
        dossierId: 1,
        name: "Connaissement_BL_Hapag_Original.pdf",
        type: "BL",
        fileUrl: "data:application/pdf;base64,JVBERi0xLjQK...",
        fileSize: 154000,
        mimeType: "application/pdf",
        isPublic: true,
        description: "Original BL remis par l'armateur",
      });

      expect(docV1.id).toBeDefined();
      expect(docV1.version).toBe(1);
      expect(docV1.isPublic).toBe(true);
      expect(docV1.name).toBe("Connaissement_BL_Hapag_Original.pdf");
    });

    it("incrémente la version à v2 lors d'un remplacement de document et archive l'historique", async () => {
      const docV2 = await db.uploadDocumentWithVersion({
        dossierId: 1,
        name: "Connaissement_BL_Hapag_Rectificatif_v2.pdf",
        type: "BL",
        fileUrl: "data:application/pdf;base64,JVBERi0xLjQK_V2...",
        fileSize: 160000,
        mimeType: "application/pdf",
        isPublic: true,
        description: "BL Rectifié avec bon numéro de conteneur",
        replaceExistingType: true,
      });

      expect(docV2.version).toBeGreaterThanOrEqual(2);
      expect(docV2.name).toBe("Connaissement_BL_Hapag_Rectificatif_v2.pdf");

      const prevVersions = JSON.parse(docV2.previousVersions || "[]");
      expect(prevVersions.length).toBeGreaterThanOrEqual(1);
      expect(prevVersions[0].version).toBeDefined();
    });

    it("filtre strictement les documents selon la visibilité publique pour les clients externes", async () => {
      // Document interne sensible (ex: calcul de débours internes / quittance confidentielle)
      await db.uploadDocumentWithVersion({
        dossierId: 2,
        name: "Bordereau_Debours_Interne_Confidentiel.pdf",
        type: "Autre",
        fileUrl: "data:application/pdf;base64,...",
        fileSize: 85000,
        isPublic: false,
        description: "Document interne réservé aux comptables",
      });

      const internalDocs = await db.listDocuments(2, false);
      const publicDocs = await db.listDocuments(2, true);

      const hasInternalInPublic = publicDocs.some(d => d.name === "Bordereau_Debours_Interne_Confidentiel.pdf");
      expect(hasInternalInPublic).toBe(false);

      const hasInternalInStaff = internalDocs.some(d => d.name === "Bordereau_Debours_Interne_Confidentiel.pdf");
      expect(hasInternalInStaff).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // PILLAR 2: WORKFLOW D'APPROBATION FINANCIÈRE
  // -------------------------------------------------------------
  describe("Pillar 2: Workflow d'Approbation & Arbitrage Financier", () => {
    it("déclenche une demande d'approbation pour un débours > 5M GNF", async () => {
      const req = await db.createApprovalRequest({
        entityType: "disbursement",
        entityId: 101,
        dossierId: 1,
        amount: 8500000,
        currency: "GNF",
        thresholdAmount: db.APPROVAL_THRESHOLDS.DISBURSEMENT_GNF,
        requestedById: 2,
        requestedByName: "Mamadou Diallo",
        comment: "Avance frais de manutention quai terminal Conakry",
      });

      expect(req.id).toBeDefined();
      expect(req.status).toBe("EN_ATTENTE");
      expect(req.amount).toBe(8500000);
      expect(req.thresholdAmount).toBe(5000000);
    });

    it("permet l'approbation par un manager et met à jour le statut à APPROUVE", async () => {
      const req = await db.createApprovalRequest({
        entityType: "invoice",
        entityId: 202,
        dossierId: 1,
        amount: 25000000,
        currency: "GNF",
        thresholdAmount: db.APPROVAL_THRESHOLDS.INVOICE_GNF,
        requestedById: 3,
        requestedByName: "Fatoumata Camara",
      });

      const approved = await db.approveRequest(req.id, 1, "Alpha Barry (Directeur)");
      expect(approved.status).toBe("APPROUVE");
      expect(approved.approverName).toBe("Alpha Barry (Directeur)");
      expect(approved.resolvedAt).toBeDefined();
    });

    it("rejette une demande avec un motif obligatoire et refuse les rejets sans justification", async () => {
      const req = await db.createApprovalRequest({
        entityType: "disbursement",
        entityId: 303,
        dossierId: 1,
        amount: 12000000,
        currency: "GNF",
        requestedById: 2,
        requestedByName: "Mamadou Diallo",
      });

      // Tentative sans motif => doit lever une erreur
      await expect(db.rejectRequest(req.id, 1, "Alpha Barry", "")).rejects.toThrow(
        "Un motif explicite est strictement obligatoire"
      );

      // Rejet valide avec motif
      const rejected = await db.rejectRequest(
        req.id,
        1,
        "Alpha Barry (Directeur)",
        "Quittance Trésor non conforme au barème SYDONIA World"
      );

      expect(rejected.status).toBe("REJETE");
      expect(rejected.rejectionReason).toBe("Quittance Trésor non conforme au barème SYDONIA World");
    });
  });

  // -------------------------------------------------------------
  // PILLAR 3: RAPPORTS CONSOLIDÉS CLIENTS MINIERS
  // -------------------------------------------------------------
  describe("Pillar 3: Rapports Consolidés Clients Miniers & Lead Time", () => {
    it("génère le bilan consolidé pour un grand compte minier (GBG)", async () => {
      const report = await generateClientConsolidatedReport("Guinean Birimian Gold (GBG)");

      expect(report.clientName).toContain("Guinean Birimian Gold");
      expect(report.accountCategory).toBe("mining_major");
      expect(report.totalDossiers).toBeGreaterThanOrEqual(0);
      expect(report.averageClearanceDays).toBeGreaterThan(0);
      expect(report.exchangeRate).toBeGreaterThan(0);
      expect(Array.isArray(report.dossiers)).toBe(true);
    });

    it("génère le template HTML corporate certifié IGS pour impression PDF", async () => {
      const report = await generateClientConsolidatedReport("Guinean Birimian Gold (GBG)");
      const html = generateClientReportHtml(report);

      expect(html).toContain("IBRAHIMA GOLD SERVICE (IGS) S.A.R.L");
      expect(html).toContain("Guinean Birimian Gold (GBG)");
      expect(html).toContain("COMPTE STRATÉGIQUE MINIER");
      expect(html).toContain("Délai Moyen Quai (Lead Time)");
    });
  });

  // -------------------------------------------------------------
  // PILLAR 4: WHATSAPP BUSINESS API & PRÉFÉRENCES MULTI-CANAUX
  // -------------------------------------------------------------
  describe("Pillar 4: WhatsApp Business API & Préférences Multi-Canaux", () => {
    it("formate correctement les 5 templates HSM officiels", () => {
      const templates = [
        "dossier_cree",
        "eta_mise_a_jour",
        "alerte_surestarie_imminente",
        "dossier_regularise",
        "facture_disponible",
      ] as const;

      for (const t of templates) {
        const rendered = renderWhatsappHsmTemplate({
          dossierNumber: "DOS-2026-0042",
          clientName: "Guinee Gold Exploration",
          recipientPhone: "+224621234567",
          template: t,
          variables: {
            blLtaNumber: "HLCU1234567",
            eta: new Date("2026-08-25"),
            daysOnQuay: 6,
            amount: 18500000,
            currency: "GNF",
            invoiceNumber: "FAC-2026-0089",
            customsDeclaration: "SYD-2026-CONAKRY-890",
          },
        });

        expect(rendered.fullText).toContain("IBRAHIMA GOLD SERVICE");
        expect(rendered.fullText).toContain("DOS-2026-0042");
        expect(rendered.fullText).toContain("Guinee Gold Exploration");
        expect(rendered.fullText).toContain("portail-client");
      }
    });

    it("exécute l'envoi WhatsApp et consigne la traçabilité", async () => {
      const res = await sendWhatsappBusinessMessage({
        dossierId: 1,
        dossierNumber: "DOS-2026-0001",
        clientName: "Guinean Birimian Gold",
        recipientPhone: "+224622001122",
        template: "dossier_regularise",
        variables: {
          customsDeclaration: "SYD-2026-0012",
        },
      });

      expect(res.success).toBe(true);
      expect(res.recipientPhone).toBe("+224622001122");
      expect(res.messageId).toBeDefined();
    });

    it("enregistre et met à jour les préférences de communication d'un client", async () => {
      const initial = await db.getClientPreferences("Guinean Birimian Gold (GBG)");
      expect(initial.id).toBeDefined();

      const updated = await db.updateClientPreferences(initial.id, {
        preferredChannel: "whatsapp",
        whatsappPhone: "+224622998877",
        optInNotifications: true,
        monthlyReportEnabled: true,
      });

      expect(updated.preferredChannel).toBe("whatsapp");
      expect(updated.whatsappPhone).toBe("+224622998877");
      expect(updated.optInNotifications).toBe(true);
      expect(updated.monthlyReportEnabled).toBe(true);
    });
  });
});
