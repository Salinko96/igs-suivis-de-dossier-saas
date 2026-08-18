import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, FileText, Loader2, Save, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface CustomsEditDossier {
  id: number;
  dossierNumber: string;
  client?: string | null;
  blLtaNumber?: string | null;
  ddiGucegNumber?: string | null;
  declarationNumber?: string | null;
  bulletinNumber?: string | null;
  finalDeclarationNumber?: string | null;
  badStatus?: string | null;
  baeStatus?: string | null;
  customsStatus?: string | null;
  portStatus?: string | null;
  goodsReleaseDate?: Date | string | null;
}

interface CustomsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: CustomsEditDossier | null;
  onSuccess?: () => void;
}

export function CustomsEditModal({
  isOpen,
  onClose,
  dossier,
  onSuccess,
}: CustomsEditModalProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    blLtaNumber: "",
    ddiGucegNumber: "",
    declarationNumber: "",
    bulletinNumber: "",
    finalDeclarationNumber: "",
    badStatus: "Non_recu",
    baeStatus: "En_attente",
    customsStatus: "En_cours",
    portStatus: "Quai_PAC",
    goodsReleaseDate: "",
  });

  useEffect(() => {
    if (dossier) {
      setForm({
        blLtaNumber: dossier.blLtaNumber || "",
        ddiGucegNumber: dossier.ddiGucegNumber || "",
        declarationNumber: dossier.declarationNumber || "",
        bulletinNumber: dossier.bulletinNumber || "",
        finalDeclarationNumber: dossier.finalDeclarationNumber || "",
        badStatus: dossier.badStatus || "Non_recu",
        baeStatus: dossier.baeStatus || "En_attente",
        customsStatus: dossier.customsStatus || "En_cours",
        portStatus: dossier.portStatus || "Quai_PAC",
        goodsReleaseDate: dossier.goodsReleaseDate
          ? new Date(dossier.goodsReleaseDate).toISOString().slice(0, 10)
          : "",
      });
    }
  }, [dossier]);

  const updateCustomsMutation = trpc.dossier.updateCustoms.useMutation({
    onSuccess: (updated) => {
      toast.success(`Dossier ${updated.dossierNumber} mis à jour avec succès !`, {
        description: `Statut calculé : ${updated.calculatedStatus} (${updated.completionRate}%)`,
      });
      utils.dossier.list.invalidate();
      utils.dossier.get.invalidate();
      utils.dashboard.get.invalidate();
      utils.task.list.invalidate();
      utils.notification.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(`Erreur lors de la mise à jour : ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier) return;

    updateCustomsMutation.mutate({
      id: dossier.id,
      data: {
        blLtaNumber: form.blLtaNumber.trim() || null,
        ddiGucegNumber: form.ddiGucegNumber.trim() || null,
        declarationNumber: form.declarationNumber.trim() || null,
        bulletinNumber: form.bulletinNumber.trim() || null,
        finalDeclarationNumber: form.finalDeclarationNumber.trim() || null,
        badStatus: form.badStatus || null,
        baeStatus: form.baeStatus || null,
        customsStatus: form.customsStatus || null,
        portStatus: form.portStatus || null,
        goodsReleaseDate: form.goodsReleaseDate
          ? new Date(`${form.goodsReleaseDate}T00:00:00Z`)
          : null,
      },
    });
  };

  if (!dossier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#d9a94b]">
            <ShieldAlert size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0b3b32]">
              Régularisation Douane & PAC
            </span>
          </div>
          <DialogTitle className="font-[Georgia] text-2xl text-[#102c26]">
            Édition Rapide Douane : {dossier.dossierNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#627670]">
            Mise à jour directe des identifiants SYDONIA World, DDI GUCEG, BLD et statut de mainlevée BAE pour le client <strong>{dossier.client || "IGS"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Identifiants Titres & Déclarations */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">N° Connaissement (BL / LTA)</Label>
              <Input
                value={form.blLtaNumber}
                onChange={e => setForm(c => ({ ...c, blLtaNumber: e.target.value }))}
                placeholder="ex: HLCUNG12604AUQG1"
                className="h-9 rounded-xl border-[#d9e4df] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">N° DDI (GUCEG Guinée)</Label>
              <Input
                value={form.ddiGucegNumber}
                onChange={e => setForm(c => ({ ...c, ddiGucegNumber: e.target.value }))}
                placeholder="ex: DDI-2026-GN-8841"
                className="h-9 rounded-xl border-[#d9e4df] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">N° Déclaration (SYDONIA)</Label>
              <Input
                value={form.declarationNumber}
                onChange={e => setForm(c => ({ ...c, declarationNumber: e.target.value }))}
                placeholder="ex: S 142- 27/07/2026"
                className="h-9 rounded-xl border-[#d9e4df] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">N° Bulletin Liquidation (BLD)</Label>
              <Input
                value={form.bulletinNumber}
                onChange={e => setForm(c => ({ ...c, bulletinNumber: e.target.value }))}
                placeholder="ex: L 1774 Du 28/07/2026"
                className="h-9 rounded-xl border-[#d9e4df] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">N° Déclaration Définitive (C)</Label>
              <Input
                value={form.finalDeclarationNumber}
                onChange={e => setForm(c => ({ ...c, finalDeclarationNumber: e.target.value }))}
                placeholder="ex: C 1398-2026"
                className="h-9 rounded-xl border-[#d9e4df] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#3d534c]">Date Sortie / Enlèvement PAC</Label>
              <Input
                type="date"
                value={form.goodsReleaseDate}
                onChange={e => setForm(c => ({ ...c, goodsReleaseDate: e.target.value }))}
                className="h-9 rounded-xl border-[#d9e4df] text-xs"
              />
            </div>
          </div>

          {/* Statuts Procédures */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#3d534c]">Statut BAD</Label>
              <select
                value={form.badStatus}
                onChange={e => setForm(c => ({ ...c, badStatus: e.target.value }))}
                className="h-9 w-full rounded-xl border border-[#d9e4df] bg-white px-2 text-xs"
              >
                <option value="Non_recu">Non reçu</option>
                <option value="Demande">Demandé</option>
                <option value="Obtenu">Obtenu</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#3d534c]">Statut BAE</Label>
              <select
                value={form.baeStatus}
                onChange={e => setForm(c => ({ ...c, baeStatus: e.target.value }))}
                className="h-9 w-full rounded-xl border border-[#d9e4df] bg-white px-2 text-xs"
              >
                <option value="En_attente">En attente</option>
                <option value="Delivre">Délivré</option>
                <option value="Bloque">Bloqué</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#3d534c]">Statut Douane</Label>
              <select
                value={form.customsStatus}
                onChange={e => setForm(c => ({ ...c, customsStatus: e.target.value }))}
                className="h-9 w-full rounded-xl border border-[#d9e4df] bg-white px-2 text-xs"
              >
                <option value="En_cours">En cours</option>
                <option value="Visite_programmee">Visite programmée</option>
                <option value="Liquide">Liquidé</option>
                <option value="Acquitte">Acquitté</option>
                <option value="Litige">Litige</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#3d534c]">Statut Port PAC</Label>
              <select
                value={form.portStatus}
                onChange={e => setForm(c => ({ ...c, portStatus: e.target.value }))}
                className="h-9 w-full rounded-xl border border-[#d9e4df] bg-white px-2 text-xs"
              >
                <option value="Attente_navire">Attente navire</option>
                <option value="Quai_PAC">À quai PAC</option>
                <option value="Terminal_Conteneurs">Terminal conteneurs</option>
                <option value="Sorti">Sorti</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-[#d9e4df] text-xs h-9"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateCustomsMutation.isPending}
              className="rounded-xl bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs h-9 px-5"
            >
              {updateCustomsMutation.isPending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={14} className="mr-1.5" />
              )}
              Enregistrer les données douanières
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
