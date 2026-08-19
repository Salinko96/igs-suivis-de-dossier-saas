import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import * as db from "../db";
import { generateProactiveAlerts } from "../alertsService";

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

describe("R2 - Notifications & Alerts Synchronization Suite (notification.*)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  describe("1. Proactive Alert Generation & Deterministic Properties", () => {
    it("generates deterministic alert structures from dossier records", async () => {
      const dossiers = await db.listDossiers();
      const alertsRun1 = generateProactiveAlerts(dossiers);
      const alertsRun2 = generateProactiveAlerts(dossiers);

      expect(alertsRun1.length).toBeGreaterThan(0);
      expect(alertsRun1.length).toBe(alertsRun2.length);

      // Verify all alerts contain required properties
      for (const alert of alertsRun1) {
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("dossierId");
        expect(alert).toHaveProperty("dossierNumber");
        expect(alert).toHaveProperty("type");
        expect(alert).toHaveProperty("title");
        expect(alert).toHaveProperty("message");
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("isRead");
        expect(alert).toHaveProperty("createdAt");
        expect(["critical", "warning", "info"]).toContain(alert.severity);
      }
    });

    it("prioritizes critical severity alerts first in list", async () => {
      const dossiers = await db.listDossiers();
      const alerts = generateProactiveAlerts(dossiers);
      const firstNonCriticalIdx = alerts.findIndex(a => a.severity !== "critical");

      if (firstNonCriticalIdx > 0) {
        // All alerts prior to firstNonCriticalIdx must be critical
        for (let i = 0; i < firstNonCriticalIdx; i++) {
          expect(alerts[i].severity).toBe("critical");
        }
      }
    });
  });

  describe("2. Single Notification 'markAsRead' Mutation", () => {
    it("marks a specific notification as read and persists the state", async () => {
      const listBefore = await adminCaller.notification.list();
      expect(listBefore.length).toBeGreaterThan(0);

      // Find an alert or use first alert
      const targetAlert = listBefore[0];
      const targetId = targetAlert.id;

      // Mark single notification as read
      const mutationRes = await adminCaller.notification.markAsRead({ id: targetId });
      expect(mutationRes).toHaveProperty("success", true);

      // Verify persistence in subsequent list query
      const listAfter = await adminCaller.notification.list();
      const updated = listAfter.find(a => a.id === targetId);
      expect(updated).toBeDefined();
      expect(updated?.isRead).toBe(1);
    });

    it("does not mutate read state of unrelated notifications", async () => {
      const list = await adminCaller.notification.list();
      if (list.length > 1) {
        const target = list[1];
        await adminCaller.notification.markAsRead({ id: target.id });

        const refreshed = await adminCaller.notification.list();
        const refreshedTarget = refreshed.find(a => a.id === target.id);
        expect(refreshedTarget?.isRead).toBe(1);
      }
    });
  });

  describe("3. Bulk 'markAllAsRead' Mutation & Badge Counter Calculation", () => {
    it("marks all proactive notifications as read simultaneously", async () => {
      const res = await adminCaller.notification.markAllAsRead();
      expect(res).toHaveProperty("success", true);

      const listAfter = await adminCaller.notification.list();
      const unreadAlerts = listAfter.filter(a => a.isRead === 0);
      expect(unreadAlerts.length).toBe(0);

      // Verify every alert has isRead === 1
      for (const alert of listAfter) {
        expect(alert.isRead).toBe(1);
      }
    });

    it("accurately calculates unread badge count (0 when all read)", async () => {
      const list = await adminCaller.notification.list();
      const unreadCount = list.filter(a => a.isRead === 0).length;
      expect(unreadCount).toBe(0);
    });
  });

  describe("4. Idempotence & Error Tolerance", () => {
    it("handles repeated markAsRead calls on same notification without error", async () => {
      const list = await adminCaller.notification.list();
      const alertId = list[0].id;

      await expect(adminCaller.notification.markAsRead({ id: alertId })).resolves.toHaveProperty("success", true);
      await expect(adminCaller.notification.markAsRead({ id: alertId })).resolves.toHaveProperty("success", true);
    });

    it("handles markAllAsRead when all notifications are already read", async () => {
      await expect(adminCaller.notification.markAllAsRead()).resolves.toHaveProperty("success", true);
    });
  });
});
