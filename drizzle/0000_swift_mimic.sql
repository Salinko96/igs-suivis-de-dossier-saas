CREATE TYPE "public"."calculated_priority" AS ENUM('Haute', 'Normale', 'Basse');--> statement-breakpoint
CREATE TYPE "public"."calculated_status" AS ENUM('Régularisé', 'À régulariser');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossierNumber" varchar(16) NOT NULL,
	"clientDossierNumber" varchar(120),
	"client" varchar(255),
	"blLtaNumber" varchar(160),
	"cargoNature" text,
	"transportMode" varchar(64),
	"eta" timestamp,
	"originPort" varchar(255),
	"destinationPort" varchar(255),
	"container" varchar(255),
	"bulk" varchar(255),
	"goodsReleaseDate" timestamp,
	"declarationNumber" varchar(160),
	"bulletinNumber" varchar(160),
	"finalDeclarationNumber" varchar(160),
	"calculatedStatus" "calculated_status" NOT NULL,
	"calculatedPriority" "calculated_priority" NOT NULL,
	"completionRate" integer DEFAULT 0 NOT NULL,
	"documentStatus" varchar(80),
	"customsStatus" varchar(80),
	"portStatus" varchar(100),
	"financialStatus" varchar(100),
	"fieldOperation" varchar(160),
	"responsible" varchar(120),
	"nextAction" varchar(255),
	"fieldAlert" varchar(120),
	"deliveryLocation" varchar(120),
	"declarant" varchar(120),
	"service" varchar(80),
	"regime" varchar(80),
	"notes" text,
	"createdById" integer,
	"updatedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_number_unique" ON "dossiers" USING btree ("dossierNumber");--> statement-breakpoint
CREATE INDEX "dossiers_client_idx" ON "dossiers" USING btree ("client");--> statement-breakpoint
CREATE INDEX "dossiers_status_idx" ON "dossiers" USING btree ("calculatedStatus");--> statement-breakpoint
CREATE INDEX "dossiers_priority_idx" ON "dossiers" USING btree ("calculatedPriority");--> statement-breakpoint
CREATE INDEX "dossiers_eta_idx" ON "dossiers" USING btree ("eta");--> statement-breakpoint
CREATE INDEX "dossiers_bl_lta_idx" ON "dossiers" USING btree ("blLtaNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_category_label_unique" ON "reference_items" USING btree ("category","label");--> statement-breakpoint
CREATE INDEX "reference_category_idx" ON "reference_items" USING btree ("category");