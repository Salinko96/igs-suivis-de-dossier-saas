import { describe, expect, it } from "vitest";

export interface MenuItem {
  label: string;
  path: string;
  roles?: string[];
}

export const MENU_ITEMS: MenuItem[] = [
  { label: "Pilotage & KPI", path: "/", roles: ["admin", "comptable", "manager"] },
  { label: "Tous les Dossiers", path: "/dossiers", roles: ["admin", "declarant", "comptable", "manager", "client"] },
  { label: "Finances & Facturation", path: "/finances", roles: ["admin", "comptable", "manager"] },
  { label: "Planning & Échéances", path: "/planning", roles: ["admin", "declarant", "manager"] },
  { label: "Contrôles Douane & PAC", path: "/controles", roles: ["admin", "declarant", "manager"] },
  { label: "Portail Client Externe", path: "/portail-client", roles: ["admin", "client"] },
];

export function getVisibleMenuItems(role: string): MenuItem[] {
  return MENU_ITEMS.filter(item => !item.roles || item.roles.includes(role));
}

export function isRouteAuthorized(role: string, targetPath: string): boolean {
  if (role === "admin") return true;

  // Normalisation des chemins dynamiques (ex: /dossiers/12 -> /dossiers)
  const normalizedPath = targetPath.startsWith("/dossiers/") ? "/dossiers" : targetPath;

  const menuItem = MENU_ITEMS.find(item => item.path === normalizedPath);
  if (!menuItem) return false;
  return !menuItem.roles || menuItem.roles.includes(role);
}

export function getTargetRedirectOnRoleSwitch(role: string): string {
  switch (role) {
    case "declarant":
      return "/planning";
    case "comptable":
      return "/finances";
    case "client":
      return "/portail-client";
    case "manager":
    case "admin":
    default:
      return "/";
  }
}

export function getRoleBadgeText(role?: string): string {
  switch (role) {
    case "declarant":
      return "Déclarant PAC";
    case "comptable":
      return "Comptable";
    case "client":
      return "Client";
    case "manager":
      return "Manager";
    default:
      return "Admin";
  }
}

describe("Tier 3 - UI Navigation & Route Guards: Role Simulator UX & Protection (R1, R4)", () => {
  describe("1. Filtrage Dynamique du Menu Latéral (Sidebar Menu Items)", () => {
    it("affiche tous les 6 menus pour l'Administrateur IGS", () => {
      const menus = getVisibleMenuItems("admin");
      expect(menus).toHaveLength(6);
      expect(menus.map(m => m.path)).toEqual([
        "/",
        "/dossiers",
        "/finances",
        "/planning",
        "/controles",
        "/portail-client",
      ]);
    });

    it("filtre les menus pour le Déclarant PAC (Planning, Contrôles, Dossiers - masque Finances)", () => {
      const menus = getVisibleMenuItems("declarant");
      expect(menus).toHaveLength(3);
      const paths = menus.map(m => m.path);
      expect(paths).toContain("/planning");
      expect(paths).toContain("/controles");
      expect(paths).toContain("/dossiers");
      expect(paths).not.toContain("/finances");
      expect(paths).not.toContain("/");
    });

    it("filtre les menus pour le Comptable (Pilotage, Finances, Dossiers - masque Contrôles/Planning)", () => {
      const menus = getVisibleMenuItems("comptable");
      expect(menus).toHaveLength(3);
      const paths = menus.map(m => m.path);
      expect(paths).toContain("/");
      expect(paths).toContain("/finances");
      expect(paths).toContain("/dossiers");
      expect(paths).not.toContain("/planning");
      expect(paths).not.toContain("/controles");
    });

    it("filtre les menus pour le Client (Portail Client, Dossiers)", () => {
      const menus = getVisibleMenuItems("client");
      expect(menus).toHaveLength(2);
      const paths = menus.map(m => m.path);
      expect(paths).toContain("/portail-client");
      expect(paths).toContain("/dossiers");
      expect(paths).not.toContain("/finances");
      expect(paths).not.toContain("/planning");
      expect(paths).not.toContain("/controles");
    });
  });

  describe("2. Contrôle d'Accès aux Routes & Gardes (Route Guards)", () => {
    it("autorise l'Admin sur l'ensemble des routes système", () => {
      expect(isRouteAuthorized("admin", "/")).toBe(true);
      expect(isRouteAuthorized("admin", "/finances")).toBe(true);
      expect(isRouteAuthorized("admin", "/planning")).toBe(true);
      expect(isRouteAuthorized("admin", "/controles")).toBe(true);
      expect(isRouteAuthorized("admin", "/dossiers/54")).toBe(true);
    });

    it("bloque le Déclarant sur les routes financières", () => {
      expect(isRouteAuthorized("declarant", "/planning")).toBe(true);
      expect(isRouteAuthorized("declarant", "/controles")).toBe(true);
      expect(isRouteAuthorized("declarant", "/dossiers/12")).toBe(true);
      expect(isRouteAuthorized("declarant", "/finances")).toBe(false);
      expect(isRouteAuthorized("declarant", "/")).toBe(false);
    });

    it("bloque le Comptable sur les routes terrain/douane", () => {
      expect(isRouteAuthorized("comptable", "/finances")).toBe(true);
      expect(isRouteAuthorized("comptable", "/")).toBe(true);
      expect(isRouteAuthorized("comptable", "/dossiers/3")).toBe(true);
      expect(isRouteAuthorized("comptable", "/planning")).toBe(false);
      expect(isRouteAuthorized("comptable", "/controles")).toBe(false);
    });

    it("bloque le Client sur les routes internes et administratives", () => {
      expect(isRouteAuthorized("client", "/portail-client")).toBe(true);
      expect(isRouteAuthorized("client", "/dossiers")).toBe(true);
      expect(isRouteAuthorized("client", "/finances")).toBe(false);
      expect(isRouteAuthorized("client", "/controles")).toBe(false);
      expect(isRouteAuthorized("client", "/planning")).toBe(false);
    });
  });

  describe("3. Redirection Cible lors du Switch de Rôle (UX Simulateur)", () => {
    it("détermine la route cible appropriée selon le rôle activé", () => {
      expect(getTargetRedirectOnRoleSwitch("declarant")).toBe("/planning");
      expect(getTargetRedirectOnRoleSwitch("comptable")).toBe("/finances");
      expect(getTargetRedirectOnRoleSwitch("client")).toBe("/portail-client");
      expect(getTargetRedirectOnRoleSwitch("admin")).toBe("/");
      expect(getTargetRedirectOnRoleSwitch("manager")).toBe("/");
    });
  });

  describe("4. Libellés et Badges des Profils", () => {
    it("renvoie les libellés officiels de badges pour chaque persona", () => {
      expect(getRoleBadgeText("declarant")).toBe("Déclarant PAC");
      expect(getRoleBadgeText("comptable")).toBe("Comptable");
      expect(getRoleBadgeText("client")).toBe("Client");
      expect(getRoleBadgeText("manager")).toBe("Manager");
      expect(getRoleBadgeText("admin")).toBe("Admin");
      expect(getRoleBadgeText(undefined)).toBe("Admin");
    });
  });
});
