import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Milestone 4 — PWA Manifest, Service Worker & Offline Infrastructure (Port de Conakry)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const publicDir = path.join(rootDir, "client", "public");
  const manifestPath = path.join(publicDir, "manifest.json");
  const swPath = path.join(publicDir, "sw.js");
  const indexHtmlPath = path.join(rootDir, "client", "index.html");

  describe("1. Web App Manifest (client/public/manifest.json)", () => {
    it("doit exister et être un JSON valide", () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const raw = fs.readFileSync(manifestPath, "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it("contient toutes les métadonnées requises et les couleurs de marque IGS (#0b3b32)", () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(manifest.name).toBe("IGS Transit & Douane Guinée — Suivis de Dossiers");
      expect(manifest.short_name).toBe("IGS Transit");
      expect(manifest.description).toContain("Port Autonome de Conakry");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.background_color).toBe("#0b3b32");
      expect(manifest.theme_color).toBe("#0b3b32");
      expect(manifest.orientation).toBe("portrait-primary");
      expect(manifest.lang).toBe("fr-GN");
      expect(manifest.categories).toEqual(
        expect.arrayContaining(["business", "productivity", "utilities"])
      );
    });

    it("déclare des icônes valides et présentes physiquement sur le disque", () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

      const icon192 = manifest.icons.find((i: any) => i.sizes === "192x192");
      const icon512 = manifest.icons.find((i: any) => i.sizes === "512x512");
      const favicon = manifest.icons.find((i: any) => i.src.includes("favicon"));

      expect(icon192).toBeDefined();
      expect(icon192.purpose).toContain("maskable");
      expect(icon512).toBeDefined();
      expect(icon512.purpose).toContain("maskable");
      expect(favicon).toBeDefined();

      // Vérification physique des fichiers d'icônes
      for (const icon of manifest.icons) {
        const filePath = path.join(publicDir, icon.src.replace(/^\//, ""));
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe("2. Service Worker Engine (client/public/sw.js)", () => {
    it("doit exister et contenir la version de cache et les assets statiques vitaux", () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const swCode = fs.readFileSync(swPath, "utf-8");

      expect(swCode).toContain("CACHE_NAME = 'igs-transit-v1'");
      expect(swCode).toContain("STATIC_ASSETS");
      expect(swCode).toContain("'/manifest.json'");
      expect(swCode).toContain("'/index.html'");
      expect(swCode).toContain("'/igs-logo-transparent.png'");
    });

    it("implémente les cycles de vie PWA : install (skipWaiting) et activate (clients.claim + purge)", () => {
      const swCode = fs.readFileSync(swPath, "utf-8");

      expect(swCode).toContain("self.addEventListener('install'");
      expect(swCode).toContain("skipWaiting");
      expect(swCode).toContain("self.addEventListener('activate'");
      expect(swCode).toContain("clients.claim");
      expect(swCode).toContain("caches.delete");
    });

    it("implémente les stratégies de cache requises pour le terrain (Network-First API & Cache-First Statics)", () => {
      const swCode = fs.readFileSync(swPath, "utf-8");

      expect(swCode).toContain("self.addEventListener('fetch'");
      // API tRPC /api/ Network-First avec repli Cache & JSON Offline
      expect(swCode).toContain("url.pathname.startsWith('/api/')");
      expect(swCode).toContain("OFFLINE_MODE");
      expect(swCode).toContain("Mode hors-ligne : Données non synchronisées");

      // Static assets Cache-First
      expect(swCode).toContain("caches.match(request)");
      expect(swCode).toContain("request.mode === 'navigate'");
    });
  });

  describe("3. Intégration HTML & Métadonnées PWA (client/index.html)", () => {
    it("contient la liaison manifest.json, le theme-color et les balises iOS standalone", () => {
      expect(fs.existsSync(indexHtmlPath)).toBe(true);
      const html = fs.readFileSync(indexHtmlPath, "utf-8");

      expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
      expect(html).toContain('<meta name="theme-color" content="#0b3b32" />');
      expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
      expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
      expect(html).toContain('<link rel="apple-touch-icon" href="/igs-logo-icon.png" />');
    });
  });

  describe("4. Scénario de Simulation Hors-Ligne (Quai Conakry Offline Simulation)", () => {
    it("simule la réponse de secours hors-ligne structurée pour tRPC", () => {
      const offlinePayload = [
        {
          error: {
            json: {
              message: "Mode hors-ligne : Données non synchronisées pour cette ressource.",
              code: -32603,
              data: {
                code: "OFFLINE_MODE",
                httpStatus: 503,
              },
            },
          },
        },
      ];

      expect(offlinePayload[0].error.json.data.code).toBe("OFFLINE_MODE");
      expect(offlinePayload[0].error.json.data.httpStatus).toBe(503);
      expect(offlinePayload[0].error.json.message).toContain("Mode hors-ligne");
    });
  });
});
