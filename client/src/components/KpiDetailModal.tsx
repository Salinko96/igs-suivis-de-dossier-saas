import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Package,
  Receipt,
  Search,
  Ship,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export type KpiType = "turnover" | "margin" | "disbursements" | "demurrage_risk";

export interface KpiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: KpiType | null;
  invoices: any[];
  dossiers: any[];
  exchangeRate: number;
  displayCurrency: "GNF" | "USD";
  isLoading?: boolean;
}

export function KpiDetailModal({
  isOpen,
  onClose,
  kpiType,
  invoices = [],
  dossiers = [],
  exchangeRate = 8650,
  displayCurrency: initialCurrency = "GNF",
  isLoading = false,
}: KpiDetailModalProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currency, setCurrency] = useState<"GNF" | "USD">(initialCurrency);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const formatAmount = (amountInGnf: number) => {
    if (currency === "USD") {
      const inUsd = amountInGnf / exchangeRate;
      return `$ ${inUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${Math.round(amountInGnf).toLocaleString("fr-FR")} GNF`;
  };

  // 1. Filtrage et recalcul pour le Chiffre d'Affaires Global
  const turnoverData = useMemo(() => {
    if (kpiType !== "turnover") return { rows: [], totalGnf: 0 };
    const query = searchQuery.trim().toLowerCase();

    let filtered = invoices.filter(inv => {
      const matchQuery =
        !query ||
        inv.invoiceNumber?.toLowerCase().includes(query) ||
        inv.client?.toLowerCase().includes(query) ||
        String(inv.dossierId).includes(query);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchQuery && matchStatus;
    });

    const totalGnf = filtered.reduce((sum, inv) => {
      const val = inv.currency === "USD" ? inv.amountTtc * (inv.exchangeRate || exchangeRate) : inv.amountTtc;
      return sum + val;
    }, 0);

    return { rows: filtered, totalGnf };
  }, [invoices, kpiType, searchQuery, statusFilter, exchangeRate]);

  // 2. Filtrage et recalcul pour la Marge Brute Estimée
  const marginData = useMemo(() => {
    if (kpiType !== "margin") return { rows: [], totalGnf: 0 };
    const query = searchQuery.trim().toLowerCase();

    let filtered = invoices.filter(inv => {
      const matchQuery =
        !query ||
        inv.invoiceNumber?.toLowerCase().includes(query) ||
        inv.client?.toLowerCase().includes(query) ||
        String(inv.dossierId).includes(query);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchQuery && matchStatus;
    });

    const totalGnf = filtered.reduce((sum, inv) => {
      const margin = inv.estimatedMargin ?? Math.round((inv.amountHt || 0) * 0.25);
      const val = inv.currency === "USD" ? margin * (inv.exchangeRate || exchangeRate) : margin;
      return sum + val;
    }, 0);

    return { rows: filtered, totalGnf };
  }, [invoices, kpiType, searchQuery, statusFilter, exchangeRate]);

  // 3. Filtrage et recalcul pour les Débours Avancés PAC
  const disbursementsData = useMemo(() => {
    if (kpiType !== "disbursements") return { rows: [], totalGnf: 0 };
    const query = searchQuery.trim().toLowerCase();

    let filtered = invoices.filter(inv => {
      const matchQuery =
        !query ||
        inv.invoiceNumber?.toLowerCase().includes(query) ||
        inv.client?.toLowerCase().includes(query) ||
        String(inv.dossierId).includes(query);
      return matchQuery;
    });

    const totalGnf = filtered.reduce((sum, inv) => {
      const disb = inv.disbursementsAmount || (Number(inv.customsDutiesAmount || 0) + Number(inv.portFeesAmount || 0) + Number(inv.storageAndDemurrageFees || 0));
      const val = inv.currency === "USD" ? disb * (inv.exchangeRate || exchangeRate) : disb;
      return sum + val;
    }, 0);

    return { rows: filtered, totalGnf };
  }, [invoices, kpiType, searchQuery, exchangeRate]);

  // 4. Filtrage et recalcul pour le Risque Surestaries PAC (> 7 jours au quai)
  const demurrageData = useMemo(() => {
    if (kpiType !== "demurrage_risk") return { rows: [], totalCount: 0 };
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    const atRiskDossiers = dossiers.filter(d => {
      if (!d.eta || d.goodsReleaseDate) return false;
      const etaTime = new Date(d.eta).getTime();
      if (isNaN(etaTime)) return false;
      const daysOnQuay = Math.floor((now - etaTime) / 86400000);
      return daysOnQuay > 7;
    });

    const filtered = atRiskDossiers.filter(d => {
      if (!query) return true;
      return (
        d.dossierNumber?.toLowerCase().includes(query) ||
        d.client?.toLowerCase().includes(query) ||
        d.blLtaNumber?.toLowerCase().includes(query) ||
        d.cargoNature?.toLowerCase().includes(query)
      );
    });

    return { rows: filtered, totalCount: filtered.length };
  }, [dossiers, kpiType, searchQuery]);

  // Export simple CSV
  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (kpiType === "turnover") {
      csvContent += "N° Facture,Client,Dossier,Honoraires HT,TVA 18%,Total TTC,Devise,Statut,Date\n";
      turnoverData.rows.forEach(r => {
        csvContent += `"${r.invoiceNumber}","${r.client}","DOS-${r.dossierId}",${r.amountHt},${r.amountTva},${r.amountTtc},"${r.currency}","${r.status}","${new Date(r.createdAt).toLocaleDateString("fr-FR")}"\n`;
      });
    } else if (kpiType === "margin") {
      csvContent += "N° Facture,Client,Dossier,Honoraires HT,Marge Brute Estimée,Devise,Statut\n";
      marginData.rows.forEach(r => {
        csvContent += `"${r.invoiceNumber}","${r.client}","DOS-${r.dossierId}",${r.amountHt},${r.estimatedMargin || Math.round(r.amountHt * 0.25)},"${r.currency}","${r.status}"\n`;
      });
    } else if (kpiType === "disbursements") {
      csvContent += "N° Facture,Client,Dossier,Droits Douane,Frais Portuaires PAC,Surestaries & Magasinage,Total Débours,Devise\n";
      disbursementsData.rows.forEach(r => {
        csvContent += `"${r.invoiceNumber}","${r.client}","DOS-${r.dossierId}",${r.customsDutiesAmount || 0},${r.portFeesAmount || 0},${r.storageAndDemurrageFees || 0},${r.disbursementsAmount || 0},"${r.currency}"\n`;
      });
    } else if (kpiType === "demurrage_risk") {
      csvContent += "N° Dossier,Client,N° BL/LTA,Date ETA,Jours au Quai,Marchandise,Statut Douanier\n";
      demurrageData.rows.forEach(d => {
        const days = Math.floor((Date.now() - new Date(d.eta).getTime()) / 86400000);
        csvContent += `"${d.dossierNumber}","${d.client}","${d.blLtaNumber || ""}","${new Date(d.eta).toLocaleDateString("fr-FR")}",${days},"${d.cargoNature || ""}","${d.calculatedStatus || ""}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `export_detail_${kpiType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!kpiType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-3xl bg-white shadow-2xl border-0 overflow-hidden">
        {/* En-tête du Modal avec thème IGS */}
        <div className="bg-[#0b3b32] text-white p-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
                {kpiType === "turnover" && <Wallet size={22} />}
                {kpiType === "margin" && <TrendingUp size={22} className="text-[#d9a94b]" />}
                {kpiType === "disbursements" && <Receipt size={22} className="text-blue-300" />}
                {kpiType === "demurrage_risk" && <AlertTriangle size={22} className="text-rose-300" />}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9a94b]">
                  Décomposition & Traçabilité Financière
                </span>
                <DialogTitle className="font-[Georgia] text-xl sm:text-2xl font-bold text-white mt-0.5">
                  {kpiType === "turnover" && "Détail du Chiffre d'Affaires Global"}
                  {kpiType === "margin" && "Décomposition de la Marge Brute Estimée"}
                  {kpiType === "disbursements" && "Détail des Débours Avancés Port Autonome & Douane"}
                  {kpiType === "demurrage_risk" && "Dossiers en Risque de Surestaries (> 7 jours au quai)"}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-100/80 mt-1">
                  {kpiType === "turnover" && "Toutes les factures émises, honoraires de transit HT et TVA collectée."}
                  {kpiType === "margin" && "Marge nette opérationnelle IGS calculée sur les prestations de transit."}
                  {kpiType === "disbursements" && "Décomposition des droits de douane (Trésor), frais de quai PAC et magasinage."}
                  {kpiType === "demurrage_risk" && "Dossiers au port de Conakry sans date de sortie dont l'ETA dépasse 7 jours."}
                </DialogDescription>
              </div>
            </div>

            {/* Badge de Somme Recalculée en Direct */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/15 text-left sm:text-right shrink-0">
              <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider block">
                {kpiType === "demurrage_risk" ? "Total Dossiers Concernés" : "Total Recalculé en Direct"}
              </span>
              <p className="font-[Georgia] text-xl font-bold text-white mt-0.5">
                {kpiType === "turnover" && formatAmount(turnoverData.totalGnf)}
                {kpiType === "margin" && formatAmount(marginData.totalGnf)}
                {kpiType === "disbursements" && formatAmount(disbursementsData.totalGnf)}
                {kpiType === "demurrage_risk" && `${demurrageData.totalCount} dossier(s)`}
              </p>
            </div>
          </div>
        </div>

        {/* Barre d'outils (Recherche, Filtres, Toggle Devise, Export) */}
        <div className="p-4 bg-gray-50/90 border-b border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={kpiType === "demurrage_risk" ? "Filtrer par N° dossier, client, BL..." : "Rechercher par N° facture, client..."}
                className="pl-9 h-9 text-xs rounded-xl bg-white border-gray-200"
              />
            </div>

            {kpiType !== "demurrage_risk" && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl bg-white border border-gray-200 text-gray-700 font-medium"
              >
                <option value="all">Tous les statuts</option>
                <option value="Proforma">Proforma</option>
                <option value="Émise">Émise</option>
                <option value="Payée">Payée</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {kpiType !== "demurrage_risk" && (
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-gray-200 shadow-sm">
                <Button
                  variant={currency === "GNF" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrency("GNF")}
                  className={`rounded-lg text-[11px] h-7 px-2.5 ${currency === "GNF" ? "bg-[#0b3b32] text-white" : ""}`}
                >
                  GNF
                </Button>
                <Button
                  variant={currency === "USD" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrency("USD")}
                  className={`rounded-lg text-[11px] h-7 px-2.5 ${currency === "USD" ? "bg-[#0b3b32] text-white" : ""}`}
                >
                  USD ($)
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs rounded-xl border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-950 gap-1.5 shadow-sm font-medium"
            >
              <Download size={13} />
              <span>Exporter CSV</span>
            </Button>
          </div>
        </div>

        {/* Corps du Tableau avec Défilement Fluide */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[280px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* TABLEAU 1: CHIFFRE D'AFFAIRES GLOBAL */}
              {kpiType === "turnover" && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600 border-b">
                      <tr>
                        <th className="p-3 pl-4">N° Facture</th>
                        <th className="p-3">Client & Dossier</th>
                        <th className="p-3 text-right">Honoraires HT</th>
                        <th className="p-3 text-right">TVA (18%)</th>
                        <th className="p-3 text-right">Total TTC</th>
                        <th className="p-3 text-center">Statut</th>
                        <th className="p-3 text-right pr-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {turnoverData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                            Aucune facture trouvée pour ce filtre.
                          </td>
                        </tr>
                      ) : (
                        turnoverData.rows.map(inv => {
                          const htGnf = inv.currency === "USD" ? inv.amountHt * (inv.exchangeRate || exchangeRate) : inv.amountHt;
                          const tvaGnf = inv.currency === "USD" ? inv.amountTva * (inv.exchangeRate || exchangeRate) : inv.amountTva;
                          const ttcGnf = inv.currency === "USD" ? inv.amountTtc * (inv.exchangeRate || exchangeRate) : inv.amountTtc;
                          return (
                            <tr key={inv.id} className="hover:bg-emerald-50/40 transition">
                              <td className="p-3 pl-4 font-mono font-bold text-[#0b3b32]">
                                {inv.invoiceNumber}
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-gray-900 block">{inv.client}</span>
                                <span className="text-[10px] text-muted-foreground">Dossier #{inv.dossierId}</span>
                              </td>
                              <td className="p-3 text-right font-medium text-gray-700">{formatAmount(htGnf)}</td>
                              <td className="p-3 text-right text-gray-500">{formatAmount(tvaGnf)}</td>
                              <td className="p-3 text-right font-bold text-[#0b3b32]">{formatAmount(ttcGnf)}</td>
                              <td className="p-3 text-center">
                                <Badge
                                  className={
                                    inv.status === "Payée"
                                      ? "bg-emerald-100 text-emerald-800 border-0"
                                      : inv.status === "Émise"
                                      ? "bg-blue-100 text-blue-800 border-0"
                                      : "bg-amber-100 text-amber-800 border-0"
                                  }
                                >
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-right pr-4 text-gray-500">
                                {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {turnoverData.rows.length > 0 && (
                      <tfoot className="bg-[#f0f7f4] font-bold border-t border-emerald-200">
                        <tr>
                          <td colSpan={4} className="p-3 pl-4 text-right uppercase text-[10px] tracking-wider text-emerald-900">
                            Total Somme des Lignes :
                          </td>
                          <td className="p-3 text-right text-sm text-[#0b3b32]">
                            {formatAmount(turnoverData.totalGnf)}
                          </td>
                          <td colSpan={2} className="p-3 text-[11px] text-emerald-700 text-right pr-4 font-medium">
                            {turnoverData.rows.length} facture(s)
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* TABLEAU 2: MARGE BRUTE ESTIMÉE */}
              {kpiType === "margin" && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600 border-b">
                      <tr>
                        <th className="p-3 pl-4">N° Facture</th>
                        <th className="p-3">Client & Dossier</th>
                        <th className="p-3 text-right">Honoraires HT</th>
                        <th className="p-3 text-center">Taux Marge %</th>
                        <th className="p-3 text-right">Marge Brute IGS</th>
                        <th className="p-3 text-center">Statut Facture</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {marginData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                            Aucune facture trouvée.
                          </td>
                        </tr>
                      ) : (
                        marginData.rows.map(inv => {
                          const marginGnf = inv.currency === "USD"
                            ? (inv.estimatedMargin || Math.round(inv.amountHt * 0.25)) * (inv.exchangeRate || exchangeRate)
                            : (inv.estimatedMargin || Math.round(inv.amountHt * 0.25));
                          const htGnf = inv.currency === "USD" ? inv.amountHt * (inv.exchangeRate || exchangeRate) : inv.amountHt;
                          const marginPct = htGnf > 0 ? Math.round((marginGnf / htGnf) * 100) : 25;
                          return (
                            <tr key={inv.id} className="hover:bg-amber-50/30 transition">
                              <td className="p-3 pl-4 font-mono font-bold text-gray-900">
                                {inv.invoiceNumber}
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-gray-900 block">{inv.client}</span>
                                <span className="text-[10px] text-muted-foreground">Dossier #{inv.dossierId}</span>
                              </td>
                              <td className="p-3 text-right font-medium text-gray-700">{formatAmount(htGnf)}</td>
                              <td className="p-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                                  {marginPct}%
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-amber-900">{formatAmount(marginGnf)}</td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className="text-gray-700 font-medium">
                                  {inv.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {marginData.rows.length > 0 && (
                      <tfoot className="bg-amber-50/70 font-bold border-t border-amber-200">
                        <tr>
                          <td colSpan={4} className="p-3 pl-4 text-right uppercase text-[10px] tracking-wider text-amber-950">
                            Total Marge Brute :
                          </td>
                          <td className="p-3 text-right text-sm text-amber-950">
                            {formatAmount(marginData.totalGnf)}
                          </td>
                          <td className="p-3 text-[11px] text-amber-800 text-center font-medium">
                            {marginData.rows.length} facture(s)
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* TABLEAU 3: DÉBOURS AVANCÉS PAC & DOUANE */}
              {kpiType === "disbursements" && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600 border-b">
                      <tr>
                        <th className="p-3 pl-4">Réf. Facture / Dossier</th>
                        <th className="p-3">Client</th>
                        <th className="p-3 text-right">Droits Douane (Trésor)</th>
                        <th className="p-3 text-right">Redevances PAC / Quai</th>
                        <th className="p-3 text-right">Magasinage</th>
                        <th className="p-3 text-right pr-4">Total Débours Avancés</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {disbursementsData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                            Aucun débours enregistré.
                          </td>
                        </tr>
                      ) : (
                        disbursementsData.rows.map(inv => {
                          const mult = inv.currency === "USD" ? (inv.exchangeRate || exchangeRate) : 1;
                          const customs = (inv.customsDutiesAmount || 0) * mult;
                          const port = (inv.portFeesAmount || 0) * mult;
                          const storage = (inv.storageAndDemurrageFees || 0) * mult;
                          const totalDisb = (inv.disbursementsAmount || (customs + port + storage)) * (inv.currency === "USD" ? mult : 1);

                          return (
                            <tr key={inv.id} className="hover:bg-blue-50/30 transition">
                              <td className="p-3 pl-4">
                                <span className="font-mono font-bold text-gray-900 block">{inv.invoiceNumber}</span>
                                <span className="text-[10px] text-muted-foreground">Dossier #{inv.dossierId}</span>
                              </td>
                              <td className="p-3 font-semibold text-gray-900">{inv.client}</td>
                              <td className="p-3 text-right text-gray-700">{formatAmount(customs)}</td>
                              <td className="p-3 text-right text-gray-700">{formatAmount(port)}</td>
                              <td className="p-3 text-right text-gray-700">{formatAmount(storage)}</td>
                              <td className="p-3 text-right pr-4 font-bold text-blue-900">{formatAmount(totalDisb)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {disbursementsData.rows.length > 0 && (
                      <tfoot className="bg-blue-50/70 font-bold border-t border-blue-200">
                        <tr>
                          <td colSpan={5} className="p-3 pl-4 text-right uppercase text-[10px] tracking-wider text-blue-950">
                            Total Débours Avancés :
                          </td>
                          <td className="p-3 text-right pr-4 text-sm text-blue-950">
                            {formatAmount(disbursementsData.totalGnf)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* TABLEAU 4: RISQUE SURESTARIES PAC (> 7 JOURS) */}
              {kpiType === "demurrage_risk" && (
                <div className="rounded-2xl border border-rose-200/80 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-rose-50/70 text-[10px] uppercase tracking-wider text-rose-950 border-b border-rose-200">
                      <tr>
                        <th className="p-3 pl-4">N° Dossier</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">N° BL / LTA</th>
                        <th className="p-3">Date ETA (Arrivée)</th>
                        <th className="p-3 text-center">Jours de Séjour Quai</th>
                        <th className="p-3">Marchandise</th>
                        <th className="p-3 text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100/60">
                      {demurrageData.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                            Aucun dossier en dépassement de délai de surestaries (&gt; 7 jours).
                          </td>
                        </tr>
                      ) : (
                        demurrageData.rows.map(d => {
                          const days = Math.floor((Date.now() - new Date(d.eta).getTime()) / 86400000);
                          return (
                            <tr key={d.id} className="hover:bg-rose-50/40 transition">
                              <td className="p-3 pl-4 font-bold text-rose-950 font-mono">
                                {d.dossierNumber}
                              </td>
                              <td className="p-3 font-semibold text-gray-900">{d.client || "Client non renseigné"}</td>
                              <td className="p-3 font-mono text-gray-600">{d.blLtaNumber || "—"}</td>
                              <td className="p-3 text-gray-600">
                                {d.eta ? new Date(d.eta).toLocaleDateString("fr-FR") : "—"}
                              </td>
                              <td className="p-3 text-center">
                                <Badge className="bg-rose-100 text-rose-900 border-rose-300 font-bold">
                                  <Clock size={11} className="mr-1 inline" />
                                  {days} jours au quai
                                </Badge>
                              </td>
                              <td className="p-3 text-gray-600 truncate max-w-[150px]">{d.cargoNature || "—"}</td>
                              <td className="p-3 text-right pr-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    onClose();
                                    setLocation(`/dossiers/${d.id}`);
                                  }}
                                  className="h-7 text-[11px] rounded-lg border-gray-200 hover:bg-emerald-50 hover:text-emerald-900"
                                >
                                  Fiche <ArrowUpRight size={12} className="ml-1" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {demurrageData.rows.length > 0 && (
                      <tfoot className="bg-rose-50/90 font-bold border-t border-rose-200">
                        <tr>
                          <td colSpan={4} className="p-3 pl-4 uppercase text-[10px] tracking-wider text-rose-950">
                            Total Dossiers en Alerte Séjour Prolongé :
                          </td>
                          <td className="p-3 text-center text-sm text-rose-950">
                            {demurrageData.totalCount} dossier(s)
                          </td>
                          <td colSpan={2} className="p-3 text-right pr-4 text-[11px] text-rose-800 font-normal">
                            Alerte PAC / Surestaries actives
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pied de page du Modal */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calculator size={14} className="text-emerald-800" />
            <span>Données synchronisées en temps réel avec Supabase PostgreSQL</span>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-gray-300 text-xs px-4 h-9 font-semibold"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
