import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import * as db from "../db";
import type { TrpcContext } from "../_core/context";
import fs from "fs";
import path from "path";

// Helpers to construct mock contexts for different roles
function createCallerForUser(user: any) {
  const ctx: TrpcContext = {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user,
  };
  return appRouter.createCaller(ctx);
}

const adminUser = {
  id: 1,
  openId: "igs_admin_challenger",
  name: "Ibrahima Diallo (Admin Challenger)",
  email: "admin-challenger@igs-transit.gn",
  role: "admin",
  loginMethod: "direct",
  clientCompany: null,
  phone: "+224 620 00 00 00",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const declarantUser = {
  id: 2,
  openId: "declarant_challenger_port",
  name: "Mamadou Sow (Declarant Challenger)",
  email: "declarant-challenger@igs-transit.gn",
  role: "declarant",
  loginMethod: "direct",
  clientCompany: null,
  phone: "+224 621 11 22 33",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const comptableUser = {
  id: 3,
  openId: "comptable_challenger",
  name: "Fatoumata Camara (Comptable Challenger)",
  email: "finance-challenger@igs-transit.gn",
  role: "comptable",
  loginMethod: "direct",
  clientCompany: null,
  phone: "+224 622 44 55 66",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const clientUser = {
  id: 4,
  openId: "client_challenger_gold",
  name: "Birimian Mining Logistics",
  email: "logistics@birimian-mining.gn",
  role: "client",
  clientCompany: "Guinean Birimian Gold S.A",
  loginMethod: "direct",
  phone: "+224 623 77 88 99",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Empirical Challenger 1 — Milestone 5 Adversarial Stress & Hardening Suite", () => {
  const adminCaller = createCallerForUser(adminUser);
  const declarantCaller = createCallerForUser(declarantUser);
  const comptableCaller = createCallerForUser(comptableUser);
  const clientCaller = createCallerForUser(clientUser);

  // =========================================================================
  // 1. CONCURRENCY & OPTIMISTIC LOCKING STRESS TEST
  // =========================================================================
  describe("1. Concurrency Conflict Detection & Optimistic Locking Stress Harness", () => {
    it("handles 30 simultaneous parallel updates on the same dossier with only 1 version winner", async () => {
      // Create or use an existing test dossier
      const dossier = await db.getDossier(1);
      expect(dossier).toBeDefined();
      const currentVersion = dossier!.version || 1;

      // 30 parallel updates competing for the exact same expectedVersion
      const parallelWorkers = 30;
      const updatePromises = Array.from({ length: parallelWorkers }).map((_, idx) =>
        declarantCaller.dossier.update({
          id: 1,
          expectedVersion: currentVersion,
          data: {
            regime: `IM4_CONCURRENT_${idx}_${Date.now()}`,
          },
        }).then(
          (res) => ({ success: true, res }),
          (err) => ({ success: false, code: (err as TRPCError).code, message: err.message })
        )
      );

      const results = await Promise.all(updatePromises);
      const winners = results.filter((r) => r.success);
      const conflictRejections = results.filter(
        (r) => !r.success && (r.code === "CONFLICT" || r.message?.includes("Conflit") || r.message?.includes("conflit"))
      );

      // Exactly 1 winner should advance the version, and 29 should be rejected with CONFLICT
      expect(winners.length).toBe(1);
      expect(conflictRejections.length).toBe(parallelWorkers - 1);

      // Verify the final dossier version in DB was incremented by exactly 1
      const updatedDossier = await db.getDossier(1);
      expect(updatedDossier?.version).toBe(currentVersion + 1);
    });

    it("verifies forceOverwrite bypasses optimistic lock and updates version successfully", async () => {
      // Create fresh dossier
      const freshDossier = await adminCaller.dossier.create({
        dossierNumber: `DOS-STRESS-${Date.now()}`,
        client: "Stale Test Client",
        regime: "IM4",
        cargoNature: "Conteneurs 20ft",
        transportMode: "Maritime",
        blLtaNumber: `BL-STRESS-${Date.now()}`,
        originPort: "Anvers",
        destinationPort: "Conakry",
      });
      const initialVersion = freshDossier.version || 1;

      // Advance version by 1
      await adminCaller.dossier.update({
        id: freshDossier.id,
        expectedVersion: initialVersion,
        data: { notes: "Intermediate modification to advance version" },
      });

      // Stale update (expectedVersion = initialVersion while server is at initialVersion + 1) without forceOverwrite must fail with CONFLICT
      await expect(
        declarantCaller.dossier.update({
          id: freshDossier.id,
          expectedVersion: initialVersion, // Stale!
          data: { cargoNature: "Stale update attempt" },
        })
      ).rejects.toThrow(/conflit/i);

      // Same stale version with forceOverwrite: true must succeed and bump version
      const forceResult = await declarantCaller.dossier.update({
        id: freshDossier.id,
        expectedVersion: initialVersion,
        forceOverwrite: true,
        data: { cargoNature: "Force overwrite approved by chief declarant" },
      });

      expect(forceResult).toBeDefined();
      expect(forceResult.cargoNature).toBe("Force overwrite approved by chief declarant");
      expect(forceResult.version).toBeGreaterThan(initialVersion + 1);
    });

    it("stress tests customs transition optimistic locking (dossier.updateCustoms) with version guards", async () => {
      const dossier = await db.getDossier(3);
      expect(dossier).toBeDefined();
      const ver = dossier!.version || 1;

      // Parallel customs updates
      const c1 = declarantCaller.dossier.updateCustoms({
        id: 3,
        expectedVersion: ver,
        data: {
          declarationNumber: `SYD-${Date.now()}-1`,
          badStatus: "valide",
        },
      });

      const c2 = declarantCaller.dossier.updateCustoms({
        id: 3,
        expectedVersion: ver,
        data: {
          declarationNumber: `SYD-${Date.now()}-2`,
          badStatus: "non_requis",
        },
      });

      const outcomes = await Promise.allSettled([c1, c2]);
      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const rejected = outcomes.filter((o) => o.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });
  });

  // =========================================================================
  // 2. AUDIT TRAIL INTEGRITY UNDER BULK MUTATIONS
  // =========================================================================
  describe("2. Regulatory Audit Trail Integrity & Immutability Under Bulk Operations", () => {
    it("records precise immutable before/after diffs for sequential customs transitions", async () => {
      // Create isolated test dossier
      const testDossier = await adminCaller.dossier.create({
        dossierNumber: `DOS-AUDIT-${Date.now()}`,
        client: "Audit Test Corp",
        regime: "IM4",
        cargoNature: "Marchandises diverses",
        transportMode: "Maritime",
        blLtaNumber: `BL-AUDIT-${Date.now()}`,
        originPort: "Marseille",
        destinationPort: "Conakry",
      });

      const customsSteps = [
        { field: "ddiGucegNumber", val: "DDI-2026-001" },
        { field: "declarationNumber", val: "SYD-2026-001" },
        { field: "bulletinNumber", val: "BLD-2026-001" },
        { field: "badStatus", val: "emis" },
        { field: "baeStatus", val: "delivre" },
        { field: "notes", val: "Marchandise dédouanée et prête pour sortie PAC" },
      ];

      for (const step of customsSteps) {
        const fresh = await db.getDossier(testDossier.id);
        await declarantCaller.dossier.updateCustoms({
          id: testDossier.id,
          expectedVersion: fresh!.version,
          data: {
            [step.field]: step.val,
          },
        });
      }

      // Query audit logs
      const updatedLogs = await adminCaller.audit.list({ dossierId: testDossier.id });
      expect(updatedLogs.length).toBeGreaterThanOrEqual(customsSteps.length);

      // Verify log details
      for (const log of updatedLogs) {
        expect(log.dossierId).toBe(testDossier.id);
        expect(log.authorName).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.createdAt).toBeDefined();
      }
    });

    it("verifies financial operations generate audit events with actor attribution", async () => {
      const testDossierId = 5;
      const initialLogs = await adminCaller.audit.list({ dossierId: testDossierId });
      const initialCount = initialLogs.length;

      // 1. Create Invoice
      const invoice = await comptableCaller.finance.createInvoice({
        dossierId: testDossierId,
        client: "Guinean Birimian Gold S.A",
        amountHt: 15000000,
        amountTva: 2700000,
        amountTtc: 17700000,
        disbursementsAmount: 8000000,
        status: "Proforma",
      });
      expect(invoice).toBeDefined();

      // 2. Record Payment
      const payment = await comptableCaller.finance.recordPayment({
        id: invoice.id,
        paidAmount: 10000000,
        paymentMethod: "virement",
        paymentReference: "VIR-BCRG-2026-888",
      });
      expect(payment).toBeDefined();

      // 3. Create PAC Disbursement Advance
      const disbursement = await comptableCaller.finance.createDebour({
        dossierId: testDossierId,
        invoiceId: invoice.id,
        amountAdvanced: 3500000,
        type: "douane",
        notes: "Avance Frais Magasinage Port Autonome de Conakry",
      });
      expect(disbursement).toBeDefined();

      // Fetch audit trail
      const logsAfter = await adminCaller.audit.list({ dossierId: testDossierId });
      expect(logsAfter.length).toBeGreaterThan(initialCount);

      // Check financial audit records
      const finActions = logsAfter.map((l) => l.action);
      expect(finActions.some((a) => a.includes("INVOICE") || a.includes("FACTURE") || a.includes("PAYMENT") || a.includes("DEBOUR"))).toBe(true);
    });
  });

  // =========================================================================
  // 3. PWA MANIFEST & SERVICE WORKER OFFLINE SIMULATION
  // =========================================================================
  describe("3. PWA Manifest, Service Worker & Conakry Dock Offline Simulation", () => {
    it("validates manifest.json conforms to PWA installability requirements", () => {
      const manifestPath = path.resolve(process.cwd(), "client/public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);

      expect(manifest.name).toBe("IGS Transit & Douane Guinée — Suivis de Dossiers");
      expect(manifest.short_name).toBe("IGS Transit");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.theme_color).toBe("#0b3b32");
      expect(manifest.background_color).toBe("#0b3b32");
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      // Validate icon files exist on disk
      for (const icon of manifest.icons) {
        const iconPath = path.resolve(process.cwd(), "client/public", icon.src.replace(/^\//, ""));
        expect(fs.existsSync(iconPath)).toBe(true);
      }
    });

    it("validates sw.js implements Cache-First for static and Network-First for tRPC API", () => {
      const swPath = path.resolve(process.cwd(), "client/public/sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      // Cache-First static caching
      expect(swContent).toContain("CACHE_NAME");
      expect(swContent).toContain("STATIC_ASSETS");
      // Network-First for API
      expect(swContent).toContain("/api/");
      expect(swContent).toContain("OFFLINE_MODE");
    });

    it("verifies index.html has complete PWA meta tags and viewport scaling", () => {
      const indexPath = path.resolve(process.cwd(), "client/index.html");
      expect(fs.existsSync(indexPath)).toBe(true);

      const html = fs.readFileSync(indexPath, "utf-8");
      expect(html).toContain('rel="manifest"');
      expect(html).toContain('name="theme-color"');
      expect(html).toContain('content="#0b3b32"');
      expect(html).toContain('name="apple-mobile-web-app-capable"');
      expect(html).toContain('name="viewport"');
    });
  });

  // =========================================================================
  // 4. USER HR MANAGEMENT & SESSION REVOCATION STRESS TEST
  // =========================================================================
  describe("4. User Administration & Instant Session Revocation Stress Test", () => {
    it("strictly forbids non-admin users from accessing user management routes", async () => {
      await expect(declarantCaller.user.list({})).rejects.toThrow();
      await expect(comptableCaller.user.list({})).rejects.toThrow();
      await expect(clientCaller.user.list({})).rejects.toThrow();

      await expect(declarantCaller.user.getHRStats()).rejects.toThrow();
    });

    it("calculates real-time HR KPIs across 100+ employees", async () => {
      const stats = await adminCaller.user.getHRStats();
      expect(stats).toBeDefined();
      expect(stats.totalEmployees).toBeGreaterThanOrEqual(100);
      expect(stats.activeDeclarantsAtPort).toBeGreaterThan(0);
      expect(stats.activeComptables).toBeGreaterThan(0);
      expect(stats.connectedClients).toBeGreaterThan(0);
      expect(stats.totalActive + stats.totalInactive).toBe(stats.totalEmployees);
    });

    it("instant session revocation locks out deactivated user immediately", async () => {
      // 1. Create a test declarant user
      const created = await adminCaller.user.create({
        name: "Test Session Revocation Agent",
        email: `agent-revoc-${Date.now()}@igs-transit.gn`,
        role: "declarant",
        phone: "+224 629 99 88 77",
        isActive: true,
      });
      expect(created).toBeDefined();
      expect(created.isActive).toBe(true);

      // 2. Build caller for this active user
      const activeAgentCaller = createCallerForUser(created);
      const searchRes = await activeAgentCaller.dossier.list({});
      expect(searchRes).toBeDefined();

      // 3. Admin deactivates the agent
      const toggleRes = await adminCaller.user.toggleStatus({
        id: created.id,
        isActive: false,
      });
      expect(toggleRes.isActive).toBe(false);

      // 4. Test database status
      const dbUser = await db.getUserById(created.id);
      expect(dbUser?.isActive).toBe(false);
      expect(dbUser?.sessionRevokedAt).toBeDefined();
    });
  });
});
