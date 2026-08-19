import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { generateProactiveAlerts } from "../alertsService";
import { TRPCError } from "@trpc/server";

function createAnonymousContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: null,
  };
}

function createAdminContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 1,
      openId: "igs_admin_challenger",
      name: "Ibrahima Gold Service (Challenger Admin)",
      email: "admin@igs-logistics.gn",
      role: "admin",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 620 00 00 00",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Empirical Challenger Stress-Test Suite: R1 (Portal Tracking) & R2 (Notifications)", () => {
  const publicCaller = appRouter.createCaller(createAnonymousContext());
  const adminCaller = appRouter.createCaller(createAdminContext());

  // =========================================================================
  // R1: CLIENT PORTAL TRACKING STRESS-TESTS
  // =========================================================================
  describe("R1: Client Portal Tracking Empirical Tests", () => {
    describe("1. Valid Identifiers & Multi-Field Resolution", () => {
      it("resolves valid portal access code 'IGS-1001' with correct payload structure", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1001" });
        expect(res).toBeDefined();
        expect(res.dossier).toBeDefined();
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
        expect(res.dossier.portalAccessCode).toBe("IGS-1001");
        expect(res.dossier.client).toBe("Guinean Birimian Gold S.A");
        expect(Array.isArray(res.documents)).toBe(true);
        expect(Array.isArray(res.timeline)).toBe(true);
      });

      it("resolves valid client dossier number 'CKYSI26000340'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "CKYSI26000340" });
        expect(res).toBeDefined();
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
        expect(res.dossier.clientDossierNumber).toBe("CKYSI26000340");
      });

      it("resolves valid maritime BL number 'HLCUNG12604AUQG1'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "HLCUNG12604AUQG1" });
        expect(res).toBeDefined();
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
        expect(res.dossier.blLtaNumber).toBe("HLCUNG12604AUQG1");
      });

      it("resolves internal dossier number 'DOS-0001'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "DOS-0001" });
        expect(res).toBeDefined();
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("resolves secondary records (IGS-1002, IGS-1003, HLCUNG12604AVHK6)", async () => {
        const res2 = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1002" });
        expect(res2.dossier.dossierNumber).toBe("DOS-0002");

        const res2Bl = await publicCaller.portal.track({ accessCodeOrNumber: "HLCUNG12604AVHK6" });
        expect(res2Bl.dossier.dossierNumber).toBe("DOS-0002");

        const res3 = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1003" });
        expect(res3.dossier.dossierNumber).toBe("DOS-0003");
      });
    });

    describe("2. Lowercase Variants & Leading/Trailing Whitespace Resiliency", () => {
      it("handles lowercase portal access code 'igs-1001'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "igs-1001" });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("handles lowercase client reference 'ckysi26000340'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "ckysi26000340" });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("handles lowercase BL number 'hlcung12604auqg1'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "hlcung12604auqg1" });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("handles leading and trailing spaces '   IGS-1001   '", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "   IGS-1001   " });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("handles tab and newline characters around valid code '\\t CKYSI26000340 \\n'", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "\t CKYSI26000340 \n" });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });

      it("handles mixed case and padding '   hLcUng12604AuQg1   '", async () => {
        const res = await publicCaller.portal.track({ accessCodeOrNumber: "   hLcUng12604AuQg1   " });
        expect(res.dossier.dossierNumber).toBe("DOS-0001");
      });
    });

    describe("3. Invalid Codes, Adversarial Inputs & Exact Error Messages", () => {
      it("throws NOT_FOUND with exact expected message for 'XXXX-9999'", async () => {
        try {
          await publicCaller.portal.track({ accessCodeOrNumber: "XXXX-9999" });
          expect.fail("Should have thrown TRPCError");
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe("NOT_FOUND");
          expect(err.message).toContain("Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.");
        }
      });

      it("throws NOT_FOUND with exact expected message for '???'", async () => {
        try {
          await publicCaller.portal.track({ accessCodeOrNumber: "???" });
          expect.fail("Should have thrown TRPCError");
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe("NOT_FOUND");
          expect(err.message).toContain("Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.");
        }
      });

      it("throws NOT_FOUND for SQL injection attempt \"' OR '1'='1\"", async () => {
        try {
          await publicCaller.portal.track({ accessCodeOrNumber: "' OR '1'='1" });
          expect.fail("Should have thrown TRPCError");
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe("NOT_FOUND");
        }
      });

      it("throws NOT_FOUND for XSS string '<script>alert(1)</script>'", async () => {
        try {
          await publicCaller.portal.track({ accessCodeOrNumber: "<script>alert(1)</script>" });
          expect.fail("Should have thrown TRPCError");
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe("NOT_FOUND");
        }
      });

      it("rejects empty string '' with input validation error", async () => {
        await expect(publicCaller.portal.track({ accessCodeOrNumber: "" })).rejects.toThrow();
      });

      it("rejects whitespace-only string '    ' with input validation error", async () => {
        await expect(publicCaller.portal.track({ accessCodeOrNumber: "    " })).rejects.toThrow();
      });

      it("rejects single-character input 'A' (min length 2)", async () => {
        await expect(publicCaller.portal.track({ accessCodeOrNumber: "A" })).rejects.toThrow();
      });
    });

    describe("4. Empirical Response Time Benchmarking (<50ms)", () => {
      it("demonstrates sub-50ms average and p95 latency across 100 queries", async () => {
        const iterations = 100;
        const testInputs = [
          "IGS-1001",
          "CKYSI26000340",
          "HLCUNG12604AUQG1",
          "XXXX-9999", // not found
          "igs-1001",
          "  DOS-0001  ",
        ];

        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const input = testInputs[i % testInputs.length];
          const start = performance.now();
          try {
            await publicCaller.portal.track({ accessCodeOrNumber: input });
          } catch (e) {
            // expected for invalid code
          }
          const duration = performance.now() - start;
          latencies.push(duration);
        }

        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;
        const p95 = latencies[Math.floor(latencies.length * 0.95)];

        // Empirical performance assertions
        expect(avg).toBeLessThan(50); // Average < 50ms
        expect(p95).toBeLessThan(50); // 95th percentile < 50ms
      });
    });
  });

  // =========================================================================
  // R2: NOTIFICATIONS & BADGE SYNC STRESS-TESTS
  // =========================================================================
  describe("R2: Notifications & Badge Synchronization Empirical Tests", () => {
    describe("1. Deterministic Alert ID Stability Across Dossier Reordering", () => {
      it("preserves exact identical alert IDs when dossiers list is reversed or reordered", async () => {
        const originalDossiers = await db.listDossiers();
        expect(originalDossiers.length).toBeGreaterThan(0);

        const alertsOriginal = generateProactiveAlerts(originalDossiers);
        expect(alertsOriginal.length).toBeGreaterThan(0);

        // Reverse the dossier order
        const reversedDossiers = [...originalDossiers].reverse();
        const alertsReversed = generateProactiveAlerts(reversedDossiers);

        // Sort by id for deterministic comparison
        const originalMap = new Map(alertsOriginal.map(a => [a.id, a]));
        const reversedMap = new Map(alertsReversed.map(a => [a.id, a]));

        expect(reversedMap.size).toBe(originalMap.size);

        for (const [id, originalAlert] of originalMap.entries()) {
          const matchingReversed = reversedMap.get(id);
          expect(matchingReversed).toBeDefined();
          expect(matchingReversed?.dossierId).toBe(originalAlert.dossierId);
          expect(matchingReversed?.type).toBe(originalAlert.type);
          expect(matchingReversed?.title).toBe(originalAlert.title);
          expect(matchingReversed?.severity).toBe(originalAlert.severity);
        }
      });

      it("preserves exact identical alert IDs when dossiers are randomly shuffled", async () => {
        const originalDossiers = await db.listDossiers();
        const alertsOriginal = generateProactiveAlerts(originalDossiers);

        // Shuffled copy
        const shuffled = [...originalDossiers].sort(() => Math.random() - 0.5);
        const alertsShuffled = generateProactiveAlerts(shuffled);

        const originalIds = new Set(alertsOriginal.map(a => a.id));
        const shuffledIds = new Set(alertsShuffled.map(a => a.id));

        expect(shuffledIds.size).toBe(originalIds.size);
        for (const id of originalIds) {
          expect(shuffledIds.has(id)).toBe(true);
        }
      });

      it("conforms to deterministic ID mathematical formula: (dossier.id * 10) + typeIndex", async () => {
        const dossiers = await db.listDossiers();
        const alerts = generateProactiveAlerts(dossiers);

        for (const alert of alerts) {
          const typeIndex = alert.id % 10;
          const extractedDossierId = Math.floor(alert.id / 10);
          expect(extractedDossierId).toBe(alert.dossierId);
          expect([1, 2, 3]).toContain(typeIndex);
          if (alert.type === "SURESTARIES_RISQUE") expect(typeIndex).toBe(1);
          if (alert.type === "ETA_DEPASSEE") expect(typeIndex).toBe(2);
          if (alert.type === "DDI_MANQUANTE") expect(typeIndex).toBe(3);
        }
      });
    });

    describe("2. Single markAsRead & Persistence", () => {
      it("marks specific notification as read and preserves state across multiple queries", async () => {
        const listInitial = await adminCaller.notification.list();
        expect(listInitial.length).toBeGreaterThan(0);

        const targetAlert = listInitial[0];
        const res = await adminCaller.notification.markAsRead({ id: targetAlert.id });
        expect(res).toEqual({ success: true });

        // Query 1
        const listCheck1 = await adminCaller.notification.list();
        const found1 = listCheck1.find(a => a.id === targetAlert.id);
        expect(found1?.isRead).toBe(1);

        // Query 2 (repeat to verify persistence)
        const listCheck2 = await adminCaller.notification.list();
        const found2 = listCheck2.find(a => a.id === targetAlert.id);
        expect(found2?.isRead).toBe(1);
      });

      it("is idempotent: calling markAsRead multiple times on the same ID succeeds without side effects", async () => {
        const list = await adminCaller.notification.list();
        const targetId = list[0].id;

        for (let i = 0; i < 5; i++) {
          const res = await adminCaller.notification.markAsRead({ id: targetId });
          expect(res).toEqual({ success: true });
        }

        const listAfter = await adminCaller.notification.list();
        const found = listAfter.find(a => a.id === targetId);
        expect(found?.isRead).toBe(1);
      });
    });

    describe("3. Bulk markAllAsRead & Unread Counter Equals 0", () => {
      it("marks all notifications as read and unread counter evaluates to exactly 0", async () => {
        const res = await adminCaller.notification.markAllAsRead();
        expect(res).toEqual({ success: true });

        const list = await adminCaller.notification.list();
        expect(list.length).toBeGreaterThan(0);

        const unreadCount = list.filter(n => n.isRead === 0).length;
        expect(unreadCount).toBe(0);

        for (const notif of list) {
          expect(notif.isRead).toBe(1);
        }
      });

      it("repeated markAllAsRead calls maintain 0 unread counter", async () => {
        await adminCaller.notification.markAllAsRead();
        await adminCaller.notification.markAllAsRead();

        const list = await adminCaller.notification.list();
        const unreadCount = list.filter(n => n.isRead === 0).length;
        expect(unreadCount).toBe(0);
      });
    });

    describe("4. Concurrency & Parallel Execution Stress-Tests", () => {
      it("handles parallel concurrent markAsRead mutations without corruption", async () => {
        const list = await adminCaller.notification.list();
        const idsToMark = list.slice(0, 5).map(n => n.id);

        // Launch concurrent calls simultaneously
        const mutationPromises = idsToMark.map(id =>
          adminCaller.notification.markAsRead({ id })
        );

        const results = await Promise.all(mutationPromises);
        results.forEach(r => expect(r).toEqual({ success: true }));

        const listAfter = await adminCaller.notification.list();
        for (const id of idsToMark) {
          const alert = listAfter.find(n => n.id === id);
          expect(alert?.isRead).toBe(1);
        }
      });

      it("handles concurrent mix of markAsRead, markAllAsRead, and list queries", async () => {
        const list = await adminCaller.notification.list();
        const targetId = list[0].id;

        const mixedPromises = [
          adminCaller.notification.list(),
          adminCaller.notification.markAsRead({ id: targetId }),
          adminCaller.notification.list(),
          adminCaller.notification.markAllAsRead(),
          adminCaller.notification.list(),
          adminCaller.notification.markAsRead({ id: targetId }),
          adminCaller.notification.list(),
        ];

        const results = await Promise.all(mixedPromises);
        expect(results).toHaveLength(7);

        // Final state after all concurrent promises finish
        const finalList = await adminCaller.notification.list();
        const unreadCount = finalList.filter(n => n.isRead === 0).length;
        expect(unreadCount).toBe(0);
      });
    });
  });
});
