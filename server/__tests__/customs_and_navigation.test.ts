import { describe, expect, it } from "vitest";
import { calculateDossierState, formatDossierNumber } from "../dossierRules";
import { generateProactiveAlerts } from "../alertsService";
import type { Dossier } from "../../drizzle/schema";

export interface BreadcrumbCrumb {
  label: string;
  path: string;
}

export function buildBreadcrumbs(pathname: string, dossierNumber?: string): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [{ label: "Accueil", path: "/" }];

  if (pathname === "/" || pathname === "") {
    return crumbs;
  }

  if (pathname.startsWith("/dossiers")) {
    crumbs.push({ label: "Tous les Dossiers", path: "/dossiers" });
    if (pathname !== "/dossiers") {
      const label = dossierNumber ? `Fiche ${dossierNumber}` : "Détail Dossier";
      crumbs.push({ label, path: pathname });
    }
    return crumbs;
  }

  if (pathname.startsWith("/controles")) {
    crumbs.push({ label: "Contrôles Douane & PAC", path: "/controles" });
    return crumbs;
  }

  if (pathname.startsWith("/planning")) {
    crumbs.push({ label: "Planning & Échéances", path: "/planning" });
    return crumbs;
  }

  if (pathname.startsWith("/finances")) {
    crumbs.push({ label: "Finances & Facturation", path: "/finances" });
    return crumbs;
  }

  if (pathname.startsWith("/portail-client")) {
    crumbs.push({ label: "Portail Client Externe", path: "/portail-client" });
    return crumbs;
  }

  crumbs.push({ label: pathname.replace("/", ""), path: pathname });
  return crumbs;
}

export function getQuickBackTarget(pathname: string): string {
  if (pathname.startsWith("/dossiers/") && pathname !== "/dossiers") {
    return "/dossiers";
  }
  return "/";
}

