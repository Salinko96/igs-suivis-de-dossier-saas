import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";
import { COOKIE_NAME } from "@shared/const";

function createMockContext(user: any = null): { ctx: TrpcContext; res: { cookie: any; clearCookie: any } } {
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  const ctx: TrpcContext = {
    req: { headers: {} } as any,
    res: res as any,
    user,
  };
  return { ctx, res };
}

describe("Tier 2 - tRPC Server RBAC & Integration: Auth Role Simulation (R1, R4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Mutation auth.login pour les 4 personas du simulateur", () => {
    it("connecte le profil Administrateur IGS et émet le cookie de session", async () => {
      const { ctx, res } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.login({ role: "admin" });

      expect(user).toBeDefined();
      expect(user?.role).toBe("admin");
      expect(user?.name).toBe("Ibrahima Gold Service (Admin)");
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ maxAge: expect.any(Number) })
      );
    });

    it("connecte le profil Déclarant PAC (Mamadou Diallo)", async () => {
      const { ctx, res } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.login({ role: "declarant" });

      expect(user).toBeDefined();
      expect(user?.role).toBe("declarant");
      expect(user?.name).toBe("Mamadou Diallo (Déclarant)");
      expect(res.cookie).toHaveBeenCalled();
    });

    it("connecte le profil Comptable (Fatoumata Camara)", async () => {
      const { ctx, res } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.login({ role: "comptable" });

      expect(user).toBeDefined();
      expect(user?.role).toBe("comptable");
      expect(user?.name).toBe("Fatoumata Camara (Comptable)");
      expect(res.cookie).toHaveBeenCalled();
    });

    it("connecte le profil Portail Client avec la société cliente associée (Birimian Gold)", async () => {
      const { ctx, res } = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.login({
        role: "client",
        clientCompany: "Guinean Birimian Gold S.A",
      });

      expect(user).toBeDefined();
      expect(user?.role).toBe("client");
      expect(user?.clientCompany).toBe("Guinean Birimian Gold S.A");
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe("2. Query auth.me & Contexte de Session", () => {
    it("renvoie null lorsque l'utilisateur n'est pas authentifié", async () => {
      const { ctx } = createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const me = await caller.auth.me();
      expect(me).toBeNull();
    });

    it("renvoie les claims et le profil de l'utilisateur actif connecté", async () => {
      const mockUser = {
        id: 2,
        openId: "declarant_conakry",
        name: "Mamadou Diallo",
        email: "declarant@igs-logistics.gn",
        role: "declarant",
        loginMethod: "direct",
        clientCompany: null,
        phone: "+224 621 11 22 33",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const { ctx } = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      const me = await caller.auth.me();
      expect(me).toBeDefined();
      expect(me?.id).toBe(2);
      expect(me?.role).toBe("declarant");
      expect(me?.name).toBe("Mamadou Diallo");
    });
  });

  describe("3. Mutation auth.logout", () => {
    it("révoque la session et supprime le cookie de session", async () => {
      const { ctx, res } = createMockContext({ id: 1, role: "admin" });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
      expect(res.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.objectContaining({ maxAge: -1 })
      );
    });
  });

  describe("4. Gestion des Collaborateurs & Sécurité (toggleStatus & delete)", () => {
    it("permet à l'admin de suspendre, réactiver et supprimer un collaborateur", async () => {
      const { ctx } = createMockContext({ id: 1, role: "admin", name: "Admin IGS" });
      const caller = appRouter.createCaller(ctx);

      // Création d'un collaborateur de test
      const created = await caller.user.create({
        name: "Agent Test PAC",
        email: `agent.test.${Date.now()}@igs-logistics.gn`,
        role: "declarant",
        phone: "+224 620 99 88 77",
      });
      expect(created).toBeDefined();
      expect(created.isActive).toBe(true);

      // Suspension de la session
      const suspended = await caller.user.toggleStatus({ id: created.id, isActive: false });
      expect(suspended.isActive).toBe(false);
      expect(suspended.sessionRevokedAt).toBeDefined();

      // Réactivation du compte
      const reactivated = await caller.user.toggleStatus({ id: created.id, isActive: true });
      expect(reactivated.isActive).toBe(true);

      // Suppression définitive du collaborateur
      const deleted = await caller.user.delete({ id: created.id });
      expect(deleted.success).toBe(true);
      expect(deleted.user.id).toBe(created.id);
    });

    it("permet de supprimer un collaborateur par ID numérique (ex: ID 43 Souleymane Diallo)", async () => {
      const { ctx } = createMockContext({ id: 1, role: "admin", name: "Admin IGS" });
      const caller = appRouter.createCaller(ctx);

      const deleted = await caller.user.delete({ id: 43 });
      expect(deleted.success).toBe(true);
      expect(deleted.user.name).toContain("Souleymane Diallo");
    });

    it("interdit la suppression du compte Administrateur Principal IGS", async () => {
      const { ctx } = createMockContext({ id: 1, role: "admin", name: "Admin IGS" });
      const caller = appRouter.createCaller(ctx);

      await expect(caller.user.delete({ id: 1 })).rejects.toThrow();
    });
  });
});
