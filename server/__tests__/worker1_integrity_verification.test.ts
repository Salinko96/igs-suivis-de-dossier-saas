import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { generateProactiveAlerts } from "../alertsService";
import type { Dossier } from "../../drizzle/schema";
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

describe("Worker 1 Comprehensive Verification Suite", () => {
  const publicCaller = appRouter.createCaller(createAnonymousContext());
  const adminCaller = appRouter.createCaller(createAdminContext());

  describe("R1: Client Portal Multi-Identifier Search & Error Response", () => {
    it("throws a TRPCError with code NOT_FOUND and explicit French message for invalid code", async () => {
      try {
        await publicCaller.portal.track({ accessCodeOrNumber: "XXXX-9999" });
        expect.unreachable("Should have thrown NOT_FOUND error");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe("NOT_FOUND");
        expect(err.message).toContain("Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.");
      }
    });

    it("resolves accurately by portal access code IGS-1001", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1001" });
      expect(res.dossier).toBeDefined();
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("resolves accurately by client dossier number CKYSI26000340", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "CKYSI26000340" });
      expect(res.dossier).toBeDefined();
      expect(res.dossier.clientDossierNumber).toBe("CKYSI26000340");
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("resolves accurately by maritime BL number HLCUNG12604AUQG1", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "HLCUNG12604AUQG1" });
      expect(res.dossier).toBeDefined();
      expect(res.dossier.blLtaNumber).toBe("HLCUNG12604AUQG1");
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("getDossierByPortalCode supports all 4 fields in both case-sensitive and case-insensitive formats", async () => {
      const d1 = await db.getDossierByPortalCode("igs-1001");
      expect(d1?.dossierNumber).toBe("DOS-0001");

      const d2 = await db.getDossierByPortalCode("ckysi26000340");
      expect(d2?.dossierNumber).toBe("DOS-0001");

      const d3 = await db.getDossierByPortalCode("hlcung12604auqg1");
      expect(d3?.dossierNumber).toBe("DOS-0001");

      const d4 = await db.getDossierByPortalCode("dos-0001");
      expect(d4?.dossierNumber).toBe("DOS-0001");
    });
  });

  describe("R2: Deterministic Alert IDs & Read State Synchronization", () => {
    it("generates deterministic IDs formatted as (d.id * 10) + alertTypeIndex", () => {
      const mockDossier: Dossier = {
        id: 7,
        dossierNumber: "DOS-0007",
        clientDossierNumber: "CLI-777",
        client: "Test Client",
        blLtaNumber: "BL-777",
        cargoNature: "Equipement minier",
        transportMode: "Maritime",
        eta: new Date("2026-08-01T00:00:00Z"),
        originPort: "Antwerp",
        destinationPort: "Port Autonome de Conakry",
        container: "1x40",
        bulk: null,
        goodsReleaseDate: null,
        declarationNumber: null,
        bulletinNumber: null,
        finalDeclarationNumber: null,
        ddiGucegNumber: null,
        badStatus: null,
        baeStatus: null,
        calculatedStatus: "À régulariser",
        calculatedPriority: "Haute",
        completionRate: 40,
        documentStatus: null,
        customsStatus: null,
        portStatus: null,
        financialStatus: null,
        fieldOperation: null,
        responsible: "Agent Test",
        nextAction: null,
        fieldAlert: null,
        deliveryLocation: null,
        declarant: null,
        service: "Transit",
        regime: "IM4",
        notes: null,
        portalAccessCode: "IGS-1007",
        createdById: 1,
        updatedById: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alerts = generateProactiveAlerts([mockDossier]);
      const demurrage = alerts.find(a => a.type === "SURESTARIES_RISQUE");
      const eta = alerts.find(a => a.type === "ETA_DEPASSEE");
      const ddi = alerts.find(a => a.type === "DDI_MANQUANTE");

      expect(demurrage?.id).toBe(7 * 10 + 1); // 71
      expect(eta?.id).toBe(7 * 10 + 2); // 72
      expect(ddi?.id).toBe(7 * 10 + 3); // 73
    });

    it("maintains stable alert IDs even when the order of dossiers in the array is inverted", () => {
      const dossiers = [
        {
          id: 1,
          dossierNumber: "DOS-0001",
          eta: new Date("2026-08-01T00:00:00Z"),
          goodsReleaseDate: null,
          declarationNumber: null,
        } as Dossier,
        {
          id: 5,
          dossierNumber: "DOS-0005",
          eta: new Date("2026-08-01T00:00:00Z"),
          goodsReleaseDate: null,
          declarationNumber: null,
        } as Dossier,
      ];

      const alertsForward = generateProactiveAlerts(dossiers);
      const alertsReversed = generateProactiveAlerts([...dossiers].reverse());

      const d1Forward = alertsForward.filter(a => a.dossierId === 1).map(a => a.id);
      const d1Reversed = alertsReversed.filter(a => a.dossierId === 1).map(a => a.id);

      expect(d1Forward.sort()).toEqual(d1Reversed.sort());
    });

    it("marks single and all notifications as read and retains state", async () => {
      const list = await adminCaller.notification.list();
      expect(list.length).toBeGreaterThan(0);

      const firstAlert = list[0];
      await adminCaller.notification.markAsRead({ id: firstAlert.id });

      const updatedList = await adminCaller.notification.list();
      const updatedAlert = updatedList.find(a => a.id === firstAlert.id);
      expect(updatedAlert?.isRead).toBe(1);

      await adminCaller.notification.markAllAsRead();
      const allReadList = await adminCaller.notification.list();
      expect(allReadList.every(a => a.isRead === 1)).toBe(true);
    });
  });

  describe("R4: Database Direct PK Index Lookup Optimization", () => {
    it("retrieves dossier via numeric ID directly", async () => {
      const d = await db.getDossier(1);
      expect(d).toBeDefined();
      expect(d?.id).toBe(1);
      expect(d?.dossierNumber).toBe("DOS-0001");
    });

    it("retrieves dossier via string numeric ID directly", async () => {
      const d = await db.getDossier("1");
      expect(d).toBeDefined();
      expect(d?.id).toBe(1);
    });

    it("retrieves dossier via formatted number DOS-0001", async () => {
      const d = await db.getDossier("DOS-0001");
      expect(d).toBeDefined();
      expect(d?.id).toBe(1);
    });

    it("retrieves dossier via other fields (portal code, BL, client ref)", async () => {
      const dByCode = await db.getDossier("IGS-1001");
      expect(dByCode?.id).toBe(1);

      const dByBl = await db.getDossier("HLCUNG12604AUQG1");
      expect(dByBl?.id).toBe(1);

      const dByClientRef = await db.getDossier("CKYSI26000340");
      expect(dByClientRef?.id).toBe(1);
    });
  });
});
