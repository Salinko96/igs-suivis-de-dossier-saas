/**
 * safeFetch — Client HTTP sécurisé et résilient pour le frontend IGS SaaS
 *
 * Élimine définitivement les erreurs de type:
 * "Unexpected token 'A', 'An error o'... is not valid JSON"
 *
 * Règles :
 * 1. Vérifie response.ok
 * 2. Inspecte le header Content-Type (application/json vs texte/HTML)
 * 3. En cas d'erreur serveur non-JSON (ex: crash Vercel 500/504), lit response.text() en fallback
 * 4. Renvoie toujours une structure typée { data, error, ok, status }
 */

export interface SafeFetchResult<T = any> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export async function safeFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await globalThis.fetch(input, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (res.ok) {
      if (isJson) {
        try {
          const data = await res.json();
          return { data, error: null, status: res.status, ok: true };
        } catch (jsonErr: any) {
          console.warn("[safeFetch] JSON parsing failed despite 200 OK:", jsonErr);
          return {
            data: null,
            error: "Format de réponse inattendu reçu du serveur.",
            status: res.status,
            ok: false,
          };
        }
      } else {
        const text = await res.text();
        return {
          data: text as unknown as T,
          error: null,
          status: res.status,
          ok: true,
        };
      }
    }

    // Gestion des erreurs HTTP (4xx, 5xx)
    let errorMessage = `Erreur serveur (${res.status})`;

    if (isJson) {
      try {
        const errJson = await res.json();
        errorMessage =
          errJson.error ||
          errJson.message ||
          errJson.details ||
          (Array.isArray(errJson) && errJson[0]?.error?.message) ||
          errorMessage;
      } catch {
        // Fallback si le JSON d'erreur est corrompu
      }
    } else {
      try {
        const rawText = await res.text();
        if (
          rawText &&
          rawText.length < 300 &&
          !rawText.includes("<html") &&
          !rawText.includes("<!DOCTYPE") &&
          !rawText.includes("<body")
        ) {
          errorMessage = rawText.trim();
        } else if (res.status === 504 || res.status === 502) {
          errorMessage = "Délai d'attente serveur dépassé (Timeout). Veuillez réessayer.";
        } else if (res.status === 500) {
          errorMessage = "Erreur interne temporaire du serveur de données.";
        }
      } catch {
        // Ignorer
      }
    }

    return {
      data: null,
      error: errorMessage,
      status: res.status,
      ok: false,
    };
  } catch (netErr: any) {
    console.error("[safeFetch] Network Exception:", netErr);
    return {
      data: null,
      error:
        netErr.name === "AbortError"
          ? "La requête a été interrompue."
          : "Impossible de joindre le serveur. Vérifiez votre connexion Internet.",
      status: 0,
      ok: false,
    };
  }
}
