import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";

function createClientContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 4,
      openId: "client_birimian",
      name: "Guinean Birimian Gold (Portail)",
      email: "logistique@birimian-gold.gn",
      role: "client",
      loginMethod: "direct",
      clientCompany: "Guinean Birimian Gold S.A",
      phone: "+224 623 77 88 99",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Tier 2 - tRPC Server RBAC & Integration: Client Portal Multi-Tenant Isolation (R1)", () => {
  const ctx = createClientContext();
  const caller = appRouter.createCaller(ctx);

  describe("1. Étanchéité Multi-Société & Filtrage Automatique des Dossiers", () => {
    it("filtre automatiquement les dossiers sur la société du client connecté (Guinean Birimian Gold S.A)", async () => {
      const clientDossiers = await caller.dossier.list({});

      expect(Array.isArray(clientDossiers)).toBe(true);
      expect(clientDossiers.length).toBeGreaterThan(0);

      // Tous les dossiers renvoyés doivent appartenir à Guinean Birimian Gold
      for (const d of clientDossiers) {
        expect(d.client).toMatch(/Guinean Birimian Gold/i);
      }

      // Aucun dossier de New Japon Mining ou Boké Alumina ne doit être présent
      const otherCompanyDossiers = clientDossiers.filter(
        d => d.client && (d.client.includes("New Japon") || d.client.includes("Boké Alumina"))
      );
      expect(otherCompanyDossiers).toHaveLength(0);
    });

    it("empêche le client de surcharger le filtre client pour voir les dossiers d'un tiers", async () => {
      // Le client tente de forcer le filtre client="New Japon Mining"
      const attemptedExploit = await caller.dossier.list({
        client: "New Japon Mining",
      });

      // Le serveur doit appliquer son filtre de session et renvoyer une liste vide (puisque New Japon n'est pas Birimian Gold)
      expect(attemptedExploit).toHaveLength(0);
    });
  });

  describe("2. Suivi Public Direct par Code ou Numéro de BL (portal.track)", () => {
    it("permet le suivi en temps réel d'un dossier via son numéro ou code d'accès", async () => {
      const publicTrack = await caller.portal.track({
        accessCodeOrNumber: "DOS-0001",
      });

      expect(publicTrack).toBeDefined();
      expect(publicTrack.dossier).toBeDefined();
      expect(publicTrack.dossier.dossierNumber).toBe("DOS-0001");
      expect(Array.isArray(publicTrack.documents)).toBe(true);
      expect(Array.isArray(publicTrack.timeline)).toBe(true);
    });

    it("rejette une tentative de suivi avec un code ou numéro inexistant", async () => {
      await expect(
        caller.portal.track({ accessCodeOrNumber: "DOS-INCONNU-9999" })
      ).rejects.toThrow(/introuvable/i);
    });
  });

  describe("3. Bouclier de Sécurité du Portail Client", () => {
    it("interdit au client de supprimer un dossier (403 Forbidden)", async () => {
      await expect(caller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);
    });

    it("interdit au client de modifier les référentiels de transport/douane (403 Forbidden)", async () => {
      await expect(
        caller.reference.create({ category: "client", label: "Société Hackée" })
      ).rejects.toThrow(/permission|forbidden/i);
    });
  });
});
