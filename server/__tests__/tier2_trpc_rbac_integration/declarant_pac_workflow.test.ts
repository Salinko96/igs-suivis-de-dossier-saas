import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";

function createDeclarantContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 2,
      openId: "declarant_conakry",
      name: "Mamadou Diallo",
      email: "declarant@igs-logistics.gn",
      role: "declarant",
      loginMethod: "direct",
      clientCompany: null,
      phone: "+224 621 11 22 33",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Tier 2 - tRPC Server RBAC & Integration: Déclarant PAC Workflow (R2)", () => {
  const ctx = createDeclarantContext();
  const caller = appRouter.createCaller(ctx);

  describe("1. Gestion Interactive des Tâches Opérationnelles & Persistance", () => {
    it("permet au déclarant de lister les tâches assignées", async () => {
      const tasks = await caller.task.list();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);

      const mamadouTasks = tasks.filter(t => t.assignedTo?.includes("Mamadou Diallo"));
      expect(mamadouTasks.length).toBeGreaterThan(0);
    });

    it("permet au déclarant de créer une nouvelle tâche prioritaire sur un dossier", async () => {
      const newTask = await caller.task.create({
        dossierId: 1,
        title: "Inspection conteneur sous scanner PAC",
        assignedTo: "Mamadou Diallo",
        priority: "Haute",
      });

      expect(newTask).toBeDefined();
      expect(newTask.title).toBe("Inspection conteneur sous scanner PAC");
      expect(newTask.assignedTo).toBe("Mamadou Diallo");
      expect(newTask.status).toBe("A_faire");
      expect(newTask.completedAt).toBeNull();
    });

    it("persiste le basculement d'état d'une tâche (A_faire -> Termine) avec timestamp completedAt", async () => {
      const tasks = await caller.task.list();
      const targetTask = tasks[0];
      expect(targetTask).toBeDefined();

      // Coche la tâche comme terminée
      const updated = await caller.task.updateStatus({
        id: targetTask.id,
        status: "Termine",
      });

      expect(updated.status).toBe("Termine");
      expect(updated.completedAt).not.toBeNull();
      expect(new Date(updated.completedAt!).getTime()).toBeLessThanOrEqual(Date.now());

      // Vérifie la persistance lors d'une re-lecture
      const reloadedTasks = await caller.task.list();
      const reloadedTask = reloadedTasks.find(t => t.id === targetTask.id);
      expect(reloadedTask?.status).toBe("Termine");
      expect(reloadedTask?.completedAt).not.toBeNull();
    });

    it("permet de décocher une tâche terminée vers l'état A_faire", async () => {
      const tasks = await caller.task.list();
      const targetTask = tasks.find(t => t.status === "Termine");
      if (targetTask) {
        const unchecked = await caller.task.updateStatus({
          id: targetTask.id,
          status: "A_faire",
        });
        expect(unchecked.status).toBe("A_faire");
        expect(unchecked.completedAt).toBeNull();
      }
    });
  });

  describe("2. Édition des Identifiants Douaniers & Recalcul de Statut (R2)", () => {
    it("permet au déclarant de renseigner les numéros SYDONIA, BLD et BAE sur un dossier", async () => {
      // Met à jour le dossier 2
      const updatedDossier = await caller.dossier.update({
        id: 2,
        data: {
          declarationNumber: "S 142- 2026",
          bulletinNumber: "L 1723- 2026",
          customsStatus: "BAE accordé",
          goodsReleaseDate: new Date("2026-08-18"),
        },
      });

      expect(updatedDossier.declarationNumber).toBe("S 142- 2026");
      expect(updatedDossier.bulletinNumber).toBe("L 1723- 2026");
      expect(updatedDossier.customsStatus).toBe("BAE accordé");

      // Vérifie que l'audit trail enregistre la modification
      const history = await caller.audit.list({ dossierId: 2 });
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(h => h.authorName?.includes("Mamadou Diallo") || h.authorName?.includes("Opérateur"))).toBe(true);
    });
  });

  describe("3. Bouclier Administratif & Sécurité (RBAC Protection)", () => {
    it("interdit au déclarant de supprimer un dossier (réservé admin - 403 Forbidden)", async () => {
      await expect(caller.dossier.remove({ id: 1 })).rejects.toThrow(/permission|forbidden/i);
    });

    it("interdit au déclarant de créer un référentiel global (réservé admin - 403 Forbidden)", async () => {
      await expect(
        caller.reference.create({ category: "port_destination", label: "Port de Kamsar Minéralier" })
      ).rejects.toThrow(/permission|forbidden/i);
    });
  });
});
