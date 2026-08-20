-- ====================================================================
-- MIGRATION SUPABASE : SÉCURITÉ PORTAIL CLIENT, VALIDATION & AUDIT LOG
-- IGS Dossiers — Transit & Douane Guinée
-- ====================================================================

-- 1. Table des Sessions d'Accès OTP pour les Sociétés Clientes
CREATE TABLE IF NOT EXISTS client_access_sessions (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    client_company VARCHAR(255) NOT NULL,
    client_phone VARCHAR(32),
    client_email VARCHAR(320),
    otp_code VARCHAR(12) NOT NULL,
    session_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_dossier ON client_access_sessions(dossier_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_phone ON client_access_sessions(client_phone);
CREATE INDEX IF NOT EXISTS idx_client_sessions_expires ON client_access_sessions(expires_at);

-- 2. Table des Logs d'Accès au Portail Public / Partagé
CREATE TABLE IF NOT EXISTS portal_access_logs (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE SET NULL,
    access_code_used VARCHAR(64) NOT NULL,
    token_identifier VARCHAR(120),
    client_company VARCHAR(255),
    ip_address VARCHAR(64),
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_logs_dossier ON portal_access_logs(dossier_id);
CREATE INDEX IF NOT EXISTS idx_portal_logs_time ON portal_access_logs(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_logs_code ON portal_access_logs(access_code_used);

-- 3. Table des Logs d'Audit et Traçabilité Réglementaire (Contrôle Douane)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    record_id INTEGER NOT NULL,
    user_id INTEGER,
    user_name VARCHAR(120),
    user_role VARCHAR(64),
    action VARCHAR(64) NOT NULL, -- CREATE, UPDATE, DELETE, CUSTOMS_TRANSITION, PAYMENT, DISBURSEMENT
    field_changed VARCHAR(80),
    previous_value TEXT,
    new_value TEXT,
    before_data JSONB,
    after_data JSONB,
    comment TEXT,
    ip_address VARCHAR(64),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 4. Activation de Row Level Security (RLS)
ALTER TABLE client_access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS Supabase pour le Portail Client et l'Administration
-- Les agents internes IGS (admin, declarant, comptable, manager) ont un accès complet
CREATE POLICY "internal_agents_all_access_dossiers" ON dossiers
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'role' IN ('admin', 'declarant', 'comptable', 'manager')
    );

-- Les clients ne voient que leurs propres dossiers
CREATE POLICY "client_own_dossiers_isolation" ON dossiers
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'client' AND (
            client = (auth.jwt() ->> 'client_company')
            OR client_id::text = auth.uid()::text
        )
    );

-- Les logs d'audit sont strictement réservés aux administrateurs et auditeurs
CREATE POLICY "admin_audit_logs_read" ON audit_logs
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "system_insert_audit_logs" ON audit_logs
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);
