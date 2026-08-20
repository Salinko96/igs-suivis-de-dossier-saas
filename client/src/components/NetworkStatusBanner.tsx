import React from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, Wifi, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface NetworkStatusBannerProps {
  className?: string;
}

export function NetworkStatusBanner({ className = "" }: NetworkStatusBannerProps) {
  const { isOnline, wasOffline, resetWasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full transition-all duration-300 ${className}`}
      data-testid="network-status-banner"
    >
      {!isOnline ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300">
              <WifiOff className="h-4 w-4 animate-pulse" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-bold text-xs tracking-tight">
                Mode Hors-Ligne (Quai de Conakry) :
              </span>
              <span className="text-xs text-amber-900 dark:text-amber-300">
                Données en cache actives. Les modifications seront synchronisées au rétablissement du réseau.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="border-amber-500/40 bg-amber-50 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mr-1 h-3 w-3" /> Cache Local Actif
            </Badge>
          </div>
        </div>
      ) : wasOffline ? (
        <div className="flex items-center justify-between gap-3 bg-emerald-600/15 border-b border-emerald-600/30 px-4 py-2 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              Connexion rétablie : Synchronisation terminée.
            </div>
          </div>
          <button
            type="button"
            onClick={resetWasOffline}
            className="text-[11px] font-medium text-emerald-800 hover:underline dark:text-emerald-300"
          >
            Fermer
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default NetworkStatusBanner;
