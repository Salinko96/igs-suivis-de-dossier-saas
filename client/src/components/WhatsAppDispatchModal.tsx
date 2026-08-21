import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Building,
  Anchor,
  Clock,
  AlertTriangle,
  Receipt,
  FileCheck,
} from "lucide-react";

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: {
    id: number;
    dossierNumber: string;
    client: string | null;
    blLtaNumber?: string | null;
    eta?: Date | string | null;
    daysOnQuay?: number | null;
    declarationNumber?: string | null;
  } | null;
}

const TEMPLATES = [
  {
    id: "dossier_cree",
    label: "1. Ouverture & Prise en Charge Dossier",
    icon: Anchor,
    desc: "Avis initial avec numéro BL et lien direct de suivi",
  },
  {
    id: "eta_mise_a_jour",
    label: "2. Mise à Jour Date d'Accostage (ETA)",
    icon: Clock,
    desc: "Notification de la date d'arrivée navire au Port de Conakry",
  },
  {
    id: "alerte_surestarie_imminente",
    label: "3. Alerte Franchise Quai / Risque Surestarie (J-2)",
    icon: AlertTriangle,
    desc: "Avertissement d'expiration imminente de la franchise de 7 jours",
  },
  {
    id: "dossier_regularise",
    label: "4. Confirmation BAE & Sortie de Quai",
    icon: FileCheck,
    desc: "Validation du Bon à Enlever et disponibilité de la cargaison",
  },
  {
    id: "facture_disponible",
    label: "5. Avis d'Émission de Facture & Débours",
    icon: Receipt,
    desc: "Notification de la facture proforma ou définitive",
  },
];

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  isOpen,
  onClose,
  dossier,
}) => {
  const [template, setTemplate] = useState<
    "dossier_cree" | "eta_mise_a_jour" | "alerte_surestarie_imminente" | "dossier_regularise" | "facture_disponible"
  >("dossier_cree");
  const [recipientPhone, setRecipientPhone] = useState<string>("+224620000000");

  const sendMutation = trpc.whatsapp.sendHsmTemplate.useMutation({
    onSuccess: (res) => {
      toast.success(`Message WhatsApp expédié au ${res.recipientPhone}`);
      onClose();
    },
    onError: (err) => {
      toast.error(`Erreur WhatsApp API : ${err.message}`);
    },
  });

  if (!dossier) return null;

  const handleSend = () => {
    sendMutation.mutate({
      dossierId: dossier.id,
      dossierNumber: dossier.dossierNumber,
      clientName: dossier.client || "Client IGS",
      recipientPhone,
      template,
      variables: {
        blLtaNumber: dossier.blLtaNumber,
        eta: dossier.eta,
        daysOnQuay: dossier.daysOnQuay || 5,
        customsDeclaration: dossier.declarationNumber,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            WhatsApp Business API — Notification Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dossier info summary */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground">Dossier : </span>
              <strong className="text-foreground">{dossier.dossierNumber}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Client : </span>
              <strong className="text-foreground">{dossier.client || "Client"}</strong>
            </div>
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Template Officiel WhatsApp (HSM)</Label>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const isSelected = template === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setTemplate(t.id as any)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                        : "border-border hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-emerald-600 dark:text-emerald-400" : ""}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recipient Phone input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Numéro WhatsApp Destinataire (Format Guinée +224)</Label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+224 620 00 00 00"
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>
          </div>

          {/* Preview box */}
          <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs space-y-1 font-mono text-emerald-900 dark:text-emerald-300">
            <div className="font-bold">🚢 IBRAHIMA GOLD SERVICE — TRANSIT & DOUANE</div>
            <div className="text-[11px]">
              Notification instantanée certifiée avec traçabilité et lien sécurisé de consultation.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendMutation.isPending || !recipientPhone}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
          >
            <Send className="w-3.5 h-3.5" />
            {sendMutation.isPending ? "Envoi en cours..." : "Expédier le Message WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
