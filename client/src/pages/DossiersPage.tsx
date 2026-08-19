import DashboardLayout from "@/components/DashboardLayout";
import { CustomsEditModal, CustomsEditDossier } from "@/components/CustomsEditModal";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const dateLabel = (value: Date | string | null | undefined) =>
  value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "—";

const badgeStyle = (value?: string | null) =>
  value === "Régularisé"
    ? "bg-[#e3f1ea] text-[#176b55]"
    : value === "Haute" || value === "À régulariser"
    ? "bg-[#fff0eb] text-[#bf5038]"
    : value === "Normale"
    ? "bg-[#fff5df] text-[#9e6a08]"
    : "bg-[#edf5f1] text-[#2d7664]";

function cleanStr(s: unknown): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeHeaderKey(h: string): string {
  const clean = cleanStr(h);
  if (clean.includes("client dossier") || clean.includes("n° client") || clean.includes("dossier client") || clean.includes("ref client") || clean.includes("num client") || clean.includes("code client") || clean.includes("no client") || clean.includes("n° dossier client")) return "clientDossierNumber";
  if (clean.includes("n° dossier") || clean.includes("num dossier") || clean.includes("dossier n°") || clean.includes("id dossier") || clean === "dossier" || clean === "n°" || clean === "no" || clean === "ref" || clean === "code") return "dossierNumber";
  if (clean.includes("client") || clean.includes("destinataire") || clean.includes("importateur") || clean.includes("societe") || clean.includes("consignee") || clean.includes("customer")) return "client";
  if (clean.includes("bl") || clean.includes("b/l") || clean.includes("lta") || clean.includes("connaissement") || clean.includes("bill of lading") || clean.includes("waybill") || clean.includes("booking")) return "blLtaNumber";
  if (clean.includes("marchandise") || clean.includes("cargo") || clean.includes("nature") || clean.includes("designation") || clean.includes("description") || clean.includes("commodity") || clean.includes("produit")) return "cargoNature";
  if (clean.includes("transport") || clean.includes("mode") || clean.includes("fret")) return "transportMode";
  if (clean.includes("eta") || clean.includes("arrivee") || clean.includes("date eta") || clean.includes("date d'arrivee") || clean.includes("date arrivee")) return "eta";
  if (clean.includes("pol") || clean.includes("origine") || clean.includes("port origine") || clean.includes("loading") || clean.includes("chargement") || clean.includes("provenance") || clean.includes("port depart")) return "originPort";
  if (clean.includes("pod") || clean.includes("destination") || clean.includes("port dest") || clean.includes("discharge") || clean.includes("debarquement") || clean.includes("port arrivee")) return "destinationPort";
  if (clean.includes("conteneur") || clean.includes("tc") || clean.includes("container") || clean.includes("n° conteneur")) return "container";
  if (clean.includes("vrac") || clean.includes("bulk") || clean.includes("pkg") || clean.includes("colis") || clean.includes("poids") || clean.includes("tonnage") || clean.includes("quantite")) return "bulk";
  if (clean.includes("sortie") || clean.includes("release") || clean.includes("date sortie") || clean.includes("bae") || clean.includes("date bae") || clean.includes("enlevement")) return "goodsReleaseDate";
  if (clean.includes("declaration") || clean.includes("decl") || clean.includes("sydonia") || clean.includes("ddi") || clean.includes("num declaration") || clean.includes("n° decl")) return "declarationNumber";
  if (clean.includes("bulletin") || clean.includes("bld") || clean.includes("liquidation") || clean.includes("n° bulletin")) return "bulletinNumber";
  if (clean.includes("definitive") || clean.includes("decl def") || clean.includes("ddi def")) return "finalDeclarationNumber";
  if (clean.includes("regime")) return "regime";
  if (clean.includes("livraison") || clean.includes("lieu") || clean.includes("site")) return "deliveryLocation";
  if (clean.includes("alerte") || clean.includes("blocage") || clean.includes("incident") || clean.includes("retard")) return "fieldAlert";
  if (clean.includes("action") || clean.includes("urgente")) return "nextAction";
  if (clean.includes("douane")) return "customsStatus";
  if (clean.includes("port")) return "portStatus";
  if (clean.includes("financ") || clean.includes("paiement") || clean.includes("facture")) return "financialStatus";
  if (clean.includes("responsable") || clean.includes("agent") || clean.includes("declarant")) return "responsible";
  if (clean.includes("note") || clean.includes("observation") || clean.includes("remarque") || clean.includes("commentaire")) return "notes";
  return clean;
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const headers = firstLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, "").trim());
  const mappedHeaders = headers.map(normalizeHeaderKey);

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, "").trim());
    if (rawCols.every(c => !c)) continue;
    const row: Record<string, string> = {};
    mappedHeaders.forEach((key, colIndex) => {
      row[key] = rawCols[colIndex] || "";
    });
    if (Object.values(row).some(v => v.trim() !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

async function parseExcelBuffer(buffer: ArrayBuffer): Promise<Array<Record<string, string>>> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

  if (rawRows.length === 0) return [];

  let headerRowIdx = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    let score = 0;
    for (const cell of row) {
      const k = normalizeHeaderKey(String(cell || ""));
      if (["client", "blLtaNumber", "cargoNature", "eta", "originPort", "declarationNumber", "dossierNumber", "clientDossierNumber", "transportMode", "bulletinNumber"].includes(k)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      headerRowIdx = i;
    }
  }

  const headerRow = rawRows[headerRowIdx] || [];
  const mappedHeaders = headerRow.map((cell: any) => normalizeHeaderKey(String(cell || "")));

  const parsedRows: Array<Record<string, string>> = [];
  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row) || row.every(c => c === "" || c === null || c === undefined)) continue;

    const rowObj: Record<string, string> = {};
    mappedHeaders.forEach((key: string, colIdx: number) => {
      let val = row[colIdx];
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      } else {
        val = String(val ?? "").trim();
      }
      rowObj[key] = val;
    });

    if (Object.values(rowObj).some(v => v.trim() !== "")) {
      parsedRows.push(rowObj);
    }
  }

  return parsedRows;
}

