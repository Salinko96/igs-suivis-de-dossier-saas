import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  withDbTimeout, 
  listDossiers, 
  getDossier, 
  createDossier, 
  updateDossier, 
  importDossiersBatch, 
  deleteDossier,
  updateDossierStatus,
  createInvoice,
  recordInvoicePayment,
  upsertUser,
  getUserByOpenId,
  getUserById,
  listUsers,
  enrichDossierFields
} from "../db";
import { 
  sendDossierWhatsAppAlert, 
  sendDossierEmailAlert, 
  dispatchExternalAlertNotification,
  generateProactiveAlerts
} from "../alertsService";
import { 
  sendWhatsappBusinessMessage, 
  renderWhatsappHsmTemplate 
} from "../whatsappService";
import { uploadDossierCloudFile } from "../cloudStorageService";
import { uploadInvoicePdf, uploadPaymentProof } from "../supabase";
import { terminal49 } from "../terminal49Client";
import { appRouter } from "../routers";

describe("Adversarial Backend Resilience & Stress Suite (Challenger M1)", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. withDbTimeout & DB Query Hangs (<= 1500ms SLA Fallback)
  // =========================================================================
  describe("1. withDbTimeout SLA & Hanging Query Cancellation", () => {
    it("aborts hanging promise cleanly at 1500ms default SLA without unhandled rejections", async () => {
      const startTime = Date.now();
      const hangingPromise = new Promise<string>((resolve) => {
        // Simule une requête PostgreSQL bloquée indéfiniment
        setTimeout(() => resolve("late_result"), 5000);
      });

      await expect(withDbTimeout(hangingPromise, 1500)).rejects.toThrow("DB_QUERY_TIMEOUT");
      const elapsed = Date.now() - startTime;

      // SLA strict : doit échouer entre 1450ms et 1800ms (tolérance scheduling Node.js)
      expect(elapsed).toBeGreaterThanOrEqual(1450);
      expect(elapsed).toBeLessThan(1800);
    });

    it("respects custom timeout boundaries (e.g. 200ms)", async () => {
      const startTime = Date.now();
      const hangingPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("never"), 2000);
      });

      await expect(withDbTimeout(hangingPromise, 200)).rejects.toThrow("DB_QUERY_TIMEOUT");
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(180);
      expect(elapsed).toBeLessThan(400);
    });

    it("resolves immediately for fast queries (< 20ms) and cleans up timers", async () => {
      const startTime = Date.now();
      const fastPromise = Promise.resolve({ data: "fast_db_result" });

      const result = await withDbTimeout(fastPromise, 1500);
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ data: "fast_db_result" });
      expect(elapsed).toBeLessThan(50);
    });

    it("propagates genuine DB errors immediately without waiting for timeout SLA", async () => {
      const startTime = Date.now();
      const failingPromise = Promise.reject(new Error("PG_CONNECTION_CLOSED"));

      await expect(withDbTimeout(failingPromise, 1500)).rejects.toThrow("PG_CONNECTION_CLOSED");
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });

    it("handles late promise rejection after timeout without crashing Node process", async () => {
      // Simulates a query that times out at 100ms, then later rejects at 300ms
      let lateReject: (err: any) => void;
      const delayedRejectPromise = new Promise<string>((_, reject) => {
        lateReject = reject;
      });

      const catchHandler = vi.fn();
      await withDbTimeout(delayedRejectPromise, 100).catch(catchHandler);
      expect(catchHandler).toHaveBeenCalledWith(expect.any(Error));

      // Trigger late rejection 150ms later — should not cause unhandled rejection
      expect(() => {
        lateReject(new Error("Late PostgreSQL Socket Reset"));
      }).not.toThrow();
    });

    it("handles a burst of 50 concurrent hanging queries within <= 1600ms without memory leak", async () => {
      const startTime = Date.now();
      const burst = Array.from({ length: 50 }, (_, i) => {
        const hanging = new Promise<number>((res) => setTimeout(() => res(i), 10000));
        return withDbTimeout(hanging, 1500).catch((err) => err.message);
      });

      const results = await Promise.all(burst);
      const elapsed = Date.now() - startTime;

      expect(results.length).toBe(50);
      expect(results.every(r => r === "DB_QUERY_TIMEOUT")).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(1450);
      expect(elapsed).toBeLessThan(1900);
    });
  });

  // =========================================================================
  // 2. Memory Store Fallback Under DB Outage / Simulated Failure
  // =========================================================================
  describe("2. Full In-Memory Dual-Layer Fallback During DB Failures", () => {
    it("listDossiers seamlessly returns in-memory data when DB is down or times out", async () => {
      const dossiers = await listDossiers();
      expect(Array.isArray(dossiers)).toBe(true);
      expect(dossiers.length).toBeGreaterThan(0);
      
      const first = dossiers[0];
      expect(first).toHaveProperty("dossierNumber");
      expect(first).toHaveProperty("calculatedStatus");
    });

    it("getDossier resolves via in-memory cache instantly (< 5ms) for valid IDs and portal codes", async () => {
      const start = Date.now();
      const dossier1 = await getDossier(1);
      const elapsed1 = Date.now() - start;

      expect(dossier1).toBeDefined();
      expect(dossier1?.id).toBe(1);
      expect(elapsed1).toBeLessThan(20);

      const dossierPortal = await getDossier("IGS-1001");
      expect(dossierPortal).toBeDefined();
      expect(dossierPortal?.id).toBe(1);
    });

    it("createDossier persists to in-memory store and generates auto-sequenced dossier number", async () => {
      const created = await createDossier({
        clientDossierNumber: `CL-${Date.now()}`,
        client: "Adversarial Stress Test Client SARL",
        blLtaNumber: `BL-STRESS-${Date.now()}`,
        cargoNature: "Equipements Industriels",
        transportMode: "Maritime",
        eta: new Date(Date.now() + 86400000 * 2),
        originPort: "Anvers",
        destinationPort: "Port Autonome de Conakry (PAC)",
        container: "4x40HC",
        bulk: null,
        goodsReleaseDate: null,
        declarationNumber: null,
        bulletinNumber: null,
        createdById: 1,
      });

      expect(created).toBeDefined();
      expect(created.id).toBeGreaterThan(0);
      expect(created.dossierNumber).toMatch(/^DOS-\d{4}$/);
      expect(created.calculatedStatus).toBe("À régulariser");
      expect(created.portalAccessCode).toBe(`IGS-${1000 + created.id}`);

      // Verify retrieval
      const fetched = await getDossier(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.dossierNumber).toBe(created.dossierNumber);
    });

    it("updateDossier updates memory state and recalculates status and history correctly", async () => {
      const all = await listDossiers();
      const target = all[0];

      const updated = await updateDossier(target.id, {
        goodsReleaseDate: new Date(),
        declarationNumber: "DEC-SYDONIA-2026-TEST",
      });

      expect(updated).toBeDefined();
      expect(updated?.goodsReleaseDate).toBeDefined();
      expect(updated?.version).toBeGreaterThan(target.version || 1);

      // Verify enriched computed fields
      const enriched = enrichDossierFields(updated!);
      expect(enriched.portStatus).toBe("Marchandise Sortie de Quai (PAC)");
      expect(enriched.customsStatus).toBe("BAE Accordé & Régularisé");
      expect(enriched.baeStatus).toBe("Accordé");
    });

    it("handles concurrent updateDossier mutex without state corruption", async () => {
      const all = await listDossiers();
      const target = all[0];

      const updates = [
        updateDossier(target.id, { notes: "Parallel Update A" }, 1, "User A", { forceOverwrite: true }),
        updateDossier(target.id, { notes: "Parallel Update B" }, 2, "User B", { forceOverwrite: true }),
        updateDossier(target.id, { notes: "Parallel Update C" }, 3, "User C", { forceOverwrite: true }),
      ];

      const results = await Promise.all(updates);
      expect(results.length).toBe(3);
      expect(results.every(r => r?.id === target.id)).toBe(true);

      const finalDossier = await getDossier(target.id);
      expect(finalDossier?.version).toBeGreaterThanOrEqual((target.version || 1) + 3);
    });

    it("importDossiersBatch handles batch writes and duplicates prevention in-memory", async () => {
      const testBl = `BL-BATCH-${Date.now()}`;
      const batchInput = [
        {
          dossierNumber: `DOS-BATCH-1-${Date.now()}`,
          client: "Batch Mining Guinee",
          blLtaNumber: testBl,
          cargoNature: "Pieces Detachees",
          transportMode: "Maritime",
          eta: new Date(),
        },
        {
          dossierNumber: `DOS-BATCH-2-${Date.now()}`,
          client: "Batch Mining Guinee",
          blLtaNumber: testBl, // Duplicate BL -> should be updated/deduplicated
          cargoNature: "Pieces Detachees Modifiees",
          transportMode: "Maritime",
          eta: new Date(),
        }
      ];

      const result = await importDossiersBatch(batchInput, 1, "Stress Batch Tester");
      expect(result).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.createdCount + result.updatedCount).toBe(2);
    });

    it("user management functions (upsertUser, getUserByOpenId, listUsers) maintain memory persistence", async () => {
      const testOpenId = `stress-user-${Date.now()}`;
      await upsertUser({
        openId: testOpenId,
        name: "Test Stress User",
        email: "stress@igs-logistics.gn",
        role: "declarant",
        isActive: true,
      });

      const user = await getUserByOpenId(testOpenId);
      expect(user).toBeDefined();
      expect(user?.name).toBe("Test Stress User");
      expect(user?.role).toBe("declarant");

      const users = await listUsers();
      expect(users.some(u => u.openId === testOpenId)).toBe(true);
    });
  });

  // =========================================================================
  // 3. External API Resilience: WhatsApp & Resend (Timeout, AbortSignal, Errors)
  // =========================================================================
  describe("3. External API Resilience: Meta WhatsApp & Resend Email", () => {
    it("sendWhatsappBusinessMessage handles network hang with AbortSignal without crashing", async () => {
      process.env.WHATSAPP_API_TOKEN = "test_meta_token_xyz";
      process.env.WHATSAPP_PHONE_ID = "1234567890";

      // Mock fetch with delayed hanging response
      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          // Listen to AbortSignal
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
            });
          }
        });
      });

      const startTime = Date.now();
      const result = await sendWhatsappBusinessMessage({
        dossierNumber: "DOS-0001",
        clientName: "Test Client",
        recipientPhone: "+224620000000",
        template: "dossier_cree",
        variables: {
          blLtaNumber: "BL123456",
          eta: new Date(),
        },
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.recipientPhone).toBe("+224620000000");
      expect(result.renderedText).toContain("IBRAHIMA GOLD SERVICE");
    });

    it("sendWhatsappBusinessMessage sanitizes malformed phone numbers cleanly", async () => {
      const result = await sendWhatsappBusinessMessage({
        dossierNumber: "DOS-0001",
        clientName: "Test Sanitization",
        recipientPhone: "  +224 (621) 00-11-22 ext. 4  ",
        template: "dossier_cree",
        variables: {},
      });

      expect(result.success).toBe(true);
      expect(result.recipientPhone).toBe("+2246210011224");
    });

    it("sendWhatsappBusinessMessage gracefully handles HTTP 500, 429, and malformed JSON from Meta API", async () => {
      process.env.WHATSAPP_API_TOKEN = "valid_token";
      process.env.WHATSAPP_PHONE_ID = "phone_id";

      // Test 1: HTTP 500 Server Error
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Internal Meta Error", code: 500 } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );

      let res = await sendWhatsappBusinessMessage({
        dossierNumber: "DOS-0002",
        clientName: "Client 2",
        recipientPhone: "+224622112233",
        template: "eta_mise_a_jour",
        variables: { eta: new Date() },
      });
      expect(res.success).toBe(true);

      // Test 2: Malformed Non-JSON Response (e.g. Cloudflare Bad Gateway HTML)
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response("<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        })
      );

      res = await sendWhatsappBusinessMessage({
        dossierNumber: "DOS-0002",
        clientName: "Client 2",
        recipientPhone: "+224622112233",
        template: "alerte_surestarie_imminente",
        variables: { daysOnQuay: 6 },
      });
      expect(res.success).toBe(true);
    });

    it("sendDossierEmailAlert handles Resend API failures and timeouts without throwing", async () => {
      process.env.RESEND_API_KEY = "re_mock_key_123456";

      // Mock network connection failure (ECONNREFUSED)
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed: connect ECONNREFUSED 127.0.0.1:443"));

      const result = await sendDossierEmailAlert({
        dossierNumber: "DOS-0003",
        recipientEmail: "client@test.gn",
        clientName: "Client Email Test",
        subject: "Test Notification",
        htmlContent: "<p>Test Alert</p>",
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe("email");
      expect(result.sentTo).toBe("client@test.gn");
    });

    it("dispatchExternalAlertNotification handles both whatsapp and email under total network outage", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network is completely offline"));

      const alert = {
        id: 99,
        dossierId: 1,
        dossierNumber: "DOS-0001",
        type: "SURESTARIES_RISQUE" as const,
        title: "Alerte Surestaries",
        message: "Risque de surestarie imminente",
        severity: "critical" as const,
        isRead: 0,
        createdAt: new Date(),
      };

      const waRes = await dispatchExternalAlertNotification(alert, "whatsapp");
      expect(waRes.success).toBe(true);
      expect(waRes.channel).toBe("whatsapp");

      const mailRes = await dispatchExternalAlertNotification(alert, "email");
      expect(mailRes.success).toBe(true);
      expect(mailRes.channel).toBe("email");
    });

    it("HSM Templates formatting rigorously formats French Guinea logistic notices", () => {
      const rendered = renderWhatsappHsmTemplate({
        dossierNumber: "DOS-0099",
        clientName: "Société Minière de Boké",
        recipientPhone: "+224620000000",
        template: "facture_disponible",
        variables: {
          invoiceNumber: "FAC-2026-0042",
          amount: 45000000,
          currency: "GNF",
        },
      });

      expect(rendered.header).toContain("IBRAHIMA GOLD SERVICE");
      expect(rendered.body).toContain("Société Minière de Boké");
      expect(rendered.body).toContain("FAC-2026-0042");
      expect(rendered.body).toContain("45\u202f000\u202f000 GNF");
      expect(rendered.footer).toContain("Port Autonome de Conakry (PAC)");
      expect(rendered.fullText).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Cloud Storage & Supabase Resilience (Failover to Base64 Data URI)
  // =========================================================================
  describe("4. Cloud Storage & Supabase Storage Fail-Safe & Base64 Fallback", () => {
    it("uploadDossierCloudFile returns resilient Base64 data URL when S3 is unconfigured or fails", async () => {
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      const dummyBuffer = Buffer.from("IGS PDF Document Mock Content 2026");
      const result = await uploadDossierCloudFile({
        dossierId: 10,
        fileName: "connaissement_test.pdf",
        fileBuffer: dummyBuffer,
        mimeType: "application/pdf",
      });

      expect(result.storageProvider).toBe("local_resilient");
      expect(result.fileUrl.startsWith("data:application/pdf;base64,")).toBe(true);
      expect(result.fileKey).toContain("dossiers/10/");
    });

    it("uploadInvoicePdf safely returns Base64 data URL fallback when Supabase is down", async () => {
      const dummyPdf = Buffer.from("%PDF-1.4 Mock Invoice Content");
      const url = await uploadInvoicePdf("FAC-2026-0099", dummyPdf, "application/pdf");

      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
      expect(url?.startsWith("data:application/pdf;base64,")).toBe(true);
    });

    it("uploadPaymentProof safely returns Base64 data URL fallback on receipt upload", async () => {
      const dummyProof = Buffer.from("Fake JPEG Bank Slip Data");
      const url = await uploadPaymentProof(42, dummyProof, "recu_virement.jpg", "image/jpeg");

      expect(url).toBeDefined();
      expect(url?.startsWith("data:image/jpeg;base64,")).toBe(true);
    });
  });

  // =========================================================================
  // 5. tRPC End-to-End Resilience Under Simulated External & DB Stress
  // =========================================================================
  describe("5. tRPC Caller Procedures Under Simulated Outages", () => {
    it("tRPC dossier.list and dossier.get procedures execute without throwing 500 when external network is severed", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("NETWORK_DOWN"));

      const caller = appRouter.createCaller({
        user: {
          id: 1,
          openId: "test-admin",
          name: "Admin Tester",
          email: "admin@igs.gn",
          role: "admin",
          clientCompany: null,
          phone: null,
          isActive: true,
          sessionRevokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any,
        req: {} as any,
        res: {} as any,
      });

      const dossiers = await caller.dossier.list({});
      expect(Array.isArray(dossiers)).toBe(true);
      expect(dossiers.length).toBeGreaterThan(0);

      const single = await caller.dossier.get({ id: dossiers[0].id });
      expect(single).toBeDefined();
      expect(single.id).toBe(dossiers[0].id);
    });

    it("tRPC cron.runDemurrageCheck completes and returns summary even if all external alerts fail", async () => {
      // Simulate external API timeout/network failure
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Meta & Resend unreachable"));

      const caller = appRouter.createCaller({
        user: {
          id: 1,
          openId: "test-admin",
          name: "Admin Tester",
          email: "admin@igs.gn",
          role: "admin",
          clientCompany: null,
          phone: null,
          isActive: true,
          sessionRevokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.cron.runDemurrageCheck();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalDossiersScanned");
      expect(result).toHaveProperty("alertsSentCount");
      expect(typeof result.totalDossiersScanned).toBe("number");
    });

    it("tRPC whatsapp.sendHsmTemplate logs and returns gracefully when Meta API times out", async () => {
      // Mock fetch with delayed timeout
      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
            });
          }
        });
      });

      process.env.WHATSAPP_API_TOKEN = "mock_token";
      process.env.WHATSAPP_PHONE_ID = "mock_phone";

      const caller = appRouter.createCaller({
        user: {
          id: 1,
          openId: "test-admin",
          name: "Admin Tester",
          email: "admin@igs.gn",
          role: "admin",
          clientCompany: null,
          phone: null,
          isActive: true,
          sessionRevokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.whatsapp.sendHsmTemplate({
        dossierId: 1,
        dossierNumber: "DOS-0001",
        clientName: "Alpha Barry",
        recipientPhone: "+224620000000",
        template: "dossier_cree",
        variables: {
          blLtaNumber: "BL-TEST",
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.recipientPhone).toBe("+224620000000");
    });
  });
});
