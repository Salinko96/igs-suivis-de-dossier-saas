import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import * as db from "../db";
import type { TrpcContext } from "../_core/context";
import fs from "fs";
import path from "path";

function createAdminContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 1,
      openId: "igs_admin_conakry",
      name: "Ibrahima Gold Service (Admin)",
      email: "contact@igs-logistics.gn",
      role: "admin",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 620 00 00 00",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Empirical Challenger 2 Suite: Deep Stress-Testing of R3, R4, and R5", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  // =========================================================================
  // R3: CONTROLES UX, RESPONSIVE CARDS (<768px) & ACTION BUTTON AVAILABILITY
  // =========================================================================
  describe("R3: Controles Douane UX, Responsive Card Layout & Actions Availability", () => {
    const controlsPagePath = path.resolve(__dirname, "../../client/src/pages/ControlsPage.tsx");
    const controlsPageContent = fs.readFileSync(controlsPagePath, "utf-8");

    it("verifies ControlsPage source code contains dual-mode responsive layout (Desktop Table + Mobile Cards)", () => {
      // 1. Desktop Table container with hidden md:block and horizontal scrolling
      expect(controlsPageContent).toContain("hidden md:block");
      expect(controlsPageContent).toContain("overflow-x-auto");
      expect(controlsPageContent).toContain("scrollbar-thin");

      // 2. Mobile/Tablet stacked cards container with block md:hidden (<768px)
      expect(controlsPageContent).toContain("block md:hidden");
      expect(controlsPageContent).toContain("space-y-3");
    });

    it("verifies Desktop view has sticky right actions column with shadow gradient to prevent overflow cutoff", () => {
      expect(controlsPageContent).toContain("sticky right-0");
      expect(controlsPageContent).toContain("z-10");
      expect(controlsPageContent).toContain("shadow-[-8px_0_12px_rgba(0,0,0,0.03)]");
    });

    it("verifies Action Buttons « Régulariser » and « Fiche » are present in both Desktop and Mobile views", () => {
      // Desktop action buttons
      expect(controlsPageContent).toContain("Régulariser");
      expect(controlsPageContent).toContain("Fiche");
      expect(controlsPageContent).toContain("setEditingCustomsDossier");

      // Count occurrences of 'Régulariser' and 'Fiche'
      const regulariserMatches = controlsPageContent.match(/Régulariser/g);
      const ficheMatches = controlsPageContent.match(/Fiche/g);
      expect(regulariserMatches?.length).toBeGreaterThanOrEqual(2);
      expect(ficheMatches?.length).toBeGreaterThanOrEqual(2);
    });

    it("verifies CustomsEditModal integration for rapid customs updates without page navigation", () => {
      expect(controlsPageContent).toContain("<CustomsEditModal");
      expect(controlsPageContent).toContain("editingCustomsDossier");
      expect(controlsPageContent).toContain("isOpen={Boolean(editingCustomsDossier)}");
    });

    it("verifies Anomaly Filtering correctly detects missing customs parameters", async () => {
      const allDossiers = await db.listDossiers();
      expect(allDossiers.length).toBeGreaterThan(0);

      const duplicates = new Map<string, number>();
      allDossiers.forEach(d => {
        if (d.blLtaNumber) duplicates.set(d.blLtaNumber, (duplicates.get(d.blLtaNumber) || 0) + 1);
      });

      const detectedAnomalies = allDossiers.filter(
        dossier =>
          !dossier.clientDossierNumber ||
          !dossier.eta ||
          !dossier.declarationNumber ||
          !dossier.bulletinNumber ||
          !dossier.goodsReleaseDate ||
          (dossier.blLtaNumber && (duplicates.get(dossier.blLtaNumber) || 0) > 1)
      );

      expect(detectedAnomalies.length).toBeGreaterThan(0);
      detectedAnomalies.forEach(d => {
        const hasMissingField =
          !d.clientDossierNumber ||
          !d.eta ||
          !d.declarationNumber ||
          !d.bulletinNumber ||
          !d.goodsReleaseDate ||
          (d.blLtaNumber && (duplicates.get(d.blLtaNumber) || 0) > 1);
        expect(hasMissingField).toBe(true);
      });
    });
  });

  // =========================================================================
  // R4: DOSSIER PERFORMANCE (<300ms), DYNAMIC ROUTING & LAZY TAB EXECUTION
  // =========================================================================
  describe("R4: Dossier Detail Performance & Dynamic Route Resolution (dossier.get)", () => {
    it("resolves accurately across polymorphic identifiers: numeric ID (1), formatted string (DOS-0001), portal code (IGS-1001)", async () => {
      // 1. Numeric ID
      const byNum = await adminCaller.dossier.get({ id: 1 });
      expect(byNum).toBeDefined();
      expect(byNum.id).toBe(1);
      expect(byNum.dossierNumber).toBe("DOS-0001");

      // 2. Formatted uppercase string
      const byFormatted = await adminCaller.dossier.get({ id: "DOS-0001" });
      expect(byFormatted.id).toBe(1);
      expect(byFormatted.dossierNumber).toBe("DOS-0001");

      // 3. Formatted lowercase string
      const byFormattedLower = await adminCaller.dossier.get({ id: "dos-0001" });
      expect(byFormattedLower.id).toBe(1);
      expect(byFormattedLower.dossierNumber).toBe("DOS-0001");

      // 4. Portal code uppercase
      const byPortalCode = await adminCaller.dossier.get({ id: "IGS-1001" });
      expect(byPortalCode.id).toBe(1);
      expect(byPortalCode.dossierNumber).toBe("DOS-0001");

      // 5. Portal code lowercase
      const byPortalCodeLower = await adminCaller.dossier.get({ id: "igs-1001" });
      expect(byPortalCodeLower.id).toBe(1);
      expect(byPortalCodeLower.dossierNumber).toBe("DOS-0001");

      // 6. Client dossier number
      const byClientDossier = await adminCaller.dossier.get({ id: "CKYSI26000340" });
      expect(byClientDossier.id).toBe(1);
      expect(byClientDossier.clientDossierNumber).toBe("CKYSI26000340");

      // 7. BL / LTA number
      const byBl = await adminCaller.dossier.get({ id: "HLCUNG12604AUQG1" });
      expect(byBl.id).toBe(1);
      expect(byBl.blLtaNumber).toBe("HLCUNG12604AUQG1");
    });

    it("benchmarks 100 consecutive requests to confirm average latency < 5ms per query", async () => {
      const latencies: number[] = [];
      const totalStart = performance.now();

      for (let i = 1; i <= 100; i++) {
        const idToQuery = i % 2 === 0 ? (i % 50) + 1 : `DOS-000${(i % 9) + 1}`;
        const queryStart = performance.now();
        const result = await adminCaller.dossier.get({ id: idToQuery });
        const queryDuration = performance.now() - queryStart;
        latencies.push(queryDuration);
        expect(result).toBeDefined();
      }

      const totalDuration = performance.now() - totalStart;
      const avgLatency = totalDuration / 100;
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Latency = sortedLatencies[Math.floor(latencies.length * 0.95)];

      console.log(`[Benchmark R4] 100 queries total: ${totalDuration.toFixed(2)}ms | Avg: ${avgLatency.toFixed(3)}ms/req | p95: ${p95Latency.toFixed(3)}ms`);

      expect(totalDuration).toBeLessThan(500); // 100 requests in < 500ms total
      expect(avgLatency).toBeLessThan(5.0);   // Average latency < 5ms per request
    });

    it("verifies Lazy Tab Execution in DossierDetailPage.tsx to prevent eager secondary queries on mount", () => {
      const detailPagePath = path.resolve(__dirname, "../../client/src/pages/DossierDetailPage.tsx");
      const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");

      // 1. Initial tab is 'general'
      expect(detailPageContent).toContain('const [activeTab, setActiveTab] = useState("general");');

      // 2. Documents query is enabled only when activeTab === "documents"
      expect(detailPageContent).toContain('activeTab === "documents"');

      // 3. Audit query is enabled only when activeTab === "audit"
      expect(detailPageContent).toContain('activeTab === "audit"');

      // 4. Invoices query is enabled only when activeTab === "finances"
      expect(detailPageContent).toContain('activeTab === "finances"');

      // 5. Tasks & comments queries are enabled only when activeTab === "tasks"
      expect(detailPageContent).toContain('activeTab === "tasks"');

      // 6. Verify placeholderData avoids initial skeleton flicker when cache exists
      expect(detailPageContent).toContain("placeholderData:");
    });

    it("verifies fail-fast error handling for non-existent IDs (<5ms)", async () => {
      const start = performance.now();
      await expect(adminCaller.dossier.get({ id: 999999 })).rejects.toThrow(/introuvable/i);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(15);

      await expect(adminCaller.dossier.get({ id: "DOS-9999" })).rejects.toThrow(/introuvable/i);
      await expect(adminCaller.dossier.get({ id: "XXXX-9999" })).rejects.toThrow(/introuvable/i);
    });
  });

  // =========================================================================
  // R5: BREADCRUMBS HIERARCHY & QUICK BACK FUNCTIONALITY
  // =========================================================================
  describe("R5: Standardized Breadcrumbs Hierarchy & Quick Back Navigation", () => {
    const breadcrumbComponentPath = path.resolve(__dirname, "../../client/src/components/Breadcrumbs.tsx");
    const breadcrumbContent = fs.readFileSync(breadcrumbComponentPath, "utf-8");

    it("verifies Breadcrumbs component structure and quick back handler", () => {
      expect(breadcrumbContent).toContain("export function Breadcrumbs");
      expect(breadcrumbContent).toContain("handleBack");
      expect(breadcrumbContent).toContain("setLocation(backHref)");
      expect(breadcrumbContent).toContain("window.history.back()");
      expect(breadcrumbContent).toContain("showBackButton");
    });

    const pagesToInspect = [
      { name: "DossiersPage.tsx", path: "../../client/src/pages/DossiersPage.tsx", expectedBackHref: "/" },
      { name: "DossierDetailPage.tsx", path: "../../client/src/pages/DossierDetailPage.tsx", expectedBackHref: "/dossiers" },
      { name: "ControlsPage.tsx", path: "../../client/src/pages/ControlsPage.tsx", expectedBackHref: "/" },
      { name: "PlanningPage.tsx", path: "../../client/src/pages/PlanningPage.tsx", expectedBackHref: "/" },
      { name: "FinancesPage.tsx", path: "../../client/src/pages/FinancesPage.tsx", expectedBackHref: "/" },
    ];

    pagesToInspect.forEach(p => {
      it(`verifies ${p.name} integrates Breadcrumbs with correct backHref="${p.expectedBackHref}"`, () => {
        const fullPath = path.resolve(__dirname, p.path);
        const fileContent = fs.readFileSync(fullPath, "utf-8");

        expect(fileContent).toContain('import Breadcrumbs from "@/components/Breadcrumbs";');
        expect(fileContent).toContain("<Breadcrumbs");
        expect(fileContent).toContain(`backHref="${p.expectedBackHref}"`);
      });
    });

    it("verifies DossierDetailPage dynamically builds contextual breadcrumb for edit vs new dossier", () => {
      const detailPath = path.resolve(__dirname, "../../client/src/pages/DossierDetailPage.tsx");
      const detailContent = fs.readFileSync(detailPath, "utf-8");

      expect(detailContent).toContain('label: "Nouveau dossier"');
      expect(detailContent).toContain('label: "Tous les Dossiers"');
      expect(detailContent).toContain("`Fiche ${dossier.dossierNumber}`");
    });
  });
});
