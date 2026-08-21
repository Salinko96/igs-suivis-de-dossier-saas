import React, { Component, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Loading chunk") ||
      error?.name === "ChunkLoadError";

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Loading chunk") ||
      error?.name === "ChunkLoadError";

    if (isChunkError) {
      const alreadyReloaded = window.sessionStorage.getItem("error_boundary_chunk_reload");
      if (!alreadyReloaded) {
        window.sessionStorage.setItem("error_boundary_chunk_reload", "true");
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.sessionStorage.removeItem("error_boundary_chunk_reload");
    window.sessionStorage.removeItem("chunk_reload_triggered");
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { isChunkError, error } = this.state;

      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-[#f7faf8]">
          <div className="flex flex-col items-center w-full max-w-lg p-8 bg-white rounded-3xl border border-emerald-950/10 shadow-[0_12px_36px_rgba(11,59,50,0.08)] text-center">
            {isChunkError ? (
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-[#0b3b32] grid place-items-center mb-4">
                <Sparkles size={28} className="text-[#d9a94b]" />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 grid place-items-center mb-4">
                <AlertTriangle size={28} />
              </div>
            )}

            <h2 className="text-xl font-bold font-[Georgia] text-[#0b3b32] mb-2">
              {isChunkError
                ? "Nouvelle version déployée"
                : "Une anomalie temporaire est survenue"}
            </h2>

            <p className="text-xs text-muted-foreground mb-6 max-w-sm">
              {isChunkError
                ? "Une nouvelle mise à jour de la plateforme IGS est disponible. Cliquez ci-dessous pour actualiser et charger les dernières fonctionnalités."
                : "Veuillez actualiser la page pour relancer votre session sécurisée."}
            </p>

            {!isChunkError && error?.message && (
              <div className="p-3 w-full rounded-2xl bg-gray-50 border border-gray-100 overflow-auto mb-6 text-left max-h-32">
                <p className="text-[11px] font-mono text-gray-600 break-words">
                  {error.message}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold shadow-md cursor-pointer transition-all",
                "bg-[#0b3b32] text-white hover:bg-[#164d41] active:scale-95"
              )}
            >
              <RotateCcw size={14} className="text-[#d9a94b]" />
              {isChunkError ? "Actualiser la plateforme" : "Recharger la page"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
