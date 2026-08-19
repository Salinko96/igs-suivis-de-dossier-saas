import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes de cache mémoire (navigation instantanée sans rechargement)
      gcTime: 1000 * 60 * 15,    // 15 minutes de rétention
      refetchOnWindowFocus: false, // Pas de requêtes réseau inutiles à chaque focus
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      async fetch(input, init) {
        try {
          const res = await globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });

          // Vérifier si la réponse est du JSON valide
          const contentType = res.headers.get("content-type") || "";
          const isJson = contentType.includes("application/json");

          if (!isJson) {
            const rawText = await res.text();
            console.warn(`[tRPC Client] Intercepted non-JSON response (${res.status}):`, rawText);

            // Synthesize a valid tRPC JSON batch error structure
            let userFriendlyMsg = "Une erreur serveur temporaire est survenue. Veuillez réessayer.";
            if (rawText && rawText.length > 0 && rawText.length < 200 && !rawText.includes("<html") && !rawText.includes("<!DOCTYPE")) {
              userFriendlyMsg = rawText.trim();
            } else if (res.status === 504 || res.status === 502) {
              userFriendlyMsg = "Le serveur Vercel n'a pas répondu à temps (Délai d'attente dépassé).";
            } else if (res.status === 404) {
              userFriendlyMsg = "Ressource ou endpoint API introuvable.";
            }

            const safePayload = [
              {
                error: {
                  message: userFriendlyMsg,
                  code: -32603,
                  data: {
                    code: "INTERNAL_SERVER_ERROR",
                    httpStatus: res.status >= 400 ? res.status : 500,
                  },
                },
              },
            ];

            return new Response(JSON.stringify(safePayload), {
              status: res.status >= 400 ? res.status : 500,
              headers: {
                "Content-Type": "application/json",
              },
            });
          }

          return res;
        } catch (fetchErr: any) {
          console.error("[tRPC Client] Network Exception:", fetchErr);
          const networkPayload = [
            {
              error: {
                message: "Impossible de joindre le serveur. Vérifiez votre connexion Internet.",
                code: -32603,
                data: {
                  code: "INTERNAL_SERVER_ERROR",
                  httpStatus: 503,
                },
              },
            },
          ];
          return new Response(JSON.stringify(networkPayload), {
            status: 503,
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
