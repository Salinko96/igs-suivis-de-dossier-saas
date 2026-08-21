import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTerminal49Shipment, useTerminal49CreateTracking } from "@/hooks/use-terminal49";
import { toast } from "sonner";
import {
  Ship,
  Anchor,
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Box,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  Search,
  CheckCircle,
  HelpCircle,
  FileText,
  Building,
} from "lucide-react";

interface TrackingWidgetProps {
  blLtaNumber?: string | null;
  shippingLineScac?: string | null;
  dossierNumber?: string;
  clientName?: string | null;
  defaultEta?: Date | string | null;
  className?: string;
}

export const TrackingWidget: React.FC<TrackingWidgetProps> = ({
  blLtaNumber,
  shippingLineScac,
  dossierNumber,
  clientName,
  defaultEta,
  className = "",
}) => {
  const [manualNumber, setManualNumber] = useState<string>("");
  const activeNumber = manualNumber.trim() || blLtaNumber?.trim() || "";

  const {
    shipment,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useTerminal49Shipment(activeNumber, shippingLineScac || undefined);

  const createTrackingMutation = useTerminal49CreateTracking();

  const handleInitiateTracking = async (numberToTrack: string) => {
    if (!numberToTrack.trim()) {
      toast.error("Veuillez renseigner un numéro de connaissement (BL) valide.");
      return;
    }

    try {
      await createTrackingMutation.mutateAsync({
        requestNumber: numberToTrack.trim(),
        requestType: numberToTrack.trim().length === 11 && /^[A-Z]{4}\d{7}$/i.test(numberToTrack.trim())
          ? "container"
          : "bill_of_lading",
        shippingLineScac: shippingLineScac || undefined,
      });

      toast.success("Demande de tracking initiée", {
        description: `La synchronisation maritime pour « ${numberToTrack} » a été transmise à Terminal49.`,
      });
      refetch();
    } catch (err: any) {
      toast.error("Erreur d'initiation du tracking", {
        description: err.message || "Impossible de contacter Terminal49.",
      });
    }
  };

  // -------------------------------------------------------------
  // STATUT COLOR & BADGE MAPPER
  // -------------------------------------------------------------
  const getStatusBadge = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "arrived") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-3 py-1">
          <Anchor size={13} />
          Accosté au Port (PAC)
        </Badge>
      );
    }
    if (s === "discharged") {
      return (
        <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-1.5 px-3 py-1">
          <Layers size={13} />
          Déchargé sur Quai
        </Badge>
      );
    }
    if (s === "completed") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 px-3 py-1">
          <CheckCircle2 size={13} />
          Livré & Restitué
        </Badge>
      );
    }
    if (s === "pending") {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1.5 px-3 py-1">
          <Clock size={13} />
          En Attente Embarquement
        </Badge>
      );
    }
    return (
      <Badge className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 px-3 py-1 animate-pulse">
        <Navigation size={13} />
        En Transit Maritime
      </Badge>
    );
  };

  return (
    <Card
      className={`border-0 bg-white shadow-[0_12px_36px_rgba(20,50,43,0.06)] rounded-3xl overflow-hidden ${className}`}
    >
      {/* En-tête du Widget */}
      <div className="bg-gradient-to-r from-[#0b3b32] to-[#164d41] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
            <Ship className="text-[#d9a94b]" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d9a94b]">
                Suivi Maritime Direct (AIS & Armateurs)
              </span>
              <Badge variant="outline" className="text-[9px] border-white/30 text-white/90">
                Terminal49 v2
              </Badge>
            </div>
            <h2 className="font-[Georgia] text-lg font-bold flex items-center gap-2 text-white">
              Cargaison {activeNumber || "Maritime"}
              {dossierNumber && (
                <span className="text-xs font-normal text-emerald-200">
                  (Dossier {dossierNumber})
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {shipment && getStatusBadge(shipment.status)}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs gap-1.5 border border-white/10"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* Corps du Widget */}
      <div className="p-6 space-y-6">
        {/* CAS 1 : Chargement en cours */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {/* CAS 2 : Données trouvées et affichées */}
        {!isLoading && shipment && (
          <div className="space-y-6">
            {/* Ligne Port de Départ -> Port d'Arrivée (PAC) */}
            <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/40">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Port de chargement */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <MapPin size={13} className="text-emerald-700" />
                    <span>Port de Chargement (POL)</span>
                  </div>
                  <p className="font-bold text-emerald-950 text-sm">
                    {shipment.origin.portName || "Origine Maritime"}
                  </p>
                  <p className="text-[11px] text-[#536863]">
                    {shipment.origin.atd
                      ? `Parti le ${new Date(shipment.origin.atd).toLocaleDateString("fr-FR")}`
                      : shipment.origin.etd
                      ? `Départ estimé : ${new Date(shipment.origin.etd).toLocaleDateString("fr-FR")}`
                      : "Date départ non renseignée"}
                  </p>
                </div>

                {/* Trajet & Navire */}
                <div className="flex flex-col items-center justify-center text-center px-2 py-2 border-y md:border-y-0 md:border-x border-emerald-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Ship size={15} className="text-emerald-700" />
                    <span>{shipment.vessel.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span>Voyage: {shipment.vessel.voyage || "—"}</span>
                    {shipment.shippingLine.name && (
                      <span className="font-semibold text-emerald-950">
                        • {shipment.shippingLine.name}
                      </span>
                    )}
                  </div>
                  <div className="w-full flex items-center justify-center gap-2 mt-2">
                    <div className="h-0.5 w-16 bg-emerald-300 rounded-full" />
                    <ArrowRight size={14} className="text-emerald-700 shrink-0" />
                    <div className="h-0.5 w-16 bg-emerald-300 rounded-full" />
                  </div>
                </div>

                {/* Port de Déchargement Conakry */}
                <div className="space-y-1 md:text-right">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold md:justify-end">
                    <Anchor size={13} className="text-emerald-700" />
                    <span>Port de Déchargement (POD)</span>
                  </div>
                  <p className="font-bold text-emerald-950 text-sm">
                    {shipment.destination.portName}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-semibold">
                    {shipment.destination.ata
                      ? `Accosté le ${new Date(shipment.destination.ata).toLocaleDateString("fr-FR")}`
                      : shipment.destination.eta
                      ? `ETA Accostage : ${new Date(shipment.destination.eta).toLocaleDateString("fr-FR")}`
                      : defaultEta
                      ? `ETA IGS : ${new Date(defaultEta).toLocaleDateString("fr-FR")}`
                      : "ETA en cours d'évaluation"}
                  </p>
                </div>
              </div>
            </div>

            {/* Conteneurs Rattachés */}
            {shipment.containers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <Box size={16} className="text-emerald-700" />
                    Conteneurs Suivis ({shipment.containers.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Armateur : {shipment.shippingLine.name} ({shipment.shippingLine.scac})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shipment.containers.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-emerald-300 transition shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-950 text-sm">
                          {c.number}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            c.availableForPickup
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
                              : "border-gray-200 text-gray-700"
                          }
                        >
                          {c.availableForPickup ? "Disponible enlèvement" : c.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Type : </span>
                          <strong>{c.equipmentType || "40' High Cube"}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Plomb : </span>
                          <strong>{c.sealNumber || "Non renseigné"}</strong>
                        </div>
                      </div>

                      {/* Alerte Franchise / Last Free Day */}
                      {c.lastFreeDay && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          <span className="flex items-center gap-1 font-semibold">
                            <Clock size={13} className="text-amber-700" />
                            Fin franchise quai :
                          </span>
                          <strong>{new Date(c.lastFreeDay).toLocaleDateString("fr-FR")}</strong>
                        </div>
                      )}

                      {/* Statut des blocages douane / port */}
                      {c.hasHolds && (
                        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-red-700 shrink-0" />
                          <span>
                            Blocage administratif actif (Quai / Contrôle Douane)
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique chronologique des événements (Timeline) */}
            {shipment.events.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-700" />
                  Journal d'Événements Maritimes ({shipment.events.length})
                </h3>

                <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3 max-h-60 overflow-y-auto">
                  {shipment.events.map((ev, idx) => (
                    <div key={ev.id || idx} className="flex items-start gap-3 text-xs">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-900 grid place-items-center shrink-0 mt-0.5">
                        <CheckCircle size={13} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-emerald-950">{ev.title}</p>
                        <p className="text-muted-foreground">{ev.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                          <span>{ev.location}</span>
                          <span>•</span>
                          <span>{new Date(ev.timestamp).toLocaleString("fr-FR")}</span>
                          {ev.vesselName && (
                            <>
                              <span>•</span>
                              <span>Navire: {ev.vesselName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CAS 3 : Aucun suivi trouvé ou BL non encore traqué */}
        {!isLoading && !shipment && (
          <div className="p-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-900 mx-auto grid place-items-center">
              <Search size={24} />
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-bold text-emerald-950 text-sm">
                Aucun suivi maritime actif pour « {activeNumber || "ce dossier"} »
              </h3>
              <p className="text-xs text-muted-foreground">
                {error ||
                  "Connectez le numéro de connaissement (BL) ou conteneur pour synchroniser en temps réel les ETA navires, conteneurs et franchises quai."}
              </p>
            </div>

            {/* Formulaire de recherche et initiation */}
            <div className="max-w-sm mx-auto flex items-center gap-2">
              <Input
                placeholder="Ex: MEDUJ7763785 ou MSKU1234567"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                className="rounded-xl text-xs h-9"
              />
              <Button
                size="sm"
                disabled={createTrackingMutation.isPending || !activeNumber}
                onClick={() => handleInitiateTracking(activeNumber)}
                className="rounded-xl bg-[#0b3b32] text-white text-xs h-9 font-semibold shrink-0"
              >
                {createTrackingMutation.isPending ? (
                  <RefreshCw size={13} className="animate-spin mr-1.5" />
                ) : (
                  <Ship size={13} className="mr-1.5 text-[#d9a94b]" />
                )}
                Traquer
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
