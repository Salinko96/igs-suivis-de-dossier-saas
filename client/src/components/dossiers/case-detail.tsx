import React from "react";
import { TrackingWidget } from "@/components/tracking/tracking-widget";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ship, Anchor, FileText, Calendar, Building } from "lucide-react";

export interface CaseDetailProps {
  dossier: {
    id: number;
    dossierNumber: string;
    client?: string | null;
    blLtaNumber?: string | null;
    cargoNature?: string | null;
    transportMode?: string | null;
    eta?: Date | string | null;
    originPort?: string | null;
    destinationPort?: string | null;
    calculatedStatus?: string;
    portStatus?: string | null;
  };
  className?: string;
}

/**
 * CaseDetail Component — Vue détaillée d'un dossier de transit avec intégration native du widget Terminal49
 */
export const CaseDetail: React.FC<CaseDetailProps> = ({ dossier, className = "" }) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Widget de suivi maritime en temps réel */}
      <TrackingWidget
        blLtaNumber={dossier.blLtaNumber}
        dossierNumber={dossier.dossierNumber}
        clientName={dossier.client}
        defaultEta={dossier.eta}
      />

      {/* Résumé Opérationnel */}
      <Card className="border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)] rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9a94b]">
                Fiche Dossier IGS
              </span>
              <h2 className="font-[Georgia] text-xl font-bold text-[#102c26]">
                {dossier.dossierNumber}
              </h2>
            </div>
            {dossier.calculatedStatus && (
              <Badge className="bg-[#0b3b32] text-white">
                {dossier.calculatedStatus}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold mb-1">
                <Building size={13} className="text-emerald-700" />
                Société Clientes :
              </span>
              <strong className="text-emerald-950">{dossier.client || "Client Standard"}</strong>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold mb-1">
                <FileText size={13} className="text-emerald-700" />
                Connaissement BL :
              </span>
              <strong className="font-mono text-emerald-950">{dossier.blLtaNumber || "Non renseigné"}</strong>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold mb-1">
                <Ship size={13} className="text-emerald-700" />
                Marchandise / Mode :
              </span>
              <strong className="text-emerald-950">
                {dossier.cargoNature || "Conteneurs Fret"} ({dossier.transportMode || "Maritime"})
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold mb-1">
                <Calendar size={13} className="text-emerald-700" />
                Date Accostage ETA :
              </span>
              <strong className="text-emerald-950">
                {dossier.eta ? new Date(dossier.eta).toLocaleDateString("fr-FR") : "À confirmer"}
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseDetail;
