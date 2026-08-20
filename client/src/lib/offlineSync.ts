/**
 * Offline Sync Engine pour Déclarants Portuaires (Conakry, Kamsar, Boffa)
 * Stockage persistant IndexedDB/LocalStorage et synchronisation automatique avec résolution de conflits
 */

export interface PendingOfflineMutation {
  id: string;
  dossierId: number;
  dossierNumber: string;
  client?: string;
  timestamp: number;
  payload: {
    dossierId: number;
    goodsReleaseDate?: string | null;
    declarationNumber?: string | null;
    badStatus?: string | null;
    baeStatus?: string | null;
    customsStatus?: string | null;
    portStatus?: string | null;
    fieldOperation?: string | null;
    comment?: string | null;
    expectedVersion?: number;
  };
  status: "pending" | "syncing" | "synced" | "error" | "conflict";
  errorMessage?: string;
}

const STORAGE_KEY = "igs_declarant_offline_sync_queue_v1";

export function getOfflineQueue(): PendingOfflineMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("[OfflineSync] Error reading offline queue:", e);
    return [];
  }
}

export function saveOfflineQueue(queue: PendingOfflineMutation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("igs_offline_queue_changed", { detail: queue }));
  } catch (e) {
    console.error("[OfflineSync] Error saving offline queue:", e);
  }
}

export function enqueueOfflineMutation(mutation: Omit<PendingOfflineMutation, "id" | "timestamp" | "status">): PendingOfflineMutation {
  const queue = getOfflineQueue();
  const item: PendingOfflineMutation = {
    ...mutation,
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    status: "pending",
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeOfflineMutation(id: string) {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

export function updateOfflineMutationStatus(id: string, status: PendingOfflineMutation["status"], errorMessage?: string) {
  const queue = getOfflineQueue().map(item => {
    if (item.id === id) {
      return { ...item, status, errorMessage: errorMessage || item.errorMessage };
    }
    return item;
  });
  saveOfflineQueue(queue);
}

export function clearSyncedMutations() {
  const queue = getOfflineQueue().filter(item => item.status !== "synced");
  saveOfflineQueue(queue);
}
