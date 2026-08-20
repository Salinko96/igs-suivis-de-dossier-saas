import { useState, useEffect, useCallback } from "react";

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  offlineSince: Date | null;
  resetWasOffline: () => void;
}

/**
 * Hook de détection de l'état réseau (En ligne / Hors-ligne)
 * Optimisé pour les agents sur le quai du Port Autonome de Conakry (3G/4G instable).
 */
export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setOfflineSince(null);

      // Auto-dissiper le statut "reconnecté" après 5 secondes
      const timer = setTimeout(() => {
        setWasOffline(false);
      }, 5000);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
      setOfflineSince(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    offlineSince,
    resetWasOffline,
  };
}
