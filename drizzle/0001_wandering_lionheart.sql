CREATE TABLE `dossiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dossierNumber` varchar(16) NOT NULL,
	`clientDossierNumber` varchar(120),
	`client` varchar(255),
	`blLtaNumber` varchar(160),
	`cargoNature` text,
	`transportMode` varchar(64),
	`eta` timestamp,
	`originPort` varchar(255),
	`destinationPort` varchar(255),
	`container` varchar(255),
	`bulk` varchar(255),
	`goodsReleaseDate` timestamp,
	`declarationNumber` varchar(160),
	`bulletinNumber` varchar(160),
	`finalDeclarationNumber` varchar(160),
	`calculatedStatus` enum('Régularisé','À régulariser') NOT NULL,
	`calculatedPriority` enum('Haute','Normale','Basse') NOT NULL,
	`completionRate` int NOT NULL DEFAULT 0,
	`documentStatus` varchar(80),
	`customsStatus` varchar(80),
	`portStatus` varchar(100),
	`financialStatus` varchar(100),
	`fieldOperation` varchar(160),
	`responsible` varchar(120),
	`nextAction` varchar(255),
	`fieldAlert` varchar(120),
	`deliveryLocation` varchar(120),
	`declarant` varchar(120),
	`service` varchar(80),
	`regime` varchar(80),
	`notes` text,
	`createdById` int,
	`updatedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dossiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `dossiers_number_unique` UNIQUE(`dossierNumber`)
);
--> statement-breakpoint
CREATE TABLE `reference_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reference_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `reference_category_label_unique` UNIQUE(`category`,`label`)
);
--> statement-breakpoint
CREATE INDEX `dossiers_client_idx` ON `dossiers` (`client`);--> statement-breakpoint
CREATE INDEX `dossiers_status_idx` ON `dossiers` (`calculatedStatus`);--> statement-breakpoint
CREATE INDEX `dossiers_priority_idx` ON `dossiers` (`calculatedPriority`);--> statement-breakpoint
CREATE INDEX `dossiers_eta_idx` ON `dossiers` (`eta`);--> statement-breakpoint
CREATE INDEX `dossiers_bl_lta_idx` ON `dossiers` (`blLtaNumber`);--> statement-breakpoint
CREATE INDEX `reference_category_idx` ON `reference_items` (`category`);