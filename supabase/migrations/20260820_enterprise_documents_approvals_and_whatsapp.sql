-- Migration: Enterprise Documents, Approval Workflows, Client Reports & WhatsApp Business API
-- Date: 2026-08-20

-- 1. Extension de la table des documents (Versionning et Confidentialité)
ALTER TABLE IF EXISTS documents
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS previous_versions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(dossierId, version);
CREATE INDEX IF NOT EXISTS idx_documents_public ON documents(dossierId, is_public);

-- 2. Table des demandes d'approbation financière (Seuils Débours >5M GNF / Factures >10M GNF)
CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL, -- 'invoice' ou 'disbursement'
  entity_id INTEGER NOT NULL,
  dossier_id INTEGER NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(16) DEFAULT 'GNF' NOT NULL,
  threshold_amount NUMERIC(15, 2) NOT NULL,
  requested_by_id INTEGER NOT NULL,
  requested_by_name VARCHAR(160) NOT NULL,
  approver_id INTEGER,
  approver_name VARCHAR(160),
  status VARCHAR(32) DEFAULT 'EN_ATTENTE' NOT NULL, -- 'EN_ATTENTE', 'APPROUVE', 'REJETE'
  rejection_reason TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approvals_dossier ON approval_requests(dossier_id);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approval_requests(entity_type, entity_id);

-- 3. Préférences de communication multi-canaux & rapports mensuels par client
ALTER TABLE IF EXISTS clients
ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(32) DEFAULT 'whatsapp' NOT NULL,
ADD COLUMN IF NOT EXISTS opt_in_notifications BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS monthly_report_enabled BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(32),
ADD COLUMN IF NOT EXISTS account_category VARCHAR(64) DEFAULT 'standard'; -- 'mining_major', 'industrial', 'standard'

-- 4. Journal d'envoi WhatsApp Business API (Templates HSM & Traçabilité)
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id SERIAL PRIMARY KEY,
  dossier_id INTEGER,
  dossier_number VARCHAR(64),
  template_name VARCHAR(64) NOT NULL, -- 'dossier_cree', 'eta_mise_a_jour', 'alerte_surestarie', 'dossier_regularise', 'facture_disponible'
  recipient_phone VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  rendered_message TEXT NOT NULL,
  provider_message_id VARCHAR(120),
  status VARCHAR(32) DEFAULT 'SENT' NOT NULL, -- 'SENT', 'DELIVERED', 'READ', 'FAILED'
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_dossier ON whatsapp_message_logs(dossier_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_template ON whatsapp_message_logs(template_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_time ON whatsapp_message_logs(created_at);
