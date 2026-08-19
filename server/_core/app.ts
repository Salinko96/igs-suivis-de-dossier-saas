import "dotenv/config";
import express from "express";
import compression from "compression";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerRestRoutes } from "../restRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createApp() {
  const app = express();
  
  // Enable gzip/deflate compression for all responses
  app.use(compression({ threshold: 1024 }));
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerRestRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, req }) {
        console.error(`[tRPC Router Error on ${path}]:`, error);
      },
    })
  );

  // Global Error Handler — Always return structured JSON for all /api endpoints
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Unhandled Server Error on ${req.method} ${req.url}]:`, err);
    if (res.headersSent) {
      return next(err);
    }
    res.setHeader("Content-Type", "application/json");
    const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Une erreur serveur interne est survenue.",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  });
  
  return app;
}
