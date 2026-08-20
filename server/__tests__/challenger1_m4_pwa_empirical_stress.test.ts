import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

describe("Milestone 4 — Challenger 1: Empirical Adversarial Stress Suite (PWA & Service Worker)", () => {
  const rootDir = path.resolve(__dirname, "..", "..");
  const publicDir = path.join(rootDir, "client", "public");
  const manifestPath = path.join(publicDir, "manifest.json");
  const swPath = path.join(publicDir, "sw.js");
  const indexHtmlPath = path.join(rootDir, "client", "index.html");
  const mainTsxPath = path.join(rootDir, "client", "src", "main.tsx");
  const useOnlineStatusPath = path.join(rootDir, "client", "src", "hooks", "useOnlineStatus.ts");
  const networkBannerPath = path.join(rootDir, "client", "src", "components", "NetworkStatusBanner.tsx");
  const pwaBannerPath = path.join(rootDir, "client", "src", "components", "PWAInstallBanner.tsx");

  // =========================================================================
  // 1. MANIFEST.JSON SCHEMA INTEGRITY & ADVERSARIAL VALIDATION
  // =========================================================================
  describe("1. PWA Manifest Parsing, Schema Integrity & W3C Standard Conformance", () => {
    it("parses manifest.json without syntax errors", () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("verifies all required and recommended W3C Web App Manifest fields", () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

      // Mandatory fields
      expect(manifest.name).toBe("IGS Transit & Douane Guinée — Suivis de Dossiers");
      expect(manifest.short_name).toBe("IGS Transit");
      expect(manifest.start_url).toBe("/");
      expect(manifest.scope).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.orientation).toBe("portrait-primary");
      expect(manifest.lang).toBe("fr-GN");

      // Brand colors
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      expect(manifest.background_color).toMatch(hexColorRegex);
      expect(manifest.theme_color).toMatch(hexColorRegex);
      expect(manifest.background_color.toLowerCase()).toBe("#0b3b32");
      expect(manifest.theme_color.toLowerCase()).toBe("#0b3b32");

      // Categories
      expect(Array.isArray(manifest.categories)).toBe(true);
      expect(manifest.categories).toContain("business");
      expect(manifest.categories).toContain("productivity");
      expect(manifest.categories).toContain("utilities");
    });

    it("stress-tests icon resolution specifications and physical asset integrity", () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

      const sizeRegex = /^(\d+x\d+)(\s+\d+x\d+)*$/;
      const resolutions = new Set<string>();

      for (const icon of manifest.icons) {
        expect(typeof icon.src).toBe("string");
        expect(icon.src.startsWith("/")).toBe(true);
        expect(icon.sizes).toMatch(sizeRegex);
        expect(icon.type).toBe("image/png");

        icon.sizes.split(" ").forEach((s: string) => resolutions.add(s));

        // Physical asset check
        const physicalPath = path.join(publicDir, icon.src.replace(/^\//, ""));
        expect(fs.existsSync(physicalPath)).toBe(true);
        const stats = fs.statSync(physicalPath);
        expect(stats.size).toBeGreaterThan(100); // Non-empty image asset
      }

      // Lighthouse PWA installability requirements
      expect(resolutions.has("192x192")).toBe(true);
      expect(resolutions.has("512x512")).toBe(true);

      // Maskable icon check for Android adaptive icons
      const maskableIcon = manifest.icons.find((i: any) => i.purpose && i.purpose.includes("maskable"));
      expect(maskableIcon).toBeDefined();
      expect(["192x192", "512x512"]).toContain(maskableIcon.sizes);
    });
  });

  // =========================================================================
  // 2. SERVICE WORKER SCRIPT SYNTAX & EXECUTION RUNTIME TEST
  // =========================================================================
  describe("2. Service Worker Engine Syntax, Lifecycle & Execution Sandbox", () => {
    it("validates that sw.js has valid JavaScript syntax (executes in VM sandbox)", () => {
      const swCode = fs.readFileSync(swPath, "utf-8");

      // Build mock ServiceWorkerGlobalScope
      const mockCaches = {
        open: vi.fn().mockResolvedValue({
          addAll: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          match: vi.fn().mockResolvedValue(null),
        }),
        keys: vi.fn().mockResolvedValue(["igs-transit-v0", "old-cache"]),
        delete: vi.fn().mockResolvedValue(true),
        match: vi.fn().mockResolvedValue(null),
      };

      const eventListeners: Record<string, Function[]> = {};
      const mockSelf = {
        addEventListener: (event: string, handler: Function) => {
          eventListeners[event] = eventListeners[event] || [];
          eventListeners[event].push(handler);
        },
        skipWaiting: vi.fn().mockResolvedValue(undefined),
        clients: {
          claim: vi.fn().mockResolvedValue(undefined),
        },
      };

      const sandbox = {
        self: mockSelf,
        caches: mockCaches,
        Response: global.Response,
        URL: global.URL,
        console: { log: () => {}, warn: () => {}, error: () => {} },
      };

      expect(() => {
        vm.createContext(sandbox);
        vm.runInContext(swCode, sandbox);
      }).not.toThrow();

      // Verify registered listeners
      expect(eventListeners["install"]).toBeDefined();
      expect(eventListeners["activate"]).toBeDefined();
      expect(eventListeners["fetch"]).toBeDefined();
      expect(eventListeners["install"].length).toBeGreaterThan(0);
      expect(eventListeners["activate"].length).toBeGreaterThan(0);
      expect(eventListeners["fetch"].length).toBeGreaterThan(0);
    });

    it("verifies precached assets exist on disk and are referenced accurately", () => {
      const swCode = fs.readFileSync(swPath, "utf-8");
      
      // Extract STATIC_ASSETS array
      const match = swCode.match(/const\s+STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
      expect(match).not.toBeNull();
      
      const assetsListStr = match![1];
      const assets = assetsListStr
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""))
        .filter(Boolean);

      expect(assets).toContain("/");
      expect(assets).toContain("/index.html");
      expect(assets).toContain("/manifest.json");
      expect(assets).toContain("/favicon.png");
      expect(assets).toContain("/igs-logo-icon.png");
      expect(assets).toContain("/igs-logo-transparent.png");

      // Verify physical disk existence for files
      for (const asset of assets) {
        if (asset === "/") continue;
        const filePath = path.join(publicDir, asset.replace(/^\//, ""));
        // /index.html is in client/index.html
        if (asset === "/index.html") {
          expect(fs.existsSync(indexHtmlPath)).toBe(true);
        } else {
          expect(fs.existsSync(filePath)).toBe(true);
        }
      }
    });

    it("simulates Service Worker activate event and verifies obsolete cache purging", async () => {
      const swCode = fs.readFileSync(swPath, "utf-8");
      const deletedCaches: string[] = [];

      const mockCaches = {
        keys: vi.fn().mockResolvedValue(["igs-transit-v0", "old-cache-unrelated", "igs-transit-v1"]),
        delete: vi.fn().mockImplementation((name: string) => {
          deletedCaches.push(name);
          return Promise.resolve(true);
        }),
      };

      const claimMock = vi.fn().mockResolvedValue(undefined);
      let activateHandler: Function | null = null;

      const sandbox = {
        self: {
          addEventListener: (event: string, handler: Function) => {
            if (event === "activate") activateHandler = handler;
          },
          clients: { claim: claimMock },
          skipWaiting: vi.fn(),
        },
        caches: mockCaches,
        Response: global.Response,
        URL: global.URL,
      };

      vm.createContext(sandbox);
      vm.runInContext(swCode, sandbox);

      expect(activateHandler).not.toBeNull();

      let waitUntilPromise: Promise<any> | null = null;
      const mockEvent = {
        waitUntil: (p: Promise<any>) => {
          waitUntilPromise = p;
        },
      };

      activateHandler!(mockEvent);
      expect(waitUntilPromise).not.toBeNull();
      await waitUntilPromise;

      // Old caches purged, current CACHE_NAME preserved
      expect(deletedCaches).toContain("igs-transit-v0");
      expect(deletedCaches).toContain("old-cache-unrelated");
      expect(deletedCaches).not.toContain("igs-transit-v1");
      expect(claimMock).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. OFFLINE API FALLBACK PAYLOAD STRUCTURE & RESILIENCE
  // =========================================================================
  describe("3. Offline API Fallback Payload Structure & Error Handling Resilience", () => {
    it("verifies the offline JSON payload conforms to the tRPC batch error protocol", () => {
      const swCode = fs.readFileSync(swPath, "utf-8");

      expect(swCode).toContain("OFFLINE_MODE");
      expect(swCode).toContain("Mode hors-ligne : Données non synchronisées pour cette ressource.");

      // Sandbox extraction of offline payload
      const sandbox = { payload: null as any };
      const extractScript = `
        ${swCode.match(/const\s+offlinePayload\s*=\s*\[[\s\S]*?\];/)![0]}
        payload = offlinePayload;
      `;
      vm.createContext(sandbox);
      vm.runInContext(extractScript, sandbox);

      expect(Array.isArray(sandbox.payload)).toBe(true);
      expect(sandbox.payload.length).toBe(1);

      const errItem = sandbox.payload[0].error;
      expect(errItem).toBeDefined();
      expect(errItem.json).toBeDefined();
      expect(errItem.json.code).toBe(-32603);
      expect(errItem.json.message).toContain("Mode hors-ligne");
      expect(errItem.json.data.code).toBe("OFFLINE_MODE");
      expect(errItem.json.data.httpStatus).toBe(503);
    });

    it("verifies client fetch handler in main.tsx handles 503 and network exceptions safely", () => {
      const mainCode = fs.readFileSync(mainTsxPath, "utf-8");

      expect(mainCode).toContain("httpBatchLink");
      expect(mainCode).toContain("async fetch(input, init)");
      expect(mainCode).toContain("INTERNAL_SERVER_ERROR");
      expect(mainCode).toContain("Impossible de joindre le serveur. Vérifiez votre connexion Internet.");
      expect(mainCode).toContain("status: 503");
      expect(mainCode).toContain("Content-Type");
      expect(mainCode).toContain("application/json");
    });
  });

  // =========================================================================
  // 4. CLIENT LOGIC, HOOKS & UI BANNER RESILIENCE
  // =========================================================================
  describe("4. Client Components & Hook Contract Resilience", () => {
    it("verifies useOnlineStatus hook implementation structure", () => {
      const hookCode = fs.readFileSync(useOnlineStatusPath, "utf-8");

      expect(hookCode).toContain("export function useOnlineStatus");
      expect(hookCode).toContain("isOnline");
      expect(hookCode).toContain("wasOffline");
      expect(hookCode).toContain("offlineSince");
      expect(hookCode).toContain("resetWasOffline");
      expect(hookCode).toContain("window.addEventListener(\"online\"");
      expect(hookCode).toContain("window.addEventListener(\"offline\"");
      expect(hookCode).toContain("window.removeEventListener(\"online\"");
      expect(hookCode).toContain("window.removeEventListener(\"offline\"");
      expect(hookCode).toContain("setTimeout");
      expect(hookCode).toContain("5000"); // 5s auto-dismiss
    });

    it("verifies NetworkStatusBanner renders accessible status and Quai de Conakry alerts", () => {
      const bannerCode = fs.readFileSync(networkBannerPath, "utf-8");

      expect(bannerCode).toContain("role=\"status\"");
      expect(bannerCode).toContain("aria-live=\"polite\"");
      expect(bannerCode).toContain("Mode Hors-Ligne (Quai de Conakry)");
      expect(bannerCode).toContain("Données en cache actives. Les modifications seront synchronisées au rétablissement du réseau.");
      expect(bannerCode).toContain("Connexion rétablie : Synchronisation terminée.");
      expect(bannerCode).toContain("data-testid=\"network-status-banner\"");
    });

    it("verifies PWAInstallBanner beforeinstallprompt handling and 7-day dismissal threshold", () => {
      const pwaCode = fs.readFileSync(pwaBannerPath, "utf-8");

      expect(pwaCode).toContain("beforeinstallprompt");
      expect(pwaCode).toContain("appinstalled");
      expect(pwaCode).toContain("igs-pwa-install-dismissed-at");
      expect(pwaCode).toContain("DISMISS_DURATION_DAYS = 7");
      expect(pwaCode).toContain("display-mode: standalone");
      expect(pwaCode).toContain("navigator as any).standalone");
      expect(pwaCode).toContain("Installer l'app");
      expect(pwaCode).toContain("data-testid=\"pwa-install-banner\"");
    });
  });

  // =========================================================================
  // 5. HTML INTEGRATION & PWA META TAGS
  // =========================================================================
  describe("5. HTML Meta Tags & PWA Linking (client/index.html)", () => {
    it("contains complete manifest link and iOS standalone tags", () => {
      const html = fs.readFileSync(indexHtmlPath, "utf-8");

      expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
      expect(html).toContain('<meta name="theme-color" content="#0b3b32" />');
      expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
      expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
      expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
      expect(html).toContain('<meta name="apple-mobile-web-app-title" content="IGS Transit" />');
      expect(html).toContain('<link rel="apple-touch-icon" href="/igs-logo-icon.png" />');
      expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
    });
  });
});
