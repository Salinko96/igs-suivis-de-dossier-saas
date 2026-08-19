import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { createApp } from "../_core/app";
import { safeFetch } from "../../client/src/lib/safeFetch";

describe("Resilient HTTP & REST API Suite — Anti-Crash JSON", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("1. REST API /api/dossiers Endpoints", () => {
    it("GET /api/dossiers returns 200 with JSON list", async () => {
      const res = await fetch(`${baseUrl}/api/dossiers`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("GET /api/dossiers/1 returns 200 with valid dossier JSON", async () => {
      const res = await fetch(`${baseUrl}/api/dossiers/1`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("dossierNumber");
    });

    it("GET /api/dossiers/999999 returns 404 with structured JSON error", async () => {
      const res = await fetch(`${baseUrl}/api/dossiers/999999`);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("introuvable");
      expect(body.id).toBe("999999");
    });

    it("PUT /api/dossiers/invalid-id returns 400 with structured JSON error", async () => {
      const res = await fetch(`${baseUrl}/api/dossiers/invalid-id`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: "Test" }),
      });
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("invalide");
    });

    it("PUT /api/dossiers/999999 returns 404 when updating non-existent dossier", async () => {
      const res = await fetch(`${baseUrl}/api/dossiers/999999`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: "Non-existent" }),
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("introuvable");
    });
  });

  describe("2. Client safeFetch Interception", () => {
    it("intercepts raw text/HTML 500 error without throwing Unexpected token JSON error", async () => {
      const originalFetch = globalThis.fetch;
      
      // Simulate Vercel returning raw HTML/text error "An error occurred with this deployment"
      globalThis.fetch = async () => {
        return new Response("An error occurred with this deployment", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "text/plain" },
        });
      };

      const result = await safeFetch("https://example.com/api/dossiers/43");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.data).toBeNull();
      expect(result.error).toContain("An error occurred with this deployment");

      globalThis.fetch = originalFetch;
    });

    it("handles 504 Gateway Timeout gracefully with readable message", async () => {
      const originalFetch = globalThis.fetch;
      
      globalThis.fetch = async () => {
        return new Response("<html><body>504 Gateway Time-out</body></html>", {
          status: 504,
          statusText: "Gateway Timeout",
          headers: { "Content-Type": "text/html" },
        });
      };

      const result = await safeFetch("https://example.com/api/dossiers/43");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(504);
      expect(result.error).toContain("Délai d'attente");

      globalThis.fetch = originalFetch;
    });

    it("parses valid 200 JSON responses correctly", async () => {
      const originalFetch = globalThis.fetch;
      
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ success: true, dossierId: 43 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const result = await safeFetch("https://example.com/api/dossiers/43");
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true, dossierId: 43 });
      expect(result.error).toBeNull();

      globalThis.fetch = originalFetch;
    });
  });
});
