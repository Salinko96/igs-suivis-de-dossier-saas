import DashboardLayout from "@/components/DashboardLayout";
import { CustomsEditModal, CustomsEditDossier } from "@/components/CustomsEditModal";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CopyCheck,
  Edit3,
  ExternalLink,
  FileQuestion,
  FileWarning,
  Filter,
  Landmark,
  PackageOpen,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  TimerReset,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

// ----------------- TYPES ET SYSTÈME DE FILTRE UNIFIÉ -----------------
export type DashboardFilter =
  | { type: "anomaly"; value: string; label: string }
  | { type: "client"; value: string; label: string }
  | { type: "eta_window"; value: "under_7_days"; label: string }
  | { type: "eta_status"; value: "overdue_no_exit"; label: string }
  | { type: "released_status"; value: "released" | "average_duration"; label: string }
  | { type: "alert"; value: "all" | "ddi_bulletin" | string; label: string }
  | { type: "duplicate_client"; value: "duplicate_client_number"; label: string };

const controls = [
  {
    key: "missingClientNumber",
    title: "N° dossier client manquants",
    caption: "À compléter avec le client",
    icon: FileQuestion,
    tone: "text-[#bf5038] bg-[#fff0eb]",
    filter: { type: "anomaly", value: "missingClientNumber", label: "N° dossier client manquants" } as const,
  },
  {
    key: "missingRelease",
    title: "Sorties non renseignées",
    caption: "Marchandises sans date de sortie PAC",
    icon: PackageOpen,
    tone: "text-[#a16b0a] bg-[#fff5df]",
    filter: { type: "anomaly", value: "missingRelease", label: "Sorties non renseignées" } as const,
  },
  {
    key: "duplicateBlLta",
    title: "Doublons BL / LTA",
    caption: "Vérifier les connaissements en double",
    icon: ClipboardCheck,
    tone: "text-[#bf5038] bg-[#fff0eb]",
    filter: { type: "anomaly", value: "duplicateBlLta", label: "Doublons BL / LTA" } as const,
  },
  {
    key: "duplicateClientNumber",
    title: "Doublons N° dossier client",
    caption: "Contrôler les références client",
    icon: CopyCheck,
    tone: "text-[#a16b0a] bg-[#fff5df]",
    filter: { type: "duplicate_client", value: "duplicate_client_number", label: "Doublons N° dossier client" } as const,
  },
  {
    key: "missingDeclarations",
    title: "Déclarations manquantes",
    caption: "N° SYDONIA à renseigner",
    icon: ReceiptText,
    tone: "text-[#a16b0a] bg-[#fff5df]",
    filter: { type: "anomaly", value: "missingDeclarations", label: "Déclarations manquantes (SYDONIA)" } as const,
  },
  {
    key: "missingBulletins",
    title: "Bulletins manquants",
    caption: "Bulletins de liquidation (BLD)",
    icon: FileWarning,
    tone: "text-[#bf5038] bg-[#fff0eb]",
    filter: { type: "anomaly", value: "missingBulletins", label: "Bulletins manquants (BLD)" } as const,
  },
  {
    key: "missingEta",
    title: "ETA manquantes",
    caption: "Planification d'arrivée non définie",
    icon: CalendarClock,
    tone: "text-[#a16b0a] bg-[#fff5df]",
    filter: { type: "anomaly", value: "missingEta", label: "ETA manquantes" } as const,
  },
] as const;

// Helper sûr pour tester la présence d'une anomalie
function hasAnomaly(dossier: { anomalies?: string[] | string | null; issues?: string[] }, anomaly: string): boolean {
  const anomalies = dossier.anomalies || dossier.issues;

  if (Array.isArray(anomalies)) {
    return anomalies.some((item) =>
      String(item).toLowerCase().includes(anomaly.toLowerCase())
    );
  }

  return String(anomalies ?? "")
    .toLowerCase()
    .includes(anomaly.toLowerCase());
}

