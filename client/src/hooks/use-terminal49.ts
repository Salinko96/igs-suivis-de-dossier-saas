import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import {
  CreateTrackingRequestInput,
  TrackedContainer,
  TrackedShipmentDetail,
} from "@/lib/terminal49/types";

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes de cache

/**
 * Hook React Query pour récupérer le suivi maritime en temps réel d'un connaissement (BL) ou conteneur
 */
export function useTerminal49Shipment(
  numberOrId: string | null | undefined,
  scac?: string
) {
  const cleanNumber = numberOrId?.trim();
  const isEnabled = Boolean(cleanNumber && cleanNumber.length > 2);

  // Utilisation directe du tRPC client avec cache configuré à 5 minutes
  const query = trpc.terminal49.trackByNumber.useQuery(
    { number: cleanNumber || "", scac },
    {
      enabled: isEnabled,
      staleTime: STALE_TIME_MS,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const data = query.data?.data as TrackedShipmentDetail | null | undefined;
  const error = query.data?.error || (query.error ? query.error.message : null);

  return {
    shipment: data || null,
    error,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: Boolean(error || query.isError),
    refetch: query.refetch,
  };
}

/**
 * Hook pour récupérer un conteneur spécifique
 */
export function useTerminal49Container(containerId: string | null | undefined) {
  const isEnabled = Boolean(containerId && containerId.trim().length > 0);

  const query = trpc.terminal49.getContainer.useQuery(
    { containerId: containerId || "" },
    {
      enabled: isEnabled,
      staleTime: STALE_TIME_MS,
      retry: 1,
    }
  );

  const data = query.data?.data as TrackedContainer | null | undefined;
  const error = query.data?.error || (query.error ? query.error.message : null);

  return {
    container: data || null,
    error,
    isLoading: query.isLoading,
    isError: Boolean(error || query.isError),
    refetch: query.refetch,
  };
}

/**
 * Hook pour lister toutes les cargaisons suivies (10 slots max plan gratuit)
 */
export function useTerminal49List(page: number = 1, size: number = 10) {
  const query = trpc.terminal49.listShipments.useQuery(
    { page, size },
    {
      staleTime: STALE_TIME_MS,
      retry: 1,
    }
  );

  const shipments = (query.data?.data as TrackedShipmentDetail[] | null) || [];
  const error = query.data?.error || (query.error ? query.error.message : null);

  return {
    shipments,
    error,
    isLoading: query.isLoading,
    isError: Boolean(error || query.isError),
    refetch: query.refetch,
  };
}

/**
 * Hook de mutation pour créer une nouvelle demande de suivi (POST /tracking_requests)
 */
export function useTerminal49CreateTracking() {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  return trpc.terminal49.createTracking.useMutation({
    onSuccess: () => {
      utils.terminal49.listShipments.invalidate();
      utils.terminal49.trackByNumber.invalidate();
    },
  });
}
