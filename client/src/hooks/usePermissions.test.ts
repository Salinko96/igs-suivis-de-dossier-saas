import { describe, expect, it } from "vitest";
import { resolvePermissions, getRoleBadge, Role } from "./usePermissions";

describe("Frontend RBAC & Role Capabilities: usePermissions (Milestones 2, 3, 4)", () => {
  describe("1. Admin Role Capabilities", () => {
    it("accorde tous les accès opérationnels, financiers, et administratifs", () => {
      const p = resolvePermissions("admin");
      expect(p.isAdmin).toBe(true);
      expect(p.canViewFinances).toBe(true);
      expect(p.canViewControls).toBe(true);
      expect(p.canViewPlanning).toBe(true);
      expect(p.canEditCustoms).toBe(true);
      expect(p.canManageInvoices).toBe(true);
      expect(p.canCreateDossier).toBe(true);
      expect(p.canDeleteDossier).toBe(true);
      expect(p.canViewAudit).toBe(true);
      expect(p.canViewAllCompanies).toBe(true);
      expect(p.canViewMargin).toBe(true);
      expect(p.defaultRoute).toBe("/");
      expect(p.roleBadge).toBe("Admin");
    });
  });

  describe("2. Déclarant PAC Role Capabilities (Mamadou Diallo)", () => {
    it("accorde le planning, contrôles et édition douane mais bloque strictement les finances", () => {
      const p = resolvePermissions("declarant");
      expect(p.isDeclarant).toBe(true);
      expect(p.canViewPlanning).toBe(true);
      expect(p.canViewControls).toBe(true);
      expect(p.canEditCustoms).toBe(true);
      expect(p.canCreateDossier).toBe(true);

      // Financial shield
      expect(p.canViewFinances).toBe(false);
      expect(p.canManageInvoices).toBe(false);
      expect(p.canViewMargin).toBe(false);
      expect(p.canDeleteDossier).toBe(false);

      expect(p.defaultRoute).toBe("/planning");
      expect(p.roleBadge).toBe("Déclarant PAC");
    });
  });

  describe("3. Comptable Role Capabilities (Fatoumata Camara)", () => {
    it("accorde la gestion financière et facturation mais bloque les contrôles douane terrain", () => {
      const p = resolvePermissions("comptable");
      expect(p.isComptable).toBe(true);
      expect(p.canViewFinances).toBe(true);
      expect(p.canManageInvoices).toBe(true);
      expect(p.canViewMargin).toBe(true);

      // Customs & controls shield
      expect(p.canViewControls).toBe(false);
      expect(p.canViewPlanning).toBe(false);
      expect(p.canEditCustoms).toBe(false);
      expect(p.canDeleteDossier).toBe(false);

      expect(p.defaultRoute).toBe("/finances");
      expect(p.roleBadge).toBe("Comptable");
    });
  });

  describe("4. Client Role Capabilities (Guinean Birimian Gold)", () => {
    it("isole le portail client sans accès aux finances internes ni aux opérations douanières", () => {
      const p = resolvePermissions("client");
      expect(p.isClient).toBe(true);
      expect(p.canViewFinances).toBe(false);
      expect(p.canViewControls).toBe(false);
      expect(p.canViewPlanning).toBe(false);
      expect(p.canEditCustoms).toBe(false);
      expect(p.canManageInvoices).toBe(false);
      expect(p.canCreateDossier).toBe(false);
      expect(p.canDeleteDossier).toBe(false);
      expect(p.canViewMargin).toBe(false);
      expect(p.canViewAudit).toBe(false);
      expect(p.canViewAllCompanies).toBe(false);

      expect(p.defaultRoute).toBe("/portail-client");
      expect(p.roleBadge).toBe("Client");
    });
  });

  describe("5. Role Badge helper", () => {
    it("renvoie les bons libellés de badges", () => {
      expect(getRoleBadge("admin")).toBe("Admin");
      expect(getRoleBadge("declarant")).toBe("Déclarant PAC");
      expect(getRoleBadge("comptable")).toBe("Comptable");
      expect(getRoleBadge("client")).toBe("Client");
      expect(getRoleBadge("manager")).toBe("Manager");
      expect(getRoleBadge(null)).toBe("Utilisateur");
      expect(getRoleBadge(undefined)).toBe("Utilisateur");
    });
  });
});
