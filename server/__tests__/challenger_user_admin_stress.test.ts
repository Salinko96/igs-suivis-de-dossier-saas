import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";

function createAnonymousContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: null,
  };
}

function createAdminContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 1,
      openId: "igs_admin_conakry",
      name: "Ibrahima Gold Service (Admin)",
      email: "contact@igs-logistics.gn",
      role: "admin",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 620 00 00 00",
      isActive: true,
      sessionRevokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
  };
}

function createDeclarantContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 2,
      openId: "declarant_conakry",
      name: "Mamadou Diallo (Déclarant PAC)",
      email: "declarant@igs-logistics.gn",
      role: "declarant",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 621 11 22 33",
      isActive: true,
      sessionRevokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

function createComptableContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 3,
      openId: "comptable_conakry",
      name: "Fatoumata Camara (Comptable)",
      email: "finance@igs-logistics.gn",
      role: "comptable",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 622 44 55 66",
      isActive: true,
      sessionRevokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

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
      isActive: true,
      sessionRevokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Adversarial Stress Test Suite — Milestone 1 (Users & HR Administration)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const declarantCaller = appRouter.createCaller(createDeclarantContext());
  const comptableCaller = appRouter.createCaller(createComptableContext());
  const clientCaller = appRouter.createCaller(createClientContext());
  const anonCaller = appRouter.createCaller(createAnonymousContext());

  // =========================================================================
  // 1. BOUNDARY INPUTS & MALFORMED DATA TESTS
  // =========================================================================
  describe("1. Boundary Inputs & Malformed Data Stress Testing", () => {
    it("rejects user creation with empty or whitespace-only name (< 2 chars)", async () => {
      await expect(
        adminCaller.user.create({
          name: "",
          email: "valid.email@igs.gn",
          role: "declarant",
        })
      ).rejects.toThrow();

      await expect(
        adminCaller.user.create({
          name: "A",
          email: "valid.email@igs.gn",
          role: "declarant",
        })
      ).rejects.toThrow();
    });

    it("rejects user creation with malformed email addresses", async () => {
      const malformedEmails = [
        "not-an-email",
        "@missinguser.gn",
        "missingatsign.gn",
        "user name@domain.com",
        "user@domain..com",
      ];

      for (const email of malformedEmails) {
        await expect(
          adminCaller.user.create({
            name: "Test Boundary User",
            email,
            role: "declarant",
          })
        ).rejects.toThrow();
      }
    });

    it("rejects invalid pagination bounds (< 1 limit, > 500 limit, negative offset)", async () => {
      // Limit 0 or negative
      await expect(adminCaller.user.list({ limit: 0 })).rejects.toThrow();
      await expect(adminCaller.user.list({ limit: -10 })).rejects.toThrow();

      // Limit exceeding max 500
      await expect(adminCaller.user.list({ limit: 501 })).rejects.toThrow();
      await expect(adminCaller.user.list({ limit: 99999 })).rejects.toThrow();

      // Negative offset
      await expect(adminCaller.user.list({ offset: -1 })).rejects.toThrow();
    });

    it("handles extreme valid pagination bounds gracefully without crashing", async () => {
      // Maximum allowed limit 500
      const maxLimitRes = await adminCaller.user.list({ limit: 500, offset: 0 });
      expect(Array.isArray(maxLimitRes)).toBe(true);
      expect(maxLimitRes.length).toBeGreaterThanOrEqual(100);

      // Huge offset beyond total count
      const outOfBoundsOffset = await adminCaller.user.list({ limit: 50, offset: 50000 });
      expect(Array.isArray(outOfBoundsOffset)).toBe(true);
      expect(outOfBoundsOffset.length).toBe(0);
    });

    it("throws NOT_FOUND when querying non-existent user IDs", async () => {
      const nonExistentIds = [999999, 888888, 1234567];
      for (const id of nonExistentIds) {
        await expect(adminCaller.user.get({ id })).rejects.toThrowError(TRPCError);
        try {
          await adminCaller.user.get({ id });
        } catch (err: any) {
          expect(err.code).toBe("NOT_FOUND");
        }
      }
    });

    it("throws error when updating non-existent user ID", async () => {
      await expect(
        adminCaller.user.update({
          id: 999999,
          name: "Ghost Collaborator",
        })
      ).rejects.toThrow();
    });

    it("throws error when toggling status of non-existent user ID", async () => {
      await expect(
        adminCaller.user.toggleStatus({
          id: 999999,
          isActive: false,
        })
      ).rejects.toThrow();
    });

    it("accepts null/undefined/empty phone numbers cleanly", async () => {
      const userWithoutPhone = await adminCaller.user.create({
        name: "Collaborateur Sans Téléphone",
        email: `sans.tel.${Date.now()}@igs-transit.gn`,
        role: "declarant",
        phone: null,
      });

      expect(userWithoutPhone).toBeDefined();
      expect(userWithoutPhone.phone).toBeNull();
      expect(userWithoutPhone.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 2. PRIVILEGE ESCALATION & RBAC ADVERSARIAL MATRIX
  // =========================================================================
  describe("2. Privilege Escalation & Adversarial RBAC Attack Matrix", () => {
    const unprivilegedCallers = [
      { name: "anonymousCaller", caller: anonCaller, expectedCode: "UNAUTHORIZED" },
      { name: "declarantCaller", caller: declarantCaller, expectedCode: "FORBIDDEN" },
      { name: "comptableCaller", caller: comptableCaller, expectedCode: "FORBIDDEN" },
      { name: "clientCaller", caller: clientCaller, expectedCode: "FORBIDDEN" },
    ];

    for (const { name, caller, expectedCode } of unprivilegedCallers) {
      it(`blocks ${name} from user.list with ${expectedCode}`, async () => {
        try {
          await caller.user.list();
          expect.unreachable(`${name} should not be able to list users`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });

      it(`blocks ${name} from user.getHRStats with ${expectedCode}`, async () => {
        try {
          await caller.user.getHRStats();
          expect.unreachable(`${name} should not be able to get HR stats`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });

      it(`blocks ${name} from user.get with ${expectedCode}`, async () => {
        try {
          await caller.user.get({ id: 1 });
          expect.unreachable(`${name} should not be able to fetch user by ID`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });

      it(`blocks ${name} from user.create with ${expectedCode}`, async () => {
        try {
          await caller.user.create({
            name: "Hacker Injected User",
            email: "hacker@domain.gn",
            role: "admin",
          });
          expect.unreachable(`${name} should not be able to create user`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });

      it(`blocks ${name} from user.update with ${expectedCode}`, async () => {
        try {
          await caller.user.update({
            id: 1,
            role: "admin",
            name: "Privilege Escalation Attempt",
          });
          expect.unreachable(`${name} should not be able to update user`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });

      it(`blocks ${name} from user.toggleStatus with ${expectedCode}`, async () => {
        try {
          await caller.user.toggleStatus({
            id: 1,
            isActive: false,
          });
          expect.unreachable(`${name} should not be able to toggle user status`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe(expectedCode);
        }
      });
    }

    it("blocks deactivated admin (isActive=false) from invoking any user administration procedure", async () => {
      const inactiveAdmin = appRouter.createCaller(
        createAdminContext({
          id: 999,
          isActive: false,
          sessionRevokedAt: new Date(),
        })
      );

      try {
        await inactiveAdmin.user.list();
        expect.unreachable("Inactive admin must be blocked by RBAC middleware");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("compte est désactivé");
      }

      try {
        await inactiveAdmin.user.getHRStats();
        expect.unreachable("Inactive admin must be blocked from getHRStats");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });
  });

  // =========================================================================
  // 3. CONCURRENT STATUS TOGGLING & RAPID SESSION REVOCATION
  // =========================================================================
  describe("3. Concurrent Status Toggling & Immediate Session Revocation", () => {
    it("handles rapid concurrent toggling safely without race condition corruption", async () => {
      // Create a test user for rapid toggling
      const testUser = await adminCaller.user.create({
        name: "Concurrent Test Collaborator",
        email: `concurrent.${Date.now()}@igs-transit.gn`,
        role: "declarant",
        isActive: true,
      });

      // Fire 10 parallel toggle operations alternating true/false
      const operations = Array.from({ length: 10 }).map((_, idx) =>
        adminCaller.user.toggleStatus({
          id: testUser.id,
          isActive: idx % 2 === 0,
        })
      );

      const results = await Promise.all(operations);
      expect(results.length).toBe(10);

      // Verify the final user state in DB is consistent with its isActive value
      const finalUser = await adminCaller.user.get({ id: testUser.id });
      expect(typeof finalUser.isActive).toBe("boolean");
      if (!finalUser.isActive) {
        expect(finalUser.sessionRevokedAt).toBeDefined();
        expect(finalUser.sessionRevokedAt).toBeInstanceOf(Date);
      } else {
        expect(finalUser.sessionRevokedAt).toBeNull();
      }
    });

    it("verifies immediate session revocation upon deactivation via sdk.authenticateRequest", async () => {
      // 1. Create active user
      const victim = await adminCaller.user.create({
        name: "Agent PAC Revocation Test",
        email: `agent.revocation.${Date.now()}@igs-transit.gn`,
        role: "declarant",
        isActive: true,
      });

      // 2. Generate valid session token while active
      const token = await sdk.createSessionToken(victim.openId, {
        name: victim.name || "Agent",
      });

      const mockReq = {
        headers: {
          cookie: `app_session_id=${token}`,
        },
      } as any;

      // 3. Authentication should succeed while active
      const authedBefore = await sdk.authenticateRequest(mockReq);
      expect(authedBefore).toBeDefined();
      expect(authedBefore.openId).toBe(victim.openId);

      // 4. Admin deactivates user
      await adminCaller.user.toggleStatus({ id: victim.id, isActive: false });

      // 5. Subsequent request with the same token MUST be immediately rejected with ForbiddenError
      await expect(sdk.authenticateRequest(mockReq)).rejects.toThrow("suspendu ou désactivé");

      // 6. Caller created with the deactivated user context is rejected on protectedProcedure
      const victimCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: {
          ...victim,
          isActive: false,
          sessionRevokedAt: new Date(),
        },
      });

      await expect(victimCaller.dossier.list()).rejects.toThrowError(TRPCError);

      // 7. Reactivate user and verify access is restored
      await adminCaller.user.toggleStatus({ id: victim.id, isActive: true });
      const authedAfter = await sdk.authenticateRequest(mockReq);
      expect(authedAfter).toBeDefined();
      expect(authedAfter.openId).toBe(victim.openId);
    });
  });

  // =========================================================================
  // 4. EXACT MATHEMATICAL INVARIANTS FOR HR STATS
  // =========================================================================
  describe("4. Exact Mathematical Invariants for HR Statistics", () => {
    it("maintains fundamental invariant: totalEmployees === totalActive + totalInactive", async () => {
      const stats = await adminCaller.user.getHRStats();
      expect(stats.totalEmployees).toBe(stats.totalActive + stats.totalInactive);
    });

    it("maintains role breakdown mathematical consistency with raw database records", async () => {
      const allUsers = await db.listUsers();
      const stats = await adminCaller.user.getHRStats();

      const expectedTotal = allUsers.length;
      const expectedActive = allUsers.filter(u => u.isActive !== false).length;
      const expectedInactive = allUsers.filter(u => u.isActive === false).length;

      const expectedActiveDeclarants = allUsers.filter(
        u => u.role === "declarant" && u.isActive !== false
      ).length;
      const expectedActiveComptables = allUsers.filter(
        u => u.role === "comptable" && u.isActive !== false
      ).length;
      const expectedConnectedClients = allUsers.filter(
        u => u.role === "client" && u.isActive !== false
      ).length;

      expect(stats.totalEmployees).toBe(expectedTotal);
      expect(stats.totalActive).toBe(expectedActive);
      expect(stats.totalInactive).toBe(expectedInactive);
      expect(stats.activeDeclarantsAtPort).toBe(expectedActiveDeclarants);
      expect(stats.activeComptables).toBe(expectedActiveComptables);
      expect(stats.connectedClients).toBe(expectedConnectedClients);

      // Role partitions sum: all distinct roles must sum to totalEmployees
      const roles = ["admin", "declarant", "comptable", "client", "manager", "user"];
      const sumOfRoles = roles.reduce(
        (sum, r) => sum + allUsers.filter(u => u.role === r).length,
        0
      );
      expect(sumOfRoles).toBe(stats.totalEmployees);
    });

    it("verifies mathematical invariant shifts across full mutation lifecycle", async () => {
      // Step A: Baseline stats
      const baseStats = await adminCaller.user.getHRStats();

      // Step B: Create 1 active declarant
      const newDeclarant = await adminCaller.user.create({
        name: "Math Invariant Declarant PAC",
        email: `math.declarant.${Date.now()}@igs-transit.gn`,
        role: "declarant",
        isActive: true,
      });

      const statsAfterDeclarant = await adminCaller.user.getHRStats();
      expect(statsAfterDeclarant.totalEmployees).toBe(baseStats.totalEmployees + 1);
      expect(statsAfterDeclarant.totalActive).toBe(baseStats.totalActive + 1);
      expect(statsAfterDeclarant.totalInactive).toBe(baseStats.totalInactive);
      expect(statsAfterDeclarant.activeDeclarantsAtPort).toBe(baseStats.activeDeclarantsAtPort + 1);
      expect(statsAfterDeclarant.totalEmployees).toBe(
        statsAfterDeclarant.totalActive + statsAfterDeclarant.totalInactive
      );

      // Step C: Create 1 inactive comptable
      const newComptable = await adminCaller.user.create({
        name: "Math Invariant Inactive Comptable",
        email: `math.comptable.${Date.now()}@igs-transit.gn`,
        role: "comptable",
        isActive: false,
      });

      const statsAfterComptable = await adminCaller.user.getHRStats();
      expect(statsAfterComptable.totalEmployees).toBe(statsAfterDeclarant.totalEmployees + 1);
      expect(statsAfterComptable.totalActive).toBe(statsAfterDeclarant.totalActive);
      expect(statsAfterComptable.totalInactive).toBe(statsAfterDeclarant.totalInactive + 1);
      expect(statsAfterComptable.activeComptables).toBe(statsAfterDeclarant.activeComptables);
      expect(statsAfterComptable.totalEmployees).toBe(
        statsAfterComptable.totalActive + statsAfterComptable.totalInactive
      );

      // Step D: Deactivate the active declarant
      await adminCaller.user.toggleStatus({ id: newDeclarant.id, isActive: false });

      const statsAfterDeactivation = await adminCaller.user.getHRStats();
      expect(statsAfterDeactivation.totalEmployees).toBe(statsAfterComptable.totalEmployees);
      expect(statsAfterDeactivation.totalActive).toBe(statsAfterComptable.totalActive - 1);
      expect(statsAfterDeactivation.totalInactive).toBe(statsAfterComptable.totalInactive + 1);
      expect(statsAfterDeactivation.activeDeclarantsAtPort).toBe(
        statsAfterComptable.activeDeclarantsAtPort - 1
      );
      expect(statsAfterDeactivation.totalEmployees).toBe(
        statsAfterDeactivation.totalActive + statsAfterDeactivation.totalInactive
      );

      // Step E: Reactivate the declarant
      await adminCaller.user.toggleStatus({ id: newDeclarant.id, isActive: true });

      const statsAfterReactivation = await adminCaller.user.getHRStats();
      expect(statsAfterReactivation.totalEmployees).toBe(statsAfterDeactivation.totalEmployees);
      expect(statsAfterReactivation.totalActive).toBe(statsAfterDeactivation.totalActive + 1);
      expect(statsAfterReactivation.totalInactive).toBe(statsAfterDeactivation.totalInactive - 1);
      expect(statsAfterReactivation.activeDeclarantsAtPort).toBe(
        statsAfterDeactivation.activeDeclarantsAtPort + 1
      );
      expect(statsAfterReactivation.totalEmployees).toBe(
        statsAfterReactivation.totalActive + statsAfterReactivation.totalInactive
      );
    });
  });
});
