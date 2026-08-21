import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Globe,
  CircleDollarSign,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ActionCategory = "all" | "customs" | "finance" | "portal" | "dossier";

interface UnifiedLogItem {
  id: string;
  sourceType: "audit" | "portal";
  createdAt: Date | string;
  dossierId: number | null;
  authorName: string;
  userRole: string;
  action: string;
  fieldChanged: string;
  category: ActionCategory;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  comment: string | null;
  isSuccess?: boolean;
}

// Helpers de classification des logs
function isCustomsLog(action?: string, field?: string): boolean {
  const text = `${action || ""} ${field || ""}`.toUpperCase();
  return (
    text.includes("STATUT") ||
    text.includes("DOUANE") ||
    text.includes("DDI") ||
    text.includes("SYDONIA") ||
    text.includes("BAE") ||
    text.includes("BAD") ||
    text.includes("PORT") ||
    text.includes("PAC") ||
    text.includes("ACCORD") ||
    text.includes("DECLARATION")
  );
}

function isFinanceLog(action?: string, field?: string): boolean {
  const text = `${action || ""} ${field || ""}`.toUpperCase();
  return (
    text.includes("FACTURE") ||
    text.includes("PAIEMENT") ||
    text.includes("DEBOURS") ||
    text.includes("QUITTANCE") ||
    text.includes("TAUX") ||
    text.includes("FINANCE") ||
    text.includes("APPROBATION") ||
    text.includes("MONTANT")
  );
}

function isDossierLifecycleLog(action?: string, field?: string): boolean {
  const text = `${action || ""} ${field || ""}`.toUpperCase();
  return (
    text.includes("CREATION") ||
    text.includes("CREE") ||
    text.includes("SUPPRESSION") ||
    text.includes("CLOTURE") ||
    text.includes("MODIFICATION") ||
    text.includes("IMPORT")
  );
}

