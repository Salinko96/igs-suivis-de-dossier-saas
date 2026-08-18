import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { appRouter } from "../../routers";
import * as db from "../../db";

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

function createClientContext(): TrpcContext {
  return {
    req: { headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
    user: {
      id: 4,
      openId: "client_birimian",
      name: "Guinean Birimian Gold (Portail)",
      email: "logistique@birimian-gold.gn",
      role: "client",
      loginMethod: "direct",
      clientCompany: "Guinean Birimian Gold S.A",
      phone: "+224 623 77 88 99",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("Tier 2 - Dynamic Route Resolution /dossiers/[id] & Error Resilience", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const clientCaller = appRouter.createCaller(createClientContext());

  it("1. Charge avec succès un dossier via son ID numérique (ex: 1)", async () => {
    const res = await adminCaller.dossier.get({ id: 1 });
    expect(res).toBeDefined();
    expect(res.id).toBe(1);
    expect(res.dossierNumber).toBe("DOS-0001");
  });

  it("2. Charge avec succès un dossier via son ID sous forme de chaîne numérique (ex: '9')", async () => {
    const res = await adminCaller.dossier.get({ id: "9" });
    expect(res).toBeDefined();
    expect(res.id).toBe(9);
    expect(res.dossierNumber).toBe("DOS-0009");
  });

  it("3. Charge avec succès un dossier via son numéro métier formaté (ex: 'DOS-0009' ou 'DOS-0054')", async () => {
    const res9 = await adminCaller.dossier.get({ id: "DOS-0009" });
    expect(res9).toBeDefined();
    expect(res9.dossierNumber).toBe("DOS-0009");

    const res54 = await adminCaller.dossier.get({ id: "DOS-0054" });
    expect(res54).toBeDefined();
    expect(res54.dossierNumber).toBe("DOS-0054");
  });

  it("4. Charge avec succès un dossier via son code portail client (ex: 'IGS-1001')", async () => {
    const res = await adminCaller.dossier.get({ id: "IGS-1001" });
    expect(res).toBeDefined();
    expect(res.id).toBe(1);
  });

  it("5. Retourne une erreur NOT_FOUND explicite si le dossier n'existe pas", async () => {
    await expect(adminCaller.dossier.get({ id: 999999 })).rejects.toThrow(
      /Dossier introuvable/
    );
    await expect(adminCaller.dossier.get({ id: "DOS-9999" })).rejects.toThrow(
      /Dossier introuvable/
    );
    await expect(adminCaller.dossier.get({ id: "INVALIDE_REF" })).rejects.toThrow(
      /Dossier introuvable/
    );
  });

  it("6. Isole strictement l'accès pour les comptes de rôle client", async () => {
    // Dossier 1 appartient à Guinean Birimian Gold S.A -> Succès
    const dossier1 = await clientCaller.dossier.get({ id: 1 });
    expect(dossier1).toBeDefined();
    expect(dossier1.client).toBe("Guinean Birimian Gold S.A");

    // Recherche d'un dossier appartenant à un autre client -> Doit lever FORBIDDEN
    const allDossiers = await db.listDossiers();
    const otherClientDossier = allDossiers.find(d => d.client && d.client !== "Guinean Birimian Gold S.A");
    if (otherClientDossier) {
      await expect(clientCaller.dossier.get({ id: otherClientDossier.id })).rejects.toThrow(
        /Accès refusé/
      );
    }
  });
});
