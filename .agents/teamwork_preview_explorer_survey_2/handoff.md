# Rapport d'Exploration Backend, Schéma & RBAC (Survey Explorer 2)

**Projet :** IGS Guinée SaaS — Suivi de Dossiers & Dédouanement  
**Auteur :** Explorer 2 (Backend, tRPC, Drizzle Schema & RBAC Specialist)  
**Date :** 2026-08-18  
**Référence :** `ORIGINAL_REQUEST.md` (Acceptance Criteria R1, R2, R3, R4)  

---

## 1. Observation

### 1.1. Architecture Backend et Organisation des Fichiers
- **Structure Globale :**
  - `server/` :
    - `server/routers.ts` (395 lignes) : Routeur tRPC racine (`appRouter`) regroupant les sous-routeurs : `auth`, `reference`, `dossier`, `portal`, `document`, `audit`, `finance`, `task`, `comment`, `notification`, `dashboard`, `system`.
    - `server/db.ts` (1166 lignes) : Couche d'accès aux données double-mode : PostgreSQL via Drizzle ORM (`drizzle-orm/postgres-js`) avec repli transparent en mémoire vive (`_memoryUsers`, `_memoryDossiers`, `_memoryInvoices`, `_memoryTasks`, `_memoryComments`, `_memoryNotifications`, `_memoryReferenceItems`).
    - `server/_core/trpc.ts` (46 lignes) : Initialisation tRPC avec transformateur `superjson`, `publicProcedure`, `protectedProcedure` (vérifiant `ctx.user`), et `adminProcedure` (vérifiant `ctx.user.role === 'admin'`).
    - `server/_core/context.ts` (29 lignes) : Construction du contexte Express avec extraction de session via `sdk.authenticateRequest(req)`.
    - `server/_core/sdk.ts` (351 lignes) : Gestion des tokens JWT signés (`jose` HS256) stockés dans le cookie `app_session_id` ou transmis via `Authorization: Bearer <token>`.
    - `server/dossierRules.ts` (51 lignes) : Calcul automatique de l'état du dossier (`calculatedStatus`: "Régularisé" / "À régulariser", `calculatedPriority`: "Haute" / "Normale" / "Basse", `completionRate`: 0-100%).
    - `server/seed.ts` (63 lignes) : Script d'initialisation de la base PostgreSQL à partir de `server/initialImportData.ts`.
  - `drizzle/` :
    - `drizzle/schema.ts` (202 lignes) : Définition des tables PostgreSQL Drizzle (`users`, `dossiers`, `documents`, `dossier_status_history`, `invoices`, `dossier_tasks`, `dossier_comments`, `notifications`, `reference_items`).
    - `drizzle.config.ts` (16 lignes) : Configuration Drizzle Kit (`dialect: "postgresql"`, `schema: "./drizzle/schema.ts"`).
  - `shared/` :
    - `shared/const.ts` (38 lignes) : Constantes d'authentification (`COOKIE_NAME = "app_session_id"`, `ONE_YEAR_MS`, messages d'erreur).
    - `shared/types.ts` (8 lignes) : Réexport unifié des types Drizzle (`User`, `Dossier`, `Invoice`, `DossierTask`, etc.).

### 1.2. État Existant des Tables et Modèles de Données

#### A. Table `dossiers` (`drizzle/schema.ts`, lignes 25-72)
- **Identifiants Douane & Logistique Existants :**
  - `blLtaNumber` (`varchar(160)`) : N° Connaissement maritime (BL) ou Lettre de Transport Aérien (LTA).
  - `declarationNumber` (`varchar(160)`) : N° Déclaration douane (ex: "S 142- 27/07/2026" dans SYDONIA World).
  - `bulletinNumber` (`varchar(160)`) : N° Bulletin de Liquidation Douane (BLD, ex: "L 1774 Du 28/07/2026").
  - `finalDeclarationNumber` (`varchar(160)`) : N° Déclaration définitive (ex: "C 1398-2026").
  - `clientDossierNumber` (`varchar(120)`) : Référence interne client (ex: "CKYSI26000340").
  - `portalAccessCode` (`varchar(32)`) : Code de suivi public direct (ex: "IGS-1001").
