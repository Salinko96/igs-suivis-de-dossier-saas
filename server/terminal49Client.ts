import {
  ApiResponsePattern,
  CreateTrackingRequestInput,
  JsonApiResponse,
  JsonApiResource,
  Terminal49ContainerAttributes,
  Terminal49ShipmentAttributes,
  Terminal49TrackingRequestAttributes,
  Terminal49TransportEventAttributes,
  TrackedContainer,
  TrackedShipmentDetail,
  TrackedTimelineEvent,
} from "../client/src/lib/terminal49/types";

const TERMINAL49_BASE_URL = "https://api.terminal49.com/v2";
const FETCH_TIMEOUT_MS = 10000; // 10s timeout via AbortController

/**
 * Normalise les objets JSON:API de Terminal49 vers le modèle unifié TrackedShipmentDetail
 */
export function parseJsonApiShipment(
  resource: JsonApiResource<Terminal49ShipmentAttributes>,
  included: JsonApiResource[] = []
): TrackedShipmentDetail {
  const attrs = resource.attributes || {};

  // Extraction des conteneurs depuis "included"
  const containerResources = included.filter((r) => r.type === "container");
  const transportEventResources = included.filter(
    (r) => r.type === "transport_event" || r.type === "port_event" || r.type === "event"
  );

  const events: TrackedTimelineEvent[] = transportEventResources.map((ev) => {
    const evAttrs = (ev.attributes || {}) as Terminal49TransportEventAttributes;
    return {
      id: ev.id,
      eventType: evAttrs.event_type || "status_change",
      title: formatEventTitle(evAttrs.event_type || undefined, evAttrs.description || undefined),
      description: evAttrs.description || evAttrs.event_type || "Événement de transport",
      location: evAttrs.location || attrs.port_of_discharge_name || "Port Autonome de Conakry",
      timestamp: evAttrs.timestamp || new Date().toISOString(),
      isActual: evAttrs.is_actual ?? true,
      vesselName: evAttrs.vessel_name || attrs.vessel_name || null,
      voyageNumber: evAttrs.voyage_number || attrs.voyage_number || null,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const containers: TrackedContainer[] = containerResources.map((c) => {
    const cAttrs = (c.attributes || {}) as Terminal49ContainerAttributes;
    const holds = Array.isArray(cAttrs.holds_at_pod)
      ? cAttrs.holds_at_pod.map((h) => ({
          name: h.name || "Contrôle Douanier / Quai",
          status: h.status || "En cours",
        }))
      : [];

    return {
      id: c.id,
      number: cAttrs.number || "CONT-NON-RENSEIGNÉ",
      sealNumber: cAttrs.seal_number || null,
      equipmentType: cAttrs.equipment_type || cAttrs.equipment_description || "40HC",
      equipmentDescription: cAttrs.equipment_description || null,
      status: cAttrs.status || "in_transit",
      availableForPickup: Boolean(cAttrs.available_for_pickup),
      lastFreeDay: cAttrs.last_free_day_on || null,
      hasHolds: Boolean(cAttrs.has_holds || holds.length > 0),
      holds,
      fees: cAttrs.fees ? {
        total: cAttrs.fees.total || 0,
        currency: cAttrs.fees.currency || "USD",
        demurrage: cAttrs.fees.demurrage || 0,
      } : null,
      dischargedAt: cAttrs.discharged_at || null,
      gatedOutAt: cAttrs.gated_out_at || null,
      events: events.slice(0, 5),
    };
  });

  // Mapper le statut vers une nomenclature stricte
  const rawStatus = (attrs.status || "in_transit").toLowerCase();
  let normalizedStatus: TrackedShipmentDetail["status"] = "in_transit";
  if (rawStatus.includes("arrive") || rawStatus.includes("berthed")) normalizedStatus = "arrived";
  else if (rawStatus.includes("discharge")) normalizedStatus = "discharged";
  else if (rawStatus.includes("complete") || rawStatus.includes("delivered")) normalizedStatus = "completed";
  else if (rawStatus.includes("pending") || rawStatus.includes("booked")) normalizedStatus = "pending";

  return {
    id: resource.id,
    billOfLadingNumber: attrs.bill_of_lading_number || "BL-NON-DISPONIBLE",
    bookingNumber: attrs.booking_number || null,
    shippingLine: {
      scac: attrs.shipping_line_scac || "MSC",
      name: attrs.shipping_line_name || attrs.shipping_line_short_name || "Armateur Partenaire",
    },
    status: normalizedStatus,
    vessel: {
      name: attrs.vessel_name || "Navire Porte-Conteneurs",
      imo: attrs.vessel_imo || null,
      voyage: attrs.voyage_number || null,
    },
    origin: {
      portName: attrs.port_of_loading_name || "Port de Chargement",
      locode: attrs.port_of_loading_locode || null,
      etd: attrs.etd_at || null,
      atd: attrs.atd_at || null,
    },
    destination: {
      portName: attrs.port_of_discharge_name || attrs.destination_name || "Port Autonome de Conakry (PAC)",
      locode: attrs.port_of_discharge_locode || "GNCKY",
      eta: attrs.eta_at || null,
      ata: attrs.ata_at || null,
    },
    containersCount: attrs.containers_count || containers.length || 1,
    containers,
    events,
    updatedAt: attrs.updated_at || new Date().toISOString(),
    rawAttributes: attrs,
  };
}

function formatEventTitle(eventType?: string, description?: string): string {
  if (!eventType) return description || "Mise à jour transport";
  const map: Record<string, string> = {
    vessel_departure: "Départ navire du port de chargement",
    vessel_arrival: "Arrivée navire au Port Autonome de Conakry",
    container_discharge: "Déchargement conteneur sur terre-plein quai",
    customs_hold_placed: "Mise sous contrôle douanier (SYDONIA)",
    customs_hold_released: "Mainlevée douanière accordée (BAE)",
    gate_out: "Sortie de quai / Livraison transporteur",
    empty_container_returned: "Retour conteneur vide au parc armateur",
  };
  return map[eventType] || description || eventType.replace(/_/g, " ");
}

export function detectScacFromNumber(number: string): string {
  const upper = number.toUpperCase().trim();
  if (upper.startsWith("MEDU") || upper.startsWith("MSCU")) return "MSCU";
  if (upper.startsWith("MAEU") || upper.startsWith("MSK")) return "MAEU";
  if (upper.startsWith("CMA") || upper.startsWith("CMDU")) return "CMDU";
  if (upper.startsWith("HLCU")) return "HLCU";
  if (upper.startsWith("COSU") || upper.startsWith("COS")) return "COSU";
  if (upper.startsWith("ONEY")) return "ONEY";
  if (upper.startsWith("GRI")) return "GRIM";
  if (upper.startsWith("EID") || upper.startsWith("EMC")) return "EGLV"; // Evergreen
  return "MSCU"; // Default armateur principal PAC Conakry
}

/**
 * Client HTTP sécurisé pour l'API Terminal49 v2
 */
export class Terminal49Client {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = TERMINAL49_BASE_URL) {
    this.apiKey = apiKey || process.env.TERMINAL49_API_KEY || "";
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    return {
      // Directives strictes: "Authorization: Token ${process.env.TERMINAL49_API_KEY}" (PAS Bearer)
      Authorization: `Token ${this.apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    };
  }

  /**
   * Effectue un appel HTTP fetch avec timeout de 10s via AbortController
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponsePattern<T>> {
    if (!this.apiKey) {
      return {
        data: null,
        error: "Clé API Terminal49 non configurée. Veuillez renseigner TERMINAL49_API_KEY.",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      const jsonText = await response.text();
      let parsed: any = null;
      try {
        parsed = jsonText ? JSON.parse(jsonText) : {};
      } catch {
        parsed = { raw: jsonText };
      }

      if (!response.ok) {
        const errorDetail =
          parsed?.errors?.[0]?.detail ||
          parsed?.errors?.[0]?.title ||
          parsed?.message ||
          `Erreur HTTP ${response.status} (${response.statusText})`;
        
        return {
          data: null,
          error: `[Terminal49 API] ${errorDetail}`,
        };
      }

      return {
        data: parsed as T,
        error: null,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        return {
          data: null,
          error: "Délai d'attente dépassé (timeout 10s) lors de la requête vers Terminal49.",
        };
      }
      return {
        data: null,
        error: `Erreur réseau Terminal49: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * POST /tracking_requests
   * Crée une demande de suivi pour un connaissement (BL), numéro de booking ou numéro de conteneur
   */
  public async createTrackingRequest(
    input: CreateTrackingRequestInput
  ): Promise<ApiResponsePattern<TrackedShipmentDetail | { requestId: string; status: string }>> {
    const scac = input.shippingLineScac?.trim() || detectScacFromNumber(input.requestNumber);

    const payload = {
      data: {
        type: "tracking_request",
        attributes: {
          request_number: input.requestNumber.trim(),
          request_type: input.requestType || (input.requestNumber.trim().length === 11 && /^[A-Z]{4}\d{7}$/i.test(input.requestNumber.trim()) ? "container" : "bill_of_lading"),
          scac,
          shipping_line_scac: scac,
        },
      },
    };

    const res = await this.request<JsonApiResponse<JsonApiResource<Terminal49TrackingRequestAttributes>>>(
      "/tracking_requests",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (res.error || !res.data) {
      return { data: null, error: res.error };
    }

    const trkReq = res.data.data;
    const trackedShipmentId = trkReq?.attributes?.tracked_object_id || trkReq?.relationships?.shipment?.data?.id;

    // Si le shipment est déjà créé et disponible, on le récupère avec ses relations
    if (trackedShipmentId) {
      const shipmentRes = await this.getShipment(trackedShipmentId);
      if (shipmentRes.data) {
        return { data: shipmentRes.data, error: null };
      }
    }

    return {
      data: {
        requestId: trkReq.id,
        status: trkReq.attributes?.status || "processing",
      },
      error: null,
    };
  }

  /**
   * GET /shipments
   * Liste les cargaisons suivies avec leurs conteneurs et événements inclus
   */
  public async listShipments(options: { page?: number; size?: number } = {}): Promise<
    ApiResponsePattern<TrackedShipmentDetail[]>
  > {
    const page = options.page || 1;
    const size = Math.min(options.size || 10, 10); // Limite 10 slots plan gratuit
    const query = `?page[number]=${page}&page[size]=${size}&include=containers,transport_events`;

    const res = await this.request<
      JsonApiResponse<JsonApiResource<Terminal49ShipmentAttributes>[]>
    >(`/shipments${query}`, { method: "GET" });

    if (res.error || !res.data) {
      return { data: null, error: res.error };
    }

    const resources = Array.isArray(res.data.data) ? res.data.data : [];
    const included = (res.data.included || []) as JsonApiResource[];

    const shipments = resources.map((r) => parseJsonApiShipment(r, included));

    return {
      data: shipments,
      error: null,
    };
  }

  /**
   * GET /shipments/{id}
   * Récupère le détail complet d'un shipment incluant les conteneurs et les événements de transport
   */
  public async getShipment(
    shipmentId: string
  ): Promise<ApiResponsePattern<TrackedShipmentDetail>> {
    if (!shipmentId) {
      return { data: null, error: "Identifiant de shipment manquant." };
    }

    const query = "?include=containers,transport_events,shipping_line";
    const res = await this.request<
      JsonApiResponse<JsonApiResource<Terminal49ShipmentAttributes>>
    >(`/shipments/${encodeURIComponent(shipmentId)}${query}`, { method: "GET" });

    if (res.error || !res.data) {
      return { data: null, error: res.error };
    }

    const shipment = parseJsonApiShipment(
      res.data.data,
      (res.data.included || []) as JsonApiResource[]
    );

    return {
      data: shipment,
      error: null,
    };
  }

  /**
   * GET /containers/{id}
   * Récupère les données d'un conteneur spécifique et ses événements de quai
   */
  public async getContainer(
    containerId: string
  ): Promise<ApiResponsePattern<TrackedContainer>> {
    if (!containerId) {
      return { data: null, error: "Identifiant de conteneur manquant." };
    }

    const query = "?include=transport_events";
    const res = await this.request<
      JsonApiResponse<JsonApiResource<Terminal49ContainerAttributes>>
    >(`/containers/${encodeURIComponent(containerId)}${query}`, { method: "GET" });

    if (res.error || !res.data) {
      return { data: null, error: res.error };
    }

    const c = res.data.data;
    const cAttrs = (c.attributes || {}) as Terminal49ContainerAttributes;
    const events: TrackedTimelineEvent[] = ((res.data.included || []) as JsonApiResource[]).map((ev) => {
      const evAttrs = (ev.attributes || {}) as Terminal49TransportEventAttributes;
      return {
        id: ev.id,
        eventType: evAttrs.event_type || "status_update",
        title: formatEventTitle(evAttrs.event_type || undefined, evAttrs.description || undefined),
        description: evAttrs.description || "Événement quai",
        location: evAttrs.location || "Port Autonome de Conakry",
        timestamp: evAttrs.timestamp || new Date().toISOString(),
        isActual: evAttrs.is_actual ?? true,
      };
    });

    const container: TrackedContainer = {
      id: c.id,
      number: cAttrs.number || containerId,
      sealNumber: cAttrs.seal_number || null,
      equipmentType: cAttrs.equipment_type || "40HC",
      equipmentDescription: cAttrs.equipment_description || null,
      status: cAttrs.status || "active",
      availableForPickup: Boolean(cAttrs.available_for_pickup),
      lastFreeDay: cAttrs.last_free_day_on || null,
      hasHolds: Boolean(cAttrs.has_holds || (cAttrs.holds_at_pod && cAttrs.holds_at_pod.length > 0)),
      holds: Array.isArray(cAttrs.holds_at_pod)
        ? cAttrs.holds_at_pod.map((h) => ({ name: h.name || "Contrôle", status: h.status || "Actif" }))
        : [],
      fees: cAttrs.fees ? {
        total: cAttrs.fees.total || 0,
        currency: cAttrs.fees.currency || "USD",
        demurrage: cAttrs.fees.demurrage || 0,
      } : null,
      dischargedAt: cAttrs.discharged_at || null,
      gatedOutAt: cAttrs.gated_out_at || null,
      events,
    };

    return {
      data: container,
      error: null,
    };
  }

  /**
   * Recherche ou création automatique de suivi par numéro de BL / Booking / Conteneur
   */
  public async trackByNumber(
    number: string,
    scac?: string
  ): Promise<ApiResponsePattern<TrackedShipmentDetail>> {
    const cleanNumber = number.trim();
    if (!cleanNumber) {
      return { data: null, error: "Numéro de suivi manquant." };
    }

    // 1. Chercher d'abord dans la liste des cargaisons déjà suivies
    const listRes = await this.listShipments({ size: 10 });
    if (listRes.data && listRes.data.length > 0) {
      const match = listRes.data.find(
        (s) =>
          s.billOfLadingNumber.toLowerCase() === cleanNumber.toLowerCase() ||
          (s.bookingNumber && s.bookingNumber.toLowerCase() === cleanNumber.toLowerCase()) ||
          s.containers.some((c) => c.number.toLowerCase() === cleanNumber.toLowerCase())
      );
      if (match) {
        return { data: match, error: null };
      }
    }

    // 2. Si non trouvé, créer une demande de tracking request
    const createRes = await this.createTrackingRequest({
      requestNumber: cleanNumber,
      requestType: cleanNumber.length === 11 && /^[A-Z]{4}\d{7}$/i.test(cleanNumber)
        ? "container"
        : "bill_of_lading",
      shippingLineScac: scac,
    });

    if (createRes.error) {
      return { data: null, error: createRes.error };
    }

    if (createRes.data && "billOfLadingNumber" in createRes.data) {
      return { data: createRes.data as TrackedShipmentDetail, error: null };
    }

    // Si en attente de traitement par Terminal49
    return {
      data: null,
      error: `Suivi initié pour le numéro « ${cleanNumber} ». Les données maritimes sont en cours de synchronisation auprès de l'armateur.`,
    };
  }
}

// Instance singleton côté serveur
export const terminal49 = new Terminal49Client();
