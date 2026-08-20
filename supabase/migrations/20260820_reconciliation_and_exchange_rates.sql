-- =========================================================================
-- MIGRATION: Rapprochement 3-Voies Dossier/Facture & Historique Taux de Change
-- Date: 2026-08-20
-- =========================================================================

-- 1. Enrichissement de la table invoices avec colonnes de rapprochement et verrouillage
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(32) DEFAULT 'non_rapproche';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reconciliation_date TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reconciliation_ref VARCHAR(120);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rate_locked_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS invoices_reconciliation_idx ON invoices(reconciliation_status);

-- 2. Enrichissement de la table exchange_rates pour l'historique immuable
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS date VARCHAR(10);
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS provider VARCHAR(64) DEFAULT 'BCRG';
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT FALSE;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS created_by_id INTEGER;

CREATE INDEX IF NOT EXISTS exchange_rates_date_idx ON exchange_rates(date);
CREATE INDEX IF NOT EXISTS exchange_rates_currency_idx ON exchange_rates(source_currency, target_currency);

-- 3. Trigger / Vue pour calculer les marges et débours non récupérés
CREATE OR REPLACE VIEW v_finance_profitability AS
SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    i.dossier_id,
    i.client,
    i.currency,
    i.exchange_rate,
    i.amount_ht,
    i.amount_ttc,
    i.disbursements_amount,
    i.estimated_margin,
    i.status AS invoice_status,
    i.reconciliation_status,
    d.dossier_number,
    d.calculated_status AS dossier_status,
    d.eta,
    d.goods_release_date,
    COALESCE((
        SELECT SUM(p.amount) 
        FROM invoice_payments p 
        WHERE p.invoice_id = i.id
    ), 0) AS total_paid
FROM invoices i
LEFT JOIN dossiers d ON d.id = i.dossier_id;