export default function AuditPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionCategory>("all");
  const [isTableHighlighted, setIsTableHighlighted] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref React principale pour le scroll fluide vers le tableau
  const auditTableRef = useRef<HTMLDivElement>(null);

  // Requêtes tRPC pour récupérer l'historique d'audit et les accès portail
  const auditQuery = trpc.audit.list.useQuery({}, { staleTime: 10_000 });
  const portalLogsQuery = trpc.portal.logs.useQuery({}, { staleTime: 10_000 });

  const rawAuditLogs = auditQuery.data || [];
  const rawPortalLogs = portalLogsQuery.data || [];

  // Unification et normalisation des flux d'audit
  const unifiedLogs: UnifiedLogItem[] = useMemo(() => {
    const list: UnifiedLogItem[] = [];

    // 1. Logs d'audit réguliers (modifications statuts, finances, documents, dossiers)
    rawAuditLogs.forEach((l: any) => {
      let category: ActionCategory = "dossier";
      if (isCustomsLog(l.action, l.fieldChanged)) {
        category = "customs";
      } else if (isFinanceLog(l.action, l.fieldChanged)) {
        category = "finance";
      } else if (l.action?.toUpperCase().includes("PORTAIL") || l.userRole === "client") {
        category = "portal";
      } else if (isDossierLifecycleLog(l.action, l.fieldChanged)) {
        category = "dossier";
      }

      list.push({
        id: `audit_${l.id}`,
        sourceType: "audit",
        createdAt: l.createdAt,
        dossierId: l.dossierId ?? null,
        authorName: l.authorName || "Opérateur IGS",
        userRole: l.userRole || "declarant",
        action: l.action || l.fieldChanged || "MODIFICATION",
        fieldChanged: l.fieldChanged || l.action || "Dossier",
        category,
        previousValue: l.previousValue ?? null,
        newValue: l.newValue ?? l.comment ?? null,
        ipAddress: l.ipAddress ?? null,
        comment: l.comment ?? null,
        isSuccess: true,
      });
    });

    // 2. Logs d'accès du portail client externe
    rawPortalLogs.forEach((p: any) => {
      list.push({
        id: `portal_${p.id}`,
        sourceType: "portal",
        createdAt: p.accessedAt,
        dossierId: p.dossierId ?? null,
        authorName: p.clientCompany || "Client Externe",
        userRole: "client",
        action: p.success ? "ACCES_PORTAIL_VALIDE" : "TENTATIVE_ACCES_ECHOUEE",
        fieldChanged: "Portail Client",
        category: "portal",
        previousValue: p.tokenIdentifier ? `Token: ${p.tokenIdentifier.slice(0, 12)}...` : null,
        newValue: p.success
          ? `Consultation dossier via code: ${p.accessCodeUsed || "Direct"}`
          : `Échec accès: ${p.errorReason || "Code invalide"}`,
        ipAddress: p.ipAddress ?? null,
        comment: p.userAgent ? `Navigateur: ${p.userAgent.slice(0, 40)}` : null,
        isSuccess: p.success,
      });
    });

    // Tri chronologique antéchronologique (plus récent en premier)
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rawAuditLogs, rawPortalLogs]);

  // Calcul des compteurs KPI dynamiques
  const kpiStats = useMemo(() => {
    const total = unifiedLogs.length;
    const customs = unifiedLogs.filter((l) => l.category === "customs").length;
    const finance = unifiedLogs.filter((l) => l.category === "finance").length;
    const portal = unifiedLogs.filter((l) => l.category === "portal").length;

    return { total, customs, finance, portal };
  }, [unifiedLogs]);

  // Filtrage combiné : Recherche texte + Catégorie sélectionnée
  const filteredLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        log.authorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.fieldChanged.toLowerCase().includes(q) ||
        (log.dossierId && String(log.dossierId).includes(q)) ||
        (log.dossierId && `dos-${String(log.dossierId).padStart(4, "0")}`.toLowerCase().includes(q)) ||
        (log.newValue && log.newValue.toLowerCase().includes(q)) ||
        (log.previousValue && log.previousValue.toLowerCase().includes(q)) ||
        (log.ipAddress && log.ipAddress.toLowerCase().includes(q)) ||
        (log.comment && log.comment.toLowerCase().includes(q));

      const matchCategory = actionFilter === "all" || log.category === actionFilter;

      return matchSearch && matchCategory;
    });
  }, [unifiedLogs, searchTerm, actionFilter]);

  // Fonction de scroll fluide avec prise en compte de prefers-reduced-motion et highlight
  const scrollToTable = useCallback(() => {
    // Déclencher le halo visuel temporaire sur la zone du tableau
    setIsTableHighlighted(true);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setIsTableHighlighted(false);
    }, 1500);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    // Plan A : via React Ref
    if (auditTableRef.current) {
      auditTableRef.current.scrollIntoView({ behavior, block: "start" });
    } else {
      // Plan B fallback : via ID DOM après render frame
      requestAnimationFrame(() => {
        const el = document.getElementById("audit-events-table");
        el?.scrollIntoView({ behavior, block: "start" });
      });
    }
  }, []);

  // Gestionnaire de clic KPI avec mise à jour du filtre, scroll fluide et highlight
  const handleKpiClick = useCallback(
    (category: ActionCategory) => {
      setActionFilter(category);
      if (category === "all") {
        setSearchTerm("");
      }

      // Laisser le temps au state React de se propager puis scroller
      setTimeout(() => {
        scrollToTable();
      }, 50);
    },
    [scrollToTable]
  );

  // Nettoyage du timeout à la destruction du composant
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Export CSV conforme et strict basé sur les filtres actuellement affichés
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.error("Aucun événement à exporter pour le filtre actuel.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent +=
      "ID,Horodatage,Dossier,Auteur,Role,Categorie,Action,Champ Modifie,Ancienne Valeur,Nouvelle Valeur,IP,Commentaire\n";

    filteredLogs.forEach((l) => {
      const dossierRef = l.dossierId ? `DOS-${String(l.dossierId).padStart(4, "0")}` : "Système";
      const escapedPrev = (l.previousValue || "").replace(/"/g, '""');
      const escapedNew = (l.newValue || "").replace(/"/g, '""');
      const escapedComment = (l.comment || "").replace(/"/g, '""');

      csvContent += `${l.id},"${new Date(l.createdAt).toISOString()}","${dossierRef}","${l.authorName}","${l.userRole}","${l.category}","${l.action}","${l.fieldChanged}","${escapedPrev}","${escapedNew}","${l.ipAddress || ""}","${escapedComment}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `registre_audit_douane_igs_${actionFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(
      `Registre d'audit (${filteredLogs.length} événements) exporté avec succès en CSV.`
    );
  };

  // Libellé dynamique de la catégorie active
  const categoryLabelMap: Record<ActionCategory, string> = {
    all: "Toutes les catégories",
    customs: "Transitions douanières",
    finance: "Opérations financières",
    portal: "Accès portail client",
    dossier: "Cycle de vie dossier",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <Breadcrumbs
          items={[
            { label: "Administration", href: "/utilisateurs" },
            { label: "Journal d'Audit & Traçabilité", active: true },
          ]}
          backHref="/utilisateurs"
        />

        {/* ========================================================================= */}
        {/* EN-TÊTE DE PAGE CONFORME CHARTE IGS                                       */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-950/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <ShieldCheck size={14} className="text-[#d9a94b]" />
              <span>Conformité & Contrôle Douanier</span>
              <span>•</span>
              <span>Traçabilité Intégrale</span>
            </div>
            <h1 className="mt-1 font-[Georgia] text-2xl font-bold tracking-tight text-[#0b3b32] sm:text-3xl">
              Journal d'Audit & Traçabilité Réglementaire
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Enregistrement infalsifiable des transitions douanières, opérations financières, arbitrages et accès portail client.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                auditQuery.refetch();
                portalLogsQuery.refetch();
                toast.success("Journal d'audit et compteurs KPI actualisés.");
              }}
              className="h-9 rounded-xl border-emerald-900/20 text-emerald-950 hover:bg-emerald-50 text-xs shadow-sm font-semibold gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  auditQuery.isRefetching || portalLogsQuery.isRefetching
                    ? "animate-spin text-emerald-700"
                    : ""
                }`}
              />
              Actualiser
            </Button>

            <Button
              onClick={handleExportCsv}
              size="sm"
              className="h-9 rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] shadow-sm text-xs font-semibold gap-1.5"
            >
              <Download size={14} className="text-[#d9a94b]" />
              Exporter Registre Douane (CSV)
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 CARTES KPI INTERACTIVES & ACCESSIBLES                                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1 : Total Événements d'Audit */}
          <button
            type="button"
            onClick={() => handleKpiClick("all")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleKpiClick("all");
              }
            }}
            aria-label={`Filtrer par total des événements d'audit (${kpiStats.total} événements consignés)`}
            className={`w-full text-left rounded-3xl p-5 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0b3b32] focus-visible:ring-offset-2 ${
              actionFilter === "all"
                ? "bg-gradient-to-br from-white to-emerald-50 border-2 border-[#0b3b32] shadow-md scale-[1.01]"
                : "bg-white border border-emerald-900/15 hover:border-emerald-700/40 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900/70">
                  Total Événements d'Audit
                </p>
                <p className="mt-1.5 font-[Georgia] text-3xl font-bold text-[#0b3b32]">
                  {kpiStats.total}
                </p>
                <p className="mt-1 text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <span>Modifications consignées</span>
                  {actionFilter === "all" && <Sparkles size={12} className="text-[#d9a94b]" />}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b3b32] text-white shadow-sm shrink-0">
                <History className="h-6 w-6 text-[#d9a94b]" />
              </div>
            </div>
          </button>

          {/* KPI 2 : Transitions Douanières */}
          <button
            type="button"
            onClick={() => handleKpiClick("customs")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleKpiClick("customs");
              }
            }}
            aria-label={`Filtrer par transitions douanières (${kpiStats.customs} événements DDI, SYDONIA, BAE, PAC)`}
            className={`w-full text-left rounded-3xl p-5 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${
              actionFilter === "customs"
                ? "bg-gradient-to-br from-white to-teal-50 border-2 border-teal-700 shadow-md scale-[1.01]"
                : "bg-white border border-teal-900/15 hover:border-teal-700/40 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-900/70">
                  Transitions Douanières
                </p>
                <p className="mt-1.5 font-[Georgia] text-3xl font-bold text-teal-950">
                  {kpiStats.customs}
                </p>
                <p className="mt-1 text-xs text-teal-700 font-medium flex items-center gap-1">
                  <span>DDI, SYDONIA, BAE, PAC</span>
                  {actionFilter === "customs" && <Sparkles size={12} className="text-teal-600" />}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-sm shrink-0">
                <FileCheck className="h-6 w-6 text-teal-200" />
              </div>
            </div>
          </button>

          {/* KPI 3 : Opérations Financières */}
          <button
            type="button"
            onClick={() => handleKpiClick("finance")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleKpiClick("finance");
              }
            }}
            aria-label={`Filtrer par opérations financières (${kpiStats.finance} factures, quittances et débours)`}
            className={`w-full text-left rounded-3xl p-5 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${
              actionFilter === "finance"
                ? "bg-gradient-to-br from-white to-amber-50 border-2 border-amber-600 shadow-md scale-[1.01]"
                : "bg-white border border-amber-900/15 hover:border-amber-700/40 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/70">
                  Opérations Financières
                </p>
                <p className="mt-1.5 font-[Georgia] text-3xl font-bold text-amber-950">
                  {kpiStats.finance}
                </p>
                <p className="mt-1 text-xs text-amber-800 font-medium flex items-center gap-1">
                  <span>Factures, Quittances & Débours</span>
                  {actionFilter === "finance" && <Sparkles size={12} className="text-amber-600" />}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-700 text-white shadow-sm shrink-0">
                <CircleDollarSign className="h-6 w-6 text-amber-200" />
              </div>
            </div>
          </button>

          {/* KPI 4 : Accès Portail Client */}
          <button
            type="button"
            onClick={() => handleKpiClick("portal")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleKpiClick("portal");
              }
            }}
            aria-label={`Filtrer par accès portail client (${kpiStats.portal} connexions et consultations)`}
            className={`w-full text-left rounded-3xl p-5 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 ${
              actionFilter === "portal"
                ? "bg-gradient-to-br from-white to-sky-50 border-2 border-sky-700 shadow-md scale-[1.01]"
                : "bg-white border border-sky-900/15 hover:border-sky-700/40 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-900/70">
                  Accès Portail Client
                </p>
                <p className="mt-1.5 font-[Georgia] text-3xl font-bold text-sky-950">
                  {kpiStats.portal}
                </p>
                <p className="mt-1 text-xs text-sky-800 font-medium flex items-center gap-1">
                  <span>Connexions & consultations</span>
                  {actionFilter === "portal" && <Sparkles size={12} className="text-sky-600" />}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-800 text-white shadow-sm shrink-0">
                <Users className="h-6 w-6 text-sky-200" />
              </div>
            </div>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BARRE DE RECHERCHE ET SÉLECTEUR DE CATÉGORIE ACTIVE                      */}
        {/* ========================================================================= */}
        <Card className="border border-emerald-900/15 bg-white p-5 shadow-sm rounded-3xl">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par N° dossier (ex: DOS-0042), déclarant, action, valeur, IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-xs h-10 rounded-2xl border-emerald-900/20 focus-visible:ring-[#0b3b32]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-1.5">
                <Filter size={14} className="text-emerald-800" />
                <select
                  value={actionFilter}
                  onChange={(e) => handleKpiClick(e.target.value as ActionCategory)}
                  className="text-xs bg-transparent border-0 text-emerald-950 font-bold focus:ring-0 cursor-pointer outline-none"
                >
                  <option value="all">Toutes les catégories d'actions ({kpiStats.total})</option>
                  <option value="customs">Contrôles Douaniers & Statuts ({kpiStats.customs})</option>
                  <option value="finance">Opérations Comptables & Finance ({kpiStats.finance})</option>
                  <option value="portal">Accès & Consultations Portail Client ({kpiStats.portal})</option>
                  <option value="dossier">Création & Cycle de Vie Dossier</option>
                </select>
              </div>

              {(searchTerm || actionFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setActionFilter("all");
                    toast.info("Filtres réinitialisés.");
                  }}
                  className="text-xs text-muted-foreground hover:text-emerald-950 h-9 rounded-xl"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {/* Ligne d'information dynamique sur les résultats affichés */}
          <div className="mt-4 border-t border-gray-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
            <div>
              Affichage de <strong className="text-emerald-950">{filteredLogs.length}</strong> événement
              {filteredLogs.length > 1 ? "s" : ""} sur {unifiedLogs.length}
              {actionFilter !== "all" && (
                <span className="font-semibold text-emerald-900 ml-1">
                  — catégorie : <em>{categoryLabelMap[actionFilter]}</em>
                </span>
              )}
              {searchTerm.trim() && (
                <span className="text-gray-600 ml-1">
                  — recherche : <em>« {searchTerm.trim()} »</em>
                </span>
              )}
            </div>

            <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#d9a94b]" />
              Conformité Code des Douanes de la République de Guinée (Art. 78)
            </span>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* TABLEAU DU REGISTRE D'AUDIT AVEC REF, ID ET HALO VISUEL                  */}
        {/* ========================================================================= */}
        <div
          ref={auditTableRef}
          id="audit-events-table"
          className={`rounded-3xl transition-all duration-500 ${
            isTableHighlighted
              ? "ring-4 ring-[#0b3b32]/30 ring-offset-2 shadow-2xl scale-[1.002]"
              : ""
          }`}
        >
          <Card className="overflow-hidden border border-emerald-900/15 bg-white shadow-sm rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-[#0b3b32]/5 text-[#0b3b32] font-semibold border-b border-emerald-900/10 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-4 pl-5 pr-3">Horodatage</th>
                    <th className="py-4 px-3">Dossier</th>
                    <th className="py-4 px-3">Collaborateur / Entité</th>
                    <th className="py-4 px-3">Catégorie & Action</th>
                    <th className="py-4 px-3">Ancienne Valeur</th>
                    <th className="py-4 px-3">Nouvelle Valeur</th>
                    <th className="py-4 pr-5 text-right">Lien</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-gray-100 text-gray-400 grid place-items-center mx-auto">
                          <SearchX size={24} />
                        </div>
                        <p className="font-bold text-sm text-emerald-950">
                          Aucun événement trouvé pour ce filtre
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Aucune trace d'audit ne correspond à vos critères de recherche ou à la catégorie « {categoryLabelMap[actionFilter]} ».
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKpiClick("all")}
                          className="mt-2 rounded-xl text-xs border-emerald-900/20 text-emerald-950 hover:bg-emerald-50"
                        >
                          <RotateCcw size={13} className="mr-1.5" />
                          Réinitialiser les filtres
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/40 transition">
                        {/* 1. Horodatage */}
                        <td className="py-3.5 pl-5 pr-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-emerald-800 shrink-0" />
                            <span>{new Date(log.createdAt).toLocaleString("fr-FR")}</span>
                          </div>
                        </td>

                        {/* 2. Dossier */}
                        <td className="py-3.5 px-3">
                          {log.dossierId ? (
                            <button
                              type="button"
                              onClick={() => setLocation(`/dossiers/${log.dossierId}`)}
                              className="font-mono font-bold text-emerald-950 hover:underline hover:text-emerald-700 text-xs"
                            >
                              DOS-{String(log.dossierId).padStart(4, "0")}
                            </button>
                          ) : (
                            <span className="font-mono text-gray-400 text-xs">Système</span>
                          )}
                        </td>

                        {/* 3. Collaborateur / Rôle */}
                        <td className="py-3.5 px-3">
                          <span className="font-semibold text-gray-900 block truncate max-w-[170px]">
                            {log.authorName}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {log.userRole}
                            {log.ipAddress ? ` • IP: ${log.ipAddress}` : ""}
                          </span>
                        </td>

                        {/* 4. Catégorie & Action */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                log.category === "customs"
                                  ? "border-teal-700 bg-teal-50 text-teal-900"
                                  : log.category === "finance"
                                  ? "border-amber-700 bg-amber-50 text-amber-900"
                                  : log.category === "portal"
                                  ? "border-sky-700 bg-sky-50 text-sky-900"
                                  : "border-emerald-700/50 bg-emerald-50 text-emerald-950"
                              }`}
                            >
                              {log.action}
                            </Badge>
                            {log.fieldChanged && log.fieldChanged !== log.action && (
                              <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                                {log.fieldChanged}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Ancienne Valeur */}
                        <td className="py-3.5 px-3 text-gray-500 font-mono text-[11px] max-w-[150px] truncate">
                          {log.previousValue || "—"}
                        </td>

                        {/* 6. Nouvelle Valeur */}
                        <td className="py-3.5 px-3 font-semibold text-emerald-950 font-mono text-[11px] max-w-[180px] truncate">
                          {log.newValue || log.comment || "—"}
                        </td>

                        {/* 7. Lien vers le dossier */}
                        <td className="py-3.5 pr-5 text-right">
                          {log.dossierId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/dossiers/${log.dossierId}`)}
                              className="h-7 px-2.5 text-[11px] rounded-xl text-emerald-900 hover:bg-emerald-100 gap-1 font-semibold"
                            >
                              <Eye size={12} />
                              Dossier
                            </Button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
