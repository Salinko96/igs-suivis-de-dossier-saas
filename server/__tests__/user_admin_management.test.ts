import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { resolvePermissions } from "../../client/src/hooks/usePermissions";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";

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

function createInactiveUserContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 59,
      openId: "igs_declarant_facinet_camara",
      name: "Facinet Camara (Compte Suspendu)",
      email: "f.camara.suspendu@igs-logistics.gn",
      role: "declarant",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 623 77 11 55",
      isActive: false,
      sessionRevokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("R1 - Module d'Administration & Gestion des 100 Employés (/utilisateurs)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const declarantCaller = appRouter.createCaller(createDeclarantContext());
  const comptableCaller = appRouter.createCaller(createComptableContext());
  const clientCaller = appRouter.createCaller(createClientContext());
  const inactiveCaller = appRouter.createCaller(createInactiveUserContext());
  const anonCaller = appRouter.createCaller(createAnonymousContext());

  describe("1. Initial Seed & HR Statistics Accuracy", () => {
    it("seeds 100+ realistic Guinean collaborators with valid attributes", async () => {
      const allUsers = await db.listUsers();
      expect(allUsers.length).toBeGreaterThanOrEqual(100);

      // Verify mandatory fields for all users
      for (const u of allUsers) {
        expect(u.id).toBeDefined();
        expect(typeof u.id).toBe("number");
        expect(u.openId).toBeDefined();
        expect(u.openId.length).toBeGreaterThan(0);
        expect(u.name).toBeDefined();
        expect(u.email).toBeDefined();
        expect(u.role).toBeDefined();
        expect(typeof u.isActive).toBe("boolean");
        expect(u.phone).toMatch(/^\+224/);
      }
    });

    it("calculates HR metrics accurately via getHRStats", async () => {
      const stats = await adminCaller.user.getHRStats();
      const allUsers = await db.listUsers();

      expect(stats.totalEmployees).toBe(allUsers.length);
      expect(stats.totalActive).toBe(allUsers.filter(u => u.isActive !== false).length);
      expect(stats.totalInactive).toBe(allUsers.filter(u => u.isActive === false).length);
      expect(stats.totalActive + stats.totalInactive).toBe(stats.totalEmployees);

      expect(stats.activeDeclarantsAtPort).toBe(
        allUsers.filter(u => u.role === "declarant" && u.isActive !== false).length
      );
      expect(stats.activeComptables).toBe(
        allUsers.filter(u => u.role === "comptable" && u.isActive !== false).length
      );
      expect(stats.connectedClients).toBe(
        allUsers.filter(u => u.role === "client" && u.isActive !== false).length
      );

      expect(stats.activeDeclarantsAtPort).toBeGreaterThanOrEqual(40);
      expect(stats.activeComptables).toBeGreaterThanOrEqual(15);
      expect(stats.connectedClients).toBeGreaterThanOrEqual(30);
    });
  });

  describe("2. RBAC Security & Procedure Guards", () => {
    it("allows adminCaller full access to user administration procedures", async () => {
      const list = await adminCaller.user.list({ limit: 10 });
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeLessThanOrEqual(10);

      const hrStats = await adminCaller.user.getHRStats();
      expect(hrStats.totalEmployees).toBeGreaterThanOrEqual(100);
    });

    it("rejects anonymousCaller with UNAUTHORIZED (401) on admin procedures", async () => {
      await expect(anonCaller.user.list()).rejects.toThrowError(TRPCError);
      await expect(anonCaller.user.getHRStats()).rejects.toThrowError(TRPCError);
      await expect(
        anonCaller.user.create({
          name: "Test Hacker",
          email: "hacker@domain.com",
          role: "admin",
        })
      ).rejects.toThrowError(TRPCError);
    });

    it("rejects declarantCaller with FORBIDDEN (403) on user administration", async () => {
      try {
        await declarantCaller.user.list();
        expect.unreachable("Declarant should not be able to list admin users");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("rejects comptableCaller with FORBIDDEN (403) on user administration", async () => {
      try {
        await comptableCaller.user.getHRStats();
        expect.unreachable("Comptable should not be able to access HR stats");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("rejects clientCaller with FORBIDDEN (403) on user administration", async () => {
      try {
        await clientCaller.user.toggleStatus({ id: 2, isActive: false });
        expect.unreachable("Client should not be able to toggle user status");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("3. Session Revocation & Inactive User Defense", () => {
    it("rejects inactive caller on any protectedProcedure with FORBIDDEN", async () => {
      try {
        await inactiveCaller.dossier.list();
        expect.unreachable("Inactive user must be blocked");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
        expect(err.message).toContain("compte est désactivé");
      }
    });

    it("rejects inactive caller on adminProcedure with FORBIDDEN", async () => {
      try {
        await inactiveCaller.user.list();
        expect.unreachable("Inactive user must be blocked");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("rejects inactive caller on declarantProcedure with FORBIDDEN", async () => {
      try {
        await inactiveCaller.dossier.updateCustoms({ id: 1, customsStatus: "Conforme" });
        expect.unreachable("Inactive user must be blocked on declarant procedures");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("rejects inactive caller on comptableProcedure with FORBIDDEN", async () => {
      try {
        await inactiveCaller.finance.summary();
        expect.unreachable("Inactive user must be blocked on comptable procedures");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("sdk.authenticateRequest rejects inactive users with ForbiddenError", async () => {
      const inactiveUser = await db.getUserByOpenId("igs_declarant_facinet_camara");
      expect(inactiveUser).toBeDefined();
      expect(inactiveUser?.isActive).toBe(false);

      const token = await sdk.createSessionToken(inactiveUser!.openId, {
        name: inactiveUser!.name || "Inactive",
      });

      const mockReq = {
        headers: {
          cookie: `app_session_id=${token}`,
        },
      } as any;

      await expect(sdk.authenticateRequest(mockReq)).rejects.toThrow("suspendu ou désactivé");
    });
  });

  describe("4. Collaborator Lifecycle & CRUD Operations", () => {
    let createdUserId: number;

    it("creates a new collaborator with valid metadata and default active status", async () => {
      const newUser = await adminCaller.user.create({
        name: "Ibrahima Kalil Keita (Nouveau Déclarant)",
        email: "ik.keita@igs-transit.gn",
        phone: "+224 620 77 88 99",
        role: "declarant",
        isActive: true,
      });

      expect(newUser).toBeDefined();
      expect(newUser.id).toBeGreaterThan(100);
      expect(newUser.name).toBe("Ibrahima Kalil Keita (Nouveau Déclarant)");
      expect(newUser.email).toBe("ik.keita@igs-transit.gn");
      expect(newUser.role).toBe("declarant");
      expect(newUser.isActive).toBe(true);
      expect(newUser.openId).toContain("igs_declarant_");

      createdUserId = newUser.id;
    });

    it("fetches the created collaborator by ID using user.get", async () => {
      const user = await adminCaller.user.get({ id: createdUserId });
      expect(user).toBeDefined();
      expect(user.id).toBe(createdUserId);
      expect(user.name).toBe("Ibrahima Kalil Keita (Nouveau Déclarant)");
    });

    it("updates the collaborator's details using user.update", async () => {
      const updated = await adminCaller.user.update({
        id: createdUserId,
        name: "Ibrahima Kalil Keita (Déclarant Promu PAC)",
        phone: "+224 620 99 00 11",
      });

      expect(updated.name).toBe("Ibrahima Kalil Keita (Déclarant Promu PAC)");
      expect(updated.phone).toBe("+224 620 99 00 11");
    });

    it("toggles status to inactive and sets sessionRevokedAt timestamp", async () => {
      const deactivated = await adminCaller.user.toggleStatus({
        id: createdUserId,
        isActive: false,
      });

      expect(deactivated.isActive).toBe(false);
      expect(deactivated.sessionRevokedAt).toBeDefined();
      expect(deactivated.sessionRevokedAt).toBeInstanceOf(Date);
    });

    it("reactivates the user successfully", async () => {
      const reactivated = await adminCaller.user.toggleStatus({
        id: createdUserId,
        isActive: true,
      });

      expect(reactivated.isActive).toBe(true);
    });
  });

  describe("5. Search, Role Filtering & Pagination", () => {
    it("filters collaborators by search term matching name", async () => {
      const results = await adminCaller.user.list({ search: "Mamadou Diallo" });
      expect(results.length).toBeGreaterThan(0);
      for (const u of results) {
        const matchesName = u.name?.toLowerCase().includes("mamadou") || u.name?.toLowerCase().includes("diallo");
        expect(matchesName).toBe(true);
      }
    });

    it("filters collaborators by role (comptable)", async () => {
      const results = await adminCaller.user.list({ role: "comptable" });
      expect(results.length).toBeGreaterThanOrEqual(15);
      for (const u of results) {
        expect(u.role).toBe("comptable");
      }
    });

    it("filters collaborators by active status", async () => {
      const inactiveResults = await adminCaller.user.list({ isActive: false });
      expect(inactiveResults.length).toBeGreaterThan(0);
      for (const u of inactiveResults) {
        expect(u.isActive).toBe(false);
      }
    });

    it("paginates collaborators with limit and offset", async () => {
      const page1 = await adminCaller.user.list({ limit: 5, offset: 0 });
      const page2 = await adminCaller.user.list({ limit: 5, offset: 5 });

      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("6. Frontend Permission Matrix (usePermissions)", () => {
    it("grants canManageUsers only to admin role", () => {
      expect(resolvePermissions("admin").canManageUsers).toBe(true);
      expect(resolvePermissions("declarant").canManageUsers).toBe(false);
      expect(resolvePermissions("comptable").canManageUsers).toBe(false);
      expect(resolvePermissions("client").canManageUsers).toBe(false);
      expect(resolvePermissions("manager").canManageUsers).toBe(false);
      expect(resolvePermissions("user").canManageUsers).toBe(false);
    });
  });
});
