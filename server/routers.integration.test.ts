import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  getReferenceItems: vi.fn(),
  createDossier: vi.fn(),
  createDossiersBatch: vi.fn(),
  importDossiersBatch: vi.fn(),
  updateDossier: vi.fn(),
  deleteDossier: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const fixture = {
  id: 7,
  dossierNumber: "DOS-0007",
  clientDossierNumber: "CKY-7",
  client: "GBG",
  blLtaNumber: "BL-7",
  cargoNature: "Cyanure",
  transportMode: "Maritime",
  eta: new Date("2026-08-20T00:00:00Z"),
  originPort: "Ningbo",
  destinationPort: "Port Autonome de Conakry",
  container: "1 x 20'",
  bulk: null,
  goodsReleaseDate: null,
  declarationNumber: null,
  bulletinNumber: null,
  finalDeclarationNumber: null,
  calculatedStatus: "À régulariser" as const,
  calculatedPriority: "Haute" as const,
  completionRate: 75,
  documentStatus: null,
  customsStatus: null,
  portStatus: null,
  financialStatus: null,
  fieldOperation: null,
  responsible: null,
  nextAction: null,
  fieldAlert: null,
  deliveryLocation: null,
  declarant: null,
  service: null,
  regime: null,
  notes: null,
  createdById: 1,
  updatedById: 1,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
};

const context = {
  req: { headers: {} } as any,
  res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  user: {
    id: 1,
    openId: "integration-user",
    name: "Opérateur IGS",
    email: "operator@example.com",
    loginMethod: "direct",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
} as TrpcContext;

describe("intégration des procédures IGS Dossiers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.listDossiers).mockResolvedValue([fixture] as never);
    vi.mocked(db.getDossier).mockResolvedValue(fixture as never);
    vi.mocked(db.getReferenceItems).mockResolvedValue([
      { id: 1, category: "client", label: "GBG", sortOrder: 1, createdAt: new Date() },
      { id: 2, category: "port_destination", label: "Port Autonome de Conakry", sortOrder: 1, createdAt: new Date() },
    ] as never);
    vi.mocked(db.createDossier).mockResolvedValue({ ...fixture, id: 8, dossierNumber: "DOS-0008" } as never);
    vi.mocked(db.importDossiersBatch).mockResolvedValue({ total: 1, createdCount: 1, updatedCount: 0, duplicatesPrevented: 0, dossiers: [fixture as never] });
    vi.mocked(db.updateDossier).mockResolvedValue(fixture as never);
    vi.mocked(db.deleteDossier).mockResolvedValue({ success: true });
    vi.mocked(db.getUserByOpenId).mockResolvedValue(context.user as any);
  });

  it("sert les dossiers, le tableau de bord et les référentiels à un utilisateur authentifié", async () => {
    const caller = appRouter.createCaller(context);
    const dossiers = await caller.dossier.list({ status: "À régulariser" });
    const dashboard = await caller.dashboard.get();
    const references = await caller.reference.list({ category: "client" });
    expect(dossiers[0]?.dossierNumber).toBe("DOS-0007");
    expect(dashboard.metrics.total).toBe(1);
    expect(dashboard.priority.find(item => item.label === "Haute")?.value).toBe(1);
    expect(references).toHaveLength(2);
    expect(db.listDossiers).toHaveBeenCalledWith({ status: "À régulariser" });
    expect(db.getReferenceItems).toHaveBeenCalledWith("client");
  });

  it("transmet les opérations de création, mise à jour, suppression et import batch au service métier", async () => {
    const caller = appRouter.createCaller(context);
    const created = await caller.dossier.create({ client: "GBG", transportMode: "Maritime" });
    await caller.dossier.update({ id: 7, data: { bulletinNumber: "B-7" } });
    const batch = await caller.dossier.importBatch([{ client: "GBG", transportMode: "Maritime" }]);
    const removed = await caller.dossier.remove({ id: 7 });

    expect(created.dossierNumber).toBe("DOS-0008");
    expect(batch.total).toBe(1);
    expect(db.createDossier).toHaveBeenCalledWith({ client: "GBG", transportMode: "Maritime" }, 1, "Opérateur IGS");
    expect(db.updateDossier).toHaveBeenCalledWith(
      7,
      { bulletinNumber: "B-7" },
      1,
      "Opérateur IGS",
      expect.objectContaining({ userRole: "admin" })
    );
    expect(removed).toEqual({ success: true });
  });

  it("gère l'authentification directe de l'opérateur", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      user: null,
    });
    const loggedIn = await caller.auth.login({ name: "Directeur Transit", role: "admin" });
    expect(db.upsertUser).toHaveBeenCalled();
    expect(loggedIn?.name).toBe("Opérateur IGS");
  });
});