describe("R3 & R5 - Customs Anomaly Detection & Navigation Suite", () => {
  describe("1. Customs State Calculation & Anomaly Detection", () => {
    it("classifies complete dossier with full customs details as 'Régularisé'", () => {
      const state = calculateDossierState({
        clientDossierNumber: "CKYSI26000340",
        client: "Guinean Birimian Gold S.A",
        blLtaNumber: "HLCUNG12604AUQG1",
        cargoNature: "Cyanure",
        transportMode: "Maritime",
        eta: new Date("2026-07-31"),
        originPort: "Ningbo port-china",
        destinationPort: "Conakry",
        container: "04TC20'",
        bulk: null,
        goodsReleaseDate: new Date("2026-08-05"),
        declarationNumber: "S 142- 27/07/2026",
        bulletinNumber: "L 1774 Du 28/07/2026",
      });

      expect(state.calculatedStatus).toBe("Régularisé");
      expect(state.calculatedPriority).toBe("Basse");
      expect(state.completionRate).toBe(100);
      expect(state.missingFields).toHaveLength(0);
    });

    it("classifies dossier missing Sydonia declaration as 'À régulariser' with high priority", () => {
      const state = calculateDossierState({
        clientDossierNumber: "CKYSI26000340",
        client: "Guinean Birimian Gold S.A",
        blLtaNumber: "HLCUNG12604AUQG1",
        cargoNature: "Cyanure",
        transportMode: "Maritime",
        eta: new Date("2026-07-31"),
        originPort: "Ningbo port-china",
        destinationPort: "Conakry",
        container: "04TC20'",
        goodsReleaseDate: null,
        declarationNumber: null, // Manquant
        bulletinNumber: null,    // Manquant
      });

      expect(state.calculatedStatus).toBe("À régulariser");
      expect(state.calculatedPriority).toBe("Haute");
      expect(state.completionRate).toBeLessThan(100);
      expect(state.missingFields).toContain("declarationNumber");
      expect(state.missingFields).toContain("bulletinNumber");
      expect(state.missingFields).toContain("goodsReleaseDate");
    });

    it("flags missing container or bulk packaging as an incomplete field", () => {
      const state = calculateDossierState({
        clientDossierNumber: "CKYSI26000340",
        client: "Guinean Birimian Gold S.A",
        blLtaNumber: "HLCUNG12604AUQG1",
        cargoNature: "Cyanure",
        transportMode: "Maritime",
        eta: new Date("2026-07-31"),
        originPort: "Ningbo port-china",
        destinationPort: "Conakry",
        container: null, // Pas de conteneur
        bulk: null,      // Pas de vrac
        goodsReleaseDate: new Date("2026-08-05"),
        declarationNumber: "S 142- 27/07/2026",
        bulletinNumber: "L 1774 Du 28/07/2026",
      });

      expect(state.calculatedStatus).toBe("À régulariser");
      expect(state.missingFields).toContain("container");
    });

    it("formats dossier sequence numbers accurately", () => {
      expect(formatDossierNumber(1)).toBe("DOS-0001");
      expect(formatDossierNumber(9)).toBe("DOS-0009");
      expect(formatDossierNumber(54)).toBe("DOS-0054");
      expect(formatDossierNumber(100)).toBe("DOS-0100");
    });

    it("detects Port of Conakry demurrage risk when ETA is past by > 7 days without release", () => {
      const mockDossier: Dossier = {
        id: 99,
        dossierNumber: "DOS-0099",
        clientDossierNumber: "TEST-01",
        client: "Mining Corp",
        blLtaNumber: "BL-9999",
        cargoNature: "Equipement",
        transportMode: "Maritime",
        eta: new Date(Date.now() - 15 * 86_400_000), // 15 jours en arrière
        originPort: "Anvers",
        destinationPort: "Conakry",
        container: "02TC40'",
        bulk: null,
        goodsReleaseDate: null,
        declarationNumber: null,
        bulletinNumber: null,
        finalDeclarationNumber: null,
        ddiGucegNumber: null,
        badStatus: "En attente",
        baeStatus: "En attente",
        calculatedStatus: "À régulariser",
        calculatedPriority: "Haute",
        completionRate: 50,
        documentStatus: null,
        customsStatus: null,
        portStatus: null,
        financialStatus: null,
        fieldOperation: null,
        responsible: "Mamadou Diallo",
        nextAction: null,
        fieldAlert: null,
        deliveryLocation: null,
        declarant: "Mamadou Diallo",
        service: "Transit",
        regime: "IM4",
        notes: null,
        portalAccessCode: "IGS-1099",
        createdById: 1,
        updatedById: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alerts = generateProactiveAlerts([mockDossier]);
      const surestariesAlert = alerts.find(a => a.type === "SURESTARIES_RISQUE");
      expect(surestariesAlert).toBeDefined();
      expect(surestariesAlert?.severity).toBe("critical");
      expect(surestariesAlert?.message).toContain("franchise 7j dépassée");
    });
  });

  describe("2. Navigation & Breadcrumb Hierarchy (R5)", () => {
    it("generates correct breadcrumb chain for root dashboard", () => {
      const crumbs = buildBreadcrumbs("/");
      expect(crumbs).toEqual([{ label: "Accueil", path: "/" }]);
    });

    it("generates correct breadcrumb chain for dossiers list", () => {
      const crumbs = buildBreadcrumbs("/dossiers");
      expect(crumbs).toEqual([
        { label: "Accueil", path: "/" },
        { label: "Tous les Dossiers", path: "/dossiers" },
      ]);
    });

    it("generates contextual breadcrumb chain for dossier detail page", () => {
      const crumbs = buildBreadcrumbs("/dossiers/DOS-0054", "DOS-0054");
      expect(crumbs).toEqual([
        { label: "Accueil", path: "/" },
        { label: "Tous les Dossiers", path: "/dossiers" },
        { label: "Fiche DOS-0054", path: "/dossiers/DOS-0054" },
      ]);
    });

    it("generates correct breadcrumb for operational and customs controls page", () => {
      const crumbs = buildBreadcrumbs("/controles");
      expect(crumbs).toEqual([
        { label: "Accueil", path: "/" },
        { label: "Contrôles Douane & PAC", path: "/controles" },
      ]);
    });

    it("generates correct breadcrumb for planning and finances", () => {
      const planningCrumbs = buildBreadcrumbs("/planning");
      expect(planningCrumbs).toEqual([
        { label: "Accueil", path: "/" },
        { label: "Planning & Échéances", path: "/planning" },
      ]);

      const financesCrumbs = buildBreadcrumbs("/finances");
      expect(financesCrumbs).toEqual([
        { label: "Accueil", path: "/" },
        { label: "Finances & Facturation", path: "/finances" },
      ]);
    });

    it("resolves quick back target to parent list when on detail page", () => {
      expect(getQuickBackTarget("/dossiers/1")).toBe("/dossiers");
      expect(getQuickBackTarget("/dossiers/DOS-0054")).toBe("/dossiers");
      expect(getQuickBackTarget("/dossiers")).toBe("/");
      expect(getQuickBackTarget("/controles")).toBe("/");
    });
  });
});
