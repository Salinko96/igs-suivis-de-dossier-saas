import DashboardLayout from "@/components/DashboardLayout";
import { CustomsEditModal, CustomsEditDossier } from "@/components/CustomsEditModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CopyCheck,
  Edit3,
  ExternalLink,
  FileQuestion,
  FileWarning,
  Landmark,
  PackageOpen,
  ReceiptText,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const controls = [
  { key: "missingClientNumber", title: "N° dossier client manquants", caption: "À compléter avec le client", icon: FileQuestion, tone: "text-[#bf5038] bg-[#fff0eb]" },
  { key: "missingRelease", title: "Sorties non renseignées", caption: "Marchandises sans date de sortie PAC", icon: PackageOpen, tone: "text-[#a16b0a] bg-[#fff5df]" },
  { key: "duplicateBlLta", title: "Doublons BL / LTA", caption: "Vérifier les connaissements en double", icon: ClipboardCheck, tone: "text-[#bf5038] bg-[#fff0eb]" },
  { key: "duplicateClientNumber", title: "Doublons N° dossier client", caption: "Contrôler les références client", icon: CopyCheck, tone: "text-[#a16b0a] bg-[#fff5df]" },
  { key: "missingDeclarations", title: "Déclarations manquantes", caption: "N° SYDONIA à renseigner", icon: ReceiptText, tone: "text-[#a16b0a] bg-[#fff5df]" },
  { key: "missingBulletins", title: "Bulletins manquants", caption: "Bulletins de liquidation (BLD)", icon: FileWarning, tone: "text-[#bf5038] bg-[#fff0eb]" },
  { key: "missingEta", title: "ETA manquantes", caption: "Planification d'arrivée non définie", icon: CalendarClock, tone: "text-[#a16b0a] bg-[#fff5df]" },
] as const;