// Helper pour calculer le délai en jours entre ETA et date de sortie PAC
function getEtaToReleaseDays(eta: Date | string | null, releaseDate: Date | string | null): number | null {
  if (!eta || !releaseDate) return null;
  const t1 = new Date(eta).getTime();
  const t2 = new Date(releaseDate).getTime();
  if (isNaN(t1) || isNaN(t2)) return null;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

// Fonction centrale de correspondance de filtre
function matchesFilter(
  dossier: any,
  filter: DashboardFilter,
  duplicatesBL: Map<string, number>,
  duplicatesClient: Map<string, number>
): boolean {
  switch (filter.type) {
    case "anomaly": {
      if (filter.value === "missingClientNumber" || filter.value.toLowerCase().includes("n° client")) {
        return !dossier.clientDossierNumber || hasAnomaly(dossier, "N° client");
      }
      if (filter.value === "missingRelease" || filter.value.toLowerCase().includes("sortie pac")) {
        return !dossier.goodsReleaseDate || hasAnomaly(dossier, "Sortie PAC non saisie");
      }
      if (filter.value === "duplicateBlLta" || filter.value.toLowerCase().includes("bl doublon")) {
        const cleanBl = dossier.blLtaNumber?.trim().toUpperCase();
        return Boolean(cleanBl && (duplicatesBL.get(cleanBl) || 0) > 1) || hasAnomaly(dossier, "BL doublon");
      }
      if (filter.value === "missingDeclarations" || filter.value.toLowerCase().includes("sydonia")) {
        return !dossier.declarationNumber || hasAnomaly(dossier, "SYDONIA manquant");
      }
      if (filter.value === "missingBulletins" || filter.value.toLowerCase().includes("bld")) {
        return !dossier.bulletinNumber || hasAnomaly(dossier, "BLD manquant");
      }
      if (filter.value === "missingEta" || filter.value.toLowerCase().includes("eta")) {
        return !dossier.eta || hasAnomaly(dossier, "ETA");
      }
      return hasAnomaly(dossier, filter.value);
    }
    case "duplicate_client": {
      const cleanRef = dossier.clientDossierNumber?.trim().toUpperCase();
      return Boolean(cleanRef && (duplicatesClient.get(cleanRef) || 0) > 1);
    }
    case "client": {
      if (
        filter.value === "Client non renseigné" ||
        filter.value === "non_renseigne" ||
        filter.value === ""
      ) {
        return !dossier.client || dossier.client.trim() === "" || dossier.client.toLowerCase().includes("non renseigné");
      }
      return String(dossier.client || "").trim().toLowerCase() === filter.value.trim().toLowerCase();
    }
    case "eta_window": {
      if (filter.value === "under_7_days") {
        if (!dossier.eta) return false;
        const etaDate = new Date(dossier.eta);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const in7Days = new Date(now);
        in7Days.setDate(in7Days.getDate() + 7);
        in7Days.setHours(23, 59, 59, 999);
        return etaDate >= now && etaDate <= in7Days;
      }
      return false;
    }
    case "eta_status": {
      if (filter.value === "overdue_no_exit") {
        if (!dossier.eta) return false;
        return !dossier.goodsReleaseDate && new Date(dossier.eta) < new Date();
      }
      return false;
    }
    case "released_status": {
      if (filter.value === "released") {
        return Boolean(dossier.goodsReleaseDate);
      }
      if (filter.value === "average_duration") {
        return Boolean(dossier.eta && dossier.goodsReleaseDate);
      }
      return false;
    }
    case "alert": {
      if (filter.value === "all") {
        return true;
      }
      if (filter.value === "ddi_bulletin") {
        return (
          dossier.fieldAlert?.toLowerCase().includes("ddi") ||
          dossier.fieldAlert?.toLowerCase().includes("bulletin") ||
          !dossier.ddiGucegNumber ||
          !dossier.bulletinNumber
        );
      }
      return String(dossier.fieldAlert || "").toLowerCase().includes(filter.value.toLowerCase());
    }
    default:
      return true;
  }
}

function ControlsContent() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // États React du système de filtrage interactif
  const [activeFilter, setActiveFilter] = useState<DashboardFilter | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCustomsDossier, setEditingCustomsDossier] = useState<CustomsEditDossier | null>(null);

  const priorityTableRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, refetch } = trpc.dashboard.get.useQuery();
  const { data: dossiers = [], error: dossiersError, refetch: refetchDossiers } = trpc.dossier.list.useQuery();

  // Détection des doublons BL / LTA réels
  const duplicatesBL = useMemo(() => {
    const map = new Map<string, number>();
    dossiers.forEach(dossier => {
      const bl = dossier.blLtaNumber?.trim().toUpperCase();
      if (bl) {
        map.set(bl, (map.get(bl) || 0) + 1);
      }
    });
    return map;
  }, [dossiers]);

  // Détection des doublons N° dossier client réels
  const duplicatesClient = useMemo(() => {
    const map = new Map<string, number>();
    dossiers.forEach(dossier => {
      const ref = dossier.clientDossierNumber?.trim().toUpperCase();
      if (ref) {
        map.set(ref, (map.get(ref) || 0) + 1);
      }
    });
    return map;
  }, [dossiers]);

  // Calcul structuré de tous les dossiers avec leurs anomalies réelles
  const dossiersPrioritaires = useMemo(() => {
    return dossiers.map(dossier => {
      const bl = dossier.blLtaNumber?.trim().toUpperCase();
      const issues: string[] = [
        [!dossier.clientDossierNumber, "N° client"],
        [!dossier.eta, "ETA"],
        [!dossier.declarationNumber, "SYDONIA manquant"],
        [!dossier.bulletinNumber, "BLD manquant"],
        [!dossier.goodsReleaseDate, "Sortie PAC non saisie"],
        [Boolean(bl && (duplicatesBL.get(bl) || 0) > 1), "BL doublon"],
      ]
        .filter(([issue]) => Boolean(issue))
        .map(([, label]) => String(label));

      const delayDays = getEtaToReleaseDays(dossier.eta, dossier.goodsReleaseDate);

      return {
        ...dossier,
        issues,
        delayDays,
      };
    });
  }, [dossiers, duplicatesBL]);

  // Base des dossiers à régulariser (avec au moins une anomalie par défaut)
  const baseAnomaliesDossiers = useMemo(() => {
    return dossiersPrioritaires.filter(d => d.issues.length > 0 || d.calculatedStatus === "À régulariser");
  }, [dossiersPrioritaires]);

  // Liste finale affichée dans le tableau "Actions prioritaires"
  const displayedDossiers = useMemo(() => {
    if (!activeFilter) {
      return baseAnomaliesDossiers;
    }

    // Si on filtre sur des statuts globaux de délai/sortie, on cherche dans l'ensemble des dossiers
    const searchPool = (activeFilter.type === "released_status" || activeFilter.type === "eta_window" || activeFilter.type === "eta_status")
      ? dossiersPrioritaires
      : baseAnomaliesDossiers;

    let filtered = searchPool.filter(dossier =>
      matchesFilter(dossier, activeFilter, duplicatesBL, duplicatesClient)
    );

    // Tri spécifique si "Délai moyen ETA -> sortie"
    if (activeFilter.type === "released_status" && activeFilter.value === "average_duration") {
      filtered = [...filtered].sort((a, b) => (b.delayDays || 0) - (a.delayDays || 0));
    }

    return filtered;
  }, [baseAnomaliesDossiers, dossiersPrioritaires, activeFilter, duplicatesBL, duplicatesClient]);

  // Fonction unique de gestion des filtres avec scroll fluide automatique
  const handleDashboardFilter = (filter: DashboardFilter) => {
    if (
      activeFilter &&
      activeFilter.type === filter.type &&
      activeFilter.value === filter.value
    ) {
      // Déclic : réinitialiser si on clique sur le filtre déjà actif
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
      setCurrentPage(1);

      requestAnimationFrame(() => {
        priorityTableRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const isFilterActive = (type: DashboardFilter["type"], value: string): boolean => {
    return Boolean(activeFilter && activeFilter.type === type && activeFilter.value === value);
  };

  if (error || dossiersError) {
    console.error("[ControlsPage] Erreur de chargement des contrôles douaniers:", error || dossiersError);
    return (
      <Card className="border-0 bg-white">
        <CardContent className="p-10 text-center">
          <AlertTriangle className="mx-auto text-[#c4543e] h-10 w-10" />
          <p className="mt-4 font-semibold text-[#ad4c38]">Impossible de charger les contrôles</p>
          <p className="mt-2 text-sm text-[#71817b]">{(error || dossiersError)?.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              refetchDossiers();
            }}
            className="mt-4 rounded-xl border-[#dfe8e4] text-[#2b4c42] hover:bg-[#edf5f1] text-xs"
          >
            <RotateCcw size={14} className="mr-1.5" /> Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data)
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );

  const { quality = {}, metrics = {}, clients = [], fieldAlerts = [] } = (data as any) || {};

  return (
    <div className="mx-auto max-w-[1540px] space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Contrôles Douane & PAC", active: true },
        ]}
        backHref="/"
      />

      {/* Header */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[#103b32] px-6 py-7 text-white shadow-[0_18px_45px_rgba(14,59,50,0.17)] sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[30px] border-[#d9a94b]/15" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9a94b]">Audit & Conformité</p>
        <h1 className="mt-2 font-[Georgia] text-3xl font-semibold tracking-tight sm:text-4xl">
          Contrôles Douane & PAC
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c6d8d1]">
          Surveillance continue des données de transit (Port Autonome de Conakry, SYDONIA World, DDI/GUCEG) et régularisation instantanée des anomalies.
        </p>
      </section>

      {/* SECTION A : ALERTES TERRAIN */}
      {fieldAlerts.length > 0 && (
        <section aria-label="Filtres alertes terrain" className="rounded-2xl border border-[#dfe8e4] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={17} className="text-[#1d7764]" />
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#697d76]">Alertes terrain enregistrées</p>
            </div>
            {activeFilter?.type === "alert" && (
              <span className="text-[11px] font-semibold text-[#1d7764] animate-pulse">● Filtre alerte actif</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={activeFilter === null || activeFilter?.value === "all"}
              onClick={() => handleDashboardFilter({ type: "alert", value: "all", label: "Toutes les alertes terrain" })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeFilter === null || (activeFilter.type === "alert" && activeFilter.value === "all")
                  ? "bg-[#0f4035] text-white shadow-sm ring-2 ring-[#0f4035]/30"
                  : "bg-[#f1f6f4] text-[#33534a] hover:bg-[#e3eeea] hover:text-[#0f4035]"
              }`}
            >
              Toutes les alertes
            </button>
            {fieldAlerts.map((alert: any) => {
              const isActive = isFilterActive("alert", alert.label);
              return (
                <button
                  type="button"
                  key={alert.label}
                  aria-pressed={isActive}
                  aria-label={`Filtrer par alerte : ${alert.label} (${alert.count})`}
                  onClick={() => handleDashboardFilter({ type: "alert", value: alert.label, label: alert.label })}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 ${
                    isActive
                      ? "bg-[#0f4035] text-white shadow-sm ring-2 ring-[#0f4035]"
                      : "bg-[#f1f6f4] text-[#33534a] hover:bg-[#e3eeea]"
                  }`}
                >
                  <span>{alert.label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? "bg-white/30 text-white" : "bg-white/80 text-[#163b31]"}`}>
                    {alert.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION B : POINTS D’ATTENTION PRIORITAIRES (7 CARTES KPI) */}
      <section aria-label="Points d'attention prioritaires">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Qualité des dossiers</p>
            <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">Points d’attention prioritaires</h2>
          </div>
          <Badge className="border-0 bg-[#fff0eb] text-[#bd5038] font-semibold">
            {quality.incomplete || baseAnomaliesDossiers.length} dossiers avec anomalies
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {controls.map(control => {
            const Icon = control.icon;
            const value = quality[control.key] ?? 0;
            const isActive = isFilterActive(control.filter.type, control.filter.value);

            return (
              <button
                type="button"
                key={control.key}
                aria-pressed={isActive}
                aria-label={`Filtrer par anomalie : ${control.title} (${value} dossiers)`}
                onClick={() => handleDashboardFilter(control.filter)}
                className={`group relative text-left rounded-2xl border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3b32] p-5 ${
                  isActive ? "ring-2 ring-[#0b3b32] bg-[#f4f8f6] shadow-md" : "hover:ring-2 hover:ring-[#0b3b32]/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 ${control.tone}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-[Georgia] text-2xl font-bold text-[#163b31]">{value}</p>
                      <p className="mt-0.5 text-sm font-medium text-[#3e5a52]">{control.title}</p>
                      <p className="mt-0.5 text-xs text-[#82918c]">{control.caption}</p>
                    </div>
                  </div>
                  {isActive ? (
                    <Badge className="bg-[#0b3b32] text-white text-[10px] font-semibold animate-in fade-in">
                      Actif
                    </Badge>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-emerald-800 flex items-center gap-0.5">
                      Voir <ArrowRight size={11} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION C & D : DÉLAIS & ROTATIONS / ANALYSE PAR CLIENT */}
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]" aria-label="Délais et concentration client">
        {/* SECTION C : DÉLAIS & ROTATIONS (4 CARTES CLIQUABLES) */}
        <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Fluidité & Transit</p>
                <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">Délais & rotations</h2>
              </div>
              <TimerReset className="text-[#1d7764]" size={21} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "ETA prévues sous 7 jours",
                  value: metrics.etaInSevenDays,
                  icon: CalendarClock,
                  tone: "bg-[#e7f1ed] text-[#216e5c]",
                  filter: { type: "eta_window", value: "under_7_days", label: "ETA prévues sous 7 jours" } as const,
                },
                {
                  label: "Délai moyen ETA → sortie",
                  value: metrics.averageEtaToRelease === null ? "—" : `${metrics.averageEtaToRelease} j`,
                  icon: TimerReset,
                  tone: "bg-[#e7f1ed] text-[#216e5c]",
                  filter: { type: "released_status", value: "average_duration", label: "Délai ETA → Sortie PAC" } as const,
                },
                {
                  label: "Part des dossiers sortis",
                  value: `${metrics.releasedShare}%`,
                  icon: CheckCircle2,
                  tone: "bg-[#edf2f0] text-[#42635a]",
                  filter: { type: "released_status", value: "released", label: "Dossiers avec sortie PAC effectuée" } as const,
                },
                {
                  label: "ETA dépassées sans sortie",
                  value: metrics.overdue,
                  icon: AlertTriangle,
                  tone: "bg-[#fff0eb] text-[#bf5038]",
                  filter: { type: "eta_status", value: "overdue_no_exit", label: "ETA dépassées sans sortie PAC" } as const,
                },
              ].map(item => {
                const isActive = isFilterActive(item.filter.type, item.filter.value);
                return (
                  <button
                    type="button"
                    key={item.label}
                    aria-pressed={isActive}
                    aria-label={`Filtrer par : ${item.label}`}
                    onClick={() => handleDashboardFilter(item.filter)}
                    className={`group text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3b32] ${
                      isActive
                        ? "border-[#0b3b32] bg-[#f4f8f6] ring-2 ring-[#0b3b32]"
                        : "border-[#edf2ef] bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`grid h-9 w-9 place-items-center rounded-lg ${item.tone}`}>
                        <item.icon size={17} />
                      </div>
                      {isActive ? (
                        <Badge className="bg-[#0b3b32] text-white text-[9px] font-semibold">Actif</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          Filtrer →
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-2xl font-bold text-[#173a31]">{item.value}</p>
                    <p className="mt-1 text-xs font-medium text-[#71817b]">{item.label}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SECTION D : ANALYSE PAR CLIENT (LIGNES CLIQUABLES) */}
        <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Analyse par client</p>
                <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">
                  Concentration des régularisations
                </h2>
              </div>
              <Landmark className="text-[#1d7764]" size={21} />
            </div>
            <div className="mt-5 overflow-hidden rounded-xl border border-[#edf2ef]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8faf9] text-[10px] uppercase tracking-[0.12em] text-[#7d8d87]">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-right">À régulariser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2ef]">
                  {clients.slice(0, 7).map((clientItem: any) => {
                    const isClientActive = isFilterActive("client", clientItem.client);
                    return (
                      <tr
                        key={clientItem.client}
                        onClick={() => handleDashboardFilter({ type: "client", value: clientItem.client, label: `Client : ${clientItem.client}` })}
                        className={`cursor-pointer transition-colors duration-150 select-none ${
                          isClientActive
                            ? "bg-[#e8f3ef] font-semibold text-[#0b3b32]"
                            : "hover:bg-emerald-50/60 text-[#335148]"
                        }`}
                      >
                        <td className="max-w-[240px] truncate px-4 py-3 font-medium flex items-center justify-between">
                          <span className="truncate">{clientItem.client}</span>
                          {isClientActive && (
                            <Badge className="bg-[#0b3b32] text-white text-[9px] ml-2">Sélectionné</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[#596e67]">{clientItem.total}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className="border-0 bg-[#fff0eb] text-[#bf5038] font-semibold">
                            {clientItem.toRegularize}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECTION E : TABLEAU ACTIONS PRIORITAIRES */}
      <section ref={priorityTableRef} id="dossiers-prioritaires" className="scroll-mt-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Actions prioritaires</p>
            <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">
              Dossiers à régulariser en priorité ({displayedDossiers.length})
            </h2>
          </div>
          {activeFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveFilter(null)}
              className="h-8 text-xs font-semibold text-[#bd5038] border-[#f7d4cb] bg-[#fff6f4] hover:bg-[#ffebe6] gap-1.5 rounded-xl transition-all"
            >
              <RotateCcw size={13} /> Réinitialiser tous les filtres
            </Button>
          )}
        </div>

        {/* Bandeau Responsive du Filtre Actif */}
        {activeFilter && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 shadow-sm animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-[#0b3b32] text-white font-semibold text-xs px-2.5 py-0.5">
                Filtre actif : {activeFilter.label} ({displayedDossiers.length} dossier{displayedDossiers.length > 1 ? "s" : ""})
              </Badge>
              <span className="text-xs text-[#33534a] font-medium hidden md:inline">
                Affichage filtré en temps réel depuis la base Supabase
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter(null)}
              className="h-7 text-[11px] font-bold text-[#0b3b32] hover:bg-emerald-100/70 gap-1 px-2.5 rounded-lg"
            >
              <X size={13} /> Retirer le filtre
            </Button>
          </div>
        )}

        {dossiersError ? (
          <Card className="border-0 bg-white">
            <CardContent className="p-5 text-sm text-[#ad4c38]">
              Impossible de charger la liste détaillée : {(dossiersError as any)?.message || "Erreur de connexion"}
            </CardContent>
          </Card>
        ) : (
          <div>
            {/* Desktop Table View with Sticky Action Column and Horizontal Scroll Indicator */}
            <div className="hidden md:block">
              <Card className="overflow-hidden border border-[#e2ece7] bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-emerald-800/20 scrollbar-track-transparent">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase tracking-[0.12em] text-[#7d8d87]">
                      <tr>
                        <th className="px-5 py-3.5">Dossier</th>
                        <th className="px-5 py-3.5">Client</th>
                        <th className="px-5 py-3.5">Marchandise</th>
                        {activeFilter?.type === "released_status" && activeFilter?.value === "average_duration" && (
                          <th className="px-5 py-3.5">Délai ETA → Sortie</th>
                        )}
                        <th className="px-5 py-3.5">Anomalies détectées</th>
                        <th className="px-5 py-3.5 text-right sticky right-0 bg-[#f8faf9] z-10 shadow-[-8px_0_12px_rgba(0,0,0,0.03)] min-w-[200px]">
                          Régularisation Rapide
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ef]">
                      {displayedDossiers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-xs text-muted-foreground">
                            <Filter className="mx-auto mb-2 text-gray-400" size={24} />
                            <p className="font-semibold text-gray-700">Aucun dossier concerné par ce filtre.</p>
                            <p className="mt-1 text-gray-500">Essayez de réinitialiser le filtre pour afficher la liste complète.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveFilter(null)}
                              className="mt-3 text-xs rounded-xl border-[#dfe8e4] text-[#0b3b32]"
                            >
                              <RotateCcw size={12} className="mr-1.5" /> Réinitialiser
                            </Button>
                          </td>
                        </tr>
                      ) : (
                        displayedDossiers.map(dossier => {
                          return (
                            <tr
                              key={dossier.id}
                              onMouseEnter={() => utils.dossier.get.prefetch({ id: dossier.id })}
                              onFocus={() => utils.dossier.get.prefetch({ id: dossier.id })}
                              className="hover:bg-[#f8faf9] transition group"
                            >
                              <td className="px-5 py-3.5 font-semibold text-[#176b55]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/dossiers/${dossier.id}`);
                                  }}
                                  className="hover:underline text-left font-bold text-[#113b31] cursor-pointer"
                                >
                                  {dossier.dossierNumber}
                                </button>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  BL: {dossier.blLtaNumber || "—"}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-[#4d665e] font-medium">{dossier.client || "Client non renseigné"}</td>
                              <td className="px-5 py-3.5 text-xs text-[#5f756e] truncate max-w-[180px]">
                                {dossier.cargoNature || "—"}
                              </td>

                              {activeFilter?.type === "released_status" && activeFilter?.value === "average_duration" && (
                                <td className="px-5 py-3.5">
                                  <Badge className="bg-emerald-100 text-emerald-900 border-0 font-mono text-[11px]">
                                    <Clock size={11} className="mr-1" />
                                    {dossier.delayDays !== null ? `${dossier.delayDays} jours` : "—"}
                                  </Badge>
                                </td>
                              )}

                              <td className="px-5 py-3.5">
                                <div className="flex flex-wrap gap-1">
                                  {dossier.issues.length === 0 ? (
                                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                                      Conforme
                                    </Badge>
                                  ) : (
                                    dossier.issues.map((issue: string) => (
                                      <button
                                        type="button"
                                        key={issue}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDashboardFilter({ type: "anomaly", value: issue, label: `Anomalie : ${issue}` });
                                        }}
                                        className="border-0 bg-[#fff0eb] text-[#bd5038] hover:bg-[#ffe2d9] transition-colors rounded-md px-1.5 py-0.5 text-[10px] font-medium cursor-pointer"
                                        title={`Cliquer pour filtrer uniquement sur « ${issue} »`}
                                      >
                                        {issue}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right sticky right-0 bg-white group-hover:bg-[#f8faf9] z-10 shadow-[-8px_0_12px_rgba(0,0,0,0.03)] transition-colors">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCustomsDossier(dossier);
                                    }}
                                    className="h-7 rounded-lg bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs px-2.5 shadow-sm font-medium"
                                  >
                                    <Edit3 size={12} className="mr-1" /> Régulariser
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocation(`/dossiers/${dossier.id}`);
                                    }}
                                    className="h-7 text-xs text-[#294a40] border-[#dfe8e4] hover:bg-[#edf5f1] px-2 font-medium"
                                  >
                                    Fiche <ChevronRight size={12} className="ml-0.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Mobile / Tablet Stacked Cards View */}
            <div className="block md:hidden space-y-3">
              {displayedDossiers.length === 0 ? (
                <Card className="border-0 bg-white p-8 text-center text-xs text-muted-foreground">
                  <Filter className="mx-auto mb-2 text-gray-400" size={24} />
                  <p className="font-semibold text-gray-700">Aucun dossier concerné par ce filtre.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveFilter(null)}
                    className="mt-3 text-xs rounded-xl border-[#dfe8e4] text-[#0b3b32]"
                  >
                    <RotateCcw size={12} className="mr-1.5" /> Réinitialiser
                  </Button>
                </Card>
              ) : (
                displayedDossiers.map(dossier => {
                  return (
                    <Card
                      key={dossier.id}
                      className="overflow-hidden border border-[#e2ece7] bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-[#edf2ef] pb-2.5">
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/dossiers/${dossier.id}`);
                              }}
                              className="text-base font-bold text-[#123e34] hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                            >
                              {dossier.dossierNumber}
                              <ExternalLink size={13} className="text-[#1d7764]" />
                            </button>
                            <p className="text-xs font-medium text-[#4d665e] mt-0.5">
                              {dossier.client || "Client non renseigné"}
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono text-[11px] border-[#c2d6ce] text-[#245347] bg-[#f4f8f6]">
                            BL: {dossier.blLtaNumber || "—"}
                          </Badge>
                        </div>

                        {dossier.cargoNature && (
                          <p className="text-xs text-[#637b73]">
                            <span className="font-medium text-[#3b534c]">Marchandise :</span> {dossier.cargoNature}
                          </p>
                        )}

                        <div>
                          <p className="text-[11px] font-semibold text-[#7f908a] uppercase tracking-wider mb-1.5">
                            Anomalies détectées ({dossier.issues.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {dossier.issues.length === 0 ? (
                              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[11px]">
                                Conforme
                              </Badge>
                            ) : (
                              dossier.issues.map((issue: string) => (
                                <button
                                  type="button"
                                  key={issue}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDashboardFilter({ type: "anomaly", value: issue, label: `Anomalie : ${issue}` });
                                  }}
                                  className="border-0 bg-[#fff0eb] text-[#bd5038] hover:bg-[#ffe2d9] transition-colors rounded-md px-2 py-0.5 text-[11px] font-medium flex items-center cursor-pointer"
                                >
                                  <AlertCircle size={11} className="mr-1 inline" />
                                  {issue}
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#edf2ef]">
                          <Button
                            size="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCustomsDossier(dossier);
                            }}
                            className="h-10 w-full rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Edit3 size={14} /> Régulariser
                          </Button>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/dossiers/${dossier.id}`);
                            }}
                            className="h-10 w-full rounded-xl border-[#dfe8e4] text-[#23473d] hover:bg-[#edf5f1] text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            Fiche <ChevronRight size={14} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      {/* Modal d'édition rapide douane intégrée */}
      <CustomsEditModal
        isOpen={Boolean(editingCustomsDossier)}
        onClose={() => setEditingCustomsDossier(null)}
        dossier={editingCustomsDossier}
      />
    </div>
  );
}

export default function ControlsPage() {
  return (
    <DashboardLayout>
      <ControlsContent />
    </DashboardLayout>
  );
}
