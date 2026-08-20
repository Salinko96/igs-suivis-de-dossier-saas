import { describe, expect, it } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";

describe("Enterprise Client Portal Security, Validation & Audit Trail", () => {
  // 1. SÉCURITÉ DU PORTAIL CLIENT (JWT TOKEN SIGNÉ)
  describe("1. Signed JWT Tokens for Client Portal", () => {
    it("generates a signed JWT token valid for 7 days", async () => {
      const token = await db.generatePortalToken({
        dossierId: 1,
        dossierNumber: "DOS-0001",
        clientCompany: "Guinean Birimian Gold S.A",
        clientDossierNumber: "CKYSI26000340",
      }, "7d");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // Standard JWT header.payload.signature

      const verified = await db.verifyPortalToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.dossierId).toBe(1);
      expect(verified?.dossierNumber).toBe("DOS-0001");
      expect(verified?.clientCompany).toBe("Guinean Birimian Gold S.A");
      expect(verified?.scope).toBe("portal_tracking");
    });

    it("rejects an invalid or tampered JWT token", async () => {
      const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidSignature";
      const verified = await db.verifyPortalToken(invalidToken);
      expect(verified).toBeNull();
    });
  });

  // 2. SYSTÈME OTP (ONE-TIME PASSWORD) & SESSIONS
  describe("2. OTP Authentication for Client Companies", () => {
    it("requests an OTP session with 6-digit code and 15 min expiry", async () => {
      const res = await db.requestClientOtp({
        clientCompany: "Test Mining Corp Guinea",
        phone: "+224 621 99 88 77",
        email: "logistique@testmining.gn",
        dossierId: 1,
      });

      expect(res.success).toBe(true);
      expect(res.expiresInSeconds).toBe(900);
      expect(res.debugOtpCode).toBeDefined();
      expect(res.debugOtpCode).toHaveLength(6);
    });

    it("fails verification when OTP code is incorrect", async () => {
      await db.requestClientOtp({
        clientCompany: "Company Wrong Code",
        phone: "+224 620 00 00 00",
      });

      const verifyRes = await db.verifyClientOtp({
        clientCompany: "Company Wrong Code",
        otpCode: "000000",
      });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain("incorrect");
    });

    it("succeeds when OTP code matches and generates a 7-day session token", async () => {
      const reqRes = await db.requestClientOtp({
        clientCompany: "Bauxite Express S.A",
        phone: "+224 622 33 44 55",
        dossierId: 2,
      });

      const otp = reqRes.debugOtpCode!;
      const verifyRes = await db.verifyClientOtp({
        clientCompany: "Bauxite Express S.A",
        otpCode: otp,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.token).toBeDefined();
      expect(verifyRes.clientCompany).toBe("Bauxite Express S.A");

      // Verify the returned token
      const verifiedToken = await db.verifyPortalToken(verifyRes.token!);
      expect(verifiedToken).not.toBeNull();
      expect(verifiedToken?.clientCompany).toBe("Bauxite Express S.A");
    });
  });

  // 3. LOGGING DES ACCÈS AU PORTAIL (IP & SUCCÈS/ÉCHEC)
  describe("3. Portal Access Logging", () => {
    it("logs successful and failed access attempts with IP and timestamp", async () => {
      const logSuccess = await db.logPortalAccess({
        dossierId: 1,
        accessCodeUsed: "IGS-1001",
        clientCompany: "Guinean Birimian Gold S.A",
        ipAddress: "197.149.200.5",
        userAgent: "Mozilla/5.0 Chrome/120.0",
        success: true,
      });

      expect(logSuccess.id).toBeDefined();
      expect(logSuccess.success).toBe(true);
      expect(logSuccess.ipAddress).toBe("197.149.200.5");

      const logFail = await db.logPortalAccess({
        accessCodeUsed: "UNKNOWN-CODE-999",
        ipAddress: "197.149.200.6",
        success: false,
        errorReason: "Dossier introuvable",
      });

      expect(logFail.success).toBe(false);
      expect(logFail.errorReason).toBe("Dossier introuvable");

      const logs = await db.listPortalAccessLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 4. RÈGLES DE VALIDATION & STATUT BROUILLON
  describe("4. Strict Validation & Draft Status", () => {
    it("creates a draft dossier when marked as isDraft or calculatedStatus Brouillon", async () => {
      const draft = await db.createDossier({
        clientDossierNumber: "DRAFT-REF-01",
        isDraft: true,
        calculatedStatus: "Brouillon",
      });

      expect(draft.id).toBeDefined();
      expect(draft.calculatedStatus).toBe("Brouillon");
    });

    it("calculates standard status for full operational dossier", async () => {
      const full = await db.createDossier({
        client: "Société Minière de Boké",
        clientDossierNumber: "SMB-2026-001",
        blLtaNumber: "MSKU99887766",
        transportMode: "Maritime",
        cargoNature: "Équipements d'extraction",
        eta: new Date("2026-09-01"),
        originPort: "Anvers",
        destinationPort: "Port Autonome de Conakry",
        container: "2x40HC",
        goodsReleaseDate: new Date("2026-09-05"),
        declarationNumber: "DEC-2026-999",
        bulletinNumber: "BLQ-2026-999",
      });

      expect(full.calculatedStatus).toBe("Régularisé");
      expect(full.completionRate).toBe(100);
    });
  });

  // 5. AUDIT TRAIL & HISTORIQUE DES ACTIONS
  describe("5. Complete Audit Trail & Filtering", () => {
    it("logs audit event and retrieves via listAuditLogs", async () => {
      await db.logAuditEvent({
        dossierId: 1,
        userId: 2,
        userName: "Mamadou Diallo",
        userRole: "declarant",
        action: "STATUT_MODIFIE",
        entityType: "dossier",
        entityId: 1,
        fieldChanged: "BAD Port Autonome",
        previousValue: "En attente",
        newValue: "Obtenu",
        comment: "BAD délivré au quai 2",
        ipAddress: "127.0.0.1",
      });

      const auditList = await db.listAuditLogs({ dossierId: 1, action: "STATUT_MODIFIE" });
      expect(auditList.length).toBeGreaterThan(0);
      expect(auditList[0].fieldChanged).toBe("BAD Port Autonome");
      expect(auditList[0].newValue).toBe("Obtenu");
      expect(auditList[0].authorName).toBe("Mamadou Diallo");
    });

    it("filters audit logs by author name", async () => {
      const authorLogs = await db.listAuditLogs({ authorName: "Mamadou" });
      expect(authorLogs.every(l => l.authorName?.includes("Mamadou"))).toBe(true);
    });
  });
});
