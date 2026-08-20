-- ============================================================================
-- Migration: Optimisation des Performances, Indexation Composite et Vues Dédiées
-- Date: 2026-08-20
-- Auteur: Senior Full-Stack Engineer (IGS Transit & Douane SaaS)
-- ============================================================================

-- 1. Index composites et filtrés pour la table dossiers
CREATE INDEX IF NOT EXISTS idx_dossiers_calculated_status_eta ON dossiers(calculated_status, eta);
CREATE INDEX IF NOT EXISTS idx_dossiers_goods_release ON dossiers(goods_release_date) WHERE goods_release_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dossiers_client_created ON dossiers(client, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossiers_priority_status ON dossiers(priority, calculated_status);
CREATE INDEX IF NOT EXISTS idx_dossiers_declarant ON dossiers(declarant_assigned_id) WHERE declarant_assigned_id IS NOT NULL;

-- 2. Index pour la table factures et paiements
CREATE INDEX IF NOT EXISTS idx_invoices_dossier_status ON invoices(dossier_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_reconciliation ON invoices(reconciliation_status, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_created ON invoices(client, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_date ON invoice_payments(invoice_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_pac_disbursements_dossier_status ON pac_disbursements(dossier_id, status);

-- 3. Index pour les utilisateurs et sessions
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_search ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_client_company ON users(client_company) WHERE client_company IS NOT NULL;

-- 4. Index pour les tâches et le planning
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status_due ON dossier_tasks(assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_dossier_priority ON dossier_tasks(dossier_id, priority);

-- 5. Index pour l'audit trail et les logs portail
CREATE INDEX IF NOT EXISTS idx_dossier_history_composite ON dossier_status_history(dossier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_logs_composite ON portal_access_logs(client_company, accessed_at DESC);

-- 6. Vue SQL matérialisée / indexée pour le calcul rapide des KPIs financiers
CREATE OR REPLACE VIEW v_finance_kpi_aggregates AS
SELECT
  COUNT(*) AS total_invoices,
  COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount_ttc * 8650 ELSE amount_ttc END), 0) AS total_ca_gnf,
  COALESCE(SUM(CASE WHEN currency = 'USD' THEN estimated_margin * 8650 ELSE estimated_margin END), 0) AS total_margin_gnf,
  COALESCE(SUM(CASE WHEN currency = 'USD' THEN disbursements_amount * 8650 ELSE disbursements_amount END), 0) AS total_disbursements_gnf,
  COUNT(CASE WHEN status = 'Payée' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN status != 'Payée' THEN 1 END) AS pending_invoices_count,
  COUNT(CASE WHEN reconciliation_status = 'rapproche' THEN 1 END) AS reconciled_count
FROM invoices;

COMMENT ON VIEW v_finance_kpi_aggregates IS 'Vue optimisée pour l''extraction instantanée des métriques financières et de facturation.';
