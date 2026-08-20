import React, { useEffect, useState, useCallback } from "react";
import { Download, X, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = "igs-pwa-install-dismissed-at";
const DISMISS_DURATION_DAYS = 7;

export interface PWAInstallBannerProps {
  className?: string;
  forceShow?: boolean;
}

export function PWAInstallBanner({ className = "", forceShow = false }: PWAInstallBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Vérifier si l'application fonctionne déjà en mode PWA autonome
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Vérifier si la bannière a été masquée récemment
    const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const daysSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_DURATION_DAYS && !forceShow) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } else {
      setIsDismissed(false);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [forceShow]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback instruction pour navigateurs iOS / Safari ou installation manuelle
      return;
    }

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
      }
    } catch (err) {
      console.error("[PWA] Installation prompt error:", err);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  }, []);

  // Ne pas afficher si déjà installé, masqué par l'utilisateur, ou sans prompt disponible (sauf si forceShow en mode démo/test)
  if (isInstalled || (isDismissed && !forceShow) || (!deferredPrompt && !forceShow)) {
    return null;
  }

  return (
    <aside
      aria-label="Installation de l'application mobile"
      data-testid="pwa-install-banner"
      className={`relative flex items-center justify-between gap-3 bg-gradient-to-r from-[#0b3b32] to-[#155346] px-4 py-2.5 text-white shadow-md transition-all sm:px-6 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#d9a94b] shadow-inner">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-white">Application Mobile IGS Port Conakry</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d9a94b]/20 px-2 py-0.5 text-[10px] font-bold text-[#d9a94b]">
              <Sparkles className="h-2.5 w-2.5" /> PWA Terrain
            </span>
          </div>
          <p className="truncate text-[11px] text-[#b8d5cc]">
            Installez l'accès direct et travaillez hors-ligne sur les quais du Port Autonome.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="h-8 rounded-xl bg-[#d9a94b] px-3.5 text-xs font-bold text-[#0b3b32] shadow-sm hover:bg-[#e5b95c] active:scale-95 transition-transform"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {isInstalling ? "Installation..." : "Installer l'app"}
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fermer la bannière d'installation"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

export default PWAInstallBanner;