function ControlsContent() {
  const [, setLocation] = useLocation();
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [editingCustomsDossier, setEditingCustomsDossier] = useState<CustomsEditDossier | null>(null);

  const { data, isLoading, error } = trpc.dashboard.get.useQuery();
  const { data: dossiers = [], error: dossiersError } = trpc.dossier.list.useQuery();

  if (error)
    return (
      <Card className="border-0 bg-white">
        <CardContent className="p-10 text-center">
          <AlertTriangle className="mx-auto text-[#c4543e]" />
          <p className="mt-4 font-semibold text-[#ad4c38]">Impossible de charger les contrôles</p>
          <p className="mt-2 text-sm text-[#71817b]">{error.message}</p>
        </CardContent>
      </Card>
    );

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

  const { quality, metrics, clients, fieldAlerts = [] } = data;
  const duplicates = new Map<string, number>();
  dossiers.forEach(dossier => {
    if (dossier.blLtaNumber) duplicates.set(dossier.blLtaNumber, (duplicates.get(dossier.blLtaNumber) || 0) + 1);
  });

  const anomalies = dossiers
    .filter(
      dossier =>
        !dossier.clientDossierNumber ||
        !dossier.eta ||
        !dossier.declarationNumber ||
        !dossier.bulletinNumber ||
        !dossier.goodsReleaseDate ||
        (dossier.blLtaNumber && (duplicates.get(dossier.blLtaNumber) || 0) > 1)
    )
    .filter(d => (selectedAlert ? d.fieldAlert === selectedAlert : true))
    .slice(0, 15);

  return (
    <div className="mx-auto max-w-[1540px] space-y-6">
      {/* Header */}
      <section className="rounded-[1.7rem] bg-[#123e34] px-7 py-7 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d9a94b]">Assurance opérationnelle & Douane</p>
        <h1 className="mt-2 font-[Georgia] text-3xl font-semibold">Contrôles qualité & alertes terrain</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7d9d2]">
          Surveillance continue des données de transit (Port Autonome de Conakry, SYDONIA World, DDI/GUCEG) et régularisation instantanée des anomalies.
        </p>
      </section>

      {/* Field Alerts Filter Chips */}
      {fieldAlerts.length > 0 && (
        <section className="rounded-2xl border border-[#dfe8e4] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={17} className="text-[#1d7764]" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#697d76]">Alertes terrain enregistrées</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedAlert(null)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                selectedAlert === null ? "bg-[#0f4035] text-white" : "bg-[#f1f6f4] text-[#33534a] hover:bg-[#e3eeea]"
              }`}
            >
              Toutes les alertes
            </button>
            {fieldAlerts.map(alert => (
              <button
                key={alert.label}
                onClick={() => setSelectedAlert(selectedAlert === alert.label ? null : alert.label)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                  selectedAlert === alert.label
                    ? "bg-[#0f4035] text-white"
                    : "bg-[#f1f6f4] text-[#33534a] hover:bg-[#e3eeea]"
                }`}
              >
                <span>{alert.label}</span>
                <span className="rounded-full bg-white/40 px-1.5 py-0.2 text-[10px] font-bold">
                  {alert.count}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quality Alerts Grid */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Qualité des dossiers</p>
            <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">Points d’attention prioritaires</h2>
          </div>
          <Badge className="border-0 bg-[#fff0eb] text-[#bd5038]">{quality.incomplete} dossiers incomplets</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {controls.map(control => {
            const Icon = control.icon;
            const value = quality[control.key];
            return (
              <Card key={control.key} className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${control.tone}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-[Georgia] text-2xl font-semibold text-[#163b31]">{value}</p>
                    <p className="mt-0.5 text-sm font-medium text-[#3e5a52]">{control.title}</p>
                    <p className="mt-0.5 text-xs text-[#82918c]">{control.caption}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Delays & Client Concentration */}
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Fluidité & Transit</p>
            <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">Délais & rotations</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "ETA prévues sous 7 jours",
                  value: metrics.etaInSevenDays,
                  icon: CalendarClock,
                  tone: "bg-[#e7f1ed] text-[#216e5c]",
                },
                {
                  label: "Délai moyen ETA → sortie",
                  value: metrics.averageEtaToRelease === null ? "—" : `${metrics.averageEtaToRelease} j`,
                  icon: TimerReset,
                  tone: "bg-[#e7f1ed] text-[#216e5c]",
                },
                {
                  label: "Part des dossiers sortis",
                  value: `${metrics.releasedShare}%`,
                  icon: CheckCircle2,
                  tone: "bg-[#edf2f0] text-[#42635a]",
                },
                {
                  label: "ETA dépassées sans sortie",
                  value: metrics.overdue,
                  icon: AlertTriangle,
                  tone: "bg-[#fff0eb] text-[#bf5038]",
                },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-[#edf2ef] p-4">
                  <div className={`grid h-9 w-9 place-items-center rounded-lg ${item.tone}`}>
                    <item.icon size={17} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-[#173a31]">{item.value}</p>
                  <p className="mt-1 text-xs text-[#71817b]">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                  {clients.slice(0, 7).map(client => (
                    <tr key={client.client}>
                      <td className="max-w-[240px] truncate px-4 py-3 font-medium text-[#335148]">{client.client}</td>
                      <td className="px-4 py-3 text-center text-[#596e67]">{client.total}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge className="border-0 bg-[#fff0eb] text-[#bf5038]">{client.toRegularize}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Actionable Anomalies Table with Instant Customs Regularization */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f908a]">Actions prioritaires</p>
            <h2 className="mt-1 font-[Georgia] text-2xl font-semibold text-[#173a31]">
              Dossiers à régulariser en priorité
            </h2>
          </div>
          {selectedAlert && (
            <Badge className="bg-[#e8f1ed] text-[#1e6150]">Filtre : {selectedAlert}</Badge>
          )}
        </div>
        {dossiersError ? (
          <Card className="border-0 bg-white">
            <CardContent className="p-5 text-sm text-[#ad4c38]">
              Impossible de charger la liste détaillée : {dossiersError.message}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase tracking-[0.12em] text-[#7d8d87]">
                  <tr>
                    <th className="px-5 py-3">Dossier</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Marchandise</th>
                    <th className="px-5 py-3">Anomalies détectées</th>
                    <th className="px-5 py-3 text-right">Régularisation Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2ef]">
                  {anomalies.map(dossier => {
                    const issues: string[] = [
                      [!dossier.clientDossierNumber, "N° client"],
                      [!dossier.eta, "ETA"],
                      [!dossier.declarationNumber, "SYDONIA manquant"],
                      [!dossier.bulletinNumber, "BLD manquant"],
                      [!dossier.goodsReleaseDate, "Sortie PAC non saisie"],
                      [Boolean(dossier.blLtaNumber && (duplicates.get(dossier.blLtaNumber) || 0) > 1), "BL doublon"],
                    ]
                      .filter(([issue]) => Boolean(issue))
                      .map(([, label]) => String(label));
                    return (
                      <tr key={dossier.id} className="hover:bg-[#f8faf9] transition">
                        <td className="px-5 py-3 font-semibold text-[#176b55]">
                          <button
                            onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                            className="hover:underline text-left font-bold"
                          >
                            {dossier.dossierNumber}
                          </button>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            BL: {dossier.blLtaNumber || "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[#4d665e]">{dossier.client || "Client non renseigné"}</td>
                        <td className="px-5 py-3 text-xs text-[#5f756e] truncate max-w-[180px]">
                          {dossier.cargoNature || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {issues.map(issue => (
                              <Badge key={issue} className="border-0 bg-[#fff0eb] text-[#bd5038] text-[10px]">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => setEditingCustomsDossier(dossier)}
                              className="h-7 rounded-lg bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs px-2.5 shadow-sm"
                            >
                              <Edit3 size={12} className="mr-1" /> Régulariser
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                              className="h-7 text-xs text-muted-foreground hover:text-emerald-900 px-2"
                            >
                              Fiche <ChevronRight size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
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
