-- ==============================================================================
-- IGS DOSSIERS SAAS - MIGRATION COMPLÈTE FINANCES, FACTURATION & DÉBOURS (SUPABASE)
-- Date: 2026-08-19
-- Auteur: Senior Full-Stack Engineer (Vercel & Supabase Production)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE role_type AS ENUM ('user', 'declarant', 'comptable', 'manager', 'client', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE calculated_status_type AS ENUM ('Régularisé', 'À régulariser');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE calculated_priority_type AS ENUM ('Haute', 'Normale', 'Basse');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_type AS ENUM ('Proforma', 'Émise', 'Payée', 'En_retard', 'Annulée');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type_type AS ENUM ('Proforma', 'Definitive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type_type AS ENUM (
        'ETA_DEPASSEE', 'DDI_MANQUANTE', 'BULLETIN_MANQUANT', 
        'SURESTARIES_RISQUE', 'STATUT_MODIFIE', 'DOCUMENT_AJOUTE', 'FACTURE_GENEREE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES

-- Table des Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(160),
    email VARCHAR(320),
    phone VARCHAR(32),
    country VARCHAR(100) DEFAULT 'Guinée',
    tax_id VARCHAR(80),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Dossiers
CREATE TABLE IF NOT EXISTS public.dossiers (
    id SERIAL PRIMARY KEY,
    dossier_number VARCHAR(16) NOT NULL UNIQUE,
    client_dossier_number VARCHAR(120),
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    client VARCHAR(255) NOT NULL,
    bl_lta_number VARCHAR(160),
    cargo_nature TEXT,
    transport_mode VARCHAR(64) DEFAULT 'Maritime',
    eta TIMESTAMPTZ,
    origin_port VARCHAR(255),
    destination_port VARCHAR(255),
    port VARCHAR(120) DEFAULT 'Port Autonome de Conakry (PAC)',
    container VARCHAR(255),
    bulk VARCHAR(255),
    goods_release_date TIMESTAMPTZ,
    days_on_quay INTEGER DEFAULT 0,
    declaration_number VARCHAR(160),
    bulletin_number VARCHAR(160),
    final_declaration_number VARCHAR(160),
    ddi_guceg_number VARCHAR(160),
    bad_status VARCHAR(64),
    bae_status VARCHAR(64),
    calculated_status calculated_status_type NOT NULL DEFAULT 'À régulariser',
    calculated_priority calculated_priority_type NOT NULL DEFAULT 'Normale',
    completion_rate INTEGER NOT NULL DEFAULT 0,
    document_status VARCHAR(80),
    customs_status VARCHAR(80),
    port_status VARCHAR(100),
    financial_status VARCHAR(100) DEFAULT 'Non facturé',
    field_operation VARCHAR(160),
    responsible VARCHAR(120),
    next_action VARCHAR(255),
    field_alert VARCHAR(120),
    delivery_location VARCHAR(120),
    declarant VARCHAR(120),
    service VARCHAR(80),
    regime VARCHAR(80),
    notes TEXT,
    portal_access_code VARCHAR(32),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Factures
CREATE TABLE IF NOT EXISTS public.invoices (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_number VARCHAR(32) NOT NULL UNIQUE,
    client VARCHAR(255) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'GNF',
    invoice_type invoice_type_type NOT NULL DEFAULT 'Proforma',
    exchange_rate INTEGER NOT NULL DEFAULT 8650,
    amount_ht BIGINT NOT NULL DEFAULT 0,
    amount_tva BIGINT NOT NULL DEFAULT 0,
    amount_ttc BIGINT NOT NULL DEFAULT 0,
    disbursements_amount BIGINT NOT NULL DEFAULT 0,
    customs_duties_amount BIGINT NOT NULL DEFAULT 0,
    port_fees_amount BIGINT NOT NULL DEFAULT 0,
    storage_and_demurrage_fees BIGINT NOT NULL DEFAULT 0,
    estimated_margin BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(64),
    payment_reference VARCHAR(120),
    receipt_number VARCHAR(64),
    status invoice_status_type NOT NULL DEFAULT 'Proforma',
    pdf_url TEXT,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_by_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Encaissements
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'GNF',
    payment_method VARCHAR(64) NOT NULL,
    payment_reference VARCHAR(120),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    proof_url TEXT,
    notes TEXT,
    created_by_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Débours PAC & Douane
CREATE TABLE IF NOT EXISTS public.pac_disbursements (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES public.invoices(id) ON DELETE SET NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'douane',
    amount_advanced BIGINT NOT NULL DEFAULT 0,
    amount_reimbursed BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'avance',
    receipt_number VARCHAR(64),
    notes TEXT,
    created_by_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table du Taux de Change
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id SERIAL PRIMARY KEY,
    source_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    target_currency VARCHAR(8) NOT NULL DEFAULT 'GNF',
    rate INTEGER NOT NULL DEFAULT 8650,
    updated_by_id INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES public.dossiers(id) ON DELETE CASCADE,
    dossier_number VARCHAR(16),
    type notification_type_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    recipient_email VARCHAR(320),
    recipient_role VARCHAR(64),
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDEXES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_invoices_dossier ON public.invoices(dossier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.invoice_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_debours_dossier ON public.pac_disbursements(dossier_id);
CREATE INDEX IF NOT EXISTS idx_debours_status ON public.pac_disbursements(status);

CREATE INDEX IF NOT EXISTS idx_dossiers_days_quay ON public.dossiers(days_on_quay);
CREATE INDEX IF NOT EXISTS idx_dossiers_status ON public.dossiers(calculated_status);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pac_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies pour `invoices`
CREATE POLICY "Allow authenticated read invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin and comptable to insert invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'comptable') 
    OR (SELECT role FROM public.users WHERE open_id = auth.uid()::text) IN ('admin', 'comptable')
);

CREATE POLICY "Allow admin and comptable to update invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (
    auth.jwt() ->> 'role' IN ('admin', 'comptable') 
    OR (SELECT role FROM public.users WHERE open_id = auth.uid()::text) IN ('admin', 'comptable')
)
WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'comptable') 
    OR (SELECT role FROM public.users WHERE open_id = auth.uid()::text) IN ('admin', 'comptable')
);

-- Policies pour `invoice_payments`
CREATE POLICY "Allow authenticated read invoice_payments"
ON public.invoice_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin and comptable to record payments"
ON public.invoice_payments FOR INSERT
TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'comptable') 
    OR (SELECT role FROM public.users WHERE open_id = auth.uid()::text) IN ('admin', 'comptable')
);

