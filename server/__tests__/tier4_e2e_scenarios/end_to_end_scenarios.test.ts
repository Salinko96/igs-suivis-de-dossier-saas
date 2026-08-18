import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";
import { calculateInvoiceFinancials, convertCurrency } from "../tier1_business_logic/currency_conversion.test";
import { getTargetRedirectOnRoleSwitch, getVisibleMenuItems } from "../tier3_ui_navigation_guards/route_guards.test";

function createSessionContext(user: any): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user,
  };
}

describe("Tier 4 - Real-World E2E Scenarios: Multi-Persona Operational Lifecycle (R1, R2, R3, R4)", () => {
  describe("Scénario 1 : Cycle de Vie Complet d'un Dossier de Transit Maritime (Admin -> Déclarant -> Comptable -> Client)", () => {
    let createdDossierId: number;
    let dossierNumber: string;

    it("Étape 1 [Admin IGS] : Création du dossier d'importation maritime et assignation", async () => {
      const adminCtx = createSessionContext({
        id: 1,
        openId: "igs_admin_conakry",
        name: "Ibrahima Gold Service (Admin)",
        role: "admin",
      });
      const adminCaller = appRouter.createCaller(adminCtx);

      const newDossier = await adminCaller.dossier.create({
        client: "Guinean Birimian Gold S.A",
        clientDossierNumber: "GBG-EXP-2026-0099",
        blLtaNumber: "MSC-CONAKRY-9988",
        cargoNature: "Pompes hydrauliques et pièces de broyeur minier",
        transportMode: "Maritime",
        originPort: "Anvers",
        destinationPort: "Port Autonome de Conakry",
        container: "2 x 40' HC",
        eta: new Date(Date.now() + 86400000 * 4), // ETA dans 4 jours
        responsible: "Mamadou",
      });

      expect(newDossier).toBeDefined();
      expect(newDossier.dossierNumber).toMatch(/^DOS-\d{4}/);
      expect(newDossier.calculatedStatus).toBe("À régulariser");
      expect(newDossier.client).toBe("Guinean Birimian Gold S.A");

      createdDossierId = newDossier.id;
      dossierNumber = newDossier.dossierNumber;

      // L'Admin crée la tâche prioritaire pour Mamadou Diallo
      const task = await adminCaller.task.create({
        dossierId: createdDossierId,
        title: `Établir déclaration SYDONIA World pour ${dossierNumber}`,
        assignedTo: "Mamadou Diallo",
        priority: "Haute",
      });
      expect(task.status).toBe("A_faire");
    });

    it("Étape 2 [Déclarant PAC Mamadou Diallo] : Prise en charge opérationnelle, saisie SYDONIA et validation BAE", async () => {
      const declarantCtx = createSessionContext({
        id: 2,
        openId: "declarant_conakry",
        name: "Mamadou Diallo (Déclarant)",
        role: "declarant",
      });
      const declarantCaller = appRouter.createCaller(declarantCtx);

      // Le déclarant consulte ses tâches
      const tasks = await declarantCaller.task.list({ dossierId: createdDossierId });
      const taskToComplete = tasks.find(t => t.assignedTo?.includes("Mamadou Diallo"));
      expect(taskToComplete).toBeDefined();

      // Le déclarant met à jour les identifiants douaniers SYDONIA & BLD
      const updatedDossier = await declarantCaller.dossier.update({
        id: createdDossierId,
        data: {
          declarationNumber: "S 889- 2026",
          bulletinNumber: "L 1723- 2026",
          customsStatus: "BAE accordé",
          goodsReleaseDate: new Date(),
        },
      });

      expect(updatedDossier.declarationNumber).toBe("S 889- 2026");
      expect(updatedDossier.bulletinNumber).toBe("L 1723- 2026");
      expect(updatedDossier.calculatedStatus).toBe("Régularisé");

      // Le déclarant valide et coche sa tâche
      const finishedTask = await declarantCaller.task.updateStatus({
        id: taskToComplete!.id,
        status: "Termine",
      });
      expect(finishedTask.status).toBe("Termine");
      expect(finishedTask.completedAt).not.toBeNull();
    });

    it("Étape 3 [Comptable Fatoumata Camara] : Émission de la facture multi-devises, débours et encaissement", async () => {
      const comptableCtx = createSessionContext({
        id: 3,
        openId: "comptable_conakry",
        name: "Fatoumata Camara (Comptable)",
        role: "comptable",
      });
      const comptableCaller = appRouter.createCaller(comptableCtx);

      // Calculs financiers avec TVA 18% et Débours douaniers
      const amountHt = 30_000_000;
      const disbursements = 75_000_000;
      const financials = calculateInvoiceFinancials({
        amountHt,
        disbursementsAmount: disbursements,
      });

      expect(financials.amountTva).toBe(5_400_000);
      expect(financials.amountTtc).toBe(35_400_000);
      expect(financials.totalPayable).toBe(110_400_000);

      // Création de la facture
      const invoice = await comptableCaller.finance.createInvoice({
        dossierId: createdDossierId,
        client: "Guinean Birimian Gold S.A",
        currency: "GNF",
        amountHt: financials.amountHt,
        amountTva: financials.amountTva,
        amountTtc: financials.amountTtc,
        disbursementsAmount: financials.disbursementsAmount,
        status: "Payée",
        notes: "Règlement intégral reçu - Quittance N° Q-2026-0889 émise",
      });

      expect(invoice.status).toBe("Payée");
      expect(invoice.paidAt).not.toBeNull();

      // Vérifie l'équivalence en USD pour le reporting
      const equivalentUsd = convertCurrency(financials.totalPayable, "GNF", "USD");
      expect(equivalentUsd).toBeGreaterThan(0);

      // Vérifie que le statut financier du dossier est 'Payé'
      const finalizedDossier = await comptableCaller.dossier.get({ id: createdDossierId });
      expect(finalizedDossier?.financialStatus).toBe("Payé");
    });

    it("Étape 4 [Portail Client Guinean Birimian Gold] : Consultation sécurisée sans fuite de marge", async () => {
      const clientCtx = createSessionContext({
        id: 4,
        openId: "client_birimian",
        name: "Guinean Birimian Gold S.A",
        role: "client",
        clientCompany: "Guinean Birimian Gold S.A",
      });
      const clientCaller = appRouter.createCaller(clientCtx);

      // Consultation de la liste des dossiers
      const dossiers = await clientCaller.dossier.list();
      const myDossier = dossiers.find(d => d.id === createdDossierId);

      expect(myDossier).toBeDefined();
      expect(myDossier?.dossierNumber).toBe(dossierNumber);
      expect(myDossier?.calculatedStatus).toBe("Régularisé");
      expect(myDossier?.financialStatus).toBe("Payé");

      // Suivi public direct via code
      const publicTracking = await clientCaller.portal.track({
        accessCodeOrNumber: dossierNumber,
      });

      expect(publicTracking.dossier.dossierNumber).toBe(dossierNumber);
      expect(publicTracking.timeline.length).toBeGreaterThan(0);
    });
  });

  describe("Scénario 2 : Test d'Intrusion RBAC & Prévention des Fuites de Données", () => {
    it("interdit aux profils non-admin de supprimer des dossiers ou d'altérer les référentiels", async () => {
      const declarantCaller = appRouter.createCaller(createSessionContext({ id: 2, role: "declarant" }));
      const comptableCaller = appRouter.createCaller(createSessionContext({ id: 3, role: "comptable" }));
      const clientCaller = appRouter.createCaller(createSessionContext({ id: 4, role: "client" }));

      // Tentatives de suppression de dossier
      await expect(declarantCaller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);
      await expect(comptableCaller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);
      await expect(clientCaller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);

      // Tentatives de modification de référentiels
      await expect(declarantCaller.reference.create({ category: "client", label: "Bad Entity" })).rejects.toThrow(/permission|forbidden/i);
      await expect(comptableCaller.reference.create({ category: "client", label: "Bad Entity" })).rejects.toThrow(/permission|forbidden/i);
      await expect(clientCaller.reference.create({ category: "client", label: "Bad Entity" })).rejects.toThrow(/permission|forbidden/i);
    });

    it("rejette les requêtes non authentifiées sur les procédures protégées", async () => {
      const anonymousCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: null,
      });

      await expect(anonymousCaller.dossier.list()).rejects.toThrow(/login|unauthorized/i);
      await expect(anonymousCaller.finance.summary()).rejects.toThrow(/login|unauthorized/i);
      await expect(anonymousCaller.task.list()).rejects.toThrow(/login|unauthorized/i);
    });
  });

  describe("Scénario 3 : Transition Instantanée des Rôles dans le Simulateur", () => {
    it("valide la séquence complète de switch sans rechargement de page", () => {
      const rolesSequence = ["admin", "declarant", "comptable", "client", "admin"] as const;

      for (const role of rolesSequence) {
        const targetRoute = getTargetRedirectOnRoleSwitch(role);
        const visibleMenus = getVisibleMenuItems(role);

        if (role === "declarant") {
          expect(targetRoute).toBe("/planning");
          expect(visibleMenus.map(m => m.path)).not.toContain("/finances");
        } else if (role === "comptable") {
          expect(targetRoute).toBe("/finances");
          expect(visibleMenus.map(m => m.path)).not.toContain("/planning");
        } else if (role === "client") {
          expect(targetRoute).toBe("/portail-client");
          expect(visibleMenus.map(m => m.path)).not.toContain("/controles");
        } else if (role === "admin") {
          expect(targetRoute).toBe("/");
          expect(visibleMenus).toHaveLength(6);
        }
      }
    });
  });
});