- **Statuts Métier & Opérations :**
  - `calculatedStatus` (`enum: "Régularisé", "À régulariser"`), `calculatedPriority` (`enum: "Haute", "Normale", "Basse"`), `completionRate` (`integer`).
  - `customsStatus` (`varchar(80)`), `portStatus` (`varchar(100)`), `financialStatus` (`varchar(100)`), `documentStatus` (`varchar(80)`).
  - `fieldOperation` (`varchar(160)`), `fieldAlert` (`varchar(120)`), `nextAction` (`varchar(255)`), `deliveryLocation` (`varchar(120)`), `declarant` (`varchar(120)`), `service` (`varchar(80)`), `regime` (`varchar(80)`).
- **Constat :** Les champs fondamentaux pour Mamadou Diallo (BL/LTA, Sydonia, BLD, statuts) sont présents dans la table `dossiers`. Il manque toutefois des drapeaux explicites pour la validation des documents de transit (BAD - Bon à Délivrer PAC, BAE - Bon à Enlever Douane, DDI GUCEG validée).

#### B. Table `dossier_tasks` (`drizzle/schema.ts`, lignes 130-145)
- **Colonnes :**
  - `id` (`serial`), `dossierId` (`integer`), `title` (`varchar(255)`), `assignedTo` (`varchar(120)`), `dueDate` (`timestamp`), `status` (`enum: "A_faire", "En_cours", "Termine", "Bloque"`), `priority` (`enum: "Haute", "Normale", "Basse"`), `completedAt` (`timestamp`), `createdById` (`integer`), `createdAt` (`timestamp`).
- **Données en mémoire (`server/db.ts`, lignes 212-297) :**
  - 7 tâches initiales pré-remplies : 5 assignées à `"Mamadou Diallo"` (DDI GUCEG, Sydonia World, BAD Port de Conakry, Inspection physique quai PAC, Régularisation BLD) et 2 assignées à `"Fatoumata Camara"` (Paiement débours & taxes PAC, Émission facture définitive).
- **Constat :** La table et les fonctions de persistance (`listTasks`, `createTask`, `updateTaskStatus`) existent dans `server/db.ts` et `server/routers.ts`. Cependant, `task.list` ne filtre pas par utilisateur assigné (`assignedTo`), et il manque une procédure de bascule rapide (`toggleTask`) ou de génération de checklist standard.

#### C. Table `invoices` (`drizzle/schema.ts`, lignes 104-128)
- **Colonnes :**
  - `id` (`serial`), `dossierId` (`integer`), `invoiceNumber` (`varchar(32)`), `client` (`varchar(255)`), `currency` (`varchar(8)`, défaut "GNF"), `amountHt` (`integer`), `amountTva` (`integer`), `amountTtc` (`integer`), `disbursementsAmount` (`integer`), `storageAndDemurrageFees` (`integer`), `estimatedMargin` (`integer`), `status` (`enum: "Proforma", "Émise", "Payée", "En_retard", "Annulée"`), `dueDate` (`timestamp`), `paidAt` (`timestamp`), `notes` (`text`), `createdById` (`integer`), `createdAt` (`timestamp`), `updatedAt` (`timestamp`).
- **Constat sur le Module Financier :**
  - Support multi-devises partiel : le champ `currency` stocke "GNF" ou "USD", mais la conversion automatique entre GNF et USD est absente du backend.
  - La procédure `finance.summary` calcule séparément `totalCA_GNF` et `totalCA_USD` sans taux de change de référence unifié (ex: 1 USD = 8 650 GNF).
  - Les débours douaniers (`disbursementsAmount`) sont stockés sous forme d'un montant agrégé, sans décomposition détaillée (Droits de douane Sydonia, Redevance portuaire PAC, Magasinage/Surestaries).
  - L'encaissement et la quittance de paiement : `paidAt` existe, mais il manque les champs de mode de paiement (`paymentMethod`: Virement, Chèque, Espèces), référence de transaction, et génération de quittance (`receiptNumber`).

