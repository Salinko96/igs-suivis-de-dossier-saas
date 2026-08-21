import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Mail,
  Building2,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Crown,
} from "lucide-react";

interface ClientReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientName?: string;
}

const MINING_AND_MAJOR_CLIENTS = [
  "Guinean Birimian Gold (GBG)",
  "Guinee Gold Exploration (GGE)",
  "New Japon Mining (NJP)",
  "Capdrill Mining Guinea",
  "Alumina Company of Guinea (ACG)",
  "Boffa Bauxite Corporation",
  "BHP Billiton Guinea",
  "Chinalco Guinea",
  "Société Minière de Boké (SMB)",
];

export const ClientReportModal: React.FC<ClientReportModalProps> = ({
  isOpen,
  onClose,
  initialClientName = "Guinean Birimian Gold (GBG)",
}) => {
  const [selectedClient, setSelectedClient] = useState<string>(initialClientName);
  const [period, setPeriod] = useState<string>("all");

  const reportQuery = trpc.report.getClientReport.useQuery(
    { clientName: selectedClient },
    { enabled: isOpen && Boolean(selectedClient) }
  );

  const handlePrintPdf = () => {
    if (!reportQuery.data?.htmlLayout) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Fenêtre bloquée", {
        description: "Veuillez autoriser les fenêtres pop-up pour imprimer le rapport PDF.",
      });
      return;
    }
    printWindow.document.write(reportQuery.data.htmlLayout);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExportCsv = () => {
    if (!reportQuery.data?.summary) return;
    const summary = reportQuery.data.summary;
    const rows = [
      ["N° Dossier", "BL/LTA", "Marchandise", "Mode", "ETA", "Sortie Quai", "Delai (Jours)", "Statut", "Montant Facture GNF"],
      ...summary.dossiers.map((d) => [
        d.dossierNumber,
        d.blLtaNumber || "",
        d.cargoNature || "",
        d.transportMode || "",
        d.eta ? new Date(d.eta).toLocaleDateString("fr-FR") : "",
        d.goodsReleaseDate ? new Date(d.goodsReleaseDate).toLocaleDateString("fr-FR") : "",
        d.clearanceDays !== null ? String(d.clearanceDays) : "En cours",
        d.calculatedStatus,
        String(d.invoicedAmountGNF),
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapport_IGS_${selectedClient.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export Excel / CSV généré", {
      description: "Le tableur consolidé a été téléchargé sur votre poste.",
    });
  };

  const handleSendEmailSimulation = () => {
    toast.success("Rapport envoyé par email", {
      description: `Le rapport officiel certifié a été expédié à la direction logistique de ${selectedClient}.`,
    });
  };

  const summary = reportQuery.data?.summary;
  const isMining = summary?.accountCategory === "mining_major";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-card border-border p-0 overflow-hidden flex flex-col max-h-[90vh] h-[85vh]">
        {/* Header */}
        <DialogHeader className="p-5 bg-muted/40 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Rapports Consolidés d'Activité par Client
                {isMining && (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Grand Compte Minier
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bilan opérationnel et financier : volumes, Lead Time quai, CA facturé et délais moyens de régularisation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-64 h-8 text-xs bg-background">
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {MINING_AND_MAJOR_CLIENTS.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Report Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-muted/10">
          {reportQuery.isLoading ? (
            <div className="p-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 opacity-50" />
              Génération du rapport consolidé en cours...
            </div>
          ) : !summary ? (
            <div className="p-16 text-center text-xs text-muted-foreground">Aucune donnée disponible</div>
          ) : (
            <>
              {/* Top Banner */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Société Cliente
                  </div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mt-0.5">
                    {summary.clientName}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    Édité le {new Date(summary.generatedAt).toLocaleDateString("fr-FR")} • Taux USD : {summary.exchangeRate.toLocaleString("fr-FR")} GNF
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleExportCsv} className="h-8 gap-1.5 text-xs">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSendEmailSimulation} className="h-8 gap-1.5 text-xs">
                    <Mail className="w-3.5 h-3.5" /> Envoi Email
                  </Button>
                  <Button size="sm" onClick={handlePrintPdf} className="h-8 gap-1.5 text-xs">
                    <Printer className="w-3.5 h-3.5" /> Imprimer / PDF Pro
                  </Button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">Total Dossiers</div>
                  <div className="text-2xl font-extrabold text-foreground mt-1">{summary.totalDossiers}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    {summary.regularizationRatePct}% régularisés
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">Lead Time Moyen</div>
                  <div className="text-2xl font-extrabold text-foreground mt-1">{summary.averageClearanceDays} j</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Séjour quai Conakry</div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">Total Facturé (GNF)</div>
                  <div className="text-xl font-extrabold text-foreground mt-1">
                    {Math.round(summary.totalInvoicedGNF).toLocaleString("fr-FR")}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    ≈ $ {summary.totalInvoicedUSD.toLocaleString("en-US")}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">Marge Brute IGS</div>
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {Math.round(summary.totalMarginGNF).toLocaleString("fr-FR")} GNF
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Taux de marge : {summary.marginRatePct}%
                  </div>
                </div>
              </div>

              {/* Detailed Dossiers Table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="p-3.5 bg-muted/40 border-b border-border font-bold text-xs text-foreground flex items-center justify-between">
                  <span>Dossiers de Transit Traités ({summary.dossiers.length})</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Tri chronologique</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/20 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5 font-semibold">N° Dossier</th>
                        <th className="p-2.5 font-semibold">BL / LTA</th>
                        <th className="p-2.5 font-semibold">Marchandise</th>
                        <th className="p-2.5 font-semibold">ETA Navire</th>
                        <th className="p-2.5 font-semibold">Sortie Quai</th>
                        <th className="p-2.5 font-semibold text-center">Délai Quai</th>
                        <th className="p-2.5 font-semibold">Statut</th>
                        <th className="p-2.5 font-semibold text-right">Montant Facturé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.dossiers.map((d, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold">{d.dossierNumber}</td>
                          <td className="p-2.5 font-mono text-[11px]">{d.blLtaNumber || "—"}</td>
                          <td className="p-2.5 truncate max-w-xs">{d.cargoNature || "Cargaison"}</td>
                          <td className="p-2.5">{d.eta ? new Date(d.eta).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="p-2.5">{d.goodsReleaseDate ? new Date(d.goodsReleaseDate).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="p-2.5 text-center font-bold">
                            {d.clearanceDays !== null ? `${d.clearanceDays} j` : <span className="text-amber-500">En cours</span>}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              className={`text-[10px] ${
                                d.calculatedStatus === "Régularisé"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {d.calculatedStatus}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-right font-bold">
                            {d.invoicedAmountGNF.toLocaleString("fr-FR")} GNF
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
