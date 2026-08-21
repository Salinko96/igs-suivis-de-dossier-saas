/**
 * Terminal49 API v2 — TypeScript Types & JSON:API Interfaces
 * Base URL: https://api.terminal49.com/v2
 * Format: JSON:API (application/vnd.api+json)
 */

export interface JsonApiResource<TAttributes = Record<string, any>, TRelationships = Record<string, any>> {
  id: string;
  type: string;
  attributes: TAttributes;
  relationships?: TRelationships;
  links?: {
    self?: string;
    related?: string;
  };
}

export interface JsonApiResponse<TData = any, TIncluded = JsonApiResource> {
  data: TData;
  included?: TIncluded[];
  meta?: {
    page_count?: number;
    total_count?: number;
    current_page?: number;
  };
  errors?: Array<{
    title?: string;
    detail?: string;
    status?: string;
    code?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }>;
}

// -------------------------------------------------------------
// RAW ATTRIBUTES (TERMINAL49 JSON:API)
// -------------------------------------------------------------

export interface Terminal49TrackingRequestAttributes {
  request_number: string;
  request_type: "bill_of_lading" | "booking_number" | "container";
  shipping_line_scac?: string | null;
  status: "created" | "processing" | "completed" | "failed";
  failed_reason?: string | null;
  tracked_object_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Terminal49ShipmentAttributes {
  bill_of_lading_number?: string | null;
  booking_number?: string | null;
  shipping_line_scac?: string | null;
  shipping_line_name?: string | null;
  shipping_line_short_name?: string | null;
  status: "pending" | "in_transit" | "arrived" | "discharged" | "completed" | "cancelled" | string;
  
  // Port / Location Details
  port_of_loading_name?: string | null;
  port_of_loading_locode?: string | null;
  port_of_discharge_name?: string | null;
  port_of_discharge_locode?: string | null;
  destination_name?: string | null;
  
  // Vessel & Voyage
  vessel_name?: string | null;
  vessel_imo?: string | null;
  vessel_mmsi?: string | null;
  voyage_number?: string | null;
  
  // Dates (ETA, ATA, ETD, ATD)
  eta_at?: string | null;
  ata_at?: string | null;
  etd_at?: string | null;
  atd_at?: string | null;
  discharge_at?: string | null;
  
  // Statistics & Lifecycle
  containers_count?: number;
  line_tracking_stopped_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Terminal49ContainerAttributes {
  number: string;
  seal_number?: string | null;
  equipment_type?: string | null;
  equipment_description?: string | null;
  weight_in_lbs?: number | null;
  status?: string | null;
  
  // Holds & Availability
  available_for_pickup?: boolean | null;
  pickup_appointment_required?: boolean | null;
  holds_at_pod?: Array<{ name?: string; status?: string; description?: string }> | null;
  has_holds?: boolean;
  
  // Demurrage & Free Time
  last_free_day_on?: string | null;
  empty_terminated_on?: string | null;
  fees?: {
    total?: number;
    currency?: string;
    demurrage?: number;
    detention?: number;
  } | null;

  // Port Milestones
  discharged_at?: string | null;
  gated_out_at?: string | null;
  empty_returned_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Terminal49TransportEventAttributes {
  event_type: string;
  description?: string | null;
  location?: string | null;
  timestamp: string;
  is_actual: boolean;
  transport_mode?: "vessel" | "truck" | "rail" | string | null;
  vessel_name?: string | null;
  voyage_number?: string | null;
}

// -------------------------------------------------------------
// NORMALIZED DOMAIN MODELS (APP & UI)
// -------------------------------------------------------------

export interface TrackedTimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  location: string;
  timestamp: string;
  isActual: boolean;
  vesselName?: string | null;
  voyageNumber?: string | null;
}

export interface TrackedContainer {
  id: string;
  number: string;
  sealNumber?: string | null;
  equipmentType?: string | null;
  equipmentDescription?: string | null;
  status: string;
  availableForPickup: boolean;
  lastFreeDay?: string | null;
  hasHolds: boolean;
  holds: Array<{ name: string; status: string }>;
  fees?: {
    total: number;
    currency: string;
    demurrage: number;
  } | null;
  dischargedAt?: string | null;
  gatedOutAt?: string | null;
  events: TrackedTimelineEvent[];
}

export interface TrackedShipmentDetail {
  id: string;
  billOfLadingNumber: string;
  bookingNumber?: string | null;
  shippingLine: {
    scac: string;
    name: string;
  };
  status: "pending" | "in_transit" | "arrived" | "discharged" | "completed" | "unknown";
  vessel: {
    name: string;
    imo?: string | null;
    voyage?: string | null;
  };
  origin: {
    portName: string;
    locode?: string | null;
    etd?: string | null;
    atd?: string | null;
  };
  destination: {
    portName: string;
    locode?: string | null;
    eta?: string | null;
    ata?: string | null;
  };
  containersCount: number;
  containers: TrackedContainer[];
  events: TrackedTimelineEvent[];
  updatedAt?: string;
  rawAttributes?: Terminal49ShipmentAttributes;
}

export interface CreateTrackingRequestInput {
  requestNumber: string;
  requestType?: "bill_of_lading" | "booking_number" | "container";
  shippingLineScac?: string;
}

export interface ApiResponsePattern<T> {
  data: T | null;
  error: string | null;
}
