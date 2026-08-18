-- ============================================================================
-- Script d'initialisation Supabase pour IGS Dossiers SaaS (Guinée / Afrique de l'Ouest)
-- Tables : dossiers, reference_items, users
-- ============================================================================

-- 1. Types & ENUMs
DO $$ BEGIN
  CREATE TYPE calculated_priority AS ENUM ('Haute', 'Normale', 'Basse');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE calculated_status AS ENUM ('Régularisé', 'À régulariser');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS dossiers (
  id serial PRIMARY KEY NOT NULL,
  "dossierNumber" varchar(16) NOT NULL,
  "clientDossierNumber" varchar(120),
  client varchar(255),
  "blLtaNumber" varchar(160),
  "cargoNature" text,
  "transportMode" varchar(64),
  eta timestamp,
  "originPort" varchar(255),
  "destinationPort" varchar(255),
  container varchar(255),
  bulk varchar(255),
  "goodsReleaseDate" timestamp,
  "declarationNumber" varchar(160),
  "bulletinNumber" varchar(160),
  "finalDeclarationNumber" varchar(160),
  "calculatedStatus" calculated_status NOT NULL,
  "calculatedPriority" calculated_priority NOT NULL,
  "completionRate" integer DEFAULT 0 NOT NULL,
  "documentStatus" varchar(80),
  "customsStatus" varchar(80),
  "portStatus" varchar(100),
  "financialStatus" varchar(100),
  "fieldOperation" varchar(160),
  responsible varchar(120),
  "nextAction" varchar(255),
  "fieldAlert" varchar(120),
  "deliveryLocation" varchar(120),
  declarant varchar(120),
  service varchar(80),
  regime varchar(80),
  notes text,
  "createdById" integer,
  "updatedById" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS reference_items (
  id serial PRIMARY KEY NOT NULL,
  category varchar(64) NOT NULL,
  label varchar(255) NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY NOT NULL,
  "openId" varchar(64) NOT NULL,
  name text,
  email varchar(320),
  "loginMethod" varchar(64),
  role role DEFAULT 'user' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "lastSignedIn" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT users_openId_unique UNIQUE("openId")
);

-- 3. Indexes & Constraints
CREATE UNIQUE INDEX IF NOT EXISTS dossiers_number_unique ON dossiers ("dossierNumber");
CREATE INDEX IF NOT EXISTS dossiers_client_idx ON dossiers (client);
CREATE INDEX IF NOT EXISTS dossiers_status_idx ON dossiers ("calculatedStatus");
CREATE INDEX IF NOT EXISTS dossiers_priority_idx ON dossiers ("calculatedPriority");
CREATE INDEX IF NOT EXISTS dossiers_eta_idx ON dossiers (eta);
CREATE INDEX IF NOT EXISTS dossiers_bl_lta_idx ON dossiers ("blLtaNumber");
CREATE UNIQUE INDEX IF NOT EXISTS reference_category_label_unique ON reference_items (category, label);
CREATE INDEX IF NOT EXISTS reference_category_idx ON reference_items (category);

-- 4. Insertion des Référentiels
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut', 'Régularisé', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut', 'À régulariser', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite', 'Haute', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite', 'Normale', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite', 'Basse', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_recu', 'Oui', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_recu', 'Non', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_recu', 'Partiel', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_recu', 'Non applicable', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('mode_transport', 'Maritime', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('mode_transport', 'Aérien', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('mode_transport', 'Routier', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('mode_transport', 'Mixte', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('mode_transport', 'Domestique', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant', 'Interne', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant', 'Client', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant', 'Partenaire', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant', 'À définir', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('type_operation', 'Maritime', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('type_operation', 'Terrestre', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('type_operation', 'Domestique', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Tesmec', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Kalpataru', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Rabotec', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Mohan', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Fabrimetal', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'GGE', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'NJP', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'GBG', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Fauveder', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'Capdrill', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('client', 'BelAir', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Non établis', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Fact. Définitive', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Fact. Partiel', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Fact. Proforma', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Déchargé', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Réception documents client', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Vérification documents', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Déclaration douane', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Suivi répertoire / bulletin / attestation', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Paiement droits et frais', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Sortie port', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Livraison client', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Facturation', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('operation_terrain', 'Clôture dossier', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_carnet', 'Établis', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_carnet', 'Partiel', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_carnet', 'Non établis', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable', 'Amine', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable', 'Hadja', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable', 'Tawel', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite_source', 'Bas', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite_source', 'Moyen', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('priorite_source', 'Élevée', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'TTC', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'EXO', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'AT', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Interne', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Client', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Partenaire', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'À définir', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Sow', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Amine', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('declarant_igs', 'Tawel', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('livreur', 'Hadja', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('livreur', 'Tawel', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('livreur', 'Équipe IGS', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('livreur', 'Transporteur externe', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('livreur', 'Client', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Conakry', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Port Autonome de Conakry', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Boffa', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Kamsar', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Sangaredi', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Kaloum', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Matoto', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Dixinn', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'BL / LTA', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Facture commerciale', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Packing list', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Certificat d’origine', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Déclaration douane', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'N° répertoire', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'N° bulletin', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'N° attestation', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Bordereau de livraison', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Bon de sortie port', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Quitus / preuve de paiement si applicable', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Autorisation ou document spécial selon marchandise', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable_igs', 'Amine', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable_igs', 'Hadja', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable_igs', 'Tawel', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable_igs', 'Sow', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('responsable_igs', 'Direction', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'OK', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'ETA dépassée', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Documents incomplets', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Action urgente', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Blocage douane', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Blocage port', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Paiement en attente', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Document spécial requis', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Relancer le client', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Vérifier les documents', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Préparer la déclaration', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Suivre répertoire / bulletin / attestation', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Faire payer droits et frais', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Obtenir le bon de sortie port', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Organiser la livraison', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Émettre la facture', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Clôturer le dossier', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_documentaire', 'En attente', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_documentaire', 'Documents reçus', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_documentaire', 'Documents incomplets', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_documentaire', 'Non applicable', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Non démarré', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'À dédouaner', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'En déclaration', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Déclaré', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'En attente paiement', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Paiement effectué', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Dédouané', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Terminé', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Bloqué', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Régulariser', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Non concerné', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'En attente', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Arrivé au port', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'En attente bon de sortie', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Bon de sortie port', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Sorti du port', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Bloqué', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Import', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Transit', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Dédouanement', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Opération portuaire', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Livraison', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('service', 'Suivi client', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port Autonome de Conakry (PAC)', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port Minéralier de Kamsar', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Boffa', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port Autonome de San Pedro (Côte d''Ivoire)', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port Autonome d''Abidjan (Côte d''Ivoire)', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port Autonome de Dakar (Sénégal)', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Tema (Ghana)', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Lomé (Togo)', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Cotonou (Bénin)', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Ningbo port-china', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Shanghai Port (Chine)', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Qingdao Port (Chine)', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Tianjin Port (Chine)', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Lianyunggang-China', 14) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port d''Anvers (Belgique)', 15) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Rotterdam (Pays-Bas)', 16) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Valence (Espagne)', 17) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port de Dubaï (Jebel Ali)', 18) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_origine', 'Port d''Istanbul (Turquie)', 19) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port Autonome de Conakry', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port Minéralier de Kamsar', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port de Boffa', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port de Boké', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port de Taressa', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port de Konta', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Boffa-Conakry', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Conakry', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port Autonome de San Pedro (Côte d''Ivoire)', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port Autonome d''Abidjan (Côte d''Ivoire)', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Port Autonome de Dakar (Sénégal)', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('port_destination', 'Aéroport International Ahmed Sékou Touré (Conakry)', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('devise', 'GNF (Franc Guinéen)', 1) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('devise', 'USD (Dollar US)', 2) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('devise', 'EUR (Euro)', 3) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('devise', 'XOF (Franc CFA)', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Mise à la consommation directe (IM4 - TTC)', 4) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Mise à la consommation sous exonération (IM4 - EXO)', 5) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Régime Minier / Convention (EXO-MIN)', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Transit National / International (IM8 - DDI / TRIE)', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Admission Temporaire (IM5 - AT)', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Entrepôt de Douane (IM7 - ED)', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('regime', 'Exportation / Réexportation (EX)', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'DDI initiée (GUCEG)', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'DDI approuvée', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'En cours de déclaration (SYDONIA)', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Bulletin de liquidation émis', 14) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Visite douane / Scanner', 15) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_douane', 'Bon à Enlever (BAE) obtenu', 16) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Navire en rade', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Navire à quai / Déchargement', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Conteneur sous douane (Terre-plein)', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Frais portuaires réglés (PAC / ALPORT / Bolloré)', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_port', 'Surestaries en cours', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Avance reçue', 6) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Paiement droits & taxes effectué', 7) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'Payé intégralement (GNF / USD)', 8) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('statut_financier', 'En attente quitus client', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'DDI - Demande de Déclaration d''Importation (GUCEG)', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Bordereau de suivi des cargaisons (BSC / BESC Guinée)', 14) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Déclaration douane SYDONIA World', 15) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Quittance / Preuve de paiement douane', 16) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Bon à Enlever douane (BAE)', 17) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Bon de sortie port PAC', 18) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('document_guinee', 'Autorisation spéciale matières dangereuses / Cyanure', 19) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'ETA imminente (< 48h)', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'DDI manquante ou expirée', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Surestaries / Magasinage risque élevé', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Blocage visite Douane / Scanner', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('alerte_terrain', 'Document spécial requis (Cyanure/Minier)', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Soumettre la DDI sur GUCEG', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Préparer la déclaration SYDONIA', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Effectuer passage scanner / Visite', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Obtenir le Bon à Enlever (BAE)', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('prochaine_action', 'Émettre la facture (GNF / USD)', 14) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Zone Industrielle Kagbélen', 9) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Ratoma', 10) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Boké', 11) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Siguiri (Zone minière)', 12) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Kindia', 13) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Mamou', 14) ON CONFLICT (category, label) DO NOTHING;
INSERT INTO reference_items (category, label, "sortOrder") VALUES ('lieu_livraison', 'Kankan', 15) ON CONFLICT (category, label) DO NOTHING;

