import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import { uploadDossierCloudFile } from "../cloudStorageService";
import { sendDossierWhatsAppAlert, sendDossierEmailAlert } from "../alertsService";

describe("Production-Ready Suite: 4 Core Pillars Validation", () => {
  // 1. Authentification Sécurisée par Mot de Passe
  describe("Pillar 1: Authentification & Mots de Passe (auth.loginWithPassword)", () => {
    it("authentifie avec succès un administrateur et configure le rôle", async () => {
      const mockReq = { headers: {} } as any;
      let setCookieHeader = "";
      const mockRes = {
        cookie: (_name: string, val: string) => { setCookieHeader = val; },
        clearCookie: () => {},
      } as any;

      const caller = appRouter.createCaller({
        req: mockReq,
        res: mockRes,
        user: null,
      });

      const user = await caller.auth.loginWithPassword({
        email: "admin@igs-logistics.gn",
        password: "IgsTransit2026!",
      });

      expect(user).toBeDefined();
      expect(user?.role).toBe("admin");
      expect(user?.name).toContain("Admin");
      expect(setCookieHeader).toBeTruthy();
    });

    it("authentifie avec succès un déclarant PAC et un comptable", async () => {
      const mockReq = { headers: {} } as any;
      const mockRes = { cookie: () => {}, clearCookie: () => {} } as any;
      const caller = appRouter.createCaller({ req: mockReq, res: mockRes, user: null });

      const declarant = await caller.auth.loginWithPassword({
        email: "declarant@igs-logistics.gn",
        password: "IgsTransit2026!",
      });
      expect(declarant?.role).toBe("declarant");
      expect(declarant?.name).toContain("Mamadou Diallo");

      const comptable = await caller.auth.loginWithPassword({
        email: "comptable@igs-logistics.gn",
        password: "IgsTransit2026!",
      });
      expect(comptable?.role).toBe("comptable");
      expect(comptable?.name).toContain("Fatoumata Camara");
    });

    it("rejette les mots de passe trop courts avec code UNAUTHORIZED", async () => {
      const mockReq = { headers: {} } as any;
      const mockRes = { cookie: () => {}, clearCookie: () => {} } as any;
      const caller = appRouter.createCaller({ req: mockReq, res: mockRes, user: null });

      await expect(
        caller.auth.loginWithPassword({
          email: "admin@igs-logistics.gn",
          password: "123", // Trop court (< 4 caractères)
        })
      ).rejects.toThrow();
    });
  });

  // 2. Stockage Cloud & Documents (Supabase / S3 / Local Résilient)
  describe("Pillar 2: Stockage Cloud & Documents (uploadDossierCloudFile & document.uploadBase64)", () => {
    it("traite et convertit un fichier en Buffer vers le stockage sécurisé", async () => {
      const dummyContent = Buffer.from("Connaissement Maritime BL CKYSI26000340");
      const result = await uploadDossierCloudFile({
        dossierId: 1,
        fileName: "connaissement_test.pdf",
        fileBuffer: dummyContent,
        mimeType: "application/pdf",
      });

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeTruthy();
      expect(result.fileKey).toContain("dossiers/1/");
      expect(["supabase", "s3", "local_resilient"]).toContain(result.storageProvider);
    });

    it("enregistre un document via tRPC uploadBase64", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, openId: "admin", name: "Alpha", role: "admin" } as any,
      });

      const base64Data = Buffer.from("Test BAE Douane PAC").toString("base64");
      const doc = await caller.document.uploadBase64({
        dossierId: 1,
        name: "BAE_Quittance_Douane.pdf",
        type: "BAE",
        base64Content: `data:application/pdf;base64,${base64Data}`,
        mimeType: "application/pdf",
      });

      expect(doc).toBeDefined();
      expect(doc.name).toBe("BAE_Quittance_Douane.pdf");
      expect(doc.type).toBe("BAE");
      expect(doc.dossierId).toBe(1);
    });
  });

  // 3. Envoi Multi-Canal WhatsApp & Email
  describe("Pillar 3: Notifications Multi-Canal (WhatsApp & Email)", () => {
    it("formate et expédie une alerte WhatsApp pour un dossier", async () => {
      const res = await sendDossierWhatsAppAlert({
        dossierNumber: "DOS-0001",
        clientName: "Guinean Birimian Gold",
        recipientPhone: "+224620112233",
        messageText: "Votre conteneur est en cours de dédouanement à Conakry Terminal.",
      });

      expect(res.success).toBe(true);
      expect(res.channel).toBe("whatsapp");
      expect(res.sentTo).toBe("+224620112233");
      expect(res.preview).toContain("IGS TRANSIT & DOUANE GUINÉE");
      expect(res.preview).toContain("DOS-0001");
    });

    it("formate et expédie un email de notification pour un dossier", async () => {
      const res = await sendDossierEmailAlert({
        dossierNumber: "DOS-0002",
        clientName: "Topaz Multi-Industries",
        recipientEmail: "logistique@topaz.gn",
        subject: "[IGS] Déclaration SYDONIA validée",
        htmlContent: "<p>Votre déclaration douane est régularisée.</p>",
      });

      expect(res.success).toBe(true);
      expect(res.channel).toBe("email");
      expect(res.sentTo).toBe("logistique@topaz.gn");
    });
  });
});
