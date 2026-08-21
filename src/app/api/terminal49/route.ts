import { terminal49 } from "@/lib/terminal49/client";

/**
 * GET /api/terminal49 - Liste des cargaisons suivies via Terminal49
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const size = parseInt(searchParams.get("size") || "10", 10);
    const number = searchParams.get("number");
    const scac = searchParams.get("scac") || undefined;

    if (number) {
      const result = await terminal49.trackByNumber(number, scac);
      if (result.error) {
        return Response.json({ data: null, error: result.error }, { status: 400 });
      }
      return Response.json({ data: result.data, error: null }, { status: 200 });
    }

    const result = await terminal49.listShipments({ page, size });
    if (result.error) {
      return Response.json({ data: null, error: result.error }, { status: 400 });
    }

    return Response.json({ data: result.data, error: null }, { status: 200 });
  } catch (err: any) {
    return Response.json(
      { data: null, error: err.message || "Erreur serveur Terminal49" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminal49 - Crée une demande de tracking (BL / Conteneur)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestNumber, requestType, shippingLineScac } = body;

    if (!requestNumber) {
      return Response.json(
        { data: null, error: "Le champ requestNumber est obligatoire." },
        { status: 400 }
      );
    }

    const result = await terminal49.createTrackingRequest({
      requestNumber,
      requestType,
      shippingLineScac,
    });

    if (result.error) {
      return Response.json({ data: null, error: result.error }, { status: 400 });
    }

    return Response.json({ data: result.data, error: null }, { status: 201 });
  } catch (err: any) {
    return Response.json(
      { data: null, error: err.message || "Erreur lors de la création du tracking" },
      { status: 500 }
    );
  }
}
