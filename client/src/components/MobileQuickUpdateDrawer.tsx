import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enqueueOfflineMutation } from "@/lib/offlineSync";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  MessageSquare,
  PackageCheck,
  ShieldAlert,
  Ship,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface MobileQuickUpdateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: {
    id: number;
    dossierNumber: string;
    client?: string | null;
    blLtaNumber?: string | null;
    goodsReleaseDate?: Date | string | null;
    declarationNumber?: string | null;
    badStatus?: string | null;
    baeStatus?: string | null;
    fieldOperation?: string | null;
    version?: number;
  } | null;
  onSuccess?: () => void;
}

export default function MobileQuickUpdateDrawer({
  open,
  onOpenChange,
  dossier,
  onSuccess,
}: MobileQuickUpdateDrawerProps) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const [goodsReleaseDate, setGoodsReleaseDate] = useState<string>("");
  const [declarationNumber, setDeclarationNumber] = useState<string>("");
  const [badStatus, setBadStatus] = useState<string>("Obtenu");
  const [baeStatus, setBaeStatus] = useState<string>("Obtenu");
  const [fieldOperation, setFieldOperation] = useState<string>("Quai Conteneur PAC");
  const [comment, setComment] = useState<string>("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (dossier) {
      setGoodsReleaseDate(
        dossier.goodsReleaseDate
          ? new Date(dossier.goodsReleaseDate).toISOString().slice(0, 10)
          : ""
      );
      setDeclarationNumber(dossier.declarationNumber || "");
      setBadStatus(dossier.badStatus || "Obtenu");
      setBaeStatus(dossier.baeStatus || "Obtenu");
      setFieldOperation(dossier.fieldOperation || "Quai Conteneur PAC");
      setComment("");
    }
  }, [dossier, open]);

  const utils = trpc.useUtils();

  const quickUpdateMutation = trpc.dossier.quickUpdateMobile.useMutation({
    onSuccess: (updated) => {
      toast.success(`Dossier ${updated.dossierNumber} mis à jour avec succès sur le quai !`);
      utils.dossier.invalidate();
      utils.dashboard.invalidate();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(`Erreur de mise à jour : ${err.message}`);
    },
  });

  if (!dossier) return null;

  const handleSetTodayRelease = () => {
    const today = new Date().toISOString().slice(0, 10);
    setGoodsReleaseDate(today);
    setBadStatus("Obtenu");
    setBaeStatus("Obtenu");
    toast.info("Date de sortie fixée à aujourd'hui (Conakry Terminal).");
  };

  const handleSave = () => {
    const payload = {
      dossierId: dossier.id,
      goodsReleaseDate: goodsReleaseDate ? new Date(goodsReleaseDate) : null,
      declarationNumber: declarationNumber.trim() || null,
      badStatus,
      baeStatus,
      fieldOperation,
      comment: comment.trim() || null,
      expectedVersion: dossier.version,
    };

    if (!isOnline) {
      // Stockage local dans la file hors-ligne
      enqueueOfflineMutation({
        dossierId: dossier.id,
        dossierNumber: dossier.dossierNumber,
        client: dossier.client || undefined,
        payload: {
          ...payload,
          goodsReleaseDate: goodsReleaseDate || null,
        },
      });

      toast.warning("📡 Mode Hors-Ligne (Quai)", {
        description: `Modification enregistrée sur l'appareil pour ${dossier.dossierNumber}. Elle sera synchronisée dès retour du réseau.`,
      });
      onOpenChange(false);
      if (onSuccess) onSuccess();
      return;
    }

    quickUpdateMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-5 sm:p-6 rounded-3xl bg-white shadow-2xl border-0">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 font-bold">
                <Zap size={18} />
              </div>
              <div>
                <DialogTitle className="font-[Georgia] text-lg font-bold text-emerald-950">
                  {dossier.dossierNumber}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {dossier.client || "Client IGS"} • BL : {dossier.blLtaNumber || "N/A"}
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={
                isOnline
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1"
                  : "bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
              }
            >
              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isOnline ? "En Ligne" : "Hors-Ligne"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Action Rapide : Sortie Effectuée Aujourd'hui */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-3 border border-emerald-200/60 flex items-center justify-between">
            <div>
              <p className="font-bold text-emerald-950 text-xs">Sortie de Quai Validée ?</p>
              <p className="text-[11px] text-emerald-800 font-medium">Remplir date et BAE/BAD en 1 clic</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleSetTodayRelease}
              className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#165a4c] text-xs h-8 px-3 font-semibold shadow-sm gap-1"
            >
              <PackageCheck size={13} />
              <span>Aujourd'hui</span>
            </Button>
          </div>

          {/* Champ : Date de Sortie Marchandise */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-800" />
              <span>Date de Sortie Effective Marchandise</span>
            </Label>
            <Input
              type="date"
              value={goodsReleaseDate}
              onChange={(e) => setGoodsReleaseDate(e.target.value)}
              className="h-11 rounded-xl text-xs border-emerald-900/20 bg-white"
            />
          </div>

          {/* Champ : Numéro de Déclaration Douanière SYDONIA */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <FileCheck size={13} className="text-emerald-800" />
              <span>Numéro Déclaration Douane SYDONIA</span>
            </Label>
            <Input
              value={declarationNumber}
              onChange={(e) => setDeclarationNumber(e.target.value)}
              placeholder="Ex: DEC-2026-0814 ou S 1422"
              className="h-11 rounded-xl text-xs border-emerald-900/20 bg-white font-mono uppercase"
            />
          </div>

          {/* Statuts BAD / BAE avec boutons tactiles larges */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-gray-700">Bon à Délivrer (BAD)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={badStatus === "Obtenu" ? "default" : "outline"}
                  onClick={() => setBadStatus("Obtenu")}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold ${
                    badStatus === "Obtenu" ? "bg-[#0b3b32] text-white" : "border-gray-200 text-gray-700"
                  }`}
                >
                  Obtenu
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={badStatus === "En attente" ? "default" : "outline"}
                  onClick={() => setBadStatus("En attente")}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold ${
                    badStatus === "En attente" ? "bg-amber-600 text-white" : "border-gray-200 text-gray-700"
                  }`}
                >
                  Attente
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-gray-700">Bon à Enlever (BAE)</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={baeStatus === "Obtenu" ? "default" : "outline"}
                  onClick={() => setBaeStatus("Obtenu")}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold ${
                    baeStatus === "Obtenu" ? "bg-[#0b3b32] text-white" : "border-gray-200 text-gray-700"
                  }`}
                >
                  Obtenu
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={baeStatus === "En attente" ? "default" : "outline"}
                  onClick={() => setBaeStatus("En attente")}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold ${
                    baeStatus === "En attente" ? "bg-amber-600 text-white" : "border-gray-200 text-gray-700"
                  }`}
                >
                  Attente
                </Button>
              </div>
            </div>
          </div>

          {/* Commentaire / Note de Terrain */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-emerald-800" />
              <span>Note Rapide de Quai (Optionnel)</span>
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Marchandise dépotée au quai 2, escorte douanière validée."
              rows={2}
              className="rounded-xl text-xs border-emerald-900/20 bg-white resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 rounded-xl text-xs text-muted-foreground"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={quickUpdateMutation.isPending}
            className="w-full sm:flex-1 h-11 rounded-xl bg-[#0b3b32] text-white hover:bg-[#165a4c] text-xs font-bold shadow-md gap-1.5"
          >
            {quickUpdateMutation.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>{isOnline ? "Valider la Mise à Jour" : "Enregistrer Hors-Ligne"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
