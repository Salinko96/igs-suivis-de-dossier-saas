import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  AlertTriangle,
  Receipt,
  ArrowRight,
  UserCheck,
  RefreshCw,
} from "lucide-react";

interface ApprovalsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApprovalsManagementModal: React.FC<ApprovalsManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("EN_ATTENTE");
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [targetRequestId, setTargetRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const approvalsQuery = trpc.approval.list.useQuery(
    { status: filterStatus === "all" ? undefined : filterStatus },
    { enabled: isOpen, refetchInterval: 15000 }
  );

  const approveMutation = trpc.approval.approve.useMutation({
    onSuccess: () => {
      toast.success("Demande approuvée avec succès", {
        description: "L'autorisation financière a été validée et enregistrée dans le journal d'audit.",
      });
      approvalsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Erreur d'approbation", {
        description: err.message,
      });
    },
  });

  const rejectMutation = trpc.approval.reject.useMutation({
    onSuccess: () => {
      toast.success("Demande rejetée", {
        description: "Le rejet et le motif obligatoire ont été notifiés au demandeur.",
      });
      setRejectModalOpen(false);
      setRejectionReason("");
      setTargetRequestId(null);
      approvalsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Erreur lors du rejet", {
        description: err.message,
      });
    },
  });

  const handleApprove = (requestId: number) => {
    if (confirm("Confirmez-vous l'approbation définitive de cette opération financière ?")) {
      approveMutation.mutate({ requestId });
    }
  };

  const handleOpenReject = (requestId: number) => {
    setTargetRequestId(requestId);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!targetRequestId) return;
    if (!rejectionReason.trim()) {
      toast.error("Motif obligatoire", {
        description: "Veuillez renseigner la justification du rejet.",
      });
      return;
    }
    rejectMutation.mutate({
      requestId: targetRequestId,
      rejectionReason: rejectionReason.trim(),
    });
  };

  const requests = approvalsQuery.data || [];
  const pendingCount = requests.filter((r) => r.status === "EN_ATTENTE").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-card border-border p-0 overflow-hidden flex flex-col max-h-[88vh] h-[80vh]">
        {/* Header */}
        <DialogHeader className="p-5 bg-muted/40 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Workflow d'Approbation & Arbitrage Financier
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-xs">
                    {pendingCount} en attente
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contrôle des décaissements et factures soumis à seuil hiérarchique (Débours {">"} 5M GNF • Factures {">"} 10M GNF)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <div className="flex bg-muted rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setFilterStatus("EN_ATTENTE")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterStatus === "EN_ATTENTE"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                En attente
              </button>
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterStatus === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Toutes
              </button>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => approvalsQuery.refetch()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${approvalsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/10">
          {approvalsQuery.isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Chargement des demandes...</div>
          ) : requests.length === 0 ? (
            <div className="p-16 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 opacity-40 mb-2" />
              <h4 className="text-sm font-semibold text-foreground">Aucune demande en attente</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Toutes les opérations financières soumises à seuil ont été arbitrées.
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const isPending = req.status === "EN_ATTENTE";
              const isApproved = req.status === "APPROUVE";
              const isRejected = req.status === "REJETE";

              return (
                <Card
                  key={req.id}
                  className={`border transition-all ${
                    isPending
                      ? "border-amber-500/40 bg-card shadow-sm"
                      : "border-border bg-card/60"
                  }`}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                          req.entityType === "invoice"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        <Receipt className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {req.entityType === "invoice" ? "Facture Client" : "Débours PAC / Trésor"} #{req.entityId}
                          </span>
                          <Badge
                            className={`text-[10px] ${
                              isApproved
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : isRejected
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {isApproved ? "Approuvé" : isRejected ? "Rejeté" : "En attente"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Dossier #{req.dossierId}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="font-extrabold text-foreground text-sm">
                            {Number(req.amount).toLocaleString("fr-FR")} {req.currency}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            Seuil d'alerte : {Number(req.thresholdAmount).toLocaleString("fr-FR")} GNF
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            Par : <strong>{req.requestedByName}</strong>
                          </span>
                        </div>

                        {req.comment && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            "{req.comment}"
                          </p>
                        )}

                        {isRejected && req.rejectionReason && (
                          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span><strong>Motif du rejet :</strong> {req.rejectionReason}</span>
                          </div>
                        )}

                        {isApproved && req.approverName && (
                          <div className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Validé par {req.approverName} le {req.resolvedAt ? new Date(req.resolvedAt).toLocaleDateString("fr-FR") : ""}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReject(req.id)}
                          className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rejeter
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req.id)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>

      {/* Reject Modal with mandatory reason */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Motif Obligatoire de Rejet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Justification du refus financier</Label>
            <Textarea
              rows={3}
              placeholder="Ex: Justificatif manquant, montant non conforme au tarif douane..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Cette justification sera transmise au demandeur et consignée de manière inaltérable dans l'audit trail.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              className="gap-1"
            >
              <XCircle className="w-4 h-4" /> Confirmer le Rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
