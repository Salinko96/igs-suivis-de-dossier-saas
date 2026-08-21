import express, { Request, Response } from "express";
import * as db from "./db";
import { invalidateDashboardCache } from "./routers";

export function registerRestRoutes(app: express.Express) {
  // GET /api/dossiers - Liste des dossiers avec filtres optionnels
  app.get("/api/dossiers", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const status = req.query.status === "Régularisé" || req.query.status === "À régulariser" ? req.query.status : undefined;
      const priority = req.query.priority === "Haute" || req.query.priority === "Normale" || req.query.priority === "Basse" ? req.query.priority : undefined;
      const client = typeof req.query.client === "string" ? req.query.client : undefined;

      const dossiers = await db.listDossiers({
        search,
        status,
        priority,
        client,
      });

      return res.status(200).json({
        success: true,
        count: dossiers.length,
        data: dossiers,
      });
    } catch (err: any) {
      console.error("[REST GET /api/dossiers Error]", err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la récupération des dossiers",
        details: err.message,
      });
    }
  });

  // GET /api/dossiers/:id - Détail d'un dossier par son ID numérique ou sa référence
  app.get("/api/dossiers/:id", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      if (!rawId || rawId.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide ou manquant",
        });
      }

      const dossier = await db.getDossier(rawId.trim());

      if (!dossier) {
        return res.status(404).json({
          success: false,
          error: `Dossier introuvable pour l'identifiant « ${rawId} »`,
          id: rawId,
        });
      }

      return res.status(200).json({
        success: true,
        data: dossier,
      });
    } catch (err: any) {
      console.error(`[REST GET /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la lecture du dossier",
        details: err.message,
      });
    }
  });

  // POST /api/dossiers - Création d'un dossier
  app.post("/api/dossiers", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({
          success: false,
          error: "Corps de requête invalide ou manquant",
        });
      }

      invalidateDashboardCache();
      const created = await db.createDossier(body, 1, "API REST");

      return res.status(201).json({
        success: true,
        message: `Dossier ${created.dossierNumber} créé avec succès`,
        data: created,
      });
    } catch (err: any) {
      console.error("[REST POST /api/dossiers Error]", err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la création du dossier",
        details: err.message,
      });
    }
  });

  // PUT /api/dossiers/:id ou PATCH /api/dossiers/:id - Mise à jour d'un dossier
  const updateHandler = async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      const numId = Number(rawId);

      if (!rawId || isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide (doit être un entier strictement positif)",
          received: rawId,
        });
      }

      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({
          success: false,
          error: "Corps de requête invalide",
        });
      }

      const existing = await db.getDossier(numId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Dossier #${numId} introuvable pour la mise à jour`,
          id: numId,
        });
      }

      invalidateDashboardCache();
      const updated = await db.updateDossier(numId, body, 1, "API REST");

      return res.status(200).json({
        success: true,
        message: `Dossier ${updated.dossierNumber} mis à jour avec succès`,
        data: updated,
      });
    } catch (err: any) {
      console.error(`[REST PUT/PATCH /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la sauvegarde du dossier",
        details: err.message,
      });
    }
  };

  app.put("/api/dossiers/:id", updateHandler);
  app.patch("/api/dossiers/:id", updateHandler);

  // DELETE /api/dossiers/:id - Suppression d'un dossier
  app.delete("/api/dossiers/:id", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const rawId = req.params.id;
      const numId = Number(rawId);

      if (!rawId || isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Identifiant de dossier invalide",
          received: rawId,
        });
      }

      const existing = await db.getDossier(numId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Dossier #${numId} introuvable`,
          id: numId,
        });
      }

      invalidateDashboardCache();
      const deleted = await db.deleteDossier(numId);

      return res.status(200).json({
        success: true,
        message: `Dossier ${existing.dossierNumber || numId} supprimé avec succès`,
        data: deleted,
      });
    } catch (err: any) {
      console.error(`[REST DELETE /api/dossiers/${req.params.id} Error]`, err);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur interne lors de la suppression du dossier",
        details: err.message,
      });
    }
  });

  // -------------------------------------------------------------
  // TERMINAL49 SHIPPING TRACKING REST API ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/terminal49/shipments - Liste des cargaisons suivies
  app.get("/api/terminal49/shipments", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { terminal49 } = await import("./terminal49Client");
      const page = parseInt(String(req.query.page || "1"), 10);
      const size = parseInt(String(req.query.size || "10"), 10);

      const result = await terminal49.listShipments({ page, size });
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ data: null, error: err.message || "Erreur serveur Terminal49" });
    }
  });

  // GET /api/terminal49/shipments/:id - Détail d'une cargaison
  app.get("/api/terminal49/shipments/:id", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { terminal49 } = await import("./terminal49Client");
      const id = req.params.id;
      const result = await terminal49.getShipment(id);
      if (result.error) {
        return res.status(404).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ data: null, error: err.message || "Erreur serveur Terminal49" });
    }
  });

  // GET /api/terminal49/containers/:id - Détail d'un conteneur
  app.get("/api/terminal49/containers/:id", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { terminal49 } = await import("./terminal49Client");
      const id = req.params.id;
      const result = await terminal49.getContainer(id);
      if (result.error) {
        return res.status(404).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ data: null, error: err.message || "Erreur serveur Terminal49" });
    }
  });

  // POST /api/terminal49/tracking_requests - Création d'une demande de suivi
  app.post("/api/terminal49/tracking_requests", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { terminal49 } = await import("./terminal49Client");
      const { requestNumber, requestType, shippingLineScac } = req.body || {};

      if (!requestNumber) {
        return res.status(400).json({ data: null, error: "Le champ requestNumber est obligatoire." });
      }

      const result = await terminal49.createTrackingRequest({
        requestNumber,
        requestType,
        shippingLineScac,
      });

      if (result.error) {
        return res.status(400).json(result);
      }
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ data: null, error: err.message || "Erreur serveur Terminal49" });
    }
  });

  // GET /api/terminal49/track - Recherche directe par BL / Conteneur
  app.get("/api/terminal49/track", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { terminal49 } = await import("./terminal49Client");
      const number = String(req.query.number || "");
      const scac = typeof req.query.scac === "string" ? req.query.scac : undefined;

      if (!number.trim()) {
        return res.status(400).json({ data: null, error: "Numéro de suivi requis (paramètre 'number')." });
      }

      const result = await terminal49.trackByNumber(number, scac);
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ data: null, error: err.message || "Erreur serveur Terminal49" });
    }
  });
}
