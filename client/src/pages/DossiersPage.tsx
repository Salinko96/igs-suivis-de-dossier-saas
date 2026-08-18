import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";

  const headers = firstLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  const normalizeKey = (h: string): string => {
    if (h.includes("client dossier") || h.includes("n° client") || h.includes("dossier client") || h.includes("ref client")) return "clientDossierNumber";
    if (h.includes("client") || h.includes("destinataire")) return "client";
    if (h.includes("bl") || h.includes("lta") || h.includes("connaissement")) return "blLtaNumber";
    if (h.includes("marchandise") || h.includes("cargo") || h.includes("nature")) return "cargoNature";
    if (h.includes("transport") || h.includes("mode")) return "transportMode";
    if (h.includes("eta") || h.includes("arrivee") || h.includes("date eta")) return "eta";
    if (h.includes("pol") || h.includes("origine") || h.includes("port origine")) return "originPort";
    if (h.includes("pod") || h.includes("destination") || h.includes("port dest")) return "destinationPort";
    if (h.includes("conteneur") || h.includes("tc") || h.includes("container")) return "container";
    if (h.includes("vrac") || h.includes("bulk") || h.includes("pkg")) return "bulk";
    if (h.includes("sortie") || h.includes("release") || h.includes("date sortie")) return "goodsReleaseDate";
    if (h.includes("declaration") || h.includes("n° decl") || h.includes("sydonia")) return "declarationNumber";
    if (h.includes("bulletin") || h.includes("bld") || h.includes("liquidation")) return "bulletinNumber";
    if (h.includes("definitive") || h.includes("decl def")) return "finalDeclarationNumber";
    if (h.includes("regime")) return "regime";
    if (h.includes("livraison") || h.includes("lieu")) return "deliveryLocation";
    if (h.includes("alerte")) return "fieldAlert";
    if (h.includes("action")) return "nextAction";
    if (h.includes("statut douane")) return "customsStatus";
    if (h.includes("statut port")) return "portStatus";
    if (h.includes("statut financier")) return "financialStatus";
    if (h.includes("note")) return "notes";
    return h;
  };

  const mappedHeaders = headers.map(normalizeKey);

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, "").trim());
    if (rawCols.every(c => !c)) continue;
    const row: Record<string, string> = {};
    mappedHeaders.forEach((key, colIndex) => {
      row[key] = rawCols[colIndex] || "";
    });
    rows.push(row);
  }
  return rows;
}

function DossiersContent() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [client, setClient] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

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

  const { data: dossiers, isLoading, error } = trpc.dossier.list.useQuery(queryInput);
  const { data: refs } = trpc.reference.list.useQuery();
  const utils = trpc.useUtils();

  const importBatchMutation = trpc.dossier.importBatch.useMutation({
    onSuccess: result => {
      toast.success(`${result.count} dossier(s) importé(s) avec succès !`);
      utils.dossier.list.invalidate();
      utils.dashboard.get.invalidate();
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
  };

  const activeFilters = [status, priority, client, transportMode, etaFrom, etaTo].filter(Boolean).length;

  // Handle Export CSV
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

  // Handle File Selected for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      if (content) {
        const parsed = parseCSV(content);
        if (parsed.length === 0) {
          toast.error("Le fichier sélectionné ne contient pas de données valides.");
        } else {
          setImportRows(parsed);
          toast.info(`${parsed.length} dossier(s) détecté(s) dans le fichier.`);
        }
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // Confirm Import
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
          <Button onClick={() => setLocation("/dossiers/nouveau")} className="h-10 rounded-xl bg-[#0f4035] px-5 hover:bg-[#195847]">
            <Plus className="mr-2" size={17} />
            Nouveau dossier
          </Button>
        </div>
      </div>

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
                      onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                      className="group cursor-pointer rounded-2xl border border-[#edf3f0] bg-white p-4 transition-all hover:border-[#1d7764]/40 hover:shadow-md"
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
                        <span className="font-medium text-[#1d7764]">Voir détails →</span>
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
                      "",
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
                        <tr key={dossier.id} className="group transition hover:bg-[#f8fbf9]">
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
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.blLtaNumber || "—"}</td>
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
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.declarationNumber || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.bulletinNumber || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#536863]">{dossier.finalDeclarationNumber || "—"}</td>
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
                            <button
                              aria-label={`Ouvrir ${dossier.dossierNumber}`}
                              onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-[#789088] transition hover:bg-[#e6f0eb] hover:text-[#176b55]"
                            >
                              <ChevronRight size={17} />
                            </button>
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
              Importer des dossiers (CSV / Excel)
            </DialogTitle>
            <DialogDescription className="text-sm text-[#677b75]">
              Chargez un fichier CSV pour intégrer automatiquement de nouveaux dossiers de transit avec calcul instantané de régularisation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-[#c2d7ce] bg-[#f8faf9] p-6 text-center transition hover:border-[#1d7764] hover:bg-[#f0f6f3]"
            >
              <FileSpreadsheet className="mx-auto mb-2 text-[#1d7764]" size={36} />
              <p className="text-sm font-medium text-[#204036]">
                {importFileName ? `Fichier sélectionné : ${importFileName}` : "Cliquez ou glissez-déposez un fichier CSV ici"}
              </p>
              <p className="mt-1 text-xs text-[#80918c]">Séparateurs supportés : virgule (,), point-virgule (;), tabulation (\t)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#204036]">
                  <span>Aperçu des données ({importRows.length} lignes)</span>
                  <Badge className="bg-[#e3f1ea] text-[#176b55]">Prêt pour intégration</Badge>
                </div>
                <div className="max-h-56 overflow-auto rounded-xl border border-[#edf2ef] bg-[#fcfdfd]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1f6f4] text-[10px] uppercase text-[#697d77]">
                      <tr>
                        <th className="p-2">Client</th>
                        <th className="p-2">BL / LTA</th>
                        <th className="p-2">Marchandise</th>
                        <th className="p-2">ETA</th>
                        <th className="p-2">Déclaration</th>
                        <th className="p-2">Bulletin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ef]">
                      {importRows.slice(0, 8).map((row, i) => (
                        <tr key={i}>
                          <td className="p-2 truncate max-w-[120px]">{row.client || "—"}</td>
                          <td className="p-2">{row.blLtaNumber || "—"}</td>
                          <td className="p-2 truncate max-w-[140px]">{row.cargoNature || "—"}</td>
                          <td className="p-2">{row.eta || "—"}</td>
                          <td className="p-2">{row.declarationNumber || "—"}</td>
                          <td className="p-2">{row.bulletinNumber || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 8 && (
                  <p className="text-right text-[11px] text-[#869993]">... et {importRows.length - 8} autres dossiers</p>
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
              className="h-10 rounded-xl bg-[#0f4035] px-5 hover:bg-[#195847]"
            >
              {importBatchMutation.isPending ? (
                <Loader2 className="mr-2 animate-spin" size={16} />
              ) : (
                <CheckCircle2 className="mr-2" size={16} />
              )}
              Valider et intégrer ({importRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
