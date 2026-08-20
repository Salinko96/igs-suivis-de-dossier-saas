import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";

function createAnonymousContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: null,
  };
}

describe("R1 - Client Portal Search & Tracking Suite (portal.track)", () => {
  const publicCaller = appRouter.createCaller(createAnonymousContext());

  describe("1. Valid Tracking Codes Multi-Identifier Resolution", () => {
    it("resolves successfully with portal access code 'IGS-1001'", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1001" });
      expect(res).toBeDefined();
      expect(res.dossier).toBeDefined();
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
      expect(res.dossier.portalAccessCode).toBe("IGS-1001");
      expect(res.dossier.client).toBe("Guinean Birimian Gold S.A");
      expect(Array.isArray(res.documents)).toBe(true);
      expect(Array.isArray(res.timeline)).toBe(true);
    });

    it("resolves successfully with client dossier number 'CKYSI26000340'", async () => {
      // Direct DB and tRPC tracking lookup by client dossier number
      const dossier = await db.getDossier("CKYSI26000340");
      expect(dossier).toBeDefined();
      expect(dossier?.dossierNumber).toBe("DOS-0001");
      expect(dossier?.clientDossierNumber).toBe("CKYSI26000340");

      // Verify portal search handles client dossier number
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "CKYSI26000340" });
      expect(res).toBeDefined();
      expect(res.dossier).toBeDefined();
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("resolves successfully with maritime BL number 'HLCUNG12604AUQG1'", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "HLCUNG12604AUQG1" });
      expect(res).toBeDefined();
      expect(res.dossier).toBeDefined();
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
      expect(res.dossier.blLtaNumber).toBe("HLCUNG12604AUQG1");
    });

    it("resolves secondary dossier with code 'IGS-1002' or BL 'HLCUNG12604AVHK6'", async () => {
      const resByCode = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1002" });
      expect(resByCode).toBeDefined();
      expect(resByCode.dossier.dossierNumber).toBe("DOS-0002");
      expect(resByCode.dossier.client).toBe("Guinee Gold Exploration S.A");

      const resByBl = await publicCaller.portal.track({ accessCodeOrNumber: "HLCUNG12604AVHK6" });
      expect(resByBl).toBeDefined();
      expect(resByBl.dossier.dossierNumber).toBe("DOS-0002");
    });
  });

  describe("2. Case-Insensitivity & Whitespace Resiliency", () => {
    it("handles lowercase portal access code 'igs-1001'", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "igs-1001" });
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
      expect(res.dossier.portalAccessCode).toBe("IGS-1001");
    });

    it("handles leading and trailing whitespace '   IGS-1001   '", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "   IGS-1001   " });
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("handles lowercase and whitespace client ref '  ckysi26000340  '", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "  ckysi26000340  " });
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("handles lowercase BL number 'hlcung12604auqg1'", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "hlcung12604auqg1" });
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });

    it("handles numeric portal code '1001'", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "1001" });
      expect(res.dossier.dossierNumber).toBe("DOS-0001");
    });
  });

  describe("3. Error Handling for Invalid or Missing Codes", () => {
    it("rejects non-existent code 'XXXX-9999' with not-found error", async () => {
      await expect(
        publicCaller.portal.track({ accessCodeOrNumber: "XXXX-9999" })
      ).rejects.toThrow();
    });

    it("rejects non-existent code 'UNKNOWN-CODE' with not-found error", async () => {
      await expect(
        publicCaller.portal.track({ accessCodeOrNumber: "UNKNOWN-CODE" })
      ).rejects.toThrow();
    });

    it("rejects input shorter than 2 characters with schema validation error", async () => {
      await expect(
        publicCaller.portal.track({ accessCodeOrNumber: "A" })
      ).rejects.toThrow();
    });
  });

  describe("4. Payload Contract & Integrity Verification", () => {
    it("returns dossier with all essential public logistics fields", async () => {
      const res = await publicCaller.portal.track({ accessCodeOrNumber: "IGS-1001" });
      const { dossier, documents, timeline } = res;

      expect(dossier).toHaveProperty("id");
      expect(dossier).toHaveProperty("dossierNumber");
      expect(dossier).toHaveProperty("client");
      expect(dossier).toHaveProperty("cargoNature");
      expect(dossier).toHaveProperty("transportMode");
      expect(dossier).toHaveProperty("originPort");
      expect(dossier).toHaveProperty("destinationPort");
      expect(dossier).toHaveProperty("calculatedStatus");
      expect(dossier).toHaveProperty("completionRate");

      // Verify documents array structure
      expect(Array.isArray(documents)).toBe(true);
      if (documents.length > 0) {
        expect(documents[0]).toHaveProperty("id");
        expect(documents[0]).toHaveProperty("name");
        expect(documents[0]).toHaveProperty("type");
        expect(documents[0]).toHaveProperty("createdAt");
      }

      // Verify timeline array structure
      expect(Array.isArray(timeline)).toBe(true);
    });
  });
});
