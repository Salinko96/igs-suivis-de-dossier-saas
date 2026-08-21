import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings2,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  FileSpreadsheet,
  Building,
} from "lucide-react";

interface ClientPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientNameOrId: string | number;
}

export const ClientPreferencesModal: React.FC<ClientPreferencesModalProps> = ({
  isOpen,
  onClose,
  clientNameOrId,
}) => {
  const [preferredChannel, setPreferredChannel] = useState<string>("whatsapp");
  const [whatsappPhone, setWhatsappPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [optInNotifications, setOptInNotifications] = useState<boolean>(true);
  const [monthlyReportEnabled, setMonthlyReportEnabled] = useState<boolean>(true);

  const prefQuery = trpc.clientEntity.getPreferences.useQuery(
    { clientNameOrId },
    { enabled: isOpen }
  );

  useEffect(() => {
    if (prefQuery.data) {
      const c = prefQuery.data;
      setPreferredChannel(c.preferredChannel || "whatsapp");
      setWhatsappPhone(c.whatsappPhone || c.phone || "+224620000000");
      setEmail(c.email || "");
      setContactPerson(c.contactPerson || "");
      setOptInNotifications(c.optInNotifications ?? true);
      setMonthlyReportEnabled(c.monthlyReportEnabled ?? true);
    }
  }, [prefQuery.data]);

  const updateMutation = trpc.clientEntity.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Préférences enregistrées", {
        description: "Les canaux de notification et rapports ont été mis à jour.",
      });
      onClose();
    },
    onError: (err) => {
      toast.error("Erreur de mise à jour", {
        description: err.message,
      });
    },
  });

  const handleSave = () => {
    if (!prefQuery.data?.id) return;
    updateMutation.mutate({
      clientId: prefQuery.data.id,
      preferredChannel,
      whatsappPhone,
      email,
      contactPerson,
      optInNotifications,
      monthlyReportEnabled,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Canaux & Préférences de Communication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client summary */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border flex items-center gap-2.5 text-xs">
            <Building className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-muted-foreground">Société Cliente : </span>
              <strong className="text-foreground">{prefQuery.data?.name || String(clientNameOrId)}</strong>
            </div>
          </div>

          {/* Preferred channel */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Canal de Notification Préféré</Label>
            <Select value={preferredChannel} onValueChange={setPreferredChannel}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp" className="text-xs">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Business (Recommandé)
                  </span>
                </SelectItem>
                <SelectItem value="email" className="text-xs">
                  <span className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-600" /> Courriel Électronique (Email)
                  </span>
                </SelectItem>
                <SelectItem value="sms" className="text-xs">
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-purple-600" /> SMS Transactionnel Direct
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Person */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nom du Contact / Responsable Transit</Label>
            <Input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ex: M. Ousmane Camara"
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* WhatsApp Phone */}
          <div className="space-y-1.5">
            <Label className="text-xs">Numéro WhatsApp (+224...)</Label>
            <Input
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+224 620 00 00 00"
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs">Adresse Email de Notification</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="transit@entreprise.gn"
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* Toggles */}
          <div className="pt-2 space-y-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Opt-in Alertes Opérationnelles</Label>
                <p className="text-[10px] text-muted-foreground">Alertes ETA, Surestaries et BAE</p>
              </div>
              <Switch checked={optInNotifications} onCheckedChange={setOptInNotifications} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Rapports Mensuels Automatiques</Label>
                <p className="text-[10px] text-muted-foreground">Envoi automatique du bilan PDF/Excel</p>
              </div>
              <Switch checked={monthlyReportEnabled} onCheckedChange={setMonthlyReportEnabled} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Enregistrer les Préférences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
