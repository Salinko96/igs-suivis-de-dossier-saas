import { terminal49 } from "@/lib/terminal49/client";

/**
 * GET /api/terminal49/shipments/[id] - Détail d'une cargaison par son ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    if (!id) {
      return Response.json(
        { data: null, error: "Identifiant de cargaison manquant." },
        { status: 400 }
      );
    }

    const result = await terminal49.getShipment(id);

    if (result.error) {
      return Response.json({ data: null, error: result.error }, { status: 404 });
    }

    return Response.json({ data: result.data, error: null }, { status: 200 });
  } catch (err: any) {
    return Response.json(
      { data: null, error: err.message || "Erreur serveur Terminal49" },
      { status: 500 }
    );
  }
}
