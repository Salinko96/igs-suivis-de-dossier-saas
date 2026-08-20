import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";

function createAdminContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 1,
      openId: "admin_user_conakry",
      name: "Alpha Salinko Barry",
      email: "admin@igs-logistics.gn",
      role: "admin",
    } as any,
  };
}

describe("R - Users & RH KPI Cards Synchronization & Table Filtering Test Suite", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("1. Verifies that Effectif Total KPI matches exact count of users and active/inactive breakdown", async () => {
    const stats = await adminCaller.user.getHRStats();
    const users = await adminCaller.user.list();

    expect(stats.totalEmployees).toBe(users.length);
    expect(stats.totalEmployees).toBeGreaterThanOrEqual(100);

    const activeCount = users.filter((u) => u.isActive !== false).length;
    const inactiveCount = users.filter((u) => u.isActive === false).length;

    expect(stats.totalActive).toBe(activeCount);
    expect(stats.totalInactive).toBe(inactiveCount);
    expect(stats.totalActive + stats.totalInactive).toBe(stats.totalEmployees);
  });

  it("2. Verifies that Déclarants Quai PAC KPI matches table count when filtered by role=declarant", async () => {
    const stats = await adminCaller.user.getHRStats();
    const users = await adminCaller.user.list();

    const declarants = users.filter((u) => u.role === "declarant");
    const activeDeclarants = declarants.filter((u) => u.isActive !== false);

    expect(declarants.length).toBeGreaterThan(0);
    expect(activeDeclarants.length).toBe(stats.activeDeclarantsAtPort);
  });

  it("3. Verifies that Comptables & Finance KPI matches table count when filtered by role=comptable", async () => {
    const stats = await adminCaller.user.getHRStats();
    const users = await adminCaller.user.list();

    const comptables = users.filter((u) => u.role === "comptable");
    const activeComptables = comptables.filter((u) => u.isActive !== false);

    expect(comptables.length).toBeGreaterThan(0);
    expect(activeComptables.length).toBe(stats.activeComptables);
  });

  it("4. Verifies that Portails Clients KPI matches table count when filtered by role=client", async () => {
    const stats = await adminCaller.user.getHRStats();
    const users = await adminCaller.user.list();

    const clientPortals = users.filter((u) => u.role === "client");
    const activeClients = clientPortals.filter((u) => u.isActive !== false);

    expect(clientPortals.length).toBeGreaterThan(0);
    expect(activeClients.length).toBe(stats.connectedClients);
  });

  it("5. Verifies dynamic metric recalculation when a user role is changed or deactivated", async () => {
    const initialStats = await adminCaller.user.getHRStats();

    // Create a new declarant
    const created = await adminCaller.user.create({
      openId: `test_declarant_${Date.now()}`,
      name: "Test Declarant Conakry",
      email: `test.declarant.${Date.now()}@igs.gn`,
      phone: "+224 621 99 88 77",
      role: "declarant",
      clientCompany: null,
      isActive: true,
    });

    expect(created).toBeDefined();

    const updatedStats = await adminCaller.user.getHRStats();
    expect(updatedStats.totalEmployees).toBe(initialStats.totalEmployees + 1);
    expect(updatedStats.activeDeclarantsAtPort).toBe(initialStats.activeDeclarantsAtPort + 1);

    // Toggle status to inactive
    await adminCaller.user.toggleStatus({
      id: created.id,
      isActive: false,
    });

    const deactivatedStats = await adminCaller.user.getHRStats();
    expect(deactivatedStats.activeDeclarantsAtPort).toBe(initialStats.activeDeclarantsAtPort);
    expect(deactivatedStats.totalInactive).toBe(initialStats.totalInactive + 1);
  });
});
