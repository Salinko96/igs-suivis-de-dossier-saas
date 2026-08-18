import { describe, expect, it } from "vitest";

export type Role = "admin" | "declarant" | "comptable" | "client" | "manager" | "user";

export interface PermissionsMatrix {
  isAdmin: boolean;
  isDeclarant: boolean;
  isComptable: boolean;
  isClient: boolean;
  isManager: boolean;
  canViewFinances: boolean;
  canViewControls: boolean;
  canViewPlanning: boolean;
  canEditCustoms: boolean;
  canManageInvoices: boolean;
  canCreateDossier: boolean;
  canDeleteDossier: boolean;
  canViewAudit: boolean;
  canViewAllCompanies: boolean;
  canViewMargin: boolean;
  defaultRoute: string;
}

export function resolvePermissions(role?: string | null): PermissionsMatrix {
  const r = (role || "user") as Role;
  const isAdmin = r === "admin";
  const isDeclarant = r === "declarant";
  const isComptable = r === "comptable";
  const isClient = r === "client";
  const isManager = r === "manager";

  let defaultRoute = "/";
  if (isDeclarant) defaultRoute = "/planning";
  else if (isComptable) defaultRoute = "/finances";
  else if (isClient) defaultRoute = "/portail-client";

  return {
    isAdmin,
    isDeclarant,
    isComptable,
    isClient,
    isManager,
    canViewFinances: isAdmin || isManager || isComptable,
    canViewControls: isAdmin || isManager || isDeclarant,
    canViewPlanning: isAdmin || isManager || isDeclarant,
    canEditCustoms: isAdmin || isManager || isDeclarant,
    canManageInvoices: isAdmin || isManager || isComptable,
    canCreateDossier: isAdmin || isManager || isDeclarant,
    canDeleteDossier: isAdmin,
    canViewAudit: isAdmin || isManager || isDeclarant || isComptable,
    canViewAllCompanies: !isClient,
    canViewMargin: isAdmin || isManager || isComptable,
    defaultRoute,
  };
}

describe("Tier 1 - Pure Business Logic: RBAC Permissions Matrix (R1, R2, R3, R4)", () => {
  describe("1. Profil Administrateur (Admin IGS)", () => {
    it("octroie l'intégralité des permissions opérationnelles, financières et administratives", () => {
      const perms = resolvePermissions("admin");
      expect(perms.isAdmin).toBe(true);
      expect(perms.canViewFinances).toBe(true);
      expect(perms.canViewControls).toBe(true);
      expect(perms.canViewPlanning).toBe(true);
      expect(perms.canEditCustoms).toBe(true);
      expect(perms.canManageInvoices).toBe(true);
      expect(perms.canCreateDossier).toBe(true);
      expect(perms.canDeleteDossier).toBe(true);
      expect(perms.canViewMargin).toBe(true);
      expect(perms.canViewAllCompanies).toBe(true);
      expect(perms.defaultRoute).toBe("/");
    });
  });

  describe("2. Profil Déclarant PAC (Mamadou Diallo - R2)", () => {
    it("octroie les droits terrain/douane/planning mais bloque strictement la finance et la marge", () => {
      const perms = resolvePermissions("declarant");
      expect(perms.isDeclarant).toBe(true);
      expect(perms.canViewPlanning).toBe(true);
      expect(perms.canViewControls).toBe(true);
      expect(perms.canEditCustoms).toBe(true);
      expect(perms.canCreateDossier).toBe(true);
      
      // Bouclier financier R2
      expect(perms.canViewFinances).toBe(false);
      expect(perms.canManageInvoices).toBe(false);
      expect(perms.canViewMargin).toBe(false);
      expect(perms.canDeleteDossier).toBe(false);

      // Redirection automatique
      expect(perms.defaultRoute).toBe("/planning");
    });
  });

  describe("3. Profil Comptable (Fatoumata Camara - R3)", () => {
    it("octroie la gestion financière et facturation mais bloque les contrôles douaniers terrain", () => {
      const perms = resolvePermissions("comptable");
      expect(perms.isComptable).toBe(true);
      expect(perms.canViewFinances).toBe(true);
      expect(perms.canManageInvoices).toBe(true);
      expect(perms.canViewMargin).toBe(true);

      // Bouclier douane/terrain
      expect(perms.canViewControls).toBe(false);
      expect(perms.canViewPlanning).toBe(false);
      expect(perms.canEditCustoms).toBe(false);
      expect(perms.canDeleteDossier).toBe(false);

      // Redirection automatique
      expect(perms.defaultRoute).toBe("/finances");
    });
  });

  describe("4. Profil Portail Client (Guinean Birimian Gold - R1)", () => {
    it("isole strictement la vue client sans accès aux finances internes ni aux actions douanières", () => {
      const perms = resolvePermissions("client");
      expect(perms.isClient).toBe(true);
      expect(perms.canViewFinances).toBe(false);
      expect(perms.canViewControls).toBe(false);
      expect(perms.canViewPlanning).toBe(false);
      expect(perms.canEditCustoms).toBe(false);
      expect(perms.canManageInvoices).toBe(false);
      expect(perms.canCreateDossier).toBe(false);
      expect(perms.canDeleteDossier).toBe(false);
      expect(perms.canViewMargin).toBe(false);
      expect(perms.canViewAudit).toBe(false);
      expect(perms.canViewAllCompanies).toBe(false);

      // Redirection automatique
      expect(perms.defaultRoute).toBe("/portail-client");
    });
  });

  describe("5. Fallback & Cas Limites", () => {
    it("applique les restrictions par défaut pour un rôle non défini ou nul", () => {
      const permsNull = resolvePermissions(null);
      expect(permsNull.isAdmin).toBe(false);
      expect(permsNull.canViewFinances).toBe(false);
      expect(permsNull.canEditCustoms).toBe(false);
      expect(permsNull.canDeleteDossier).toBe(false);

      const permsUnknown = resolvePermissions("unknown_guest" as any);
      expect(permsUnknown.isAdmin).toBe(false);
      expect(permsUnknown.canViewFinances).toBe(false);
    });
  });
});