-- 5. Insertion des 54 Dossiers Initiaux
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0001', 'CKYSI26000340', 'Guinean Birimian Gold S.A', 'HLCUNG12604AUQG1', 'Cyanure', 'Maritime', '2026-07-31 00:00:00', 'Ningbo port-china', 'Conakry', '04TC20''', NULL, NULL, 'S 142- 27/07/2026', 'L 1774 Du 28/07/2026', NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0002', 'CKYSI26000342', 'Guinee Gold Exploration S.A', 'HLCUNG12604AVHK6', 'Cyanure', 'Maritime', '2026-07-31 00:00:00', 'Ningbo port-china', 'Conakry', '06TC20''', NULL, NULL, 'S 143- 27/07/2026', 'L 1773 Du 28/07/2026', NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0003', NULL, 'Guinee Yongchuang Shipbuilding LTD - Sarl', 'JH260LYG11', 'Hot- Rolled Steel Plates', 'Maritime', '2026-07-21 00:00:00', 'Lianyunggang-China', 'Boffa-Conakry', NULL, '56 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0004', NULL, 'Guinee Yongchuang Shipbuilding LTD - Sarl', 'JH260LYG12', 'Galvanized Steel Tubes', 'Maritime', '2026-07-21 00:00:00', 'Lianyunggang-China', 'Boffa-Conakry', NULL, '6 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0005', NULL, 'Guinee Yongchuang Shipbuilding LTD - Sarl', 'JH260LYG13', 'H-Beam Steel', 'Maritime', '2026-07-21 00:00:00', 'Lianyunggang-China', 'Boffa-Conakry', NULL, '2 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0006', NULL, 'Guinee Yongchuang Shipbuilding LTD - Sarl', 'JH260LYG14', 'Angle Steel', 'Maritime', '2026-07-21 00:00:00', 'Lianyunggang-China', 'Boffa-Conakry', NULL, '2 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0007', NULL, 'New Japon Mining Company S.A', 'NFFN017C000101', 'Environmental Gold Leaching Agent', 'Maritime', '2026-07-21 00:00:00', 'Rizhao-china', 'Port Autonome de Conakry', '20 TC20''', '22 400 kgs', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0008', NULL, 'Guinean Birimian Gold S.A', 'NFFN017C000102', 'H-Beam Channel Steel, Angle Steel, Patterned Plate, Flat-Opened', 'Maritime', '2026-07-21 00:00:00', 'Rizhao-china', 'Boffa-Conakry', NULL, '15 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0009', 'CKY8126000377', 'Guinean Birimian Gold S.A', 'NGP3626648', 'Cyanure de sodium', 'Maritime', '2026-07-30 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '5x 20 st', NULL, '2026-08-01 00:00:00', 'S 132- 20/07/2026', 'L 1723 Du 21/07/2026', 'C 1317-2026', 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0010', 'CKY8126000378', 'Guinee Gold Exploration S.A', 'NGP3651868', 'Cyanure de sodium', 'Maritime', '2026-07-30 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '5x 20 st', NULL, '2026-08-01 00:00:00', 'S 133- 20/07/2026', 'L 1729 Du 21/07/2026', 'C 1319-2026', 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0011', 'CKY8126000380', 'Guinee Gold Exploration S.A', 'NGP3654574', 'Cyanure de sodium', 'Maritime', '2026-07-30 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '4x 20 st', NULL, '2026-08-01 00:00:00', 'S 135- 20/07/2026', 'L 1725 Du 21/07/2026', 'C 1322-2026', 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0012', 'CKY8126000379', 'Guinee Gold Exploration S.A', 'NGP3654656', 'Cyanure de sodium', 'Maritime', '2026-07-30 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '6x', NULL, '2026-08-01 00:00:00', 'S 134- 20/07/2026', 'L 1728 Du 21/07/2026', 'C 1323-2026', 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0013', 'CKY8126000409', 'New Japon Mining Company S.A', 'NGP3711076', 'Sodium Cyanide Solide', 'Maritime', '2026-08-13 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '5x 20 st', NULL, NULL, 'S 162- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0014', 'CKYSI26000364', 'Capdrill', 'S04019953', 'Mining Parts', 'Maritime', '2026-08-20 00:00:00', NULL, 'Conakry', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0015', 'CKYSI26000350', 'Rabotec', 'PRORO19/2026', 'Prorogation AT', 'Domestique', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 42) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0016', 'CKYSE26000348', 'BelAir', 'NF VISION', 'Bauxite', 'Maritime', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 42) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0017', 'CKYSI26000347', 'New Japon Mining Company S.A', 'NGP3574724', 'Cyanure', 'Maritime', '2026-07-22 00:00:00', 'china', 'conakry', '05TC20''', NULL, '2026-07-28 00:00:00', 'S117 du 08/07/26', 'L1597 du 09/07/2026', NULL, 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0018', 'CKYSI26000346', 'New Japon Mining Company S.A', 'NGP3572754', 'Cyanure', 'Maritime', '2026-07-22 00:00:00', 'china', 'conakry', '05TC20''', NULL, '2026-07-28 00:00:00', 'S119 du 08/07/26', NULL, NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0019', 'CKYSI26000345', 'New Japon Mining Company S.A', 'NGP3583958', 'Cyanure', 'Maritime', '2026-07-22 00:00:00', 'china', 'Conakry', '05TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0020', 'CKYSI26000344', 'Guinee Gold Exploration S.A', 'HLCUNG12604ATCF6', 'Cyanure', 'Maritime', '2026-07-19 00:00:00', 'china', 'Conakry', '06TC20''', NULL, '2026-07-20 00:00:00', 'S114 du 08/07/26', NULL, NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0021', 'CKYSI26000343', 'Guinee Gold Exploration S.A', 'HLCUNG1260478795', 'Cyanure', 'Maritime', '2026-07-18 00:00:00', 'china', 'Conakry', '06TC20''', NULL, '2026-07-20 00:00:00', 'S116 du 08/07/26', NULL, NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0022', 'CKYSI26000341', 'Guinee Gold Exploration S.A', 'NGP3583949', 'Cyanure', 'Maritime', '2026-07-25 00:00:00', 'china', 'Conakry', '05TC20''', NULL, '2026-07-28 00:00:00', 'S115 du 08/07/26', 'L1589 du 09/07/2026', NULL, 'Régularisé', 'Basse', 100) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0023', 'CKYSI26000339', 'Guinean Birimian Gold S.A', 'HLCUNG1260470029', 'Cyanure', 'Maritime', '2026-07-18 00:00:00', 'china', 'Conakry', '04TC20''', NULL, '2026-07-20 00:00:00', 'S121 du 08/07/26', NULL, NULL, 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0024', 'CKYSI26000338', 'Guinean Birimian Gold S.A', 'NGP3626633', 'Cyanure', 'Maritime', '2026-07-25 00:00:00', 'china', 'Conakry', '05TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0025', 'CKYSI26000337', 'Guinean Birimian Gold S.A', 'NFVS01C000101', 'Machine foreuse et équipements', 'Maritime', NULL, 'china', 'Boffa', NULL, '31 colis', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0026', 'CKYSI26000336', 'Guinean Birimian Gold S.A', 'NFVS01J000102', 'Steel Ball', 'Maritime', NULL, 'china', 'Boffa', '40TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0027', 'CKYSI26000335', 'Guinean Birimian Gold S.A', 'NFVS01H000302', 'Calcium oxide', 'Maritime', NULL, 'china', 'Boffa', '43TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0028', 'CKYSI26000334', 'New Japon Mining Company S.A', 'NFVS01H000301', 'Quick Lime', 'Maritime', NULL, 'china', 'Boffa', '46TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0029', 'CKYSI26000333', NULL, 'NFVS01C000301', 'Trommel Screen', NULL, NULL, NULL, NULL, NULL, '6 Pkg', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 33) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0030', 'CKYSI26000331', NULL, 'NFVS01J000101', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 17) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0031', 'CKYSI26000330', NULL, 'NFVS01H000201', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 17) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0032', 'CKYSI26000329', NULL, 'NFVS01C000201', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 17) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0033', 'CKY8126000432', 'Guinean Birimian Gold S.A', 'NGP3696879', 'Cyanure', 'Maritime', '2026-08-12 00:00:00', 'Ningbo port-china', 'Conakry, GN', '06TC20''', NULL, NULL, 'S 161- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0034', 'CKY8126000431', 'Guinean Birimian Gold S.A', 'NGP3768278', 'Cyanure', 'Maritime', '2026-08-12 00:00:00', 'Ningbo port-china', 'Conakry, GN', '06TC20''', NULL, NULL, 'S 160- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0035', 'CKY8126000407', 'Guinean Birimian Gold S.A', 'NGP3768351', 'Cyanure', 'Maritime', '2026-08-13 00:00:00', 'Ningbo port-china', 'Conakry, GN', '06TC20''', NULL, NULL, 'S 157- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0036', 'CKY8126000408', 'New Japon Mining Company S.A', 'MEDUY4002885', 'Cyanure', 'Maritime', '2026-08-18 00:00:00', 'Ningbo, CN', 'Conakry, GN', '05TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0037', 'CKY8126000413', 'Guinean Birimian Gold S.A', 'NGP3670655', 'Cyanure de sodium', 'Maritime', '2026-08-13 00:00:00', NULL, NULL, '04TC20''', NULL, NULL, 'S 158- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0038', 'CKY8126000414', 'Guinean Birimian Gold S.A', 'NGP3677538', 'Cyanure', 'Maritime', '2026-08-13 00:00:00', NULL, NULL, '06TC20''', NULL, NULL, 'S 159- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 67) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0039', 'CKY8126000412', 'Guinee Gold Exploration S.A', 'NGP3669558', 'Cyanure', 'Maritime', '2026-08-13 00:00:00', 'CHINE', 'Conakry, GN', '04TC20''', NULL, NULL, 'S 156- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0040', 'CKYSI26000324', 'Fabrimetal', 'MEDUXO787576', 'Bar bending machine', 'Maritime', '2026-08-03 00:00:00', 'Nhava Sheva, IndiA', 'Conakry, GN', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0041', 'CKYSI26000323', 'Fabrimetal', 'MEDUXO733307', 'Spare parts for induction furnace', 'Maritime', '2026-08-04 00:00:00', 'Mundra,India', 'Conakry, GN', '02TC40'';01TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0042', 'CKYSI26000318', 'Fabrimetal', 'MEDUJ7763785', '006054796h91-genset 250kva AMF 3P STD', 'Maritime', '2026-08-07 00:00:00', 'Nhava Sheva, IndiA', 'Conakry, GN', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0043', NULL, 'Fabrimetal', 'HLCUBO12606CGXW0', 'Africa steel dynamics LTd', 'Maritime', NULL, 'Mundra,India', 'Conakry, GN', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 58) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0044', 'CKYSI26000320', 'Fabrimetal', 'EID0951355', 'Escort Back loader', 'Maritime', '2026-08-13 00:00:00', 'Mundra,India', 'Conakry, GN', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0045', 'CKYSI26000363', 'Fabrimetal', 'EID0951814', 'Meubles, Mobilier, etc', 'Maritime', '2026-09-20 00:00:00', 'Mundra,India', 'Conakry, GN', '01TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0046', 'CKY8126000411', 'Guinee Gold Exploration S.A', 'NGP3711084', 'Cyanure de sodium', 'Maritime', '2026-08-13 00:00:00', 'Ningbo, CN', 'Conakry, GN', '04TC20''', NULL, NULL, 'S 155- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0047', 'CKY8126000410', 'Guinee Gold Exploration S.A', 'NGP3669057', 'Cyanure de sodium', 'Maritime', '2026-08-13 00:00:00', 'Ningbo, CN', 'Conakry, GN', '04TC20''', NULL, NULL, 'S 154- 08/08/2026', NULL, NULL, 'À régulariser', 'Haute', 83) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0048', 'CKYSI26000293', 'Capdrill', 'S329450131', 'New unpacked vehicule', 'Maritime', '2026-08-07 00:00:00', 'Atwerp', 'Conakry, GN', NULL, '2 PKG', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0049', 'CKY8126000439', 'Guinee Gold Exploration S.A', 'VTHC20260803-6-SGGE-HCL', 'Acide chlorhydrique', 'Routier', '2026-08-13 00:00:00', 'Accra, Guinea', 'Siguiri, GN', NULL, '83.52 tonnes', NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0050', 'CKY8126000298', 'Rabotec', 'MEDUXs477883', 'Flexible rubber pipes', 'Maritime', '2026-08-18 00:00:00', 'Qingdao, china', 'Conakry, GN', '01TC40''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0051', 'CKY8126000318', 'Fabrimetal', 'MEDUJ7763785', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 25) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0052', 'CKY8126000441', 'New Japon Mining Company S.A', 'NGP3876679', 'Sodium Cyanide Solide', 'Maritime', '2026-09-26 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '06TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0053', 'CKY8126000440', 'New Japon Mining Company S.A', 'NGP3796299', 'Sodium Cyanide Solide', 'Maritime', '2026-09-26 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '04TC20''', NULL, NULL, NULL, NULL, NULL, 'À régulariser', 'Haute', 75) ON CONFLICT ("dossierNumber") DO NOTHING;
INSERT INTO dossiers ("dossierNumber", "clientDossierNumber", client, "blLtaNumber", "cargoNature", "transportMode", eta, "originPort", "destinationPort", container, bulk, "goodsReleaseDate", "declarationNumber", "bulletinNumber", "finalDeclarationNumber", "calculatedStatus", "calculatedPriority", "completionRate") VALUES ('DOS-0054', 'CKY8126000280', 'New Japon Mining Company S.A', '293961486', 'Cyanure de sodium', 'Maritime', '2026-06-16 00:00:00', 'Ningbo port-china', 'Port Autonome de Conakry', '05TC20''', NULL, NULL, 'S 97- 17/06/2026', 'L 1911 Du 10/08/2026', 'C 1398-2026', 'À régulariser', 'Haute', 92) ON CONFLICT ("dossierNumber") DO NOTHING;
