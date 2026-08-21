import { ComponentType, lazy } from "react";

/**
 * Charge un composant React de façon asynchrone avec récupération et rechargement
 * automatique transparent lors du déploiement d'une nouvelle version de l'application
 * (résolution proactive des erreurs "Failed to fetch dynamically imported module").
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const hasBeenRefreshed = window.sessionStorage.getItem("chunk_reload_triggered") === "true";

    try {
      const component = await componentImport();
      // Réinitialiser le marqueur en cas de succès
      window.sessionStorage.removeItem("chunk_reload_triggered");
      return component;
    } catch (error: any) {
      const isChunkError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Loading chunk") ||
        error?.name === "ChunkLoadError";

      if (isChunkError && !hasBeenRefreshed) {
        console.warn("[IGS Platform] Nouvelle version détectée — rechargement automatique des ressources...", error);
        window.sessionStorage.setItem("chunk_reload_triggered", "true");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      throw error;
    }
  });
}
