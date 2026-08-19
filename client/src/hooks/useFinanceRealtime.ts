import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useFinanceRealtime() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Écouter les changements en temps réel sur la table des factures
    const invoicesChannel = supabase
      .channel("realtime:invoices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        (payload) => {
          utils.finance.summary.invalidate();
          utils.finance.listInvoices.invalidate();
          utils.dossier.list.invalidate();

          if (payload.eventType === "INSERT") {
            const newInv = payload.new as any;
            toast.info(`Nouvelle facture émise : ${newInv.invoice_number || "Facture"} (${newInv.client || ""})`);
          } else if (payload.eventType === "UPDATE") {
            const updatedInv = payload.new as any;
            if (updatedInv.status === "Payée") {
              toast.success(`Encaissement confirmé : Facture ${updatedInv.invoice_number || ""} payée !`);
            }
          }
        }
      )
      .subscribe();

    // Écouter les encaissements
    const paymentsChannel = supabase
      .channel("realtime:payments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invoice_payments" },
        (payload) => {
          const payment = payload.new as any;
          utils.finance.summary.invalidate();
          utils.finance.listInvoices.invalidate();
          toast.success(`Paiement de ${Number(payment.amount).toLocaleString("fr-FR")} GNF reçu en temps réel !`);
        }
      )
      .subscribe();

    // Écouter les notifications
    const notifChannel = supabase
      .channel("realtime:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const notif = payload.new as any;
          utils.notification.list.invalidate();
          toast(notif.title || "Nouvelle notification", {
            description: notif.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [utils]);
}
