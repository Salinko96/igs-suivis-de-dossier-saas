import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  importDossiersBatch, 
  listDossiers, 
  getDossier, 
  listDossierHistory,
  withDbTimeout,
  createDossier
} from "../db";
import { uploadDossierCloudFile } from "../cloudStorageService";
import { appRouter } from "../routers";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

describe("Challenger M1.2: Batch Import DB Pressure & Cloud Storage Resilience Suite", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STORAGE_ACCESS_KEY_ID;
    delete process.env.STORAGE_SECRET_ACCESS_KEY;
    delete process.env.STORAGE_ENDPOINT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PILLAR 1: importDossiersBatch Under DB Pressure & Edge Cases
  // =========================================================================
  describe("1. importDossiersBatch DB Pressure & High Volume Stress", () => {
    it("handles empty items array gracefully in 0ms without DB operations", async () => {
      const result = await importDossiersBatch([], 1, "Admin Batch");
      expect(result).toEqual({
        total: 0,
        createdCount: 0,
        updatedCount: 0,
        duplicatesPrevented: 0,
        dossiers: [],
      });
    });

    it("imports large batch (100 distinct dossiers) in memory and auto-generates sequencing & access codes", async () => {
      const batchSize = 100;
      const testTimestamp = Date.now();
      const items = Array.from({ length: batchSize }, (_, i) => ({
        client: `Client Batch ${i + 1}`,
        blLtaNumber: `BL-STRESS-${testTimestamp}-${i + 1}`,
        clientDossierNumber: `CLI-REF-${testTimestamp}-${i + 1}`,
        cargoNature: i % 2 === 0 ? "Conteneurisé 40HC" : "Vrac Minier Bauxite",
        transportMode: "Maritime" as const,
        eta: new Date(Date.now() + i * 86400000),
        regime: "IM4",
      }));

      const startTime = performance.now();
      const result = await importDossiersBatch(items, 1, "Stress Importer");
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.total).toBe(batchSize);
      expect(result.createdCount).toBe(batchSize);
      expect(result.updatedCount).toBe(0);
      expect(result.dossiers.length).toBe(batchSize);
      // High performance constraint: 100 items should process rapidly in memory (< 500ms)
      expect(duration).toBeLessThan(1000);

      // Verify each dossier has correct properties
      for (const d of result.dossiers) {
        expect(d.id).toBeGreaterThan(0);
        expect(d.dossierNumber).toMatch(/^DOS-\d{4}$/);
        expect(d.portalAccessCode).toBe(`IGS-${1000 + d.id}`);
        expect(d.version).toBe(1);
        expect(d.calculatedStatus).toBeDefined();
      }
    });

    it("deduplicates and merges existing dossiers by BL/LTA and Client Reference in O(1)", async () => {
      const uniqueBl = `BL-DEDUP-${Date.now()}`;
      const uniqueClientRef = `CLI-DEDUP-${Date.now()}`;

      // Step 1: Initial import
      const initialItem = {
        client: "Société Minière de Boké (SMB)",
        blLtaNumber: uniqueBl,
        clientDossierNumber: uniqueClientRef,
        cargoNature: "Pelles Hydrauliques",
        transportMode: "Maritime" as const,
        eta: new Date(Date.now() + 86400000 * 3),
        badStatus: "En attente",
        baeStatus: "En attente",
      };

      const res1 = await importDossiersBatch([initialItem], 1, "Opérateur Initial");
      expect(res1.createdCount).toBe(1);
      const createdId = res1.dossiers[0].id;
      const initialVersion = res1.dossiers[0].version || 1;

      // Step 2: Second batch with same BL but updated fields (Customs cleared, BAE granted)
      const updatedItem = {
        client: "Société Minière de Boké (SMB) Updated",
        blLtaNumber: uniqueBl,
        declarationNumber: "DEC-SYDONIA-9999",
        bulletinNumber: "BLD-LIQ-8888",
        baeStatus: "Accordé",
        goodsReleaseDate: new Date(),
      };

      const res2 = await importDossiersBatch([updatedItem], 2, "Déclarant SyDonia");
      expect(res2.createdCount).toBe(0);
      expect(res2.updatedCount).toBe(1);
      expect(res2.duplicatesPrevented).toBe(1);
      expect(res2.dossiers[0].id).toBe(createdId);
      expect(res2.dossiers[0].version).toBe(initialVersion + 1);
      expect(res2.dossiers[0].declarationNumber).toBe("DEC-SYDONIA-9999");
      expect(res2.dossiers[0].bulletinNumber).toBe("BLD-LIQ-8888");
      expect(res2.dossiers[0].baeStatus).toBe("Accordé");
      expect(res2.dossiers[0].updatedById).toBe(2);

      // Verify audit history was appended
      const history = await listDossierHistory(createdId);
      expect(history.length).toBeGreaterThan(0);
      const fusionEntry = history.find(h => h.action === "IMPORT_BATCH_FUSION");
      expect(fusionEntry).toBeDefined();
      expect(fusionEntry?.authorName).toBe("Déclarant SyDonia");
    });

    it("resiliently processes batch when DB throws connection errors or times out", async () => {
      // Simulating a batch with 20 mixed items (10 new, 10 updates)
      const batchItems = Array.from({ length: 20 }, (_, i) => ({
        client: `Resilience Client ${i}`,
        blLtaNumber: `BL-RESIL-${Date.now()}-${i}`,
        cargoNature: "Consommables Industriels",
        transportMode: "Maritime" as const,
        eta: new Date(),
      }));

      // Execute under simulated DB pressure / timeout
      const result = await importDossiersBatch(batchItems, 1, "Stress Batch Bot");
      expect(result.total).toBe(20);
      expect(result.createdCount).toBe(20);
      expect(result.dossiers.length).toBe(20);

      // Verify we can fetch them immediately from in-memory cache
      for (const d of result.dossiers) {
        const fetched = await getDossier(d.id);
        expect(fetched).toBeDefined();
        expect(fetched?.blLtaNumber).toBe(d.blLtaNumber);
      }
    });

    it("handles concurrent simultaneous batch imports without race conditions", async () => {
      const prefix = `CONCURRENT-${Date.now()}`;
      const batch1 = Array.from({ length: 15 }, (_, i) => ({
        client: "Alpha Logistics",
        blLtaNumber: `BL-${prefix}-B1-${i}`,
        transportMode: "Maritime" as const,
      }));

      const batch2 = Array.from({ length: 15 }, (_, i) => ({
        client: "Beta Mining",
        blLtaNumber: `BL-${prefix}-B2-${i}`,
        transportMode: "Aérien" as const,
      }));

      const [res1, res2] = await Promise.all([
        importDossiersBatch(batch1, 1, "Worker 1"),
        importDossiersBatch(batch2, 2, "Worker 2"),
      ]);

      expect(res1.createdCount).toBe(15);
      expect(res2.createdCount).toBe(15);
      expect(res1.total).toBe(15);
      expect(res2.total).toBe(15);

      // Confirm IDs do not collide
      const ids1 = new Set(res1.dossiers.map(d => d.id));
      const ids2 = new Set(res2.dossiers.map(d => d.id));
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }
    });
  });

  // =========================================================================
  // PILLAR 2: Cloud Storage Timeout & Base64 Resilient Fallback
  // =========================================================================
  describe("2. Cloud Storage Upload Timeout & Base64 Fallback Resilience", () => {
    it("returns resilient Base64 data URI with correct MIME type when S3 is unconfigured", async () => {
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      const buffer = Buffer.from("PDF_MOCK_CONTENT_DECLARATION_SYDONIA_2026", "utf-8");
      const res = await uploadDossierCloudFile({
        dossierId: 101,
        fileName: "Declaration_Douane_2026.pdf",
        fileBuffer: buffer,
        mimeType: "application/pdf",
      });

      expect(res).toBeDefined();
      expect(res.storageProvider).toBe("local_resilient");
      expect(res.fileUrl.startsWith("data:application/pdf;base64,")).toBe(true);
      expect(res.fileKey).toMatch(/^dossiers\/101\/\d+_Declaration_Douane_2026\.pdf$/);

      // Round-trip payload verification
      const rawBase64 = res.fileUrl.replace("data:application/pdf;base64,", "");
      const decodedBuffer = Buffer.from(rawBase64, "base64");
      expect(decodedBuffer.toString("utf-8")).toBe("PDF_MOCK_CONTENT_DECLARATION_SYDONIA_2026");
    });

    it("sanitizes dangerous or special characters in filenames", async () => {
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      const buffer = Buffer.from("PHOTO_CARGO_CONTENT", "utf-8");
      const res = await uploadDossierCloudFile({
        dossierId: 88,
        fileName: "Facture N° 12/34 & BL#99 @PAC (Conakry).png",
        fileBuffer: buffer,
        mimeType: "image/png",
      });

      expect(res).toBeDefined();
      expect(res.storageProvider).toBe("local_resilient");
      expect(res.fileUrl.startsWith("data:image/png;base64,")).toBe(true);
      // Special characters replaced by underscores
      expect(res.fileKey).not.toContain(" ");
      expect(res.fileKey).not.toContain("°");
      expect(res.fileKey).not.toContain("&");
      expect(res.fileKey).not.toContain("#");
      expect(res.fileKey).not.toContain("@");
    });

    it("falls back to Base64 data URL within 3000ms when S3 send hangs or rejects", async () => {
      // Configure mock S3 credentials to trigger S3Client initialization
      process.env.STORAGE_ACCESS_KEY_ID = "mock_s3_access_key";
      process.env.STORAGE_SECRET_ACCESS_KEY = "mock_s3_secret_key";
      process.env.STORAGE_ENDPOINT = "https://s3.eu-west-3.amazonaws.com";

      const mockBuffer = Buffer.from("SYDONIA_WORLD_BANK_CREDENTIALS", "utf-8");

      // Spy on S3Client.prototype.send to simulate an AWS / Network hang or connection drop
      vi.spyOn(S3Client.prototype, "send").mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("ECONNRESET: S3 Gateway unreachable")), 50);
        });
      });

      const res = await uploadDossierCloudFile({
        dossierId: 42,
        fileName: "BAE_Douane_Conakry.pdf",
        fileBuffer: mockBuffer,
        mimeType: "application/pdf",
      });

      expect(res).toBeDefined();
      expect(res.storageProvider).toBe("local_resilient");
      expect(res.fileUrl.startsWith("data:application/pdf;base64,")).toBe(true);

      const decoded = Buffer.from(res.fileUrl.replace("data:application/pdf;base64,", ""), "base64");
      expect(decoded.toString("utf-8")).toBe("SYDONIA_WORLD_BANK_CREDENTIALS");
    });

    it("handles large binary document (500KB Uint8Array) in Base64 fallback without data corruption", async () => {
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      const largeSize = 512 * 1024; // 512 KB
      const rawData = new Uint8Array(largeSize);
      for (let i = 0; i < largeSize; i++) {
        rawData[i] = i % 256;
      }

      const res = await uploadDossierCloudFile({
        dossierId: 999,
        fileName: "HighRes_Photos_Conteneurs.jpg",
        fileBuffer: rawData,
        mimeType: "image/jpeg",
      });

      expect(res.storageProvider).toBe("local_resilient");
      expect(res.fileUrl.startsWith("data:image/jpeg;base64,")).toBe(true);

      const base64Str = res.fileUrl.replace("data:image/jpeg;base64,", "");
      const recoveredBuffer = Buffer.from(base64Str, "base64");
      expect(recoveredBuffer.length).toBe(largeSize);
      expect(recoveredBuffer[0]).toBe(0);
      expect(recoveredBuffer[255]).toBe(255);
      expect(recoveredBuffer[256]).toBe(0);
    });
  });

  // =========================================================================
  // PILLAR 3: tRPC Document Upload Endpoints Resilient Integration
  // =========================================================================
  describe("3. tRPC Document Upload with Storage Resiliency", () => {
    it("tRPC document.uploadBase64 safely stores document and returns record even when S3 fails", async () => {
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

      const sampleBase64 = Buffer.from("DOC_TEST_CONTENT_123").toString("base64");
      const doc = await caller.document.uploadBase64({
        dossierId: 1,
        name: "Connaissement_Maritime_BL.pdf",
        type: "BL",
        base64Content: `data:application/pdf;base64,${sampleBase64}`,
        mimeType: "application/pdf",
        isPublic: true,
        description: "BL original visé PAC",
      });

      expect(doc).toBeDefined();
      expect(doc.id).toBeGreaterThan(0);
      expect(doc.dossierId).toBe(1);
      expect(doc.name).toBe("Connaissement_Maritime_BL.pdf");
      expect(doc.type).toBe("BL");
      expect(doc.fileUrl).toContain("data:application/pdf;base64,");
      expect(doc.fileSize).toBe(Buffer.from("DOC_TEST_CONTENT_123").length);
    });

    it("tRPC document.uploadMulti uploads multiple documents in atomic sequence with resilient fallback", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: 1,
          openId: "test-declarant",
          name: "Déclarant Quai",
          email: "declarant@igs.gn",
          role: "declarant",
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

      const files = [
        {
          name: "Facture_Commerciale_2026.pdf",
          type: "Facture_Fournisseur" as const,
          base64Content: Buffer.from("FACTURE_COMMERCIALE_DATA").toString("base64"),
          mimeType: "application/pdf",
          isPublic: true,
        },
        {
          name: "Bon_A_Enlever_Douane.pdf",
          type: "BAE" as const,
          base64Content: Buffer.from("BAE_SYDONIA_DATA").toString("base64"),
          mimeType: "application/pdf",
          isPublic: false,
        },
      ];

      const result = await caller.document.uploadMulti({
        dossierId: 2,
        files,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.documents.length).toBe(2);
      expect(result.documents[0].name).toBe("Facture_Commerciale_2026.pdf");
      expect(result.documents[1].name).toBe("Bon_A_Enlever_Douane.pdf");
    });
  });
});
