import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseJsonApiShipment,
  Terminal49Client,
} from "../terminal49Client";
import {
  JsonApiResource,
  Terminal49ShipmentAttributes,
  TrackedShipmentDetail,
} from "../client/src/lib/terminal49/types";

describe("Terminal49 v2 Maritime Tracking Integration Suite", () => {
  const mockShipmentResource: JsonApiResource<Terminal49ShipmentAttributes> = {
    id: "shp_test_123456",
    type: "shipment",
    attributes: {
      bill_of_lading_number: "MEDUJ7763785",
      booking_number: "BKG-998877",
      shipping_line_scac: "MSCU",
      shipping_line_name: "Mediterranean Shipping Company",
      status: "in_transit",
      port_of_loading_name: "Port of Antwerp",
      port_of_loading_locode: "BEANR",
      port_of_discharge_name: "Port Autonome de Conakry (PAC)",
      port_of_discharge_locode: "GNCKY",
      vessel_name: "MSC GUINEA VOYAGER",
      vessel_imo: "9876543",
      voyage_number: "VOY-2026-08",
      eta_at: "2026-08-25T14:00:00Z",
      etd_at: "2026-08-10T08:00:00Z",
      containers_count: 2,
    },
  };

  const mockIncluded = [
    {
      id: "cnt_1",
      type: "container",
      attributes: {
        number: "MSCU1234567",
        seal_number: "SL-887799",
        equipment_type: "40HC",
        equipment_description: "40' High Cube Dry",
        status: "on_vessel",
        available_for_pickup: false,
        last_free_day_on: "2026-09-01",
        has_holds: false,
        holds_at_pod: [],
        fees: {
          total: 0,
          currency: "USD",
          demurrage: 0,
        },
      },
    },
    {
      id: "cnt_2",
      type: "container",
      attributes: {
        number: "MSCU7654321",
        seal_number: "SL-887798",
        equipment_type: "20GP",
        equipment_description: "20' General Purpose",
        status: "on_vessel",
        available_for_pickup: false,
        last_free_day_on: "2026-09-01",
        has_holds: true,
        holds_at_pod: [{ name: "Contrôle Scanner Douane", status: "Requis" }],
        fees: {
          total: 0,
          currency: "USD",
          demurrage: 0,
        },
      },
    },
    {
      id: "ev_1",
      type: "transport_event",
      attributes: {
        event_type: "vessel_departure",
        description: "Navire a quitté le port de chargement d'Anvers",
        location: "Port of Antwerp",
        timestamp: "2026-08-10T09:30:00Z",
        is_actual: true,
        vessel_name: "MSC GUINEA VOYAGER",
        voyage_number: "VOY-2026-08",
      },
    },
  ];

  // -------------------------------------------------------------
  // 1. TEST PARSER JSON:API
  // -------------------------------------------------------------
  describe("1. JSON:API Normalizer & Parser (parseJsonApiShipment)", () => {
    it("normalise correctement les attributs du shipment et extrait les conteneurs inclus", () => {
      const parsed: TrackedShipmentDetail = parseJsonApiShipment(
        mockShipmentResource,
        mockIncluded as any
      );

      expect(parsed.id).toBe("shp_test_123456");
      expect(parsed.billOfLadingNumber).toBe("MEDUJ7763785");
      expect(parsed.shippingLine.scac).toBe("MSCU");
      expect(parsed.shippingLine.name).toBe("Mediterranean Shipping Company");
      expect(parsed.vessel.name).toBe("MSC GUINEA VOYAGER");
      expect(parsed.destination.portName).toContain("Conakry");
      expect(parsed.destination.eta).toBe("2026-08-25T14:00:00Z");

      // Vérification des 2 conteneurs
      expect(parsed.containers).toHaveLength(2);
      expect(parsed.containers[0].number).toBe("MSCU1234567");
      expect(parsed.containers[0].equipmentType).toBe("40HC");
      expect(parsed.containers[0].lastFreeDay).toBe("2026-09-01");

      // Vérification du conteneur avec blocage / hold
      expect(parsed.containers[1].number).toBe("MSCU7654321");
      expect(parsed.containers[1].hasHolds).toBe(true);
      expect(parsed.containers[1].holds[0].name).toBe("Contrôle Scanner Douane");

      // Vérification des événements de transport
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].title).toBe("Départ navire du port de chargement");
    });
  });

  // -------------------------------------------------------------
  // 2. TEST HTTP CLIENT, AUTH HEADER & PATTERN { data, error }
  // -------------------------------------------------------------
  describe("2. Terminal49Client HTTP Protocol & Headers", () => {
    it("utilise le format Token (PAS Bearer) et le Content-Type JSON:API", async () => {
      const client = new Terminal49Client("g4dRkyQHqqDbXBkFtbwnd4TP");

      // Espionnage sur global.fetch
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [mockShipmentResource],
            included: mockIncluded,
          }),
      } as any);

      const result = await client.listShipments({ page: 1, size: 5 });

      expect(fetchSpy).toHaveBeenCalled();
      const lastCallArgs = fetchSpy.mock.calls[0];
      const url = lastCallArgs[0] as string;
      const options = lastCallArgs[1] as RequestInit;

      expect(url).toContain("https://api.terminal49.com/v2/shipments");
      expect(options.headers).toMatchObject({
        Authorization: "Token g4dRkyQHqqDbXBkFtbwnd4TP",
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      });

      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.[0].billOfLadingNumber).toBe("MEDUJ7763785");

      fetchSpy.mockRestore();
    });

    it("respecte la limite de 10 slots du plan gratuit pour la pagination", async () => {
      const client = new Terminal49Client("test_key");

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      } as any);

      await client.listShipments({ page: 1, size: 50 }); // Demande 50

      const lastCallArgs = fetchSpy.mock.calls[0];
      const url = lastCallArgs[0] as string;

      // La taille doit être bridée à 10 max
      expect(url).toContain("page[size]=10");

      fetchSpy.mockRestore();
    });

    it("retourne un pattern { data: null, error: message } propre en cas d'erreur API 404 ou 422", async () => {
      const client = new Terminal49Client("test_key");

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () =>
          JSON.stringify({
            errors: [
              {
                title: "Shipment Not Found",
                detail: "No active shipment found with the provided ID.",
              },
            ],
          }),
      } as any);

      const result = await client.getShipment("shp_non_existant");

      expect(result.data).toBeNull();
      expect(result.error).toContain("No active shipment found");

      fetchSpy.mockRestore();
    });

    it("gère gracieusement le timeout de 10s sans crash de l'application", async () => {
      const client = new Terminal49Client("test_key");

      const fetchSpy = vi.spyOn(global, "fetch").mockImplementationOnce(() => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      const result = await client.getShipment("shp_timeout");

      expect(result.data).toBeNull();
      expect(result.error).toContain("timeout 10s");

      fetchSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------
  // 3. TEST CRÉATION TRACKING REQUEST
  // -------------------------------------------------------------
  describe("3. Tracking Requests Creation", () => {
    it("formate correctement la charge utile JSON:API pour POST /tracking_requests", async () => {
      const client = new Terminal49Client("test_key");

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            data: {
              id: "trk_req_789",
              type: "tracking_request",
              attributes: {
                request_number: "HLCU1234567890",
                request_type: "bill_of_lading",
                status: "created",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            },
          }),
      } as any);

      const result = await client.createTrackingRequest({
        requestNumber: "HLCU1234567890",
        requestType: "bill_of_lading",
        shippingLineScac: "HLCU",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();

      const lastCallArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse((lastCallArgs[1] as RequestInit).body as string);

      expect(body.data.type).toBe("tracking_request");
      expect(body.data.attributes.request_number).toBe("HLCU1234567890");
      expect(body.data.attributes.shipping_line_scac).toBe("HLCU");

      fetchSpy.mockRestore();
    });
  });
});
