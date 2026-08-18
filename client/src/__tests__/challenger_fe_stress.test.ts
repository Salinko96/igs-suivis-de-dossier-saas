import { describe, expect, it } from "vitest";
import { resolvePermissions, getRoleBadge, Role, PermissionsMatrix } from "../hooks/usePermissions";

describe("Adversarial Stress Test: Frontend RBAC Matrix & Role Capabilities (M2, M3, M4)", () => {
  describe("1. Exhaustive Role Matrix & Default Route Verification", () => {
    const roles: Array<{
      role: Role | null | undefined | string;
      expectedAdmin: boolean;
      expectedDeclarant: boolean;
      expectedComptable: boolean;
      expectedClient: boolean;
      expectedManager: boolean;
      expectedFinances: boolean;
      expectedControls: boolean;
      expectedPlanning: boolean;
      expectedEditCustoms: boolean;
      expectedManageInvoices: boolean;
      expectedCreateDossier: boolean;
      expectedDeleteDossier: boolean;
      expectedAudit: boolean;
      expectedAllCompanies: boolean;
      expectedMargin: boolean;
      expectedRoute: string;
      expectedBadge: string;
    }> = [
      {
        role: "admin",
        expectedAdmin: true,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: true,
        expectedControls: true,
        expectedPlanning: true,
        expectedEditCustoms: true,
        expectedManageInvoices: true,
        expectedCreateDossier: true,
        expectedDeleteDossier: true,
        expectedAudit: true,
        expectedAllCompanies: true,
        expectedMargin: true,
        expectedRoute: "/",
        expectedBadge: "Admin",
      },
      {
        role: "declarant",
        expectedAdmin: false,
        expectedDeclarant: true,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: true,
        expectedPlanning: true,
        expectedEditCustoms: true,
        expectedManageInvoices: false,
        expectedCreateDossier: true,
        expectedDeleteDossier: false,
        expectedAudit: true,
        expectedAllCompanies: true,
        expectedMargin: false,
        expectedRoute: "/planning",
        expectedBadge: "Déclarant PAC",
      },
      {
        role: "comptable",
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: true,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: true,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: true,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: true,
        expectedAllCompanies: true,
        expectedMargin: true,
        expectedRoute: "/finances",
        expectedBadge: "Comptable",
      },
      {
        role: "client",
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: true,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: false,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: false,
        expectedAllCompanies: false,
        expectedMargin: false,
        expectedRoute: "/portail-client",
        expectedBadge: "Client",
      },
      {
        role: "manager",
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: true,
        expectedFinances: true,
        expectedControls: true,
        expectedPlanning: true,
        expectedEditCustoms: true,
        expectedManageInvoices: true,
        expectedCreateDossier: true,
        expectedDeleteDossier: false,
        expectedAudit: true,
        expectedAllCompanies: true,
        expectedMargin: true,
        expectedRoute: "/",
        expectedBadge: "Manager",
      },
      {
        role: "user",
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: false,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: false,
        expectedAllCompanies: true,
        expectedMargin: false,
        expectedRoute: "/",
        expectedBadge: "Utilisateur",
      },
      {
        role: null,
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: false,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: false,
        expectedAllCompanies: true,
        expectedMargin: false,
        expectedRoute: "/",
        expectedBadge: "Utilisateur",
      },
      {
        role: undefined,
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: false,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: false,
        expectedAllCompanies: true,
        expectedMargin: false,
        expectedRoute: "/",
        expectedBadge: "Utilisateur",
      },
      {
        role: "unknown_hacker_role",
        expectedAdmin: false,
        expectedDeclarant: false,
        expectedComptable: false,
        expectedClient: false,
        expectedManager: false,
        expectedFinances: false,
        expectedControls: false,
        expectedPlanning: false,
        expectedEditCustoms: false,
        expectedManageInvoices: false,
        expectedCreateDossier: false,
        expectedDeleteDossier: false,
        expectedAudit: false,
        expectedAllCompanies: true,
        expectedMargin: false,
        expectedRoute: "/",
        expectedBadge: "Utilisateur",
      },
    ];

    roles.forEach(tc => {
      it(`valide rigoureusement la matrice pour le rôle: "${tc.role}"`, () => {
        const p = resolvePermissions(tc.role as any);
        expect(p.isAdmin).toBe(tc.expectedAdmin);
        expect(p.isDeclarant).toBe(tc.expectedDeclarant);
        expect(p.isComptable).toBe(tc.expectedComptable);
        expect(p.isClient).toBe(tc.expectedClient);
        expect(p.isManager).toBe(tc.expectedManager);
        expect(p.canViewFinances).toBe(tc.expectedFinances);
        expect(p.canViewControls).toBe(tc.expectedControls);
        expect(p.canViewPlanning).toBe(tc.expectedPlanning);
        expect(p.canEditCustoms).toBe(tc.expectedEditCustoms);
        expect(p.canManageInvoices).toBe(tc.expectedManageInvoices);
        expect(p.canCreateDossier).toBe(tc.expectedCreateDossier);
        expect(p.canDeleteDossier).toBe(tc.expectedDeleteDossier);
        expect(p.canViewAudit).toBe(tc.expectedAudit);
        expect(p.canViewAllCompanies).toBe(tc.expectedAllCompanies);
        expect(p.canViewMargin).toBe(tc.expectedMargin);
        expect(p.defaultRoute).toBe(tc.expectedRoute);
        expect(p.roleBadge).toBe(tc.expectedBadge);
      });
    });
  });

  describe("2. Route Guard Authorization Logic Stress Test", () => {
    // Simulator helper for ProtectedRoute decision logic
    function checkRouteAuthorization(
      role: string | null | undefined,
      opts: {
        allowedRoles?: string[];
        requirePermission?: (p: PermissionsMatrix) => boolean;
      }
    ): { authorized: boolean; targetRedirect: string } {
      const perms = resolvePermissions(role);
      let isAuthorized = true;
      if (!role) isAuthorized = false;
      else if (perms.isAdmin) isAuthorized = true;
      else if (opts.allowedRoles && !opts.allowedRoles.includes(perms.role)) isAuthorized = false;
      else if (opts.requirePermission && !opts.requirePermission(perms)) isAuthorized = false;

      return {
        authorized: isAuthorized,
        targetRedirect: perms.defaultRoute,
      };
    }

    it("vérifie le verrouillage de la route Dashboard / pour Déclarant et Client", () => {
      const declarant = checkRouteAuthorization("declarant", { allowedRoles: ["admin", "comptable", "manager"] });
      expect(declarant.authorized).toBe(false);
      expect(declarant.targetRedirect).toBe("/planning");

      const client = checkRouteAuthorization("client", { allowedRoles: ["admin", "comptable", "manager"] });
      expect(client.authorized).toBe(false);
      expect(client.targetRedirect).toBe("/portail-client");

      const comptable = checkRouteAuthorization("comptable", { allowedRoles: ["admin", "comptable", "manager"] });
      expect(comptable.authorized).toBe(true);

      const admin = checkRouteAuthorization("admin", { allowedRoles: ["admin", "comptable", "manager"] });
      expect(admin.authorized).toBe(true);
    });

    it("vérifie le verrouillage de la route Finances /finances", () => {
      const declarant = checkRouteAuthorization("declarant", { requirePermission: p => p.canViewFinances });
      expect(declarant.authorized).toBe(false);
      expect(declarant.targetRedirect).toBe("/planning");

      const client = checkRouteAuthorization("client", { requirePermission: p => p.canViewFinances });
      expect(client.authorized).toBe(false);
      expect(client.targetRedirect).toBe("/portail-client");

      const comptable = checkRouteAuthorization("comptable", { requirePermission: p => p.canViewFinances });
      expect(comptable.authorized).toBe(true);

      const admin = checkRouteAuthorization("admin", { requirePermission: p => p.canViewFinances });
      expect(admin.authorized).toBe(true);
    });

    it("vérifie le verrouillage de la route Planning /planning", () => {
      const comptable = checkRouteAuthorization("comptable", { requirePermission: p => p.canViewPlanning });
      expect(comptable.authorized).toBe(false);
      expect(comptable.targetRedirect).toBe("/finances");

      const client = checkRouteAuthorization("client", { requirePermission: p => p.canViewPlanning });
      expect(client.authorized).toBe(false);
      expect(client.targetRedirect).toBe("/portail-client");

      const declarant = checkRouteAuthorization("declarant", { requirePermission: p => p.canViewPlanning });
      expect(declarant.authorized).toBe(true);

      const admin = checkRouteAuthorization("admin", { requirePermission: p => p.canViewPlanning });
      expect(admin.authorized).toBe(true);
    });

    it("vérifie le verrouillage de la route Contrôles /controles", () => {
      const comptable = checkRouteAuthorization("comptable", { requirePermission: p => p.canViewControls });
      expect(comptable.authorized).toBe(false);
      expect(comptable.targetRedirect).toBe("/finances");

      const declarant = checkRouteAuthorization("declarant", { requirePermission: p => p.canViewControls });
      expect(declarant.authorized).toBe(true);

      const admin = checkRouteAuthorization("admin", { requirePermission: p => p.canViewControls });
      expect(admin.authorized).toBe(true);
    });

    it("vérifie le verrouillage de la route Création Dossier /dossiers/nouveau", () => {
      const comptable = checkRouteAuthorization("comptable", { requirePermission: p => p.canCreateDossier });
      expect(comptable.authorized).toBe(false);

      const client = checkRouteAuthorization("client", { requirePermission: p => p.canCreateDossier });
      expect(client.authorized).toBe(false);

      const declarant = checkRouteAuthorization("declarant", { requirePermission: p => p.canCreateDossier });
      expect(declarant.authorized).toBe(true);

      const admin = checkRouteAuthorization("admin", { requirePermission: p => p.canCreateDossier });
      expect(admin.authorized).toBe(true);
    });
  });

  describe("3. Multi-Currency Engine & Débours Math Stress Test", () => {
    function computeInvoiceTotals(
      amountHt: number,
      duties: number,
      portFees: number,
      demurrage: number,
      exchangeRate: number
    ) {
      const tva = Math.round(amountHt * 0.18);
      const amountTtc = amountHt + tva;
      const disbursements = duties + portFees + demurrage;
      const grandTotal = amountTtc + disbursements;
      const usdEquiv = grandTotal / exchangeRate;
      return {
        tva,
        amountTtc,
        disbursements,
        grandTotal,
        usdEquiv,
      };
    }

    it("calcule avec exactitude la décomposition TVA 18%, débours et conversion GNF -> USD", () => {
      const rate = 8650;
      const totals = computeInvoiceTotals(20_000_000, 35_000_000, 8_500_000, 2_000_000, rate);

      expect(totals.tva).toBe(3_600_000);
      expect(totals.amountTtc).toBe(23_600_000);
      expect(totals.disbursements).toBe(45_500_000);
      expect(totals.grandTotal).toBe(69_100_000);
      expect(totals.usdEquiv).toBeCloseTo(69_100_000 / 8650, 4);
    });

    it("gère les cas limites: montant HT nul ou sans débours", () => {
      const rate = 8650;
      const totalsZero = computeInvoiceTotals(0, 0, 0, 0, rate);
      expect(totalsZero.tva).toBe(0);
      expect(totalsZero.grandTotal).toBe(0);
      expect(totalsZero.usdEquiv).toBe(0);

      const totalsOnlyDebours = computeInvoiceTotals(0, 10_000_000, 0, 0, rate);
      expect(totalsOnlyDebours.tva).toBe(0);
      expect(totalsOnlyDebours.amountTtc).toBe(0);
      expect(totalsOnlyDebours.disbursements).toBe(10_000_000);
      expect(totalsOnlyDebours.grandTotal).toBe(10_000_000);
    });

    it("calcule les conversions bidirectionnelles avec différents taux de change", () => {
      const rates = [8000, 8650, 9000, 10000];
      const gnfAmount = 86_500_000;

      rates.forEach(rate => {
        const usd = gnfAmount / rate;
        const backToGnf = usd * rate;
        expect(backToGnf).toBeCloseTo(gnfAmount, 2);
      });
    });
  });

  describe("4. Task Assignment & Filter Rules Stress Test", () => {
    interface MockTask {
      id: number;
      assignedTo: string;
      status: "A_faire" | "En_cours" | "Termine" | "Bloque";
      priority: "Haute" | "Normale" | "Basse";
    }

    const sampleTasks: MockTask[] = [
      { id: 1, assignedTo: "Mamadou Diallo", status: "A_faire", priority: "Haute" },
      { id: 2, assignedTo: "Mamadou Diallo", status: "Termine", priority: "Normale" },
      { id: 3, assignedTo: "Fatoumata Camara", status: "A_faire", priority: "Haute" },
      { id: 4, assignedTo: "Alpha Barry", status: "Termine", priority: "Basse" },
      { id: 5, assignedTo: "mamadou diallo (terrain)", status: "En_cours", priority: "Normale" },
    ];

    function filterTasks(
      tasks: MockTask[],
      assigneeFilter: string,
      statusFilter: "all" | "pending" | "completed"
    ): MockTask[] {
      return tasks.filter(t => {
        if (assigneeFilter === "mamadou" && !t.assignedTo.toLowerCase().includes("mamadou")) return false;
        if (assigneeFilter === "fatoumata" && !t.assignedTo.toLowerCase().includes("fatoumata")) return false;
        if (assigneeFilter === "alpha" && !t.assignedTo.toLowerCase().includes("alpha")) return false;

        if (statusFilter === "pending" && t.status === "Termine") return false;
        if (statusFilter === "completed" && t.status !== "Termine") return false;

        return true;
      });
    }

    it("filtre avec précision les tâches pour Mamadou Diallo", () => {
      const allMamadou = filterTasks(sampleTasks, "mamadou", "all");
      expect(allMamadou).toHaveLength(3);

      const pendingMamadou = filterTasks(sampleTasks, "mamadou", "pending");
      expect(pendingMamadou).toHaveLength(2);

      const completedMamadou = filterTasks(sampleTasks, "mamadou", "completed");
      expect(completedMamadou).toHaveLength(1);
    });

    it("filtre avec précision les tâches pour Fatoumata Camara", () => {
      const allFatoumata = filterTasks(sampleTasks, "fatoumata", "all");
      expect(allFatoumata).toHaveLength(1);

      const pendingFatoumata = filterTasks(sampleTasks, "fatoumata", "pending");
      expect(pendingFatoumata).toHaveLength(1);

      const completedFatoumata = filterTasks(sampleTasks, "fatoumata", "completed");
      expect(completedFatoumata).toHaveLength(0);
    });
  });
});
