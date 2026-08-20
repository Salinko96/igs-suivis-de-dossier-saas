import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";

export interface ConflictFieldDiff {
  field: string;
  label?: string;
  localValue: string | number | null | undefined;
  serverValue: string | number | null | undefined;
}

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossierNumber: string;
  serverVersion?: number;
  serverUpdatedAt?: Date | string;
  diffs?: ConflictFieldDiff[];
  onReload: () => void;
  onForceOverwrite: () => void;
  isOverwriting?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  client: "Client / Entreprise",
  clientDossierNumber: "N° Dossier Client",
  blLtaNumber: "N° Connaissement (BL / LTA)",
  cargoNature: "Nature de Marchandise",
  transportMode: "Mode de Transport",
  eta: "Date ETA d'Arrivée",
  goodsReleaseDate: "Date Sortie / Enlèvement PAC",
  originPort: "Port / Aéroport d'Origine",
  destinationPort: "Port / Destination",
  container: "N° Conteneurs (TC)",
  bulk: "Colis / Vrac",
  declarationNumber: "N° Déclaration SYDONIA",
  bulletinNumber: "N° Bulletin Liquidation BLD",
  finalDeclarationNumber: "N° Déclaration Définitive C",
  ddiGucegNumber: "N° DDI GUCEG Guinée",
  badStatus: "Statut Bon à Délivrer (BAD)",
  baeStatus: "Statut Bon à Enlever (BAE)",
  customsStatus: "Statut Douane",
  portStatus: "Statut Port Autonome (PAC)",
  financialStatus: "Statut Financier",
  fieldOperation: "Opération Quai / Terminal",
  responsible: "Responsable du Suivi",
  nextAction: "Prochaine Action",
  fieldAlert: "Alerte Terrain",
  deliveryLocation: "Lieu de Livraison",
  declarant: "Déclarant Référent",
  service: "Type de Prestation",
  regime: "Régime Douanier",
  notes: "Notes & Instructions Internes",
};

export function ConflictResolutionModal({
  isOpen,
  onClose,
  dossierNumber,
  serverVersion,
  serverUpdatedAt,
  diffs = [],
  onReload,
  onForceOverwrite,
  isOverwriting = false,
}: ConflictResolutionModalProps) {
  const formattedServerDate = serverUpdatedAt
    ? new Date(serverUpdatedAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Verrouillage Optimiste & Concurrence
            </span>
          </div>
          <DialogTitle className="font-[Georgia] text-2xl text-[#102c26]">
            Conflit d'Édition Simultanée — {dossierNumber}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-[#556963]">
            Un autre collaborateur (déclarant ou comptable) a modifié et validé ce dossier pendant que vous aviez votre formulaire ouvert.
            {serverVersion && (
              <span className="ml-1 inline-flex items-center gap-1 font-semibold text-emerald-800">
                (Version serveur actuelle : v{serverVersion}
                {formattedServerDate ? ` modifiée le ${formattedServerDate}` : ""})
              </span>
            )}
            . Pour protéger la cohérence des données, vos modifications locales n'ont pas encore écrasé le serveur.
          </DialogDescription>
        </DialogHeader>

        {/* Diff Table / Comparison View */}
        <div className="my-3 space-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 text-xs font-semibold text-amber-900">
            <span>Champ concerné</span>
            <div className="grid grid-cols-2 gap-4 text-center w-2/3">
              <span className="text-blue-900">Vos modifications locales</span>
              <span className="text-emerald-900">Valeur actuelle sur serveur</span>
            </div>
          </div>

          <ScrollArea className="max-h-60 pr-2">
            {diffs.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground italic">
                Plusieurs champs ont divergé sur le serveur. Vous pouvez recharger pour afficher la version fraîche ou forcer l'écrasement.
              </div>
            ) : (
              <div className="space-y-2 py-1">
                {diffs.map(diff => {
                  const label = diff.label || FIELD_LABELS[diff.field] || diff.field;
                  const localStr =
                    diff.localValue === null || diff.localValue === undefined || diff.localValue === ""
                      ? "Non renseigné (vide)"
                      : String(diff.localValue);
                  const serverStr =
                    diff.serverValue === null || diff.serverValue === undefined || diff.serverValue === ""
                      ? "Non renseigné (vide)"
                      : String(diff.serverValue);

                  return (
                    <div
                      key={diff.field}
                      className="rounded-xl border border-gray-100 bg-white p-2.5 text-xs shadow-xs transition-colors hover:border-amber-300"
                    >
                      <div className="mb-1 font-bold text-gray-800">{label}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-blue-50/70 p-2 text-[11px] text-blue-900 border border-blue-100">
                          <span className="block text-[9px] uppercase font-bold text-blue-600 mb-0.5">Votre saisie</span>
                          <span className="font-mono break-all">{localStr}</span>
                        </div>
                        <div className="rounded-lg bg-emerald-50/70 p-2 text-[11px] text-emerald-900 border border-emerald-100">
                          <span className="block text-[9px] uppercase font-bold text-emerald-600 mb-0.5">Serveur actuel</span>
                          <span className="font-mono break-all">{serverStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-3 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs border-gray-200"
          >
            Fermer sans modifier
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onReload}
              className="rounded-xl text-xs bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-200 font-semibold"
            >
              <RefreshCw size={14} className="mr-1.5" />
              Recharger les données du serveur
            </Button>

            <Button
              type="button"
              disabled={isOverwriting}
              onClick={onForceOverwrite}
              className="rounded-xl text-xs bg-amber-700 hover:bg-amber-800 text-white font-semibold"
            >
              {isOverwriting ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Zap size={14} className="mr-1.5" />
              )}
              Écraser avec mes modifications
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
