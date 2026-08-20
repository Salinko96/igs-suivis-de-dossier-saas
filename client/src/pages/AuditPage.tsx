import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Filter,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AuditPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const auditQuery = trpc.audit.list.useQuery({}, {
    staleTime: 10_000,
  });

  const portalLogsQuery = trpc.portal.logs.useQuery({}, {
    staleTime: 10_000,
  });

  const allLogs = auditQuery.data || [];
  const portalLogs = portalLogsQuery.data || [];

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log: any) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        log.authorName?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.fieldChanged?.toLowerCase().includes(q) ||
        String(log.dossierId || "").includes(q) ||
        log.newValue?.toLowerCase().includes(q) ||
        log.comment?.toLowerCase().includes(q);

      const matchAction =
        actionFilter === "all" ||
        (actionFilter === "customs" && (log.action?.includes("STATUT") || log.fieldChanged?.includes("Douane") || log.action?.includes("DDI") || log.action?.includes("SYDONIA"))) ||
        (actionFilter === "finance" && (log.action?.includes("FACTURE") || log.action?.includes("PAIEMENT") || log.action?.includes("DEBOURS"))) ||
        (actionFilter === "dossier" && (log.action?.includes("DOSSIER") || log.action?.includes("CREE") || log.action?.includes("MODIFIE")));

      return matchSearch && matchAction;
    });
  }, [allLogs, searchTerm, actionFilter]);

  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Date et Heure,Dossier,Auteur,Role,Action,Champ Modifie,Ancienne Valeur,Nouvelle Valeur,IP\n";
    filteredLogs.forEach((l: any) => {
      csvContent += `${l.id},"${new Date(l.createdAt).toISOString()}","DOS-${l.dossierId}","${l.authorName || ""}","${l.userRole || ""}","${l.action || ""}","${l.fieldChanged || ""}","${(l.previousValue || "").replace(/"/g, '""')}","${(l.newValue || "").replace(/"/g, '""')}","${l.ipAddress || ""}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `journal_audit_douane_igs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Journal d'audit exporté avec succès en CSV pour contrôle réglementaire.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <Breadcrumbs items={[{ label: "Administration", href: "/utilisateurs" }, { label: "Journal d'Audit & Traçabilité" }]} />

        {/* En-tête Page */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-950/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <ShieldCheck size={14} />
              <span>Conformité & Contrôle Douanier</span>
              <span>•</span>
              <span>Traçabilité Intégrale</span>
            </div>
            <h1 className="mt-1 font-[Georgia] text-2xl font-bold tracking-tight text-[#0b3b32] sm:text-3xl">
              Journal d'Audit & Historique des Événements
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Traçabilité infalsifiable de toutes les modifications de statuts douaniers, opérations financières et accès portail client.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                auditQuery.refetch();
                portalLogsQuery.refetch();
                toast.info("Journal d'audit actualisé.");
              }}
              className="border-emerald-900/20 text-emerald-950 hover:bg-emerald-50 text-xs"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${auditQuery.isRefetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              onClick={handleExportCsv}
              size="sm"
              className="bg-[#0b3b32] text-white hover:bg-[#166653] shadow-sm text-xs font-medium gap-1.5"
            >
              <Download size={14} />
              Exporter Registre Douane (CSV)
            </Button>
          </div>
        </div>

        {/* Cartes KPI Audit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-emerald-900/15 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900/70">
                  Total Événements d'Audit
                </p>
                <p className="mt-1.5 font-[Georgia] text-2xl font-bold text-[#0b3b32]">
                  {allLogs.length}
                </p>
                <p className="mt-1 text-[11px] text-emerald-700 font-medium">Modifications consignées</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b3b32] text-white shadow-sm">
                <History className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-teal-900/15 bg-gradient-to-br from-white to-teal-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-900/70">
                  Transitions Douanières
                </p>
                <p className="mt-1.5 font-[Georgia] text-2xl font-bold text-teal-950">
                  {allLogs.filter((l: any) => l.action?.includes("STATUT") || l.fieldChanged?.includes("Douane") || l.action?.includes("DDI")).length}
                </p>
                <p className="mt-1 text-[11px] text-teal-700 font-medium">DDI, SYDONIA, BAE, PAC</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800 text-white shadow-sm">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-amber-900/15 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">
                  Opérations Financières
                </p>
                <p className="mt-1.5 font-[Georgia] text-2xl font-bold text-amber-950">
                  {allLogs.filter((l: any) => l.action?.includes("FACTURE") || l.action?.includes("PAIEMENT") || l.action?.includes("DEBOURS")).length}
                </p>
                <p className="mt-1 text-[11px] text-amber-700 font-medium">Factures, Quittances & Débours</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-sky-900/15 bg-gradient-to-br from-white to-sky-50/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-900/70">
                  Accès Portail Client
                </p>
                <p className="mt-1.5 font-[Georgia] text-2xl font-bold text-sky-950">
                  {portalLogs.length}
                </p>
                <p className="mt-1 text-[11px] text-sky-700 font-medium">Connexions & consultations</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-800 text-white shadow-sm">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Barre de Recherche & Filtres */}
        <Card className="border border-emerald-900/15 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrer par N° dossier, nom d'agent, action, champ modifié..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs border-emerald-900/20 focus-visible:ring-emerald-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl bg-white border border-gray-200 text-gray-700 font-medium"
              >
                <option value="all">Toutes les catégories d'actions</option>
                <option value="customs">Contrôles Douaniers & Statuts</option>
                <option value="finance">Opérations Comptables & Finance</option>
                <option value="dossier">Création & Cycle de Vie Dossier</option>
              </select>

              {(searchTerm || actionFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setActionFilter("all");
                  }}
                  className="text-xs text-muted-foreground hover:text-emerald-950"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Effacer
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Affichage de <strong className="text-emerald-950">{filteredLogs.length}</strong> événement{filteredLogs.length > 1 ? "s" : ""} sur {allLogs.length}
            </span>
            <span className="text-[11px] text-emerald-800 font-medium">
              Conformité Code des Douanes de la République de Guinée (Art. 78)
            </span>
          </div>
        </Card>

        {/* Tableau du Registre d'Audit */}
        <Card className="overflow-hidden border border-emerald-900/15 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-[#0b3b32]/5 text-[#0b3b32] font-semibold border-b border-emerald-900/10 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 pl-4 pr-3">Horodatage</th>
                  <th className="py-3.5 px-3">Dossier</th>
                  <th className="py-3.5 px-3">Collaborateur / Rôle</th>
                  <th className="py-3.5 px-3">Action & Champ</th>
                  <th className="py-3.5 px-3">Ancienne Valeur</th>
                  <th className="py-3.5 px-3">Nouvelle Valeur</th>
                  <th className="py-3.5 pr-4 text-right">Lien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                      Aucun événement d'audit ne correspond à vos critères.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition">
                      <td className="py-3 pl-4 pr-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-emerald-800" />
                          <span>{new Date(log.createdAt).toLocaleString("fr-FR")}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-emerald-950">
                          {log.dossierId ? `DOS-${String(log.dossierId).padStart(4, "0")}` : "Système"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-gray-900 block">{log.authorName || "Opérateur IGS"}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{log.userRole || "declarant"}</span>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px] border-emerald-700/40 text-emerald-950 font-medium">
                          {log.action || log.fieldChanged}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-mono text-[11px] max-w-[140px] truncate">
                        {log.previousValue || "—"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-950 font-mono text-[11px] max-w-[160px] truncate">
                        {log.newValue || log.comment || "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {log.dossierId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/dossiers/${log.dossierId}`)}
                            className="h-7 text-[11px] rounded-lg text-emerald-900 hover:bg-emerald-100"
                          >
                            <Eye size={12} className="mr-1" />
                            Dossier
                          </Button>
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
    </DashboardLayout>
  );
}
