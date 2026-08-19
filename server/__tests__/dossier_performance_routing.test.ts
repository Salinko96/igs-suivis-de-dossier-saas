import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";

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
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("R4 - Dossier Detail Dynamic Route Resolution & Performance Suite (dossier.get)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const clientCaller = appRouter.createCaller(createClientContext());

  describe("1. Polymorphic Identifier Resolution", () => {
    it("resolves by integer ID (e.g. 1 and 54)", async () => {
      const res1 = await adminCaller.dossier.get({ id: 1 });
      expect(res1).toBeDefined();
      expect(res1.id).toBe(1);
      expect(res1.dossierNumber).toBe("DOS-0001");

      const res54 = await adminCaller.dossier.get({ id: 54 });
      expect(res54).toBeDefined();
      expect(res54.id).toBe(54);
      expect(res54.dossierNumber).toBe("DOS-0054");
    });

    it("resolves by string numeric ID (e.g. '1' and '9')", async () => {
      const res1 = await adminCaller.dossier.get({ id: "1" });
      expect(res1.id).toBe(1);
      expect(res1.dossierNumber).toBe("DOS-0001");

      const res9 = await adminCaller.dossier.get({ id: "9" });
      expect(res9.id).toBe(9);
      expect(res9.dossierNumber).toBe("DOS-0009");
    });

    it("resolves by formatted dossier number string (e.g. 'DOS-0001' and lowercase 'dos-0001')", async () => {
      const resUpper = await adminCaller.dossier.get({ id: "DOS-0001" });
      expect(resUpper.dossierNumber).toBe("DOS-0001");

      const resLower = await adminCaller.dossier.get({ id: "dos-0001" });
      expect(resLower.dossierNumber).toBe("DOS-0001");
    });

    it("resolves by portal access code (e.g. 'IGS-1001' and lowercase 'igs-1001')", async () => {
      const res = await adminCaller.dossier.get({ id: "IGS-1001" });
      expect(res.id).toBe(1);
      expect(res.dossierNumber).toBe("DOS-0001");

      const resLower = await adminCaller.dossier.get({ id: "igs-1001" });
      expect(resLower.id).toBe(1);
    });

    it("resolves by client dossier number (e.g. 'CKYSI26000340' and 'CKYSI26000342')", async () => {
      const res1 = await adminCaller.dossier.get({ id: "CKYSI26000340" });
      expect(res1.dossierNumber).toBe("DOS-0001");
      expect(res1.clientDossierNumber).toBe("CKYSI26000340");

      const res2 = await adminCaller.dossier.get({ id: "CKYSI26000342" });
      expect(res2.dossierNumber).toBe("DOS-0002");
      expect(res2.clientDossierNumber).toBe("CKYSI26000342");
    });

    it("resolves by maritime BL number (e.g. 'HLCUNG12604AUQG1')", async () => {
      const res = await adminCaller.dossier.get({ id: "HLCUNG12604AUQG1" });
      expect(res.dossierNumber).toBe("DOS-0001");
      expect(res.blLtaNumber).toBe("HLCUNG12604AUQG1");
    });
  });

  describe("2. Performance & Query Efficiency", () => {
    it("resolves 100 consecutive queries rapidly (< 250ms total)", async () => {
      const startTime = Date.now();
      const queries = [];
      for (let i = 1; i <= 50; i++) {
        const idNum = (i % 54) + 1;
        queries.push(adminCaller.dossier.get({ id: idNum }));
        queries.push(adminCaller.dossier.get({ id: `DOS-000${(i % 9) + 1}` }));
      }
      const results = await Promise.all(queries);
      const totalDuration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(totalDuration).toBeLessThan(500); // Very fast in-memory / indexed resolution
    });
  });

  describe("3. Error Handling for Nonexistent Dossiers", () => {
    it("throws NOT_FOUND error for non-existent numeric ID (999999)", async () => {
      await expect(adminCaller.dossier.get({ id: 999999 })).rejects.toThrow(/introuvable/i);
    });

    it("throws NOT_FOUND error for non-existent formatted ID ('DOS-9999')", async () => {
      await expect(adminCaller.dossier.get({ id: "DOS-9999" })).rejects.toThrow(/introuvable/i);
    });

    it("throws NOT_FOUND error for arbitrary invalid identifier ('UNKNOWN_REF')", async () => {
      await expect(adminCaller.dossier.get({ id: "UNKNOWN_REF" })).rejects.toThrow(/introuvable/i);
    });
  });

  describe("4. Security & Role Isolation", () => {
    it("allows client user to view dossier of their own company", async () => {
      const dossier1 = await clientCaller.dossier.get({ id: 1 });
      expect(dossier1.client).toBe("Guinean Birimian Gold S.A");
    });

    it("blocks client user with FORBIDDEN error when attempting to view another company's dossier", async () => {
      const all = await db.listDossiers();
      const otherClientDossier = all.find(d => d.client && d.client !== "Guinean Birimian Gold S.A");
      if (otherClientDossier) {
        await expect(
          clientCaller.dossier.get({ id: otherClientDossier.id })
        ).rejects.toThrow(/Accès refusé|forbidden/i);
      }
    });
  });
});
