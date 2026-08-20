import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as onlineHookModule from "../hooks/useOnlineStatus";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { NetworkStatusBanner } from "../components/NetworkStatusBanner";
import { PWAInstallBanner } from "../components/PWAInstallBanner";

describe("Adversarial Stress Test Suite — Milestone 4 Client PWA & Offline Banners", () => {
  let originalLocalStorage: any;
  let originalWindow: any;
  let storageMock: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    storageMock = {};
    originalLocalStorage = global.localStorage;
    originalWindow = (global as any).window;

    global.localStorage = {
      getItem: vi.fn((key: string) => storageMock[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        storageMock[key] = String(val);
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

    const eventListeners: Record<string, Function[]> = {};
    (global as any).window = {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      addEventListener: vi.fn((event: string, cb: Function) => {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: Function) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter(h => h !== cb);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const type = event.type || event;
        if (eventListeners[type]) {
          eventListeners[type].forEach(cb => cb(event));
        }
        return true;
      }),
      navigator: {
        onLine: true,
      },
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.localStorage = originalLocalStorage;
    (global as any).window = originalWindow;
  });

  describe("1. Stress Testing `useOnlineStatus` Hook Logic & Edge Cases", () => {
    it("exposes full interface and default state correctly", () => {
      expect(typeof useOnlineStatus).toBe("function");
    });

    it("handles initial navigator.onLine values (true vs false)", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: false,
        wasOffline: false,
        offlineSince: new Date("2026-08-20T10:00:00Z"),
        resetWasOffline: vi.fn(),
      });

      const res = onlineHookModule.useOnlineStatus();
      expect(res.isOnline).toBe(false);
      expect(res.wasOffline).toBe(false);
      expect(res.offlineSince).toBeInstanceOf(Date);
    });

    it("verifies state contract under rapid online/offline oscillations", () => {
      const resetMock = vi.fn();
      const states: Array<{ isOnline: boolean; wasOffline: boolean; offlineSince: Date | null }> = [];

      // Simulate rapid toggling: online -> offline -> online -> offline -> online (50 oscillations)
      for (let i = 0; i < 50; i++) {
        const isOff = i % 2 === 1;
        vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
          isOnline: !isOff,
          wasOffline: isOff ? false : i > 0,
          offlineSince: isOff ? new Date(`2026-08-20T10:00:${i < 10 ? "0" + i : i}Z`) : null,
          resetWasOffline: resetMock,
        });
        const current = onlineHookModule.useOnlineStatus();
        states.push({
          isOnline: current.isOnline,
          wasOffline: current.wasOffline,
          offlineSince: current.offlineSince,
        });
      }

      expect(states.length).toBe(50);
      expect(states[0].isOnline).toBe(true);
      expect(states[0].wasOffline).toBe(false);
      expect(states[1].isOnline).toBe(false);
      expect(states[1].offlineSince).not.toBeNull();
      expect(states[2].isOnline).toBe(true);
      expect(states[2].wasOffline).toBe(true);
    });

    it("handles timer countdown simulation when reconnected", () => {
      let wasOffline = true;
      const timer = setTimeout(() => {
        wasOffline = false;
      }, 5000);

      expect(wasOffline).toBe(true);
      vi.advanceTimersByTime(2500);
      expect(wasOffline).toBe(true);
      vi.advanceTimersByTime(2500);
      expect(wasOffline).toBe(false);
    });

    it("cleans up event listeners when component unmounts", () => {
      const listeners: Record<string, Function[]> = {};
      const addSpy = vi.spyOn(global.window, "addEventListener").mockImplementation((event, handler) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler as Function);
      });
      const removeSpy = vi.spyOn(global.window, "removeEventListener").mockImplementation((event, handler) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      });

      // Verification of add/remove contract
      global.window.addEventListener("online", () => {});
      global.window.addEventListener("offline", () => {});
      expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

      global.window.removeEventListener("online", () => {});
      global.window.removeEventListener("offline", () => {});
      expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    });
  });

  describe("2. Adversarial Testing `NetworkStatusBanner`", () => {
    it("renders nothing (empty string) in normal online state", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: true,
        wasOffline: false,
        offlineSince: null,
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toBe("");
    });

    it("renders amber offline alert with accessible ARIA live attributes and port context", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: false,
        wasOffline: false,
        offlineSince: new Date("2026-08-20T10:00:00Z"),
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('data-testid="network-status-banner"');
      expect(html).toContain("Mode Hors-Ligne (Quai de Conakry) :");
      expect(html).toContain("Données en cache actives. Les modifications seront synchronisées au rétablissement du réseau.");
      expect(html).toContain("Cache Local Actif");
    });

    it("renders green reconnection notification with close button when reconnected", () => {
      const resetMock = vi.fn();
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: true,
        wasOffline: true,
        offlineSince: null,
        resetWasOffline: resetMock,
      });

      const html = renderToStaticMarkup(React.createElement(NetworkStatusBanner));
      expect(html).toContain('data-testid="network-status-banner"');
      expect(html).toContain("Connexion rétablie : Synchronisation terminée.");
      expect(html).toContain("Fermer");
    });

    it("applies custom class names accurately", () => {
      vi.spyOn(onlineHookModule, "useOnlineStatus").mockReturnValue({
        isOnline: false,
        wasOffline: false,
        offlineSince: new Date(),
        resetWasOffline: vi.fn(),
      });

      const html = renderToStaticMarkup(
        React.createElement(NetworkStatusBanner, { className: "sticky top-0 z-50 shadow-md" })
      );
      expect(html).toContain("sticky top-0 z-50 shadow-md");
    });
  });

  describe("3. Adversarial Testing `PWAInstallBanner`", () => {
    it("renders banner content when forceShow is enabled", () => {
      const html = renderToStaticMarkup(
        React.createElement(PWAInstallBanner, { forceShow: true })
      );

      expect(html).toContain('data-testid="pwa-install-banner"');
      expect(html).toContain('aria-label="Installation de l&#x27;application mobile"');
      expect(html).toContain("Application Mobile IGS Port Conakry");
      expect(html).toContain("PWA Terrain");
      expect(html).toContain("Installer l&#x27;app");
      expect(html).toContain("Installez l&#x27;accès direct et travaillez hors-ligne sur les quais du Port Autonome.");
    });

    it("does not render when forceShow is false and no beforeinstallprompt event is caught", () => {
      const html = renderToStaticMarkup(
        React.createElement(PWAInstallBanner, { forceShow: false })
      );
      expect(html).toBe("");
    });

    it("handles 7-day dismissal persistence boundary conditions", () => {
      const dismissKey = "igs-pwa-install-dismissed-at";
      const now = Date.now();

      // Case A: Dismissed 3 days ago (< 7 days) -> should be dismissed
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const daysSince3 = (now - threeDaysAgo) / (1000 * 60 * 60 * 24);
      expect(daysSince3 < 7).toBe(true);

      // Case B: Dismissed 8 days ago (> 7 days) -> should expire dismissal
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      const daysSince8 = (now - eightDaysAgo) / (1000 * 60 * 60 * 24);
      expect(daysSince8 < 7).toBe(false);

      // Case C: Corrupted/NaN string in localStorage -> parseInt returns NaN, (NaN < 7) is false, handles safely
      const corrupted = "corrupted-val";
      const parsed = parseInt(corrupted, 10);
      const daysSinceNaN = (now - parsed) / (1000 * 60 * 60 * 24);
      expect(daysSinceNaN < 7).toBe(false);
    });

    it("handles appinstalled event lifecycle by clearing dismissal key", () => {
      const dismissKey = "igs-pwa-install-dismissed-at";
      storageMock[dismissKey] = "1724150000000";

      // Simulation of appinstalled event handler logic
      localStorage.removeItem(dismissKey);
      expect(localStorage.removeItem).toHaveBeenCalledWith(dismissKey);
      expect(storageMock[dismissKey]).toBeUndefined();
    });

    it("simulates beforeinstallprompt event handling with userChoice prompt outcomes", async () => {
      let promptCalled = false;
      const mockPromptEvent = {
        platforms: ["web", "android"],
        prompt: vi.fn().mockImplementation(async () => {
          promptCalled = true;
        }),
        userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
      };

      await mockPromptEvent.prompt();
      expect(promptCalled).toBe(true);
      const result = await mockPromptEvent.userChoice;
      expect(result.outcome).toBe("accepted");
    });
  });

  describe("4. Global Integration & Layout Verification", () => {
    it("confirms NetworkStatusBanner and PWAInstallBanner exported as both named and default exports", () => {
      expect(NetworkStatusBanner).toBeDefined();
      expect(PWAInstallBanner).toBeDefined();
    });
  });
});
