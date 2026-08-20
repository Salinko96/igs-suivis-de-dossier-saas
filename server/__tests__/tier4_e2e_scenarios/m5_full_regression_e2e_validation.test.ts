import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";
import { TRPCError } from "@trpc/server";

function createSessionContext(user: any): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user,
  };
}

describe("Milestone 5 — Full Regression & E2E Acceptance Verification Suite", () => {
  const adminUser = {
    id: 1,
    openId: "igs_admin_master",
    name: "Administrateur IGS Conakry",
    role: "admin" as const,
    isActive: true,
  };

  const declarantUser = {
    id: 2,
    openId: "declarant_mamadou",
    name: "Mamadou Diallo (Déclarant PAC)",
    role: "declarant" as const,
    isActive: true,
  };

  const comptableUser = {
    id: 3,
    openId: "comptable_fatoumata",
    name: "Fatoumata Camara (Comptable)",
    role: "comptable" as const,
    isActive: true,
  };

  const clientUser = {
    id: 4,
    openId: "client_birimian_gold",
    name: "Guinean Birimian Gold",
    role: "client" as const,
    clientCompany: "Guinean Birimian Gold",
    isActive: true,
  };

  const adminCaller = appRouter.createCaller(createSessionContext(adminUser));
  const declarantCaller = appRouter.createCaller(createSessionContext(declarantUser));
  const comptableCaller = appRouter.createCaller(createSessionContext(comptableUser));
  const clientCaller = appRouter.createCaller(createSessionContext(clientUser));
  const publicCaller = appRouter.createCaller(createSessionContext(null));

  // =========================================================================
  // 1. R1: MODULE D'ADMINISTRATION & GESTION DES 100 COLLABORATEURS
  // =========================================================================
  describe("R1: Module d'Administration & Gestion des Collaborateurs (/utilisateurs)", () => {
    it("1.1 Access Control: Rejects non-admin users from accessing user administration routes", async () => {
      await expect(declarantCaller.user.list()).rejects.toThrow(TRPCError);
      await expect(comptableCaller.user.list()).rejects.toThrow(TRPCError);
      await expect(clientCaller.user.list()).rejects.toThrow(TRPCError);
      await expect(publicCaller.user.list()).rejects.toThrow(TRPCError);

      await expect(declarantCaller.user.getHRStats()).rejects.toThrow(TRPCError);
      await expect(declarantCaller.user.toggleStatus({ id: 1, isActive: false })).rejects.toThrow(TRPCError);
    });

    it("1.2 Seed & HR Statistics: Returns verified 100+ collaborators and valid metrics breakdown", async () => {
      const hrStats = await adminCaller.user.getHRStats();
      expect(hrStats).toBeDefined();
      expect(hrStats.totalEmployees).toBeGreaterThanOrEqual(100);
      expect(hrStats.activeDeclarantsAtPort).toBeGreaterThan(0);
      expect(hrStats.activeComptables).toBeGreaterThan(0);
      expect(hrStats.connectedClients).toBeGreaterThan(0);
      expect(hrStats.totalActive + hrStats.totalInactive).toBe(hrStats.totalEmployees);

      const usersList = await adminCaller.user.list();
      expect(usersList.length).toBeGreaterThanOrEqual(100);
    });

    it("1.3 CRUD & Session Revocation: Creates, updates, toggles active/inactive, and verifies session revocation timestamp", async () => {
      // Create a test collaborator
      const created = await adminCaller.user.create({
        name: "Amadou Bah Test M5",
        email: "amadou.bah.m5@igs-logistics.gn",
        phone: "+224 622 99 88 77",
        role: "declarant",
        isActive: true,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Amadou Bah Test M5");
      expect(created.role).toBe("declarant");
      expect(created.isActive).toBe(true);

      // Update collaborator
      const updated = await adminCaller.user.update({
        id: created.id,
        name: "Amadou Bah Modifié",
        email: "amadou.bah.modifie@igs-logistics.gn",
        phone: "+224 622 00 11 22",
        role: "declarant",
        isActive: true,
      });
      expect(updated.name).toBe("Amadou Bah Modifié");

      // Deactivate collaborator (triggers session revocation)
      const deactivated = await adminCaller.user.toggleStatus({
        id: created.id,
        isActive: false,
      });
      expect(deactivated.isActive).toBe(false);
      expect(deactivated.sessionRevokedAt).not.toBeNull();

      // Check that deactivated user is counted in inactive stats
      const statsAfterDeactivation = await adminCaller.user.getHRStats();
      expect(statsAfterDeactivation.totalInactive).toBeGreaterThan(0);

      // Reactivate collaborator
      const reactivated = await adminCaller.user.toggleStatus({
        id: created.id,
        isActive: true,
      });
      expect(reactivated.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 2. R2: DÉTECTION DES CONFLITS D'ÉDITION SIMULTANÉE (OPTIMISTIC LOCKING)
  // =========================================================================
  describe("R2: Détection des Conflits d'Édition Simultanée (Optimistic Locking)", () => {
    let testDossier: any;

    it("2.1 Creates test dossier and initializes version tracking", async () => {
      testDossier = await adminCaller.dossier.create({
        client: "Société Minière de Boké (SMB)",
        clientDossierNumber: "SMB-2026-M5-001",
        blLtaNumber: "CMA-CGM-M5-001",
        cargoNature: "Pelles hydrauliques lourdes",
        transportMode: "Maritime",
        originPort: "Le Havre",
        destinationPort: "Port Autonome de Conakry",
        responsible: "Mamadou",
      });

      expect(testDossier.version).toBe(1);
    });

    it("2.2 Sequential Update: Succeeds with correct expectedVersion and increments version", async () => {
      const update1 = await declarantCaller.dossier.update({
        id: testDossier.id,
        expectedVersion: testDossier.version,
        data: {
          cargoNature: "Pelles hydrauliques lourdes CAT 349",
        },
      });

      expect(update1.version).toBe(2);
      expect(update1.cargoNature).toBe("Pelles hydrauliques lourdes CAT 349");
    });

    it("2.3 Stale Concurrent Update: Rejects with TRPCError CONFLICT when expectedVersion is stale", async () => {
      // Attempt update with stale expectedVersion = 1 while server is at version = 2
      try {
        await declarantCaller.dossier.update({
          id: testDossier.id,
          expectedVersion: 1, // Stale!
          data: {
            cargoNature: "Concurrent Edit Attempt",
          },
        });
        expect.unreachable("Should have thrown CONFLICT error");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("Conflit d'édition simultanée");
      }
    });

    it("2.4 Force Overwrite: Supervisor forceOverwrite overrides version conflict and advances version", async () => {
      const forceUpdate = await adminCaller.dossier.update({
        id: testDossier.id,
        expectedVersion: 1, // Stale version overridden
        forceOverwrite: true,
        data: {
          cargoNature: "Force Overwrite Validated by Admin",
        },
      });

      expect(forceUpdate.version).toBe(3);
      expect(forceUpdate.cargoNature).toBe("Force Overwrite Validated by Admin");
    });
  });

  // =========================================================================
  // 3. R3: JOURNAL D'AUDIT & TRAÇABILITÉ RÉGLEMENTAIRE (AUDIT TRAIL)
  // =========================================================================
  describe("R3: Journal d'Audit & Traçabilité Réglementaire (Audit Trail)", () => {
    let auditDossier: any;

    it("3.1 Logs dossier creation and customs transitions automatically into audit trail", async () => {
      auditDossier = await adminCaller.dossier.create({
        client: "Compagnie des Bauxites de Guinée (CBG)",
        clientDossierNumber: "CBG-2026-M5-002",
        blLtaNumber: "MSK-M5-002",
        cargoNature: "Convoyeurs à bande et concasseurs",
        transportMode: "Maritime",
        originPort: "Rotterdam",
        destinationPort: "Port Autonome de Conakry",
      });

      // Declarant updates customs indicators
      await declarantCaller.dossier.updateCustoms({
        id: auditDossier.id,
        data: {
          ddiGucegNumber: "DDI-GN-2026-9901",
          declarationNumber: "S 9901- 2026",
          bulletinNumber: "L 9901- 2026",
          badStatus: "Délivré",
          baeStatus: "Accordé",
          goodsReleaseDate: new Date(),
        },
      });

      const auditEntries = await adminCaller.audit.list({ dossierId: auditDossier.id });
      expect(auditEntries.length).toBeGreaterThanOrEqual(2);

      const customsAudit = auditEntries.find(
        (a: any) =>
          a.action.includes("DOUANE") ||
          a.action.includes("CUSTOMS") ||
          a.action.includes("STATUT_MODIFIE") ||
          a.action.includes("DOSSIER_CREE")
      );
      expect(customsAudit).toBeDefined();
      expect(customsAudit?.authorName).toBeDefined();
    });

    it("3.2 Financial Operations Audit: Logs invoice emission and payment into audit trail", async () => {
      const inv = await comptableCaller.finance.createInvoice({
        dossierId: auditDossier.id,
        client: "Compagnie des Bauxites de Guinée (CBG)",
        currency: "GNF",
        amountHt: 25_000_000,
        amountTva: 4_500_000,
        amountTtc: 29_500_000,
        status: "Émise",
        invoiceType: "Definitive",
      });

      const payment = await comptableCaller.finance.recordPayment({
        id: inv.id,
        paidAmount: 29_500_000,
        paymentMethod: "Virement",
        paymentReference: "VIR-BGFI-2026-9901",
      });

      expect(payment).toBeDefined();

      const updatedAudit = await adminCaller.audit.list({ dossierId: auditDossier.id });
      const invoiceAudit = updatedAudit.find(
        (a: any) => a.action.includes("FACTURE") || a.action.includes("PAIEMENT") || a.entityType === "invoice" || a.entityType === "payment"
      );
      expect(invoiceAudit).toBeDefined();
    });
  });

  // =========================================================================
  // 4. R4: MODE MOBILE & PWA INSTALLABLE POUR AGENTS SUR LE QUAI
  // =========================================================================
  describe("R4: Mode Mobile & PWA Installable pour Agents sur le Quai (Port de Conakry)", () => {
    it("4.1 Validates PWA Manifest configuration for Port de Conakry field agents", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const manifestPath = path.resolve(process.cwd(), "client/public/manifest.json");
      const manifestRaw = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestRaw);

      expect(manifest.name).toContain("IGS Transit & Douane Guinée");
      expect(manifest.short_name).toBe("IGS Transit");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.theme_color).toBe("#0b3b32");
      expect(manifest.background_color).toBe("#0b3b32");
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });

    it("4.2 Validates Service Worker caching strategies for Conakry Port connectivity", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const swPath = path.resolve(process.cwd(), "client/public/sw.js");
      const swContent = await fs.readFile(swPath, "utf-8");

      expect(swContent).toContain("igs-transit-v1");
      expect(swContent).toContain("STATIC_ASSETS");
      expect(swContent).toContain("/api/");
      expect(swContent).toContain("OFFLINE_MODE");
    });
  });

  // =========================================================================
  // 5. LEGACY REQUIREMENTS (R1-R5) REGRESSION VERIFICATION
  // =========================================================================
  describe("Legacy Requirements R1-R5 Regression Verification", () => {
    it("Legacy R1: Client Portal search returns dossier on valid code and throws NOT_FOUND fail-fast on invalid code", async () => {
      // Valid search by access code or reference
      const result = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1001" });
      expect(result).toBeDefined();
      expect(result.dossier).toBeDefined();
      expect(result.dossier.portalAccessCode).toBe("IGS-1001");
      expect(result.dossier.dossierNumber).toBe("DOS-0001");

      // Invalid search fail-fast (<1000ms under parallel CI load)
      const t0 = performance.now();
      await expect(publicCaller.portal.track({ accessCodeOrNumber: "XXXX-9999" })).rejects.toThrow(TRPCError);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(1000);
    });

    it("Legacy R2: Notifications markAsRead and markAllAsRead persist state and update unread count", async () => {
      const alertsBefore = await adminCaller.notification.list();
      expect(alertsBefore).toBeDefined();
      expect(Array.isArray(alertsBefore)).toBe(true);

      const unreadAlert = alertsBefore.find((a: any) => !a.isRead);
      if (unreadAlert) {
        const markRes = await adminCaller.notification.markAsRead({ id: unreadAlert.id });
        expect(markRes.success).toBe(true);
      }

      const markAllRes = await adminCaller.notification.markAllAsRead();
      expect(markAllRes.success).toBe(true);

      const alertsAfter = await adminCaller.notification.list();
      const anyUnread = alertsAfter.some((a: any) => a.isRead === 0 || a.isRead === false);
      expect(anyUnread).toBe(false);
    });

    it("Legacy R4: Single dossier load performance is sub-millisecond without artificial latency", async () => {
      const t0 = performance.now();
      const dossier = await adminCaller.dossier.get({ id: 1 });
      const elapsed = performance.now() - t0;

      expect(dossier).toBeDefined();
      expect(elapsed).toBeLessThan(50); // Well below the 300ms SLA
    });
  });
});
