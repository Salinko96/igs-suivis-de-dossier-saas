import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  getReferenceItems: vi.fn(),
  createDossier: vi.fn(),
  updateDossier: vi.fn(),
  deleteDossier: vi.fn(),
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
  destinationPort: "Conakry",
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
  user: { id: 1, openId: "integration-user", name: "Opérateur", email: "operator@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
} as TrpcContext;

describe("intégration des procédures IGS Dossiers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.listDossiers).mockResolvedValue([fixture] as never);
    vi.mocked(db.getDossier).mockResolvedValue(fixture as never);
    vi.mocked(db.getReferenceItems).mockResolvedValue([{ id: 1, category: "client", label: "GBG", sortOrder: 1, createdAt: new Date() }] as never);
    vi.mocked(db.createDossier).mockResolvedValue({ ...fixture, id: 8, dossierNumber: "DOS-0008" } as never);
    vi.mocked(db.updateDossier).mockResolvedValue(fixture as never);
    vi.mocked(db.deleteDossier).mockResolvedValue({ success: true });
  });

  it("sert les dossiers, le tableau de bord et les référentiels à un utilisateur authentifié", async () => {
    const caller = appRouter.createCaller(context);
    const dossiers = await caller.dossier.list({ status: "À régulariser" });
    const dashboard = await caller.dashboard.get();
    const references = await caller.reference.list({ category: "client" });
    expect(dossiers[0]?.dossierNumber).toBe("DOS-0007");
    expect(dashboard.metrics.total).toBe(1);
    expect(dashboard.priority.find(item => item.label === "Haute")?.value).toBe(1);
    expect(references).toHaveLength(1);
    expect(db.listDossiers).toHaveBeenCalledWith({ status: "À régulariser" });
    expect(db.getReferenceItems).toHaveBeenCalledWith("client");
  });

  it("transmet les opérations de création, mise à jour et suppression au service métier", async () => {
    const caller = appRouter.createCaller(context);
    const created = await caller.dossier.create({ client: "GBG", transportMode: "Maritime" });
    await caller.dossier.update({ id: 7, data: { bulletinNumber: "B-7" } });
    const removed = await caller.dossier.remove({ id: 7 });
    expect(created.dossierNumber).toBe("DOS-0008");
    expect(db.createDossier).toHaveBeenCalledWith({ client: "GBG", transportMode: "Maritime" }, 1);
    expect(db.updateDossier).toHaveBeenCalledWith(7, { bulletinNumber: "B-7" }, 1);
    expect(removed).toEqual({ success: true });
  });
});
