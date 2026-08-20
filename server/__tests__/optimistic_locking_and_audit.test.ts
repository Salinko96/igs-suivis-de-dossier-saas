import { describe, it, expect, beforeEach } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";
import { TRPCError } from "@trpc/server";

describe("Milestone 2 & Milestone 3: Optimistic Locking and Audit Trail Suite", () => {
  let createdDossier: any;

  beforeEach(async () => {
    // Créer un dossier frais pour chaque test
    createdDossier = await db.createDossier(
      {
        client: "Ciments de Guinée SA",
        clientDossierNumber: "CDG-2026-001",
        blLtaNumber: "MSKU987654321",
        cargoNature: "Clinker en Vrac",
        transportMode: "Maritime",
        eta: new Date("2026-09-01T10:00:00Z"),
        originPort: "Dakar Port",
        destinationPort: "Port Autonome de Conakry",
        regime: "IM4",
        service: "Transit & Dédouanement",
      },
      1,
      "Mamadou Diallo",
      { userRole: "declarant", ipAddress: "192.168.1.100" }
    );
  });

  describe("Milestone 2: Optimistic Locking & Simultaneous Edition Conflicts (R2)", () => {
    it("initialise la version à 1 lors de la création du dossier", () => {
      expect(createdDossier).toBeDefined();
      expect(createdDossier.version).toBe(1);
    });

    it("incrémente la version à chaque mise à jour réussie", async () => {
      const updated1 = await db.updateDossier(
        createdDossier.id,
        { cargoNature: "Clinker Portland Haute Résistance" },
        1,
        "Mamadou Diallo",
        { expectedVersion: 1, userRole: "declarant" }
      );
      expect(updated1.version).toBe(2);
      expect(updated1.cargoNature).toBe("Clinker Portland Haute Résistance");

      const updated2 = await db.updateDossier(
        createdDossier.id,
        { declarationNumber: "2026-DK-9901" },
        1,
        "Mamadou Diallo",
        { expectedVersion: 2, userRole: "declarant" }
      );
      expect(updated2.version).toBe(3);
      expect(updated2.declarationNumber).toBe("2026-DK-9901");
    });

    it("rejette les mises à jour avec une version obsolète (Conflict / Stale Version)", async () => {
      // Étape 1 : Une première mise à jour fait passer la version à 2
      await db.updateDossier(
        createdDossier.id,
        { notes: "Modification utilisateur A" },
        1,
        "Utilisateur A",
        { expectedVersion: 1 }
      );

      // Étape 2 : Un second utilisateur tente de modifier avec la version 1 (périmée)
      await expect(
        db.updateDossier(
          createdDossier.id,
          { notes: "Modification concurrente utilisateur B" },
          2,
          "Utilisateur B",
          { expectedVersion: 1 }
        )
      ).rejects.toThrowError(TRPCError);

      try {
        await db.updateDossier(
          createdDossier.id,
          { notes: "Modification concurrente utilisateur B" },
          2,
          "Utilisateur B",
          { expectedVersion: 1 }
        );
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("Conflit d'édition simultanée");
      }
    });

    it("rejette les mises à jour avec un horodatage obsolète (Stale updatedAt divergence > 1000ms)", async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute in the past

      await expect(
        db.updateDossier(
          createdDossier.id,
          { notes: "Modification horodatage expiré" },
          1,
          "Opérateur IGS",
          { expectedUpdatedAt: pastDate }
        )
      ).rejects.toThrowError(TRPCError);

      try {
        await db.updateDossier(
          createdDossier.id,
          { notes: "Modification horodatage expiré" },
          1,
          "Opérateur IGS",
          { expectedUpdatedAt: pastDate }
        )
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
      }
    });

    it("permet l'écrasement forcé avec forceOverwrite: true malgré une version obsolète", async () => {
      // Mettre à jour en version 2
      await db.updateDossier(
        createdDossier.id,
        { notes: "Mise à jour standard" },
        1,
        "Opérateur A",
        { expectedVersion: 1 }
      );

      // Écrasement forcé avec forceOverwrite: true et version périmée (1)
      const overwritten = await db.updateDossier(
        createdDossier.id,
        { notes: "Écrasement forcé validé par le responsable" },
        2,
        "Superviseur B",
        { expectedVersion: 1, forceOverwrite: true }
      );

      expect(overwritten.version).toBe(3);
      expect(overwritten.notes).toBe("Écrasement forcé validé par le responsable");
    });

    it("gère les conflits de concurrence via les routers tRPC dossier.update et dossier.updateCustoms", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, name: "Déclarant PAC Test", role: "declarant" },
      });

      // 1ère mutation tRPC
      const res1 = await caller.dossier.update({
        id: createdDossier.id,
        expectedVersion: 1,
        data: {
          client: "Ciments de Guinée SA",
          transportMode: "Maritime",
          blLtaNumber: "MSKU987654321",
          goodsReleaseDate: null,
          eta: null,
          container: null,
          bulk: null,
          cargoNature: "Clinker",
          originPort: null,
          destinationPort: null,
          regime: "IM4",
          service: "Transit",
          notes: "Validation étape 1",
        } as any,
      });
      expect(res1.version).toBe(2);

      // 2ème mutation tRPC avec version périmée (1) -> Doit lancer CONFLICT
      await expect(
        caller.dossier.update({
          id: createdDossier.id,
          expectedVersion: 1,
          data: {
            client: "Ciments de Guinée SA",
            transportMode: "Maritime",
            notes: "Tentative concurrente en conflit",
          } as any,
        })
      ).rejects.toThrowError();

      // Mutation customs avec updateCustoms et expectedVersion
      const customRes = await caller.dossier.updateCustoms({
        id: createdDossier.id,
        expectedVersion: 2,
        data: {
          declarationNumber: "SYD-2026-GN-88",
          badStatus: "Delivre",
        },
      });
      expect(customRes.version).toBe(3);
      expect(customRes.declarationNumber).toBe("SYD-2026-GN-88");
      expect(customRes.badStatus).toBe("Delivre");
    });
  });

  describe("Milestone 3: Audit Trail & Regulatory Logging (R3)", () => {
    it("enregistre un événement DOSSIER_CREE lors de la création d'un dossier", async () => {
      const history = await db.listDossierHistory(createdDossier.id);
      expect(history.length).toBeGreaterThan(0);

      const creationEvent = history.find(h => h.action === "DOSSIER_CREE");
      expect(creationEvent).toBeDefined();
      expect(creationEvent?.authorName).toBe("Mamadou Diallo");
      expect(creationEvent?.userRole).toBe("declarant");
      expect(creationEvent?.entityType).toBe("dossier");
      expect(creationEvent?.entityId).toBe(createdDossier.id);
    });

    it("journalise automatiquement les transitions douanières (SYDONIA, BLD, BAE, PAC)", async () => {
      // 1. DDI GUCEG
      await db.updateDossier(
        createdDossier.id,
        { ddiGucegNumber: "DDI-2026-GN-0045" },
        1,
        "Déclarant GUCEG",
        { userRole: "declarant" }
      );

      // 2. Déclaration SYDONIA
      await db.updateDossier(
        createdDossier.id,
        { declarationNumber: "DEC-2026-C-9902" },
        1,
        "Déclarant Douane",
        { userRole: "declarant" }
      );

      // 3. Liquidation BLD
      await db.updateDossier(
        createdDossier.id,
        { bulletinNumber: "BLD-2026-1188" },
        1,
        "Inspecteur Douane",
        { userRole: "declarant" }
      );

      // 4. BAD & BAE
      await db.updateDossier(
        createdDossier.id,
        { badStatus: "Delivre", baeStatus: "Delivre" },
        1,
        "Chef de Brigade PAC",
        { userRole: "declarant" }
      );

      // 5. Sortie PAC
      await db.updateDossier(
        createdDossier.id,
        { goodsReleaseDate: new Date("2026-09-05T14:30:00Z") },
        1,
        "Agent Terminal PAC",
        { userRole: "declarant" }
      );

      const history = await db.listDossierHistory(createdDossier.id);

      const ddiEvent = history.find(h => h.action === "DDI_MODIFIEE");
      expect(ddiEvent).toBeDefined();
      expect(ddiEvent?.newValue).toBe("DDI-2026-GN-0045");

      const sydoniaEvent = history.find(h => h.action === "SYDONIA_DECLAREE");
      expect(sydoniaEvent).toBeDefined();
      expect(sydoniaEvent?.newValue).toBe("DEC-2026-C-9902");

      const bldEvent = history.find(h => h.action === "BLD_LIQUIDEE");
      expect(bldEvent).toBeDefined();
      expect(bldEvent?.newValue).toBe("BLD-2026-1188");

      const badEvent = history.find(h => h.action === "BAD_STATUT_MODIFIE");
      expect(badEvent).toBeDefined();
      expect(badEvent?.newValue).toBe("Delivre");

      const baeEvent = history.find(h => h.action === "BAE_STATUT_MODIFIE");
      expect(baeEvent).toBeDefined();
      expect(baeEvent?.newValue).toBe("Delivre");

      const pacReleaseEvent = history.find(h => h.action === "SORTIE_PAC_ENREGISTREE");
      expect(pacReleaseEvent).toBeDefined();
    });

    it("journalise les opérations sur les pièces et documents (Ajout et Suppression)", async () => {
      const doc = await db.createDocument({
        dossierId: createdDossier.id,
        name: "Connaissement_Original_MSKU.pdf",
        type: "BL",
        fileUrl: "https://storage.igs-transit.gn/docs/msku.pdf",
        fileSize: 1024 * 450,
        mimeType: "application/pdf",
        uploadedById: 1,
        uploaderName: "Mamadou Diallo",
      });

      expect(doc).toBeDefined();

      let history = await db.listDossierHistory(createdDossier.id);
      const addDocEvent = history.find(h => h.action === "DOCUMENT_AJOUTE");
      expect(addDocEvent).toBeDefined();
      expect(addDocEvent?.entityType).toBe("document");
      expect(addDocEvent?.newValue).toBe("BL: Connaissement_Original_MSKU.pdf");
      expect(addDocEvent?.metadata).toContain("application/pdf");

      await db.deleteDocument(doc.id, 1, "Mamadou Diallo");

      history = await db.listDossierHistory(createdDossier.id);
      const deleteDocEvent = history.find(h => h.action === "DOCUMENT_SUPPRIME");
      expect(deleteDocEvent).toBeDefined();
      expect(deleteDocEvent?.entityType).toBe("document");
      expect(deleteDocEvent?.previousValue).toBe("BL: Connaissement_Original_MSKU.pdf");
    });

    it("journalise l'émission de facture, l'encaissement et les avances débours PAC", async () => {
      // 1. Facturation
      const invoice = await db.createInvoice(
        {
          dossierId: createdDossier.id,
          invoiceNumber: "FAC-2026-0899",
          clientName: "Ciments de Guinée SA",
          amountHt: 25000000,
          vatAmount: 4500000,
          amountTtc: 29500000,
          currency: "GNF",
          status: "Emise",
          createdById: 2,
        },
        2,
        "Fatoumata Camara"
      );

      expect(invoice).toBeDefined();

      // 2. Encaissement Paiement
      const payment = await db.recordInvoicePayment(
        invoice.id,
        {
          amount: 29500000,
          paymentMethod: "Virement bancaire Vista GUI",
          paymentReference: "VIR-VISTA-20260820-01",
        },
        2,
        "Fatoumata Camara"
      );

      expect(payment).toBeDefined();

      // 3. Débours PAC
      const disbursement = await db.createPacDisbursement(
        {
          dossierId: createdDossier.id,
          type: "Frais de Quai & Manutention PAC",
          amount: 8500000,
          receiptNumber: "QUITTANCE-PAC-7781",
          status: "Avance",
          beneficiary: "Port Autonome de Conakry (PAC)",
          createdById: 2,
        },
        2,
        "Fatoumata Camara"
      );

      expect(disbursement).toBeDefined();

      const history = await db.listDossierHistory(createdDossier.id);

      const invoiceEvent = history.find(h => h.action === "FACTURE_CREEE");
      expect(invoiceEvent).toBeDefined();
      expect(invoiceEvent?.entityType).toBe("invoice");
      expect(invoiceEvent?.newValue).toBe("Proforma N° FAC-2026-0899");
      expect(invoiceEvent?.userRole).toBe("comptable");

      const paymentEvent = history.find(h => h.action === "PAIEMENT_ENCAISSE");
      expect(paymentEvent).toBeDefined();
      expect(paymentEvent?.entityType).toBe("payment");
      expect(paymentEvent?.userRole).toBe("comptable");

      const deboursEvent = history.find(h => h.action === "DEBOURS_AVANCE");
      expect(deboursEvent).toBeDefined();
      expect(deboursEvent?.entityType).toBe("disbursement");
      expect(deboursEvent?.userRole).toBe("comptable");
      expect(deboursEvent?.metadata).toContain("QUITTANCE-PAC-7781");
    });

    it("expose l'historique complet via la procédure tRPC audit.list", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, name: "Auditeur Interne", role: "admin" },
      });

      const auditList = await caller.audit.list({ dossierId: createdDossier.id });
      expect(Array.isArray(auditList)).toBe(true);
      expect(auditList.length).toBeGreaterThan(0);
      expect(auditList[0]).toHaveProperty("action");
      expect(auditList[0]).toHaveProperty("userRole");
      expect(auditList[0]).toHaveProperty("createdAt");
      expect(auditList[0]).toHaveProperty("authorName");
    });
  });
});
