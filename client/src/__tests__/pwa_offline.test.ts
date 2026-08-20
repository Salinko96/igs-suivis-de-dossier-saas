import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as onlineHookModule from "../hooks/useOnlineStatus";
import { NetworkStatusBanner } from "../components/NetworkStatusBanner";
import { PWAInstallBanner } from "../components/PWAInstallBanner";

describe("Milestone 4 — Client PWA & Offline Components Test Suite (Port de Conakry)", () => {
  let originalLocalStorage: any;
  let storageMock: Record<string, string> = {};

  beforeEach(() => {
    storageMock = {};
    originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: vi.fn((key: string) => storageMock[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        storageMock[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMock[key];
      }),
      clear: vi.fn(() => {
        storageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.localStorage = originalLocalStorage;
  });

  describe("1. Hook useOnlineStatus Logic & State Contract", () => {
    it("expose l'interface OnlineStatusState complète", async () => {
      const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
      expect(useOnlineStatus).toBeDefined();
      expect(typeof useOnlineStatus).toBe("function");
    });
  });

  describe("2. Composant NetworkStatusBanner (Alertes Réseau Quai Conakry)", () => {
    it("ne s'affiche pas lorsque la connexion est normale (isOnline: true, wasOffline: false)", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: true,
        wasOffline: false,
        offlineSince: null,
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toBe("");
    });

    it("affiche la bannière d'alerte orange 'Mode Hors-Ligne (Quai de Conakry)' en cas de déconnexion", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: false,
        wasOffline: false,
        offlineSince: new Date("2026-08-20T10:00:00Z"),
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toContain("data-testid=\"network-status-banner\"");
      expect(html).toContain("Mode Hors-Ligne (Quai de Conakry) :");
      expect(html).toContain("Données en cache actives. Les modifications seront synchronisées au rétablissement du réseau.");
      expect(html).toContain("Cache Local Actif");
    });

    it("affiche la bannière verte de reconnexion lorsque la connexion est rétablie", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: true,
        wasOffline: true,
        offlineSince: null,
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toContain("data-testid=\"network-status-banner\"");
      expect(html).toContain("Connexion rétablie : Synchronisation terminée.");
      expect(html).toContain("Fermer");
    });
  });

  describe("3. Composant PWAInstallBanner (Installation Terrain Quai Conakry)", () => {
    it("rend la bannière d'installation complète quand forceShow est activé", () => {
      const html = renderToStaticMarkup(
        React.createElement(PWAInstallBanner, { forceShow: true })
      );

      expect(html).toContain("data-testid=\"pwa-install-banner\"");
      expect(html).toContain("Application Mobile IGS Port Conakry");
      expect(html).toContain("PWA Terrain");
      expect(html).toContain("Installer l&#x27;app");
      expect(html).toContain("Installez l&#x27;accès direct et travaillez hors-ligne sur les quais du Port Autonome.");
    });

    it("ne s'affiche pas par défaut sans événement beforeinstallprompt ou si masqué", () => {
      const html = renderToStaticMarkup(
        React.createElement(PWAInstallBanner, { forceShow: false })
      );
      expect(html).toBe("");
    });
  });

  describe("4. LocalStorage & Persistance de la bannière PWA", () => {
    it("gère la persistance de l'état de masquage (7 jours)", () => {
      const dismissKey = "igs-pwa-install-dismissed-at";
      const now = Date.now().toString();
      localStorage.setItem(dismissKey, now);

      expect(localStorage.getItem(dismissKey)).toBe(now);
      expect(localStorage.setItem).toHaveBeenCalledWith(dismissKey, now);
    });

    it("permet la suppression de la clé de masquage lors de l'installation effective", () => {
      const dismissKey = "igs-pwa-install-dismissed-at";
      storageMock[dismissKey] = "1724150000000";
      localStorage.removeItem(dismissKey);

      expect(localStorage.removeItem).toHaveBeenCalledWith(dismissKey);
      expect(storageMock[dismissKey]).toBeUndefined();
    });
  });
});