-- 6. FONCTIONS POSTGRESQL & RPC

-- Calcul des KPIs financiers agrégés en temps réel
CREATE OR REPLACE FUNCTION public.get_finance_kpis()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_total_ca_gnf BIGINT;
    v_total_margin_gnf BIGINT;
    v_total_debours_gnf BIGINT;
    v_risk_dossiers_count INTEGER;
    v_active_rate INTEGER;
    v_invoices_count INTEGER;
    v_paid_invoices_count INTEGER;
BEGIN
    -- Taux de change actif
    SELECT rate INTO v_active_rate FROM public.exchange_rates ORDER BY updated_at DESC LIMIT 1;
    IF v_active_rate IS NULL THEN
        v_active_rate := 8650;
    END IF;

    -- Chiffre d'Affaires total facturé (TTC)
    SELECT COALESCE(SUM(amount_ttc), 0) INTO v_total_ca_gnf 
    FROM public.invoices 
    WHERE status != 'Annulée';

    -- Marge brute totale
    SELECT COALESCE(SUM(estimated_margin), 0) INTO v_total_margin_gnf 
    FROM public.invoices 
    WHERE status != 'Annulée';

    -- Débours avancés non encore intégralement remboursés
    SELECT COALESCE(SUM(amount_advanced - amount_reimbursed), 0) INTO v_total_debours_gnf 
    FROM public.pac_disbursements 
    WHERE status IN ('avance', 'rembourse_partiel');

    -- Nombre de dossiers au port à risque de surestaries (> 7 jours)
    SELECT COUNT(*) INTO v_risk_dossiers_count 
    FROM public.dossiers 
    WHERE days_on_quay > 7 AND goods_release_date IS NULL;

    -- Statistiques factures
    SELECT COUNT(*) INTO v_invoices_count FROM public.invoices WHERE status != 'Annulée';
    SELECT COUNT(*) INTO v_paid_invoices_count FROM public.invoices WHERE status = 'Payée';

    RETURN json_build_object(
        'totalRevenueGnf', v_total_ca_gnf,
        'totalRevenueUsd', ROUND(v_total_ca_gnf::numeric / v_active_rate, 2),
        'totalMarginGnf', v_total_margin_gnf,
        'totalMarginUsd', ROUND(v_total_margin_gnf::numeric / v_active_rate, 2),
        'totalPacDisbursementsGnf', v_total_debours_gnf,
        'totalPacDisbursementsUsd', ROUND(v_total_debours_gnf::numeric / v_active_rate, 2),
        'riskDossiersCount', v_risk_dossiers_count,
        'exchangeRate', v_active_rate,
        'invoicesCount', v_invoices_count,
        'paidInvoicesCount', v_paid_invoices_count
    );
END;
$$;

-- Fonction nocturne de recalcul des jours de séjour au port et alertes de surestaries
CREATE OR REPLACE FUNCTION public.increment_surestaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mettre à jour days_on_quay pour les dossiers en cours arrivés au port
    UPDATE public.dossiers
    SET days_on_quay = GREATEST(0, EXTRACT(DAY FROM (NOW() - eta))::INTEGER),
        updated_at = NOW()
    WHERE eta IS NOT NULL 
      AND eta <= NOW() 
      AND goods_release_date IS NULL;

    -- Générer une notification pour chaque dossier dépassant 7 jours
    FOR r IN (
        SELECT id, dossier_number, client, days_on_quay 
        FROM public.dossiers 
        WHERE days_on_quay > 7 
          AND goods_release_date IS NULL
    ) LOOP
        INSERT INTO public.notifications (
            dossier_id,
            dossier_number,
            type,
            title,
            message,
            recipient_role,
            is_read,
            created_at
        ) VALUES (
            r.id,
            r.dossier_number,
            'SURESTARIES_RISQUE',
            'Alerte Surestaries Quai (> 7j)',
            'Le dossier ' || r.dossier_number || ' (' || r.client || ') est à ' || r.days_on_quay || ' jours de séjour au port. Risque de pénalités PAC.',
            'comptable',
            0,
            NOW()
        );
    END LOOP;
END;
$$;

-- Programmer l'exécution quotidienne à minuit avec pg_cron (si disponible)
DO $$
BEGIN
    PERFORM cron.schedule(
        'nightly-surestaries-check',
        '0 0 * * *',
        'SELECT public.increment_surestaries();'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron not enabled or permission denied, trigger can be invoked via Edge Function';
END $$;

-- 7. CONFIGURATION SUPABASE REALTIME
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_payments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pac_disbursements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;