function DossiersContent() {
  const [location, setLocation] = useLocation();
  const perms = usePermissions();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [client, setClient] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // State for quick customs edit modal
  const [editingCustomsDossier, setEditingCustomsDossier] = useState<CustomsEditDossier | null>(null);

  // Advanced drill-down URL parameters state
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});
  const [drillDownLabel, setDrillDownLabel] = useState<string | null>(null);

  // Synchronize URL search parameters on mount and location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p: Record<string, string> = {};
    params.forEach((v, k) => {
      p[k] = v;
    });
    setUrlParams(p);

    let label: string | null = null;

    if (p.filter === "all") {
      setSearch("");
      setStatus("");
      setPriority("");
      setClient("");
      setTransportMode("");
      setEtaFrom("");
      setEtaTo("");
      setDrillDownLabel(null);
      return;
    }

    if (p.status) {
      if (p.status.toLowerCase() === "regularise" || p.status === "Régularisé") {
        setStatus("Régularisé");
        label = "Dossiers Régularisés";
      } else if (p.status.toLowerCase() === "a_regulariser" || p.status === "À régulariser") {
        setStatus("À régulariser");
        label = "Dossiers À régulariser";
      }
    }

    if (p.a_regulariser === "true") {
      setStatus("À régulariser");
      if (!label) label = "Dossiers À régulariser";
    }

    if (p.priority) {
      const pr = p.priority.toLowerCase();
      if (pr === "haute") {
        setPriority("Haute");
        label = "Priorité Haute";
      } else if (pr === "normale") {
        setPriority("Normale");
        label = "Priorité Normale";
      } else if (pr === "basse") {
        setPriority("Basse");
        label = "Priorité Basse";
      }
    }

    if (p.client) {
      setClient(p.client);
      label = `Client : ${p.client}`;
    }

    if (p.transportMode) {
      setTransportMode(p.transportMode);
    }

    if (p.eta === "depassee" || p.overdue === "true") {
      label = "ETA Dépassées (sans sortie marchandises)";
    }

    if (p.retard === "true" || p.lateToRegularize === "true") {
      label = "Retards critiques à régulariser";
    }

    if (p.eta_range === "next_7_days") {
      label = "Arrivées sous 7 jours";
    }

    if (p.eta_month) {
      label = `Arrivées du mois (${p.eta_month})`;
    }

    if (p.vigilance) {
      if (p.vigilance === "incomplets") label = "Points de vigilance : Dossiers incomplets";
      else if (p.vigilance === "doublon_bl") label = "Points de vigilance : Doublons BL / LTA";
      else if (p.vigilance === "declaration_manquante") label = "Points de vigilance : Déclarations manquantes";
      else if (p.vigilance === "sortie_manquante") label = "Points de vigilance : Sorties non renseignées";
    }

    if (p.has_anomalies === "true") {
      label = "Tous les dossiers avec points de vigilance";
    }

    setDrillDownLabel(label);
  }, [location]);

  // Import Dialog State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryInput = useMemo(
    () => ({
      search: search || undefined,
      status: (status || undefined) as "Régularisé" | "À régulariser" | undefined,
      priority: (priority || undefined) as "Haute" | "Normale" | "Basse" | undefined,
      client: client || undefined,
      transportMode: transportMode || undefined,
      etaFrom: etaFrom ? new Date(`${etaFrom}T00:00:00Z`) : undefined,
      etaTo: etaTo ? new Date(`${etaTo}T23:59:59Z`) : undefined,
    }),
    [search, status, priority, client, transportMode, etaFrom, etaTo]
  );

  const { data: rawDossiers, isLoading, error } = trpc.dossier.list.useQuery(queryInput);
  const { data: refs } = trpc.reference.list.useQuery();
  const utils = trpc.useUtils();

  const filteredDossiers = useMemo(() => {
    if (!rawDossiers) return [];
    let list = rawDossiers;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const blOccurrences = new Map<string, number>();
    rawDossiers.forEach(d => {
      if (d.blLtaNumber && d.blLtaNumber.trim()) {
        blOccurrences.set(d.blLtaNumber.trim(), (blOccurrences.get(d.blLtaNumber.trim()) || 0) + 1);
      }
    });

    if (urlParams.eta === "depassee" || urlParams.overdue === "true") {
      list = list.filter(d => d.eta && new Date(d.eta) < now && !d.goodsReleaseDate);
    }
    if (urlParams.statut_sortie === "non_renseigne") {
      list = list.filter(d => !d.goodsReleaseDate);
    }
    if (urlParams.retard === "true") {
      list = list.filter(d => d.calculatedStatus === "À régulariser" && d.eta && new Date(d.eta) < now);
    }
    if (urlParams.eta_range === "next_7_days") {
      list = list.filter(d => {
        if (!d.eta || d.goodsReleaseDate) return false;
        const etaDate = new Date(d.eta);
        const days = Math.ceil((etaDate.getTime() - now.getTime()) / 86400000);
        return days >= 0 && days <= 7;
      });
    }
    if (urlParams.eta_month) {
      list = list.filter(d => {
        if (!d.eta) return false;
        const etaDate = new Date(d.eta);
        const keyFr = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(etaDate);
        const keyIso = etaDate.toISOString().slice(0, 7);
        return keyFr.toLowerCase() === urlParams.eta_month.toLowerCase() || keyIso === urlParams.eta_month;
      });
    }
    if (urlParams.vigilance === "incomplets") {
      list = list.filter(d => !d.clientDossierNumber || !d.eta || !d.declarationNumber || !d.bulletinNumber || !d.goodsReleaseDate);
    } else if (urlParams.vigilance === "doublon_bl") {
      list = list.filter(d => d.blLtaNumber && (blOccurrences.get(d.blLtaNumber.trim()) || 0) > 1);
    } else if (urlParams.vigilance === "declaration_manquante") {
      list = list.filter(d => !d.declarationNumber || d.declarationNumber.trim() === "");
    } else if (urlParams.vigilance === "sortie_manquante") {
      list = list.filter(d => !d.goodsReleaseDate);
    }
    if (urlParams.has_anomalies === "true") {
      list = list.filter(d =>
        !d.clientDossierNumber ||
        !d.eta ||
        !d.declarationNumber ||
        !d.bulletinNumber ||
        !d.goodsReleaseDate ||
        (d.blLtaNumber && (blOccurrences.get(d.blLtaNumber.trim()) || 0) > 1)
      );
    }

    return list;
  }, [rawDossiers, urlParams]);

  const dossiers = filteredDossiers;

  const importBatchMutation = trpc.dossier.importBatch.useMutation({
    onSuccess: result => {
      toast.success(
        `🎉 ${result.total} dossier(s) traités avec succès ! (${result.createdCount} nouveau(x), ${result.updatedCount} mis à jour, ${result.duplicatesPrevented} doublon(s) évité(s))`
      );
      utils.dossier.list.invalidate();
      utils.dashboard.get.invalidate();
      utils.notification.list.invalidate();
      setIsImportOpen(false);
      setImportRows([]);
      setImportFileName("");
    },
    onError: err => {
      toast.error(`Erreur d'importation : ${err.message}`);
    },
  });

  const transportModes = refs?.filter(item => item.category === "mode_transport") ?? [];
  const clients = refs?.filter(item => item.category === "client") ?? [];

  const reset = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setClient("");
    setTransportMode("");
    setEtaFrom("");
    setEtaTo("");
    setUrlParams({});
    setDrillDownLabel(null);
    if (window.location.search) {
      window.history.replaceState({}, "", "/dossiers");
    }
  };

  const activeFilters = [status, priority, client, transportMode, etaFrom, etaTo, drillDownLabel].filter(Boolean).length;

  const handleExportCSV = () => {
    if (!dossiers || dossiers.length === 0) {
      toast.error("Aucun dossier à exporter.");
      return;
    }

    const headers = [
      "N° Dossier",
      "N° Dossier Client",
      "Client",
      "BL / LTA",
      "Marchandise",
      "Mode Transport",
      "ETA",
      "Port Origine (POL)",
      "Port Destination (POD)",
      "Conteneur",
      "Vrac",
      "Date Sortie",
      "N° Déclaration (Sydonia)",
      "N° Bulletin (BLD)",
      "N° Déclaration Définitive",
      "Statut Calculé",
      "Priorité Calculée",
      "Taux Complétude (%)",
      "Statut Douane",
      "Statut Port",
      "Statut Financier",
      "Régime",
      "Alerte Terrain",
      "Lieu Livraison",
      "Notes",
    ];

    const formatField = (val: unknown) => {
      if (val === null || val === undefined) return "";
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [
      headers.join(";"),
      ...dossiers.map(d =>
        [
          formatField(d.dossierNumber),
          formatField(d.clientDossierNumber),
          formatField(d.client),
          formatField(d.blLtaNumber),
          formatField(d.cargoNature),
          formatField(d.transportMode),
          formatField(d.eta),
          formatField(d.originPort),
          formatField(d.destinationPort),
          formatField(d.container),
          formatField(d.bulk),
          formatField(d.goodsReleaseDate),
          formatField(d.declarationNumber),
          formatField(d.bulletinNumber),
          formatField(d.finalDeclarationNumber),
          formatField(d.calculatedStatus),
          formatField(d.calculatedPriority),
          formatField(d.completionRate),
          formatField(d.customsStatus),
          formatField(d.portStatus),
          formatField(d.financialStatus),
          formatField(d.regime),
          formatField(d.fieldAlert),
          formatField(d.deliveryLocation),
          formatField(d.notes),
        ].join(";")
      ),
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dossiers_igs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exportation CSV téléchargée avec succès.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = async evt => {
        const buffer = evt.target?.result as ArrayBuffer;
        if (buffer) {
          try {
            const parsed = await parseExcelBuffer(buffer);
            if (parsed.length === 0) {
              toast.error("Le fichier Excel ne contient pas de données valides.");
            } else {
              setImportRows(parsed);
              toast.success(`${parsed.length} dossier(s) détecté(s) dans le fichier Excel.`);
            }
          } catch (err: any) {
            toast.error("Erreur de lecture du fichier Excel : " + err.message);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = evt => {
        const content = evt.target?.result as string;
        if (content) {
          const parsed = parseCSV(content);
          if (parsed.length === 0) {
            toast.error("Le fichier CSV ne contient pas de données valides.");
          } else {
            setImportRows(parsed);
            toast.success(`${parsed.length} dossier(s) détecté(s) dans le fichier CSV.`);
          }
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleConfirmImport = () => {
    if (importRows.length === 0) return;

    const payload = importRows.map(r => ({
      clientDossierNumber: r.clientDossierNumber || null,
      client: r.client || null,
      blLtaNumber: r.blLtaNumber || null,
      cargoNature: r.cargoNature || null,
      transportMode: r.transportMode || "Maritime",
      eta: r.eta ? new Date(r.eta) : null,
      originPort: r.originPort || null,
      destinationPort: r.destinationPort || "Port Autonome de Conakry",
      container: r.container || null,
      bulk: r.bulk || null,
      goodsReleaseDate: r.goodsReleaseDate ? new Date(r.goodsReleaseDate) : null,
      declarationNumber: r.declarationNumber || null,
      bulletinNumber: r.bulletinNumber || null,
      finalDeclarationNumber: r.finalDeclarationNumber || null,
      customsStatus: r.customsStatus || null,
      portStatus: r.portStatus || null,
      financialStatus: r.financialStatus || null,
      regime: r.regime || null,
      fieldAlert: r.fieldAlert || null,
      deliveryLocation: r.deliveryLocation || null,
      notes: r.notes || null,
    }));

    importBatchMutation.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-[1540px] space-y-6">
      {/* Fil d'Ariane & Navigation */}
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Tous les Dossiers", active: true },
        ]}
        backHref="/"
      />

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8e88]">Registre opérationnel</p>
          <h1 className="mt-1 font-[Georgia] text-3xl font-semibold tracking-tight text-[#15372f]">
            Dossiers de transit & douane
          </h1>
          <p className="mt-2 text-sm text-[#71807b]">
            Recherche, qualification, import/export et suivi continu des opérations (Port de Conakry, SYDONIA, DDI).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="h-10 rounded-xl border-[#d1ded8] bg-white text-[#194b3e] hover:bg-[#f0f6f3]"
          >
            <Download className="mr-2" size={16} />
            Exporter CSV
          </Button>

          {perms.canCreateDossier && (
            <Button
              variant="outline"
              onClick={() => {
                setIsImportOpen(true);
                setImportRows([]);
                setImportFileName("");
              }}
              className="h-10 rounded-xl border-[#d1ded8] bg-white text-[#194b3e] hover:bg-[#f0f6f3]"
            >
              <Upload className="mr-2" size={16} />
              Importer CSV / Excel
            </Button>
          )}

          {perms.canCreateDossier && (
            <Button onClick={() => setLocation("/dossiers/nouveau")} className="h-10 rounded-xl bg-[#0f4035] px-5 hover:bg-[#195847] text-white">
              <Plus className="mr-2" size={17} />
              Nouveau dossier
            </Button>
          )}
        </div>
      </div>

      {/* Drill-Down Active Badge Banner */}
      {drillDownLabel && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-900/15 bg-emerald-50/70 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-950">
            <Filter size={15} className="text-emerald-800" />
            <span>Filtre actif : <strong>{drillDownLabel}</strong> ({dossiers?.length || 0} résultat{(dossiers?.length || 0) > 1 ? "s" : ""})</span>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
          >
            <X size={13} /> Effacer le filtre
          </button>
        </div>
      )}

      {/* Filter Card */}
      <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.7fr)_repeat(3,minmax(135px,0.7fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#83938d]" size={17} />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher numéro, client, BL / LTA, port, déclaration…"
                className="h-10 rounded-xl border-[#e3ebe7] pl-10"
              />
            </div>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="h-10 rounded-xl border border-[#e3ebe7] bg-white px-3 text-sm text-[#3f5851] focus:outline-none focus:ring-2 focus:ring-[#2f826d]/30"
            >
              <option value="">Tous les statuts</option>
              <option value="Régularisé">Régularisé</option>
              <option value="À régulariser">À régulariser</option>
            </select>
            <select
              value={priority}
              onChange={event => setPriority(event.target.value)}
              className="h-10 rounded-xl border border-[#e3ebe7] bg-white px-3 text-sm text-[#3f5851] focus:outline-none focus:ring-2 focus:ring-[#2f826d]/30"
            >
              <option value="">Toutes priorités</option>
              <option value="Haute">Haute</option>
              <option value="Normale">Normale</option>
              <option value="Basse">Basse</option>
            </select>
            <select
              value={transportMode}
              onChange={event => setTransportMode(event.target.value)}
              className="h-10 rounded-xl border border-[#e3ebe7] bg-white px-3 text-sm text-[#3f5851] focus:outline-none focus:ring-2 focus:ring-[#2f826d]/30"
            >
              <option value="">Tout transport</option>
              {transportModes.map(item => (
                <option key={item.id} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid gap-3 border-t border-[#edf2ef] pt-3 lg:grid-cols-[minmax(240px,0.7fr)_1fr_auto]">
            {perms.canViewAllCompanies ? (
              <select
                value={client}
                onChange={event => setClient(event.target.value)}
                className="h-10 rounded-xl border border-[#e3ebe7] bg-white px-3 text-sm text-[#3f5851] focus:outline-none focus:ring-2 focus:ring-[#2f826d]/30"
              >
                <option value="">Tous les clients</option>
                {clients.map(item => (
                  <option key={item.id} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center text-xs text-muted-foreground px-2">
                Filtre automatique sur votre société
              </div>
            )}
            <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-[#74847f]">
              <CalendarDays size={15} />
              <span className="font-medium">Plage ETA</span>
              <Input
                type="date"
                value={etaFrom}
                onChange={event => setEtaFrom(event.target.value)}
                className="h-8 w-[145px] rounded-lg text-xs"
              />
              <span>au</span>
              <Input
                type="date"
                value={etaTo}
                onChange={event => setEtaTo(event.target.value)}
                className="h-8 w-[145px] rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-center gap-2">
                <Badge className="border-0 bg-[#e8f1ed] text-[#286c5a]">
                  <Filter className="mr-1" size={12} />
                  {activeFilters} filtre{activeFilters > 1 ? "s" : ""}
                </Badge>
                {Boolean(search || activeFilters) && (
                  <button onClick={reset} className="flex items-center gap-1 text-xs font-semibold text-[#8a4a38] hover:underline">
                    <X size={13} />
                    Réinitialiser
                  </button>
                )}
              </div>
              <div className="flex rounded-lg border border-[#e3ebe7] bg-[#f8faf9] p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md ${viewMode === "table" ? "bg-white shadow text-[#15372f]" : "text-[#7b8c86]"}`}
                  title="Vue Tableau"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-md ${viewMode === "cards" ? "bg-white shadow text-[#15372f]" : "text-[#7b8c86]"}`}
                  title="Vue Cartes"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Cards Content */}
      {error ? (
        <Card className="border-0 bg-white">
          <CardContent className="p-10 text-center">
            <p className="font-semibold text-[#ad4c38]">Impossible de charger les dossiers</p>
            <p className="mt-2 text-sm text-[#71817b]">{error.message}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <div className="flex items-center justify-between border-b border-[#edf2ef] px-5 py-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={18} className="text-[#1d7764]" />
              <p className="font-semibold text-[#183c33]">
                {dossiers?.length ?? 0} dossier{(dossiers?.length ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
            <div className="hidden items-center gap-1 text-xs text-[#82918c] md:flex">
              <SlidersHorizontal size={14} />
              Triés par dernière mise à jour
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-2xl" />)
                : dossiers?.map(dossier => (
                    <div
                      key={dossier.id}
                      onMouseEnter={() => utils.dossier.get.prefetch({ id: dossier.id })}
                      onFocus={() => utils.dossier.get.prefetch({ id: dossier.id })}
                      className="group rounded-2xl border border-[#edf3f0] bg-white p-4 transition-all hover:border-[#1d7764]/40 hover:shadow-md cursor-pointer"
                      onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#176b55] group-hover:underline">{dossier.dossierNumber}</p>
                          <p className="text-xs text-[#687e77]">{dossier.client || "Client non renseigné"}</p>
                        </div>
                        <Badge className={`border-0 ${badgeStyle(dossier.calculatedStatus)}`}>
                          {dossier.calculatedStatus}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-[#536863]">
                        <p>
                          <span className="font-medium text-[#2d4d44]">BL / LTA :</span> {dossier.blLtaNumber || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-[#2d4d44]">Marchandise :</span> {dossier.cargoNature || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-[#2d4d44]">ETA :</span> {dateLabel(dossier.eta)}
                        </p>
                        <p>
                          <span className="font-medium text-[#2d4d44]">Port dest. :</span> {dossier.destinationPort || "—"}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[#edf3f0] pt-2 text-[11px]">
                        <span className="text-[#849690]">{dossier.transportMode || "Maritime"}</span>
                        <div className="flex items-center gap-2">
                          {perms.canEditCustoms && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingCustomsDossier(dossier); }}
                              className="font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Douane
                            </button>
                          )}
                          <span className="font-medium text-[#1d7764] hover:underline">Voir détails →</span>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2200px] text-left">
                <thead className="bg-[#f8faf9]">
                  <tr>
                    {[
                      "N° dossier",
                      "N° client",
                      "Client",
                      "BL / LTA",
                      "Marchandise",
                      "Transport",
                      "ETA",
                      "POL",
                      "POD",
                      "Conteneur",
                      "Vrac",
                      "Sortie",
                      "Déclaration",
                      "Bulletin",
                      "Décl. définitive",
                      "Statut",
                      "Priorité",
                      "Actions",
                    ].map(label => (
                      <th key={label} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8c86]">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff3f1]">
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <tr key={index}>
                          {Array.from({ length: 18 }).map((__, cell) => (
                            <td key={cell} className="px-4 py-3">
                              <Skeleton className="h-5 w-full rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : dossiers?.map(dossier => (
                        <tr 
                          key={dossier.id} 
                          onMouseEnter={() => utils.dossier.get.prefetch({ id: dossier.id })}
                          onFocus={() => utils.dossier.get.prefetch({ id: dossier.id })}
                          className="group transition hover:bg-[#f8fbf9]"
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                              className="font-semibold text-[#176b55] hover:underline"
                            >
                              {dossier.dossierNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.clientDossierNumber || "—"}</td>
                          <td className="max-w-[180px] px-4 py-3">
                            <p className="truncate text-sm font-medium text-[#27463e]">{dossier.client || "—"}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-emerald-950 font-medium">{dossier.blLtaNumber || "—"}</td>
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="truncate text-sm text-[#536863]">{dossier.cargoNature || "—"}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.transportMode || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dateLabel(dossier.eta)}</td>
                          <td className="max-w-[150px] px-4 py-3 text-sm text-[#536863]">
                            <p className="truncate">{dossier.originPort || "—"}</p>
                          </td>
                          <td className="max-w-[160px] px-4 py-3 text-sm text-[#536863]">
                            <p className="truncate">{dossier.destinationPort || "—"}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.container || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.bulk || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dateLabel(dossier.goodsReleaseDate)}</td>
                          <td className="px-4 py-3 text-sm font-mono text-[#194c3f]">{dossier.declarationNumber || "—"}</td>
                          <td className="px-4 py-3 text-sm font-mono text-[#8b5516]">{dossier.bulletinNumber || "—"}</td>
                          <td className="px-4 py-3 text-sm font-mono text-[#536863]">{dossier.finalDeclarationNumber || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge className={`whitespace-nowrap border-0 ${badgeStyle(dossier.calculatedStatus)}`}>
                              {dossier.calculatedStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`border-0 ${badgeStyle(dossier.calculatedPriority)}`}>
                              {dossier.calculatedPriority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {perms.canEditCustoms && (
                                <button
                                  onClick={() => setEditingCustomsDossier(dossier)}
                                  title="Édition rapide douane"
                                  className="h-8 px-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-medium flex items-center gap-1"
                                >
                                  <Edit3 size={13} /> Douane
                                </button>
                              )}
                              <button
                                aria-label={`Ouvrir ${dossier.dossierNumber}`}
                                onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-[#789088] transition hover:bg-[#e6f0eb] hover:text-[#176b55]"
                              >
                                <ChevronRight size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && dossiers?.length === 0 && (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <Search className="mx-auto mb-3 text-[#8da099]" size={28} />
                <p className="font-semibold text-[#28483f]">Aucun dossier ne correspond aux critères.</p>
                <button onClick={reset} className="mt-2 text-sm font-semibold text-[#1d7764] hover:underline">
                  Effacer les filtres
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Import CSV / Excel Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-[Georgia] text-2xl text-[#15372f]">
              Importer des dossiers (Excel / CSV)
            </DialogTitle>
            <DialogDescription className="text-sm text-[#677b75]">
              Chargez un classeur Excel (.xlsx, .xls) ou un fichier CSV pour intégrer automatiquement de nouveaux dossiers de transit avec calcul instantané de régularisation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-[#c2d7ce] bg-[#f8faf9] p-6 text-center transition hover:border-[#1d7764] hover:bg-[#f0f6f3]"
            >
              <FileSpreadsheet className="mx-auto mb-2 text-[#1d7764]" size={36} />
              <p className="text-sm font-semibold text-[#204036]">
                {importFileName ? `Fichier sélectionné : ${importFileName}` : "Cliquez ou glissez-déposez un fichier Excel (.xlsx, .xls) ou CSV ici"}
              </p>
              <p className="mt-1 text-xs text-[#80918c]">Formats supportés : Microsoft Excel (.xlsx, .xls) et CSV (séparateurs: virgule, point-virgule, tabulation)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {importRows.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#204036]">
                  <span>Aperçu des données ({importRows.length} lignes détectées)</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-[#e3f1ea] text-[#176b55] border-0 text-[10px]">
                      Anti-doublons actif (Upsert par BL / Réf)
                    </Badge>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto rounded-xl border border-[#edf2ef] bg-[#fcfdfd] shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1f6f4] text-[10px] uppercase text-[#697d77]">
                      <tr>
                        <th className="p-2.5">Réf / Client</th>
                        <th className="p-2.5">BL / LTA</th>
                        <th className="p-2.5">Marchandise</th>
                        <th className="p-2.5">Transport & ETA</th>
                        <th className="p-2.5">POL ➔ POD</th>
                        <th className="p-2.5">Déclaration</th>
                        <th className="p-2.5">Bulletin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ef]">
                      {importRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-[#f6f9f8] transition-colors">
                          <td className="p-2.5 max-w-[130px]">
                            <div className="truncate font-semibold text-[#183b32]">
                              {row.client || row.clientDossierNumber || row.dossierNumber || "—"}
                            </div>
                            {row.client && (row.clientDossierNumber || row.dossierNumber) && (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {row.clientDossierNumber || row.dossierNumber}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] font-medium text-emerald-900">
                            {row.blLtaNumber || "—"}
                          </td>
                          <td className="p-2.5 truncate max-w-[130px]" title={row.cargoNature}>
                            {row.cargoNature || "—"}
                          </td>
                          <td className="p-2.5 text-[11px]">
                            <span className="font-medium text-[#204036]">{row.eta || "—"}</span>
                            <span className="block text-[10px] text-muted-foreground">{row.transportMode || "Maritime"}</span>
                          </td>
                          <td className="p-2.5 text-[10px] text-muted-foreground">
                            {row.originPort || "POL"} ➔ {row.destinationPort || "Conakry"}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-[#1c5548]">
                            {row.declarationNumber || "—"}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-[#855319]">
                            {row.bulletinNumber || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 10 && (
                  <p className="text-right text-[11px] text-[#869993]">... et {importRows.length - 10} autres dossiers détectés prêts à être importés</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsImportOpen(false)} className="rounded-xl">
              Annuler
            </Button>
            <Button
              disabled={importRows.length === 0 || importBatchMutation.isPending}
              onClick={handleConfirmImport}
              className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#195847]"
            >
              {importBatchMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
              Confirmer l'importation ({importRows.length} dossiers)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customs Fast Edit Modal */}
      <CustomsEditModal
        isOpen={Boolean(editingCustomsDossier)}
        onClose={() => setEditingCustomsDossier(null)}
        dossier={editingCustomsDossier}
      />
    </div>
  );
}

export default function DossiersPage() {
  return (
    <DashboardLayout>
      <DossiersContent />
    </DashboardLayout>
  );
}
