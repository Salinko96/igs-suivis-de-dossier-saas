import { describe, it, expect, beforeEach } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";
import { TRPCError } from "@trpc/server";

describe("Empirical Challenger Stress-Test Suite: Milestone 2 Optimistic Locking & Concurrency", () => {
  let testDossier: any;

  beforeEach(async () => {
    // Créer un dossier frais avec version = 1 pour chaque test
    testDossier = await db.createDossier(
      {
        client: "Société Minière de Boké (SMB)",
        clientDossierNumber: "SMB-EXP-2026-901",
        blLtaNumber: "CMA-CGM-BOK-009182",
        cargoNature: "Équipements Miniers Lourds",
        transportMode: "Maritime",
        eta: new Date("2026-10-15T08:00:00Z"),
        originPort: "Anvers (Belgique)",
        destinationPort: "Port Autonome de Conakry",
        regime: "IM4",
        service: "Transit & Dédouanement",
        badStatus: "En attente",
        baeStatus: "En attente",
      },
      1,
      "Agent Challenger",
      { userRole: "declarant", ipAddress: "10.0.0.1" }
    );
  });

  // =========================================================================
  // 1. HIGH-CONCURRENCY SIMULTANEOUS UPDATES (RACE CONDITIONS)
  // =========================================================================
  describe("1. High-Concurrency Simultaneous Updates Stress Test", () => {
    it("handles 15 simultaneous writers at DB layer: exactly 1 succeeds, 14 fail with CONFLICT", async () => {
      const concurrentWriterCount = 15;
      const initialVersion = testDossier.version; // 1

      // 15 concurrent callers firing updateDossier at the exact same moment with expectedVersion = 1
      const updatePromises = Array.from({ length: concurrentWriterCount }, (_, index) => {
        return db.updateDossier(
          testDossier.id,
          { notes: `Mutation concurrente par le writer #${index + 1}` },
          index + 1,
          `Writer ${index + 1}`,
          { expectedVersion: initialVersion, userRole: "declarant" }
        );
      });

      const results = await Promise.allSettled(updatePromises);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      // Invariant 1: Exactly 1 update must succeed
      expect(fulfilled.length).toBe(1);
      expect(fulfilled[0].value.version).toBe(2);

      // Invariant 2: Exactly (N - 1) updates must be rejected
      expect(rejected.length).toBe(concurrentWriterCount - 1);

      // Invariant 3: Every rejected reason must be a TRPCError with code CONFLICT
      for (const rej of rejected) {
        expect(rej.reason).toBeInstanceOf(TRPCError);
        const trpcErr = rej.reason as TRPCError;
        expect(trpcErr.code).toBe("CONFLICT");
        expect(trpcErr.message).toContain("Conflit d'édition simultanée");
      }

      // Invariant 4: Current state on server must have version = 2 and not be corrupted
      const freshDossier = await db.getDossier(testDossier.id);
      expect(freshDossier?.version).toBe(2);
    });

    it("handles 12 simultaneous writers through tRPC router (dossier.update): exactly 1 succeeds, 11 fail with CONFLICT", async () => {
      const callerCount = 12;
      const callers = Array.from({ length: callerCount }, (_, i) => {
        return appRouter.createCaller({
          req: {} as any,
          res: { cookie: () => {}, clearCookie: () => {} } as any,
          user: {
            id: 100 + i,
            name: `Opérateur Concurrence ${i + 1}`,
            role: i % 2 === 0 ? "declarant" : "admin",
            openId: `usr_${100 + i}`,
            email: `user${100 + i}@igs-logistics.gn`,
            loginMethod: "direct",
            clientCompany: null,
            phone: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
        });
      });

      const promises = callers.map((caller, index) => {
        return caller.dossier.update({
          id: testDossier.id,
          expectedVersion: 1,
          data: {
            client: "Société Minière de Boké (SMB)",
            transportMode: "Maritime",
            notes: `tRPC mutation payload de l'opérateur #${index + 1}`,
          } as any,
        });
      });

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(fulfilled.length).toBe(1);
      expect(fulfilled[0].value.version).toBe(2);
      expect(rejected.length).toBe(callerCount - 1);

      for (const rej of rejected) {
        expect(rej.reason).toBeInstanceOf(TRPCError);
        expect((rej.reason as TRPCError).code).toBe("CONFLICT");
      }

      const freshDossier = await db.getDossier(testDossier.id);
      expect(freshDossier?.version).toBe(2);
    });

    it("handles mixed endpoint race condition (5 dossier.update vs 5 dossier.updateCustoms)", async () => {
      const declarantCaller = appRouter.createCaller({
        req: {} as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: {
          id: 50,
          name: "Mamadou Douane",
          role: "declarant",
          openId: "usr_50",
          email: "m.douane@igs-logistics.gn",
          loginMethod: "direct",
          clientCompany: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      });

      // 5 general updates
      const generalUpdates = Array.from({ length: 5 }, (_, i) =>
        declarantCaller.dossier.update({
          id: testDossier.id,
          expectedVersion: 1,
          data: {
            client: "Société Minière de Boké (SMB)",
            transportMode: "Maritime",
            cargoNature: `Cargo variation ${i + 1}`,
          } as any,
        })
      );

      // 5 customs updates
      const customsUpdates = Array.from({ length: 5 }, (_, i) =>
        declarantCaller.dossier.updateCustoms({
          id: testDossier.id,
          expectedVersion: 1,
          data: {
            declarationNumber: `SYD-CONC-${i + 1}`,
            badStatus: "Delivre",
          },
        })
      );

      const mixedResults = await Promise.allSettled([...generalUpdates, ...customsUpdates]);

      const fulfilled = mixedResults.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = mixedResults.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(9);
      for (const rej of rejected) {
        expect((rej.reason as TRPCError).code).toBe("CONFLICT");
      }
    });
  });

  // =========================================================================
  // 2. STALE VERSION & TIMESTAMP REJECTION MATRIX
  // =========================================================================
  describe("2. Stale Version & Timestamp Divergence Rejection Matrix", () => {
    it("rejects when expectedVersion = 1 while server is at version = 5", async () => {
      // Advance dossier version from 1 to 5
      let currentVersion = 1;
      for (let step = 1; step <= 4; step++) {
        const res = await db.updateDossier(
          testDossier.id,
          { notes: `Progression step ${step}` },
          1,
          "Advancement Agent",
          { expectedVersion: currentVersion }
        );
        currentVersion = res.version;
      }
      expect(currentVersion).toBe(5);

      // Attempt 1: Severely stale expectedVersion = 1
      await expect(
        db.updateDossier(
          testDossier.id,
          { notes: "Severe stale attempt" },
          1,
          "Stale Caller",
          { expectedVersion: 1 }
        )
      ).rejects.toThrowError(TRPCError);

      try {
        await db.updateDossier(
          testDossier.id,
          { notes: "Severe stale attempt" },
          1,
          "Stale Caller",
          { expectedVersion: 1 }
        );
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("v1");
        expect(err.message).toContain("v5");
      }

      // Attempt 2: Off-by-one stale expectedVersion = 4
      try {
        await db.updateDossier(
          testDossier.id,
          { notes: "Off-by-one stale attempt" },
          1,
          "Stale Caller",
          { expectedVersion: 4 }
        );
        expect.unreachable("Should have thrown CONFLICT");
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("v4");
        expect(err.message).toContain("v5");
      }

      // Attempt 3: Future / fabricated version = 99
      try {
        await db.updateDossier(
          testDossier.id,
          { notes: "Fabricated future version" },
          1,
          "Future Caller",
          { expectedVersion: 99 }
        );
        expect.unreachable("Should have thrown CONFLICT");
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("v99");
        expect(err.message).toContain("v5");
      }
    });

    it("rejects when expectedUpdatedAt diverges by more than 1000ms", async () => {
      const staleTimestamp = new Date(Date.now() - 300000); // 5 minutes ago

      await expect(
        db.updateDossier(
          testDossier.id,
          { notes: "Outdated timestamp update" },
          1,
          "Timestamp Caller",
          { expectedUpdatedAt: staleTimestamp }
        )
      ).rejects.toThrowError(TRPCError);

      try {
        await db.updateDossier(
          testDossier.id,
          { notes: "Outdated timestamp update" },
          1,
          "Timestamp Caller",
          { expectedUpdatedAt: staleTimestamp }
        );
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
      }
    });

    it("accepts update when expectedUpdatedAt matches the current updatedAt timestamp", async () => {
      const current = await db.getDossier(testDossier.id);
      expect(current).toBeDefined();

      const updated = await db.updateDossier(
        testDossier.id,
        { notes: "Timestamp match successful" },
        1,
        "Timestamp Caller",
        { expectedUpdatedAt: current!.updatedAt }
      );

      expect(updated.version).toBe(2);
      expect(updated.notes).toBe("Timestamp match successful");
    });
  });

  // =========================================================================
  // 3. RAPID SEQUENTIAL UPDATES & MONOTONICITY
  // =========================================================================
  describe("3. Rapid Sequential Updates & Strict Monotonicity Stress Test", () => {
    it("increments version monotonically (1 -> 2 -> ... -> 25) with zero skipped versions", async () => {
      const iterations = 25;
      let expectedVer = 1;

      for (let i = 1; i <= iterations; i++) {
        const updateResult = await db.updateDossier(
          testDossier.id,
          {
            notes: `Mise à jour séquentielle cycle #${i}`,
            cargoNature: `Cargaison cycle #${i}`,
          },
          1,
          "Sequential Bot",
          { expectedVersion: expectedVer, userRole: "declarant" }
        );

        expect(updateResult.version).toBe(expectedVer + 1);
        expect(updateResult.notes).toBe(`Mise à jour séquentielle cycle #${i}`);
        expect(updateResult.cargoNature).toBe(`Cargaison cycle #${i}`);

        expectedVer = updateResult.version;
      }

      // Final version must be exactly 1 + 25 = 26
      expect(expectedVer).toBe(26);

      const finalRecord = await db.getDossier(testDossier.id);
      expect(finalRecord?.version).toBe(26);

      // Verify that stale intermediate versions fail
      await expect(
        db.updateDossier(
          testDossier.id,
          { notes: "Should fail with intermediate version 15" },
          1,
          "Late Caller",
          { expectedVersion: 15 }
        )
      ).rejects.toThrowError(TRPCError);
    });
  });

  // =========================================================================
  // 4. FORCE OVERWRITE (SUPERVISOR OVERRIDE)
  // =========================================================================
  describe("4. Force Overwrite / Supervisor Override Invariants", () => {
    it("allows supervisor force overwrite with forceOverwrite: true and monotonically increments version", async () => {
      // Step 1: Advance dossier to version 10
      let v = 1;
      for (let i = 1; i <= 9; i++) {
        const res = await db.updateDossier(
          testDossier.id,
          { notes: `Step ${i}` },
          1,
          "User A",
          { expectedVersion: v }
        );
        v = res.version;
      }
      expect(v).toBe(10);

      // Step 2: Supervisor submits with stale expectedVersion = 1, but with forceOverwrite: true
      const overridden = await db.updateDossier(
        testDossier.id,
        { notes: "Écrasement forcé par Superviseur IGS", client: "Société Minière de Boké (SMB - Direction Générale)" },
        99,
        "Superviseur Alpha",
        { expectedVersion: 1, forceOverwrite: true, userRole: "admin" }
      );

      // Version must increment to 11 (not roll back to 2, and not stay at 10)
      expect(overridden.version).toBe(11);
      expect(overridden.notes).toBe("Écrasement forcé par Superviseur IGS");
      expect(overridden.client).toBe("Société Minière de Boké (SMB - Direction Générale)");

      // Step 3: Verify subsequent regular update requires expectedVersion = 11
      await expect(
        db.updateDossier(
          testDossier.id,
          { notes: "Stale update with v10" },
          1,
          "User B",
          { expectedVersion: 10 }
        )
      ).rejects.toThrowError(TRPCError);

      const nextValid = await db.updateDossier(
        testDossier.id,
        { notes: "Valid update with v11" },
        1,
        "User B",
        { expectedVersion: 11 }
      );
      expect(nextValid.version).toBe(12);
    });

    it("supports forceOverwrite via tRPC router (dossier.update & dossier.updateCustoms)", async () => {
      const adminCaller = appRouter.createCaller({
        req: {} as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: {
          id: 1,
          name: "Admin Principal IGS",
          role: "admin",
          openId: "usr_admin_1",
          email: "admin@igs-logistics.gn",
          loginMethod: "direct",
          clientCompany: null,
          phone: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      });

      // Advance to v2
      await adminCaller.dossier.update({
        id: testDossier.id,
        expectedVersion: 1,
        data: {
          client: "Société Minière de Boké (SMB)",
          transportMode: "Maritime",
          notes: "Update step 1",
        } as any,
      });

      // Force overwrite via tRPC dossier.update with stale expectedVersion: 1
      const forceUpdateRes = await adminCaller.dossier.update({
        id: testDossier.id,
        expectedVersion: 1,
        forceOverwrite: true,
        data: {
          client: "Société Minière de Boké (SMB)",
          transportMode: "Maritime",
          notes: "Force overwritten by admin via tRPC",
        } as any,
      });
      expect(forceUpdateRes.version).toBe(3);
      expect(forceUpdateRes.notes).toBe("Force overwritten by admin via tRPC");

      // Force overwrite via tRPC dossier.updateCustoms with stale expectedVersion: 1
      const forceCustomsRes = await adminCaller.dossier.updateCustoms({
        id: testDossier.id,
        expectedVersion: 1,
        forceOverwrite: true,
        data: {
          declarationNumber: "SYD-FORCE-ADMIN-01",
        },
      });
      expect(forceCustomsRes.version).toBe(4);
      expect(forceCustomsRes.declarationNumber).toBe("SYD-FORCE-ADMIN-01");
    });
  });

  // =========================================================================
  // 5. CLIENT RETRY LOOP CONCURRENCY SIMULATION
  // =========================================================================
  describe("5. Simulated Real-World Client Optimistic Retry Loop", () => {
    it("converges 10 concurrent competing workers to all successfully commit through retry loops", async () => {
      const workerCount = 10;

      // 10 concurrent worker tasks running retry loops
      const runWorker = async (workerId: number) => {
        let applied = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!applied && attempts < maxAttempts) {
          attempts++;
          const fresh = await db.getDossier(testDossier.id);
          if (!fresh) throw new Error("Dossier not found");

          try {
            await db.updateDossier(
              testDossier.id,
              { notes: `Worker #${workerId} committed on attempt #${attempts}` },
              workerId,
              `Worker ${workerId}`,
              { expectedVersion: fresh.version, userRole: "declarant" }
            );
            applied = true;
          } catch (err: any) {
            if (err instanceof TRPCError && err.code === "CONFLICT") {
              // Simuler un léger backoff / microtask yield
              await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
            } else {
              throw err;
            }
          }
        }
        return { workerId, applied, attempts };
      };

      const workerPromises = Array.from({ length: workerCount }, (_, i) => runWorker(i + 1));
      const results = await Promise.all(workerPromises);

      // All 10 workers must have succeeded
      for (const res of results) {
        expect(res.applied).toBe(true);
      }

      // Final version must be exactly 1 + 10 = 11
      const finalDossier = await db.getDossier(testDossier.id);
      expect(finalDossier?.version).toBe(11);
    });
  });
});
