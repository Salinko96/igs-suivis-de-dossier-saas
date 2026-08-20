import { Button } from "@/components/ui/button";
import { getOfflineQueue, removeOfflineMutation, updateOfflineMutationStatus } from "@/lib/offlineSync";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function OfflineSyncBanner() {
  const [queue, setQueue] = useState(getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const utils = trpc.useUtils();
  const quickUpdateMutation = trpc.dossier.quickUpdateMobile.useMutation();

  useEffect(() => {
    const handleQueueChange = () => setQueue(getOfflineQueue());
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("igs_offline_queue_changed", handleQueueChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("igs_offline_queue_changed", handleQueueChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const triggerAutoSync = async () => {
    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0 || !navigator.onLine) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const item of currentQueue) {
      if (item.status === "synced") continue;
      updateOfflineMutationStatus(item.id, "syncing");
      try {
        await quickUpdateMutation.mutateAsync({
          dossierId: item.payload.dossierId,
          goodsReleaseDate: item.payload.goodsReleaseDate ? new Date(item.payload.goodsReleaseDate) : null,
          declarationNumber: item.payload.declarationNumber,
          badStatus: item.payload.badStatus,
          baeStatus: item.payload.baeStatus,
          customsStatus: item.payload.customsStatus,
          portStatus: item.payload.portStatus,
          fieldOperation: item.payload.fieldOperation,
          comment: item.payload.comment,
          expectedVersion: item.payload.expectedVersion,
        });
        removeOfflineMutation(item.id);
        successCount++;
      } catch (err: any) {
        const isConflict = err.message?.includes("conflit") || err.data?.code === "CONFLICT";
        updateOfflineMutationStatus(item.id, isConflict ? "conflict" : "error", err.message);
      }
    }

    setIsSyncing(false);
    setQueue(getOfflineQueue());
    utils.dossier.invalidate();
    utils.dashboard.invalidate();

    if (successCount > 0) {
      toast.success(`⚡ Synchronisation terminée : ${successCount} modification(s) de quai synchronisée(s) avec succès !`);
    }
  };

  if (queue.length === 0 && isOnline) return null;

  return (
    <div className="bg-[#0b3b32] text-white px-4 py-2.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <CloudOff size={15} />
            <span>Mode Hors-Ligne Quai PAC</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <Wifi size={15} />
            <span>Réseau Rétabli</span>
          </div>
        )}

        {queue.length > 0 && (
          <span className="bg-emerald-800/80 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
            {queue.length} mise(s) à jour en attente
          </span>
        )}
      </div>

      {queue.length > 0 && (
        <Button
          size="sm"
          onClick={triggerAutoSync}
          disabled={isSyncing || !isOnline}
          className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] gap-1 shadow-sm"
        >
          <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
          <span>{isSyncing ? "Synchronisation..." : "Synchroniser Maintenant"}</span>
        </Button>
      )}
    </div>
  );
}
