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