### 1.3. Analyse des Procédures tRPC et Middleware RBAC (`server/routers.ts` & `server/_core/trpc.ts`)

| Routeur / Procédure | Type | Middleware Actuel | Rôles Autorisés Actuels | Gaps / Besoins RBAC & Métier |
|---|---|---|---|---|
| `auth.me` | Query | `publicProcedure` | Tous | Fonctionnel (renvoie l'utilisateur de session) |
| `auth.login` | Mutation | `publicProcedure` | Tous | Permet la simulation instantanée de rôle (`role`, `name`, `clientCompany`) |
| `auth.logout` | Mutation | `publicProcedure` | Tous | Supprime le cookie `app_session_id` |
| `reference.list` | Query | `protectedProcedure` | Authentifié | Fonctionnel |
| `reference.create` | Mutation | `adminProcedure` | `admin` uniquement | Fonctionnel |
| `dossier.list` | Query | `protectedProcedure` | Authentifié | Filtre déjà `currentUserCompany` pour le rôle `client` et `responsible` pour `myDossiersOnly` |
| `dossier.get` | Query | `protectedProcedure` | Authentifié | Devrait restreindre l'accès client à sa propre société |
| `dossier.create` | Mutation | `protectedProcedure` | Authentifié | Devrait interdire la création par le profil `client` |
| `dossier.update` | Mutation | `protectedProcedure` | Authentifié | Devrait interdire l'édition financière par `declarant` et douanière par `comptable` |
| `dossier.remove` | Mutation | `adminProcedure` | `admin` uniquement | Fonctionnel |
| `dossier.importBatch` | Mutation | `protectedProcedure` | Authentifié | Réservé à `admin`, `manager`, `declarant` |
| `portal.track` | Query | `publicProcedure` | Public | Fonctionnel pour recherche par BL / Code `IGS-XXXX` |
| `document.list` / `upload` / `remove` | Mix | `protectedProcedure` | Authentifié | Traçabilité automatique dans `dossier_status_history` active |
| `finance.listInvoices` | Query | `protectedProcedure` | Authentifié | **CRITIQUE :** Accessible à `declarant` alors que R2 exige "hide finances" |
| `finance.createInvoice` | Mutation | `protectedProcedure` | Authentifié | Devrait être restreint à `admin`, `comptable`, `manager` |
| `finance.summary` | Query | `protectedProcedure` | Authentifié | **CRITIQUE :** Devrait être bloqué pour `declarant` et `client` |
| `task.list` | Query | `protectedProcedure` | Authentifié | Manque le filtrage par `assignedTo` ou rôle courant |
| `task.create` | Mutation | `protectedProcedure` | Authentifié | Fonctionnel |
| `task.updateStatus` | Mutation | `protectedProcedure` | Authentifié | Fonctionnel (met à jour `status` et `completedAt`) |

### 1.4. Résultats des Commandes de Test & Build
- `npm test` : Exécuté avec succès (`5 passed, 10 tests passed`).
- `npm run check` (`tsc --noEmit`) : Exécuté avec code 0 (zéro erreur TypeScript).
- `npm run build` : Échec lors du bundling Vite dû à une anomalie de syntaxe dans `client/src/pages/FinancesPage.tsx:140` (crochet de fermeture JSX manquant au-dessus d'une déclaration d'état).

---

## 2. Logic Chain

1. **R1 (Global State & RBAC) :**
   - *Observation :* Le simulateur de rôles s'appuie sur `auth.login` qui régénère un token JWT contenant le `openId` du profil simulé (`admin`, `declarant`, `comptable`, `client`).
   - *Raisonnement :* Pour que le RBAC soit 100 % cohérent de bout en bout, le backend tRPC doit disposer de middlewares de rôle dédiés (`adminProcedure`, `declarantProcedure`, `comptableProcedure`, `internalProcedure`) qui rejettent avec `TRPCError({ code: "FORBIDDEN" })` toute tentative d'un rôle d'exécuter une procédure hors de son périmètre métier.

2. **R2 (Déclarant PAC — Mamadou Diallo) :**
   - *Observation :* Les dossiers comportent les identifiants SYDONIA (`declarationNumber`), BLD (`bulletinNumber`), BL (`blLtaNumber`), mais `finance.listInvoices` et `finance.summary` sont actuellement accessibles sans restriction de rôle.
   - *Observation :* Les tâches assignées existent dans la base (`dossier_tasks`), mais la procédure `task.list` renvoie toutes les tâches sans distinction de déclarant, et `PlanningPage.tsx` contenait un appel à une mutation non instanciée.
   - *Raisonnement :* Il faut :
     1. Ajouter dans `task.list` un filtre optionnel `assignedTo` / `role` pour que Mamadou Diallo reçoive immédiatement sa liste de tâches opérationnelles (DDI, SYDONIA, inspection PAC).
     2. Créer une procédure `dossier.updateCustoms` ou sécuriser `dossier.update` pour permettre au déclarant de mettre à jour les identifiants douaniers, valider les étapes de transit (BAD, BAE) et ajouter des pièces jointes scannées.
     3. Restreindre l'accès aux données financières (`finance.*`) aux rôles comptable et admin uniquement.

3. **R3 (Comptable — Fatoumata Camara) :**
   - *Observation :* La table `invoices` supporte les montants HT, TVA, TTC, les débours et la marge, avec les devises "GNF" et "USD", mais ne stocke pas de taux de change fixe et ne gère pas les conversions consolidées.
   - *Observation :* Les procédures existantes permettent de créer une facture (`finance.createInvoice`) et de lister (`finance.listInvoices`), mais il manque `finance.updateInvoice` (passage de Proforma à Définitive/Payée), `finance.recordPayment` (avec quittance), et `finance.setExchangeRate` / `finance.getExchangeRate`.
   - *Raisonnement :* Il faut enrichir le routeur `finance` avec :
     1. Gestion du taux de change GNF/USD (taux par défaut 8 650 GNF/USD, configurable par la comptabilité).
     2. Calculs consolidés multi-devises dans `finance.summary` (CA total exprimé à la fois en GNF et en contre-valeur USD).
     3. Procédures de cycle de vie de facture : émission proforma, conversion en facture définitive, enregistrement de paiement avec génération de numéro de quittance (`REC-YYYY-XXXX`).
     4. Décomposition claire des débours (Droits de douane, Redevance PAC, Magasinage/Surestaries).

4. **R4 (Portail Client & Expérience Simulateur) :**
   - *Observation :* Le portail client (`portal.track`) fonctionne par code d'accès (`IGS-XXXX`) ou par N° de BL (`blLtaNumber`).
   - *Raisonnement :* Pour un client authentifié via le simulateur (`role: "client"` avec `clientCompany: "Guinean Birimian Gold S.A"`), `dossier.list` applique déjà un filtre strict sur sa société. Il convient de s'assurer que les notes internes, les marges financières et les dossiers des autres clients ne sont jamais exposés.

---

## 3. Caveats

1. **Persistance Double (Drizzle Postgres vs Mémoire) :** L'application fonctionne avec PostgreSQL quand `DATABASE_URL` est fournie, mais bascule en mémoire locale si la base est absente. Toutes les nouvelles fonctions et mutations ajoutées dans `server/db.ts` doivent impérativement maintenir la synchronisation des deux modes.
2. **Tests Frontend lors du Survey :** L'anomalie de syntaxe dans `FinancesPage.tsx` a été identifiée lors du `npm run build` et doit être corrigée par l'implémenteur lors de la phase d'exécution.
3. **Aucune modification de code de production :** Conformément au protocole de la phase Survey, aucune modification directe des fichiers de code n'a été effectuée.

---

## 4. Conclusion & Recommandations d'Implémentation

### 4.1. Fichiers Backend à Modifier / Créer

1. **`server/_core/trpc.ts` :**
   - Ajouter les middlewares de contrôle de rôle :
     - `declarantProcedure` : autorisé pour `admin`, `manager`, `declarant`.
     - `comptableProcedure` : autorisé pour `admin`, `manager`, `comptable`.
     - `internalProcedure` : autorisé pour tous sauf `client`.

2. **`drizzle/schema.ts` :**
   - Ajouter dans la table `invoices` :
     - `invoiceType` (`enum: "Proforma", "Definitive"`, défaut "Proforma").
     - `exchangeRate` (`integer`, défaut 8650).
     - `paymentMethod` (`varchar(64)` : "Virement", "Chèque", "Espèces", "Mobile Money").
     - `paymentReference` (`varchar(120)`).
     - `receiptNumber` (`varchar(64)`).
     - `customsDutiesAmount` (`integer`, droits de douane débours).
     - `portFeesAmount` (`integer`, redevance PAC débours).
   - Ajouter dans la table `dossiers` (optionnel ou via métadonnées/historique) :
     - `ddiGucegNumber` (`varchar(160)`).
     - `badStatus` (`varchar(64)` : "En attente", "Obtenu").
     - `baeStatus` (`varchar(64)` : "En attente", "Accordé").

3. **`server/db.ts` :**
   - Étendre `listTasks` avec le support du filtre `{ assignedTo?: string; status?: string }`.
   - Ajouter `updateInvoice(id, data)` pour la mise à jour des montants, du statut et du type de facture.
   - Ajouter `recordInvoicePayment(id, paymentData)` avec calcul de la date de paiement, génération de quittance et mise à jour automatique du `financialStatus` du dossier associé.
   - Ajouter la gestion du taux de change GNF/USD dans les référentiels (`getExchangeRate`, `setExchangeRate`).
   - Mettre à jour `_memoryTasks` et `_memoryInvoices` pour refléter les données de test enrichies.

4. **`server/routers.ts` :**
   - Sécuriser les routeurs `finance`, `dossier`, `task` avec les middlewares appropriés.
   - Enrichir `finance` avec :
     - `updateInvoice` (mutation sécurisée comptable/admin).
     - `recordPayment` (mutation sécurisée comptable/admin avec génération de reçu).
     - `getExchangeRate` & `setExchangeRate` (gestion dynamique du cours GNF/USD).
     - `summary` (calculs consolidés bidevises GNF et USD).
   - Enrichir `task` avec :
     - `list` (filtrage par `assignedTo` pour affichage dynamique sur les vues Déclarant et Comptable).
     - `toggle` (mutation rapide pour cocher/décocher une tâche).
   - Enrichir `dossier` avec :
     - `updateCustoms` (mise à jour rapide des identifiants BL, Sydonia, DDI, BLD et validation BAD/BAE avec audit trail).

5. **`server/routers.integration.test.ts` :**
   - Ajouter des tests d'intégration unitaires pour :
     - Le filtrage des tâches par profil déclarant / comptable.
     - L'émission et le paiement d'une facture multi-devises GNF/USD.
     - La validation des permissions RBAC (rejet 403 Forbidden sur `finance` pour un profil `declarant` ou `client`).

---

## 5. Verification Method

Pour vérifier indépendamment les observations et valider la future implémentation :

1. **Vérification des Tests Unitaires & Intégration :**
   ```bash
   npm test
   ```
   *Résultat attendu :* 100 % des tests passent (vitest).

2. **Vérification des Types TypeScript :**
   ```bash
   npm run check
   ```
   *Résultat attendu :* `tsc --noEmit` se termine sans aucune erreur.

3. **Vérification du Build Complet :**
   ```bash
   npm run build
   ```
   *Résultat attendu :* Bundle Vite client + bundle esbuild serveur compilés avec succès dans `dist/`.

4. **Fichiers Clés à Inspecter :**
   - `server/routers.ts` : Définition des procédures tRPC et contrôles de permissions.
   - `server/db.ts` : Fonctions d'accès DB et mémoire persistée.
   - `drizzle/schema.ts` : Schéma Drizzle PostgreSQL.
   - `server/_core/trpc.ts` : Middlewares de contexte et de rôles.
