import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";
import { SignJWT } from "jose";

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

function createDeclarantContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
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
      ...overrides,
    },
  };
}

function createComptableContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
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
      ...overrides,
    },
  };
}

function createClientContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
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
      ...overrides,
    },
  };
}

describe("Empirical Challenger 2 — Session Revocation & Auth Lifecycle Suite (Milestone 1)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const declarantCaller = appRouter.createCaller(createDeclarantContext());
  const comptableCaller = appRouter.createCaller(createComptableContext());
  const clientCaller = appRouter.createCaller(createClientContext());
  const anonCaller = appRouter.createCaller(createAnonymousContext());

  // =========================================================================
  // 1. ACTIVE USER LOGIN -> SESSION GENERATION -> INSTANT REVOCATION -> 403
  // =========================================================================
  describe("1. Active User Login -> Instant Deactivation -> Immediate Rejection with 403 FORBIDDEN", () => {
    it("verifies full cycle: active login, session issuance, deactivation via toggleUserStatus, and immediate rejection on next tRPC query/mutation", async () => {
      // Step 1: Create an active declarant employee
      const testEmail = `agent.lifecycle.${Date.now()}@igs-transit.gn`;
      const employee = await adminCaller.user.create({
        name: "Amadou Bailo Diallo (Déclarant Test)",
        email: testEmail,
        phone: "+224 620 12 34 56",
        role: "declarant",
        isActive: true,
      });

      expect(employee).toBeDefined();
      expect(employee.isActive).toBe(true);
      expect(employee.sessionRevokedAt).toBeNull();

      // Step 2: Issue valid JWT session token
      const sessionToken = await sdk.createSessionToken(employee.openId, {
        name: employee.name || "Amadou Bailo Diallo",
      });
      expect(typeof sessionToken).toBe("string");
      expect(sessionToken.length).toBeGreaterThan(20);

      // Step 3: Request with cookie is authenticated successfully while active
      const mockReqActive = {
        headers: {
          cookie: `app_session_id=${sessionToken}`,
        },
      } as any;
      const authedUser = await sdk.authenticateRequest(mockReqActive);
      expect(authedUser).toBeDefined();
      expect(authedUser.openId).toBe(employee.openId);
      expect(authedUser.isActive).toBe(true);

      // Step 4: User executes tRPC queries and mutations successfully while active
      const activeEmployeeCaller = appRouter.createCaller({
        req: mockReqActive,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: authedUser,
      });

      const dossiers = await activeEmployeeCaller.dossier.list();
      expect(Array.isArray(dossiers)).toBe(true);

      // Step 5: Admin instantly deactivates the employee via toggleUserStatus
      const deactivatedUser = await adminCaller.user.toggleStatus({
        id: employee.id,
        isActive: false,
      });

      expect(deactivatedUser.isActive).toBe(false);
      expect(deactivatedUser.sessionRevokedAt).toBeDefined();
      expect(deactivatedUser.sessionRevokedAt).toBeInstanceOf(Date);

      // Step 6: Verify DB state immediately reflects deactivation
      const fetchedFromDb = await db.getUserById(employee.id);
      expect(fetchedFromDb?.isActive).toBe(false);
      expect(fetchedFromDb?.sessionRevokedAt).toBeDefined();

      // Step 7: Next request with the EXACT SAME valid token MUST be rejected immediately
      await expect(sdk.authenticateRequest(mockReqActive)).rejects.toThrow(
        "Ce compte collaborateur est suspendu ou désactivé"
      );

      // Step 8: Next tRPC query/mutation with deactivated user context MUST fail with 403 FORBIDDEN
      const revokedCaller = appRouter.createCaller({
        req: mockReqActive,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: {
          ...authedUser,
          isActive: false,
          sessionRevokedAt: deactivatedUser.sessionRevokedAt,
        },
      });

      // Protected procedure check
      try {
        await revokedCaller.dossier.list();
        expect.unreachable("Protected procedure should reject deactivated user");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("Votre compte est désactivé");
      }

      // Declarant procedure check
      try {
        await revokedCaller.dossier.updateCustoms({ id: 1, customsStatus: "Conforme" });
        expect.unreachable("Declarant procedure should reject deactivated user");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("Votre compte est désactivé");
      }

      // Internal procedure check
      try {
        await revokedCaller.dossier.create({ client: "Test Client", cargoNature: "Conteneur" });
        expect.unreachable("Internal procedure should reject deactivated user");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("Votre compte est désactivé");
      }
    });

    it("verifies Bearer token in Authorization header is also rejected immediately upon deactivation", async () => {
      const email = `bearer.test.${Date.now()}@igs-transit.gn`;
      const user = await adminCaller.user.create({
        name: "Bearer Header Test User",
        email,
        role: "comptable",
        isActive: true,
      });

      const token = await sdk.createSessionToken(user.openId, { name: user.name || "Bearer User" });

      const bearerReq = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      // Active -> succeeds
      const authed = await sdk.authenticateRequest(bearerReq);
      expect(authed.openId).toBe(user.openId);

      // Deactivate
      await adminCaller.user.toggleStatus({ id: user.id, isActive: false });

      // Bearer header with deactivated token -> rejects with ForbiddenError
      await expect(sdk.authenticateRequest(bearerReq)).rejects.toThrow("suspendu ou désactivé");
    });

    it("blocks deactivated user across ALL critical SaaS mutation procedures (comment, document, task, finance)", async () => {
      const email = `all.procs.${Date.now()}@igs-transit.gn`;
      const employee = await adminCaller.user.create({
        name: "Multi-Proc Deactivated User",
        email,
        role: "comptable",
        isActive: false,
      });

      const revokedCaller = appRouter.createCaller({
        req: { headers: {} } as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: {
          ...employee,
          isActive: false,
          sessionRevokedAt: new Date(),
        },
      });

      // 1. Comment add
      await expect(
        revokedCaller.comment.add({ dossierId: 1, message: "Unauthorized comment attempt" })
      ).rejects.toThrowError(TRPCError);

      // 2. Document upload
      await expect(
        revokedCaller.document.upload({
          dossierId: 1,
          name: "unauthorized.pdf",
          type: "BL",
          fileUrl: "http://fake.url/file.pdf",
        })
      ).rejects.toThrowError(TRPCError);

      // 3. Task create
      await expect(
        revokedCaller.task.create({
          dossierId: 1,
          title: "Unauthorized task",
        })
      ).rejects.toThrowError(TRPCError);

      // 4. Finance invoice creation
      await expect(
        revokedCaller.finance.createInvoice({
          dossierId: 1,
          client: "Test Client",
          amountHt: 1000000,
          amountTtc: 1180000,
        })
      ).rejects.toThrowError(TRPCError);

      // 5. Finance summary
      await expect(revokedCaller.finance.summary()).rejects.toThrowError(TRPCError);
    });
  });

  // =========================================================================
  // 2. REACTIVATION -> IMMEDIATE ACCESS RESTORATION
  // =========================================================================
  describe("2. Reactivation -> Immediate Access Restoration", () => {
    it("restores access instantly across procedures when admin toggles user back to active", async () => {
      // Step 1: Create user in deactivated state
      const email = `reactivate.test.${Date.now()}@igs-transit.gn`;
      const employee = await adminCaller.user.create({
        name: "Mariama Cire Camara (Reactivation Test)",
        email,
        phone: "+224 622 99 88 77",
        role: "comptable",
        isActive: false,
      });

      expect(employee.isActive).toBe(false);
      expect(employee.sessionRevokedAt).toBeDefined();

      const sessionToken = await sdk.createSessionToken(employee.openId, {
        name: employee.name || "Mariama Camara",
      });

      const mockReq = {
        headers: {
          cookie: `app_session_id=${sessionToken}`,
        },
      } as any;

      // Verify blocked while inactive
      await expect(sdk.authenticateRequest(mockReq)).rejects.toThrow("suspendu ou désactivé");

      // Step 2: Admin reactivates the account
      const reactivated = await adminCaller.user.toggleStatus({
        id: employee.id,
        isActive: true,
      });

      expect(reactivated.isActive).toBe(true);
      expect(reactivated.sessionRevokedAt).toBeNull();

      // Step 3: Verify DB state is updated
      const dbUser = await db.getUserById(employee.id);
      expect(dbUser?.isActive).toBe(true);
      expect(dbUser?.sessionRevokedAt).toBeNull();

      // Step 4: Authentication succeeds immediately with original session token
      const authedUser = await sdk.authenticateRequest(mockReq);
      expect(authedUser).toBeDefined();
      expect(authedUser.openId).toBe(employee.openId);
      expect(authedUser.isActive).toBe(true);

      // Step 5: tRPC procedures execute successfully
      const reactivatedCaller = appRouter.createCaller({
        req: mockReq,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: authedUser,
      });

      const summary = await reactivatedCaller.finance.summary();
      expect(summary).toBeDefined();
      expect(typeof summary.totalCA_GNF).toBe("number");
    });

    it("handles multiple rapid toggling cycles (active -> inactive -> active -> inactive -> active) without state drift", async () => {
      const email = `cycle.test.${Date.now()}@igs-transit.gn`;
      const user = await adminCaller.user.create({
        name: "Cycle State Agent PAC",
        email,
        role: "declarant",
        isActive: true,
      });

      const token = await sdk.createSessionToken(user.openId, { name: user.name || "Cycle Agent" });
      const mockReq = { headers: { cookie: `app_session_id=${token}` } } as any;

      for (let i = 0; i < 5; i++) {
        // Toggle to inactive
        const inactiveRes = await adminCaller.user.toggleStatus({ id: user.id, isActive: false });
        expect(inactiveRes.isActive).toBe(false);
        expect(inactiveRes.sessionRevokedAt).toBeInstanceOf(Date);
        await expect(sdk.authenticateRequest(mockReq)).rejects.toThrow();

        // Toggle to active
        const activeRes = await adminCaller.user.toggleStatus({ id: user.id, isActive: true });
        expect(activeRes.isActive).toBe(true);
        expect(activeRes.sessionRevokedAt).toBeNull();
        const authed = await sdk.authenticateRequest(mockReq);
        expect(authed.openId).toBe(user.openId);
      }
    });
  });

  // =========================================================================
  // 3. UNAUTHORIZED TAMPERING DEFENSE & RBAC INTEGRITY
  // =========================================================================
  describe("3. User Update & Protection Against Role/Credential Tampering", () => {
    it("strictly forbids unauthenticated callers from all user administration mutations and queries", async () => {
      // Create attempt
      await expect(
        anonCaller.user.create({
          name: "Attacker User",
          email: "attacker@exploit.gn",
          role: "admin",
        })
      ).rejects.toThrowError(TRPCError);

      // Update attempt
      await expect(
        anonCaller.user.update({
          id: 1,
          role: "admin",
          name: "Hacked Admin",
        })
      ).rejects.toThrowError(TRPCError);

      // Toggle status attempt
      await expect(
        anonCaller.user.toggleStatus({
          id: 1,
          isActive: false,
        })
      ).rejects.toThrowError(TRPCError);

      // List attempt
      await expect(anonCaller.user.list()).rejects.toThrowError(TRPCError);

      // Get attempt
      await expect(anonCaller.user.get({ id: 1 })).rejects.toThrowError(TRPCError);

      // HR Stats attempt
      await expect(anonCaller.user.getHRStats()).rejects.toThrowError(TRPCError);
    });

    it("prevents declarant from elevating their own or others' roles via user.update", async () => {
      try {
        await declarantCaller.user.update({
          id: 2,
          role: "admin",
        });
        expect.unreachable("Declarant should not be able to elevate role");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("prevents comptable from modifying employee credentials or roles", async () => {
      try {
        await comptableCaller.user.update({
          id: 1,
          name: "Compromised Account",
          email: "compromised@finance.gn",
        });
        expect.unreachable("Comptable should not be able to update user records");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("prevents external client portal users from accessing any user administration endpoint", async () => {
      const clientEndpoints = [
        () => clientCaller.user.list(),
        () => clientCaller.user.get({ id: 4 }),
        () => clientCaller.user.getHRStats(),
        () => clientCaller.user.create({ name: "Malicious", email: "malicious@hack.gn", role: "admin" }),
        () => clientCaller.user.update({ id: 4, role: "admin" }),
        () => clientCaller.user.toggleStatus({ id: 1, isActive: false }),
      ];

      for (const endpoint of clientEndpoints) {
        try {
          await endpoint();
          expect.unreachable("Client must be rejected on all user endpoints");
        } catch (err: any) {
          expect(err).toBeInstanceOf(TRPCError);
          expect(err.code).toBe("FORBIDDEN");
        }
      }
    });

    it("rejects unauthorized role types outside the permitted enum during creation", async () => {
      await expect(
        adminCaller.user.create({
          name: "Invalid Role User",
          email: "invalid.role@igs.gn",
          role: "superadmin" as any,
        })
      ).rejects.toThrow();

      await expect(
        adminCaller.user.create({
          name: "Invalid Role User 2",
          email: "invalid.role2@igs.gn",
          role: "root" as any,
        })
      ).rejects.toThrow();
    });

    it("allows authorized admin to update employee fields safely and correctly updates sessionRevokedAt when isActive is changed", async () => {
      const email = `admin.update.${Date.now()}@igs-transit.gn`;
      const targetUser = await adminCaller.user.create({
        name: "Alpha Oumar Sow",
        email,
        phone: "+224 625 00 11 22",
        role: "declarant",
        isActive: true,
      });

      // Admin updates name, role and phone
      const updated = await adminCaller.user.update({
        id: targetUser.id,
        name: "Alpha Oumar Sow (Chef Déclarant)",
        phone: "+224 625 99 99 99",
        role: "manager",
      });

      expect(updated.name).toBe("Alpha Oumar Sow (Chef Déclarant)");
      expect(updated.phone).toBe("+224 625 99 99 99");
      expect(updated.role).toBe("manager");
      expect(updated.isActive).toBe(true);

      // Admin deactivates via update
      const deactivatedViaUpdate = await adminCaller.user.update({
        id: targetUser.id,
        isActive: false,
      });

      expect(deactivatedViaUpdate.isActive).toBe(false);
      expect(deactivatedViaUpdate.sessionRevokedAt).toBeInstanceOf(Date);

      // Admin reactivates via update
      const reactivatedViaUpdate = await adminCaller.user.update({
        id: targetUser.id,
        isActive: true,
      });

      expect(reactivatedViaUpdate.isActive).toBe(true);
      expect(reactivatedViaUpdate.sessionRevokedAt).toBeNull();
    });
  });

  // =========================================================================
  // 4. ADVERSARIAL TOKEN INTEGRITY & EDGE CASES
  // =========================================================================
  describe("4. Adversarial Token Integrity, Forgery & Boundary Scenarios", () => {
    it("rejects forged JWT tokens with invalid signatures", async () => {
      // Craft a token signed with an unauthorized secret key
      const fakeSecret = new TextEncoder().encode("fake_unauthorized_secret_key_1234567890");
      const forgedToken = await new SignJWT({
        openId: "igs_admin_conakry",
        appId: "fake_app",
        name: "Forged Admin",
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime("2h")
        .sign(fakeSecret);

      const fakeReq = {
        headers: {
          cookie: `app_session_id=${forgedToken}`,
        },
      } as any;

      // verifySession should return null and authenticateRequest should throw ForbiddenError
      const session = await sdk.verifySession(forgedToken);
      expect(session).toBeNull();

      await expect(sdk.authenticateRequest(fakeReq)).rejects.toThrow("Invalid session cookie");
    });

    it("rejects expired JWT tokens immediately", async () => {
      // Create an already expired token (1 hour in the past)
      const expiredToken = await sdk.signSession(
        {
          openId: "igs_admin_conakry",
          appId: "igs_transit_gn",
          name: "Expired Admin",
        },
        { expiresInMs: -3600_000 }
      );

      const session = await sdk.verifySession(expiredToken);
      expect(session).toBeNull();

      const expiredReq = {
        headers: {
          cookie: `app_session_id=${expiredToken}`,
        },
      } as any;

      await expect(sdk.authenticateRequest(expiredReq)).rejects.toThrow("Invalid session cookie");
    });

    it("rejects missing, empty, or garbage session tokens cleanly", async () => {
      const invalidTokens = [
        "",
        "   ",
        "invalid.token.structure",
        "Bearer",
        "null",
        "undefined",
        "12345",
      ];

      for (const token of invalidTokens) {
        const session = await sdk.verifySession(token);
        expect(session).toBeNull();

        const req = {
          headers: {
            cookie: `app_session_id=${token}`,
          },
        } as any;

        await expect(sdk.authenticateRequest(req)).rejects.toThrow("Invalid session cookie");
      }
    });

    it("blocks deactivated admin account from performing administrative actions", async () => {
      const inactiveAdminCaller = appRouter.createCaller(
        createAdminContext({
          id: 99,
          isActive: false,
          sessionRevokedAt: new Date(),
        })
      );

      // Should be blocked on adminProcedure
      try {
        await inactiveAdminCaller.user.list();
        expect.unreachable("Deactivated admin should be blocked on adminProcedure");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("Votre compte est désactivé");
      }

      // Should also be blocked on protectedProcedure
      try {
        await inactiveAdminCaller.dossier.list();
        expect.unreachable("Deactivated admin should be blocked on protectedProcedure");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("guarantees session isolation between multiple distinct users", async () => {
      // User A (declarant) & User B (comptable)
      const userA = await adminCaller.user.create({
        name: "Agent Isolation A",
        email: `isolation.a.${Date.now()}@igs-transit.gn`,
        role: "declarant",
        isActive: true,
      });

      const userB = await adminCaller.user.create({
        name: "Agent Isolation B",
        email: `isolation.b.${Date.now()}@igs-transit.gn`,
        role: "comptable",
        isActive: true,
      });

      const tokenA = await sdk.createSessionToken(userA.openId, { name: userA.name || "A" });
      const tokenB = await sdk.createSessionToken(userB.openId, { name: userB.name || "B" });

      const reqA = { headers: { cookie: `app_session_id=${tokenA}` } } as any;
      const reqB = { headers: { cookie: `app_session_id=${tokenB}` } } as any;

      // Both active
      const authedA1 = await sdk.authenticateRequest(reqA);
      const authedB1 = await sdk.authenticateRequest(reqB);
      expect(authedA1.openId).toBe(userA.openId);
      expect(authedB1.openId).toBe(userB.openId);

      // Deactivate User A only
      await adminCaller.user.toggleStatus({ id: userA.id, isActive: false });

      // User A must be rejected
      await expect(sdk.authenticateRequest(reqA)).rejects.toThrow("suspendu ou désactivé");

      // User B MUST remain active and functional (unaffected)
      const authedB2 = await sdk.authenticateRequest(reqB);
      expect(authedB2.openId).toBe(userB.openId);
      expect(authedB2.isActive).toBe(true);
    });
  });
});
