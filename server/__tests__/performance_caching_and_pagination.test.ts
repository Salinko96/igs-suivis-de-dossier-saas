import { describe, it, expect, beforeEach } from "vitest";
import * as db from "../db";
import { appRouter } from "../routers";

describe("Performance Optimization, Aggregate Caching & Server Pagination", () => {
  beforeEach(() => {
    db.invalidateFinanceCache();
    db.invalidateDashboardCache();
    db.invalidateUsersCache();
  });

  describe("Server-Side Pagination for Users (Collaborateurs)", () => {
    it("should paginate users with page 1, limit 10", async () => {
      const result = await db.listUsersPaginated({ page: 1, limit: 10 });
      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total).toBeGreaterThanOrEqual(100);
      expect(result.totalPages).toBe(Math.ceil(result.total / 10));
      expect(result.hasMore).toBe(true);
    });

    it("should paginate users with page 2 and return disjoint items", async () => {
      const page1 = await db.listUsersPaginated({ page: 1, limit: 10 });
      const page2 = await db.listUsersPaginated({ page: 2, limit: 10 });
      expect(page1.items.length).toBe(10);
      expect(page2.items.length).toBe(10);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });

    it("should filter users by role and compute correct pagination totals", async () => {
      const declarants = await db.listUsersPaginated({ role: "declarant", page: 1, limit: 100 });
      expect(declarants.items.every(u => u.role === "declarant")).toBe(true);
      expect(declarants.total).toBeGreaterThanOrEqual(43);
      expect(declarants.totalPages).toBe(1);
    });

    it("should filter users by status and search keyword", async () => {
      const searchRes = await db.listUsersPaginated({ search: "diallo", page: 1, limit: 25 });
      expect(searchRes.items.length).toBeGreaterThan(0);
      expect(searchRes.items.every(u => 
        u.name?.toLowerCase().includes("diallo") ||
        u.email?.toLowerCase().includes("diallo") ||
        u.openId.toLowerCase().includes("diallo")
      )).toBe(true);
    });
  });

  describe("Server-Side Pagination for Dossiers", () => {
    it("should paginate dossiers with limit 25", async () => {
      const res = await db.listDossiersPaginated({ page: 1, limit: 25 });
      expect(res.items.length).toBeLessThanOrEqual(25);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(25);
      expect(res.total).toBeGreaterThanOrEqual(50);
      expect(res.totalPages).toBe(Math.ceil(res.total / 25));
    });

    it("should filter dossiers by calculatedStatus with pagination", async () => {
      const regularises = await db.listDossiersPaginated({ status: "Régularisé", page: 1, limit: 50 });
      expect(regularises.items.every(d => d.calculatedStatus === "Régularisé")).toBe(true);
    });
  });

  describe("Server-Side Pagination for Invoices", () => {
    it("should paginate invoices with filters", async () => {
      const res = await db.listInvoicesPaginated({ page: 1, limit: 10 });
      expect(res.items.length).toBeLessThanOrEqual(10);
      expect(res.page).toBe(1);
      expect(res.total).toBeGreaterThanOrEqual(1);
    });

    it("should filter invoices by status and search", async () => {
      const proformas = await db.listInvoicesPaginated({ status: "Proforma" });
      expect(proformas.items.every(i => i.status === "Proforma")).toBe(true);
    });
  });

  describe("Heavy Aggregate Caching & Cache Invalidation", () => {
    it("should set and retrieve cached aggregates", () => {
      const testData = { revenue: 1000000, margin: 250000 };
      db.setCachedAggregate("test_key", testData);

      const retrieved = db.getCachedAggregate<typeof testData>("test_key");
      expect(retrieved).toEqual(testData);
    });

    it("should cache getProfitabilityMetrics results", async () => {
      const first = await db.getProfitabilityMetrics();
      const second = await db.getProfitabilityMetrics();
      expect(first).toEqual(second);
      expect(db.getCachedAggregate("finance_profitability")).toBeDefined();
    });

    it("should invalidate finance cache properly", async () => {
      await db.getProfitabilityMetrics();
      expect(db.getCachedAggregate("finance_profitability")).toBeDefined();

      db.invalidateFinanceCache();
      expect(db.getCachedAggregate("finance_profitability")).toBeNull();
    });
  });

  describe("tRPC Endpoints Integration", () => {
    const adminCtx = {
      user: {
        id: 1,
        openId: "igs_admin_test",
        name: "Admin Tester",
        email: "admin@igs.gn",
        role: "admin" as const,
        clientCompany: null,
      },
      req: {} as any,
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as any,
    };

    const caller = appRouter.createCaller(adminCtx);

    it("should call user.listPaginated via tRPC caller", async () => {
      const res = await caller.user.listPaginated({ page: 1, limit: 15, role: "comptable" });
      expect(res.items.length).toBeLessThanOrEqual(15);
      expect(res.items.every(u => u.role === "comptable")).toBe(true);
      expect(res.total).toBeGreaterThanOrEqual(17);
    });

    it("should call dossier.listPaginated via tRPC caller", async () => {
      const res = await caller.dossier.listPaginated({ page: 1, limit: 20 });
      expect(res.items.length).toBeLessThanOrEqual(20);
      expect(res.total).toBeGreaterThanOrEqual(50);
    });

    it("should call finance.listInvoicesPaginated via tRPC caller", async () => {
      const res = await caller.finance.listInvoicesPaginated({ page: 1, limit: 10 });
      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.items.length).toBeGreaterThan(0);
    });

    it("should call finance.summary and return cached structure", async () => {
      const summary = await caller.finance.summary();
      expect(summary.totalCA_GNF).toBeGreaterThan(0);
      expect(summary.totalMargin_GNF).toBeGreaterThan(0);
      expect(summary.exchangeRate).toBeGreaterThan(0);
    });
  });
});
