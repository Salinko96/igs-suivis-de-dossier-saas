import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import * as db from "../db";
import { 
  VALID_CUSTOMS_REGIMES, 
  DEPRECATED_CUSTOMS_REGIMES, 
  isDeprecatedCustomsRegime 
} from "../dossierRules";

describe("Régimes Douaniers Guinée — Spécifications & Intégrité Opérationnelle", () => {
  const adminCtx = {
    user: { id: 1, name: "Admin IGS", email: "admin@igs.gn", role: "admin" },
  };

  it("1. Retourne la liste exacte des 7 régimes douaniers officiels dans l'ordre requis", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const refs = await caller.reference.list({ category: "regime" });
    const regimeLabels = refs.filter(r => r.category === "regime").map(r => r.label);

    expect(regimeLabels).toEqual([
      "Mise à la consommation directe (IM4 - TTC)",
      "Mise à la consommation sous exonération (IM4 - EXO)",
      "Transit National / International (IM8 - DDI / TRIE)",
      "Admission Temporaire (IM5 - AT)",
      "Enlèvement provisoire",
      "Entrepôt de Douane (IM7 - ED)",
      "Exportation / Réexportation (EX)",
    ]);
  });

  it("2. Positionne 'Enlèvement provisoire' exactement après 'Admission Temporaire (IM5 - AT)'", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const refs = await caller.reference.list({ category: "regime" });
    const regimeLabels = refs.filter(r => r.category === "regime").map(r => r.label);

    const atIndex = regimeLabels.indexOf("Admission Temporaire (IM5 - AT)");
    const epIndex = regimeLabels.indexOf("Enlèvement provisoire");

    expect(atIndex).toBeGreaterThanOrEqual(0);
    expect(epIndex).toBe(atIndex + 1);
  });

  it("3. A supprimé définitivement les 4 anciennes valeurs courtes et obsolètes du référentiel actif", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const refs = await caller.reference.list({ category: "regime" });
    const regimeLabels = refs.filter(r => r.category === "regime").map(r => r.label);

    for (const deprecated of DEPRECATED_CUSTOMS_REGIMES) {
      expect(regimeLabels).not.toContain(deprecated);
      expect(isDeprecatedCustomsRegime(deprecated)).toBe(true);
    }
  });

  it("4. Rejette la création d'un nouveau dossier utilisant un régime douanier obsolète", async () => {
    const caller = appRouter.createCaller(adminCtx);

    for (const deprecated of ["TTC", "EXO", "AT", "Régime Minier / Convention (EXO-MIN)"]) {
      await expect(
        caller.dossier.create({
          client: "Société Minière de Boké",
          clientDossierNumber: `TEST-REGIME-${Date.now()}`,
          regime: deprecated,
        })
      ).rejects.toThrow();
    }
  });

  it("5. Autorise la création avec le nouveau régime 'Enlèvement provisoire'", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const created = await caller.dossier.create({
      client: "Société Minière de Boké",
      clientDossierNumber: `TEST-EP-${Date.now()}`,
      regime: "Enlèvement provisoire",
    });

    expect(created).toBeDefined();
    expect(created.regime).toBe("Enlèvement provisoire");

    const fetched = await caller.dossier.get({ id: created.id });
    expect(fetched.regime).toBe("Enlèvement provisoire");
  });

  it("6. Préserve la lisibilité sans erreur des dossiers historiques ayant d'anciennes valeurs", async () => {
    const caller = appRouter.createCaller(adminCtx);

    // Création d'un dossier avec un régime valide puis simulation d'une valeur historique
    const created = await caller.dossier.create({
      client: "Archive Mining SARL",
      clientDossierNumber: `HIST-${Date.now()}`,
      regime: "Mise à la consommation directe (IM4 - TTC)",
    });

    // Insertion d'une valeur historique directement sur l'objet mémoire
    const target = await db.getDossier(created.id);
    if (target) {
      (target as any).regime = "TTC";
    }

    const fetched = await caller.dossier.get({ id: created.id });
    expect(fetched).toBeDefined();
    expect(fetched.regime).toBe("TTC");

    // Une mise à jour sans modification du régime (ex: mise à jour des notes) doit fonctionner
    const updated = await caller.dossier.update({
      id: created.id,
      data: {
        notes: "Mise à jour des notes d'audit sans altérer le régime historique",
        regime: "TTC",
      },
    });

    expect(updated).toBeDefined();
    expect(updated.regime).toBe("TTC");
  });
});
