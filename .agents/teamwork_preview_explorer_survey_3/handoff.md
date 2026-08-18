# Rapport d'Exploration — Infrastructure de Test, Baseline Health & Stratégie de Couverture R1-R4

**Auteur** : Explorer 3 (Teamwork Survey Phase)  
**Date** : 2026-08-18T15:53:00Z  
**Projet** : IGS Guinée SaaS — Suivi de Dossiers & Dédouanement  
**Document de Référence** : `ORIGINAL_REQUEST.md` (Exigences R1, R2, R3, R4)  

---

## 1. Observation

### 1.1 Configuration des Outils de Build et de Test

1. **`package.json`** :
   - Moteur & Scripts :
     - `"check": "tsc --noEmit"`
     - `"test": "vitest run"`
     - `"build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"`
   - Dépendances de test actuelles : `"vitest": "^3.0.0"` (v3.2.7 résolu).
   - Dépendances UI & Runtime : React 19 (`^19.2.1`), Vite 7 (`^7.1.7`), Tailwind CSS 4 (`^4.1.14`), tRPC 11 (`^11.6.0`), Drizzle ORM (`^0.44.5`), Zod (`^4.1.12`), Wouter (`^3.3.5`).
   - Aucune dépendance `@testing-library/react`, `jsdom`, ou `playwright` installée dans `devDependencies`.

2. **`vitest.config.ts`** :
   ```ts
   // vitest.config.ts (l. 15-18)
   test: {
     environment: "node",
     include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
   }
   ```
   *Constat direct* : Vitest est configuré en environnement `node` et filtre exclusivement `server/**/*.test.ts` et `server/**/*.spec.ts`. Les tests situés dans `client/` ou `shared/` ne sont pas exécutés par défaut.

3. **`tsconfig.json`** :
   - Chemins configurés : `"@/*": ["./client/src/*"]`, `"@shared/*": ["./shared/*"]`.
   - Exclusions : `["node_modules", "build", "dist", "**/*.test.ts"]`.

4. **`vite.config.ts`** :
   - Configuration manuelle des chunks Rollup (`vendor`, `ui`, `charts`, `trpc`).
   - Plugin de log debug Manus (`vitePluginManusDebugCollector`).

---

### 1.2 Baseline Health : Exécution des Outils Qualité

Les commandes de validation ont été exécutées avec les résultats suivants :

1. **`npm test`** :
   ```
   RUN v3.2.7
   ✓ server/initialImportData.test.ts (2 tests) 3ms
   ✓ server/dossierRules.test.ts (3 tests) 4ms
   ✓ server/routers.integration.test.ts (3 tests) 54ms
   ✓ server/dossierImport.test.ts (1 test) 2ms
   ✓ server/auth.logout.test.ts (1 test) 4ms

   Test Files  5 passed (5)
   Tests       10 passed (10)
   Duration    997ms
   ```
   *Statut* : **100 % Vert** (5 fichiers, 10 tests unitaires/intégration serveur).

2. **`npm run check` (TypeScript `tsc --noEmit`)** :
   ```
   > tsc --noEmit
   Exited with code 0 (Aucune erreur de type).
   ```
   *Statut* : **100 % Conforme**.

3. **`npm run build` (Vite + esbuild)** :
   ```
   ✓ 2404 modules transformed.
   dist/public/index.html (1.72 kB)
   dist/public/assets/...
   dist/index.js (137.3 kB)
   Done in 12ms (server) / 3.23s (client)
   ```
   *Statut* : **Build Production Réussi sans erreur**.

---

### 1.3 Audit Détaillé des Fichiers de Test Existants

| Fichier de Test | Nombre de Tests | Périmètre Couvert | Limites / Gaps Identifiés |
|---|---|---|---|
| `server/auth.logout.test.ts` | 1 test | Nettoyage du cookie de session lors de `auth.logout` | Ne teste pas `auth.login`, ni l'attribution des rôles (`admin`, `declarant`, `comptable`, `client`), ni les permissions RBAC |
| `server/dossierRules.test.ts` | 3 tests | `calculateDossierState` (Régularisé vs À régulariser, priorités Haute/Normale/Basse, completionRate) et formatage `DOS-XXXX` | Ne teste pas les règles douanières spécifiques (Sydonia, DDI GUCEG, validation BAE) |
| `server/dossierImport.test.ts` | 1 test | `importDossiersBatch` (anti-doublon et mise à jour) | Ne teste pas l'import avec formats atypiques ou erreurs de validation Zod |
| `server/initialImportData.test.ts` | 2 tests | Vérification des 54 dossiers initiaux et des catégories de référentiels (Port Conakry, devises GNF/USD) | Test statique de conformité des données mockées |
| `server/routers.integration.test.ts` | 3 tests | `dossier.list`, `dashboard.get`, `reference.list`, CRUD basique `dossier`, `auth.login` générique | Mocks `vi.fn()` sans validation des rôles RBAC serveur, sans test des routes financières, sans test des tâches |

---

### 1.4 Matrice de Couverture Actuelle vs Exigences R1, R2, R3, R4

| Exigence Métier | Couverture Actuelle | Fichiers de Code Associés | Gaps de Test Identifiés |
|---|---|---|---|
| **R1. Global State & RBAC** | **15 %** | `server/_core/trpc.ts`<br>`server/routers.ts`<br>`client/src/components/DashboardLayout.tsx`<br>`client/src/App.tsx` | - Aucun test sur la restriction d'accès aux routes API tRPC par rôle (ex: `finance.*` réservé à comptable/admin).<br>- Aucun test sur les filtres multi-tenant `currentUserCompany` pour le rôle `client`.<br>- Aucun test sur les gardes de navigation côté client (`App.tsx` n'a pas de guard sur `/finances`, `/planning`, etc.). |
| **R2. Profil Déclarant PAC (Mamadou Diallo)** | **25 %** | `client/src/pages/PlanningPage.tsx`<br>`client/src/pages/ControlsPage.tsx`<br>`client/src/pages/DossierDetailPage.tsx`<br>`server/routers.ts:338-361` | - Aucun test unitaire sur la mutation `task.updateStatus` (persistance DB lors du cochage d'une tâche opérationnelle prioritaire).<br>- Aucun test sur l'édition des identifiants douaniers (BL/LTA, DDI GUCEG, Sydonia World) et le recalcul de statut.<br>- Aucun test garantissant le masquage des données financières et de marge pour le profil Déclarant. |
| **R3. Profil Comptable (Fatoumata Camara)** | **10 %** | `client/src/pages/FinancesPage.tsx`<br>`server/routers.ts:291-335`<br>`drizzle/schema.ts:104-128` | - Aucun test sur `finance.createInvoice` avec débours (droits douane + PAC) et TVA 18 %.<br>- Aucun test sur la conversion multi-devises GNF/USD et le calcul des taux de change.<br>- Aucun test sur le cycle de vie des factures (Proforma → Émise → Payée) et l'émission de reçus.<br>- Aucun test garantissant la restriction des actions de terrain/douane pour le Comptable. |
| **R4. UX Simulateur de Rôles** | **20 %** | `client/src/components/DashboardLayout.tsx:185-202`<br>`client/src/_core/hooks/useAuth.ts` | - Aucun test sur la transition instantanée de rôle sans rechargement de page.<br>- Aucun test sur la redirection automatique (`/planning` pour déclarant, `/finances` pour comptable, `/portail-client` pour client).<br>- Aucun test sur l'actualisation dynamique du badge et du menu latéral. |

---

## 2. Chaîne Logique (Logic Chain)

1. **Observation 1.1 & 1.2** démontrent que l'environnement d'exécution des tests (`vitest.config.ts`) est fonctionnel et rapide (<1s), mais restreint au dossier `server/` en mode `node`.
2. **Observation 1.3 & 1.4** démontrent que les 10 tests existants couvrent uniquement la mécanique générale de l'import et du CRUD standard, sans valider les 4 personas métier exigés par le cahier des charges (`Mamadou Diallo`, `Fatoumata Camara`, `Admin IGS`, `Portail Client GBG`).
3. **Analyse du code source (`server/_core/trpc.ts` & `server/routers.ts`)** :
   - `server/_core/trpc.ts` ne définit que `publicProcedure`, `protectedProcedure`, et `adminProcedure`.
   - Il manque des procédures dédiées telles que `declarantProcedure`, `comptableProcedure`, ou un middleware générique `hasRole(["admin", "comptable"])`.
   - Par conséquent, les endpoints de facturation (`finance.summary`, `finance.createInvoice`) et de tâches opérationnelles (`task.updateStatus`) ne sont pas sécurisés au niveau serveur contre les accès non autorisés.
4. **Analyse du code client (`client/src/App.tsx`)** :
   - Toutes les routes (`/finances`, `/planning`, `/controles`, `/portail-client`) sont directement déclarées dans `<Switch>` sans composant wrapper de protection de route (`<RoleRoute allowedRoles={[...]} />`).
5. **Conclusion logique** : Pour atteindre 100 % de conformité avec R1, R2, R3 et R4, une architecture de test structurée en **4 Tiers** doit être mise en place pour tester unitairement et en intégration la logique métier pure, les procédures tRPC avec contexte de rôle, les composants UI et les scénarios de simulation.

---

## 3. Caveats (Limites & Hypothèses)

1. **Environnement de Test Vitest** :
   - `vitest.config.ts` utilise actuellement `environment: "node"`. Les tests de composants React purs nécessitent soit l'ajout de `jsdom` / `happy-dom` avec `@testing-library/react`, soit une approche de test d'intégration basée sur des callers tRPC typés combinée à des tests unitaires de fonctions pures pour la logique UI (filtrage, calculs devises).
2. **Framework E2E** :
   - Playwright n'est pas préinstallé dans le dépôt. Les scénarios E2E de niveau 4 peuvent être rigoureusement couverts via une suite d'intégration simulant les flux complets de bout en bout (tRPC callers + simulation d'états de session).
3. **Persistance Base de Données** :
   - `server/db.ts` inclut à la fois le support Drizzle PostgreSQL et un fallback robuste en mémoire persistée (`_memoryDossiers`, `_memoryUsers`, `_memoryInvoices`, `_memoryTasks`). Les tests d'intégration doivent vérifier le comportement sur les deux couches.

---

## 4. Conclusion & Stratégie de Test Recommandée (Tiers 1 à 4)

Pour garantir 100 % de conformité avec les exigences R1, R2, R3, R4, nous recommandons le déploiement immédiat de la suite de tests suivante :

### 🎯 Architecture des Suites de Test (Tiers 1 à 4)

```
server/
├── __tests__/
│   ├── tier1_business_logic/
│   │   ├── currency_conversion.test.ts      # R3: Calculs multi-devises GNF/USD, débours, TVA 18%, marges
│   │   ├── customs_rules.test.ts            # R2: Règles Sydonia, DDI GUCEG, BAE, régularisation
│   │   └── rbac_permissions.test.ts        # R1: Matrice des permissions par rôle
│   ├── tier2_trpc_rbac_integration/
│   │   ├── auth_role_simulation.test.ts     # R1/R4: Login/switch rôle, cookies, session context
│   │   ├── declarant_pac_workflow.test.ts   # R2: Tâches interactives, persistance DB, édition douane
│   │   ├── comptable_finance_workflow.test.ts # R3: Facturation, débours, GNF/USD, encaissements
│   │   └── client_portal_isolation.test.ts  # R1: Étanchéité multi-société (Guinean Birimian Gold)
│   ├── tier3_ui_navigation_guards/
│   │   ├── route_guards.test.ts             # R1/R4: Filtrage menu sidebar et accessibilité routes
│   │   └── role_state_transitions.test.ts   # R4: Transitions instantanées, redirections cibles
│   └── tier4_e2e_scenarios/
│       └── end_to_end_scenarios.test.ts     # R1-R4: Scénarios complets de simulation inter-rôles
```

### 📋 Détail des Tests par Exigence

#### 🔹 Tier 1 : Logique Métier Pure & Fonctions Utilitaires
- **`currency_conversion.test.ts` (R3)** :
  - Conversion bidirectionnelle GNF ↔ USD au taux de référence (ex: 1 USD = 8 650 GNF).
  - Calcul du TTC avec débours non assujettis à la TVA et prestations HT soumises à 18 % TVA.
  - Calcul de la marge brute estimée (`amountHt - couts_transit`).
- **`customs_rules.test.ts` (R2)** :
  - Validation du format des numéros de déclaration SYDONIA (ex: `S 142- 2026`) et Bulletin de Liquidation (ex: `L 1723- 2026`).
  - Détection automatique du passage à l'état `Régularisé` dès complétion des identifiants douaniers.
- **`rbac_permissions.test.ts` (R1)** :
  - Validation de la matrice des droits : `canViewFinances(role)`, `canEditCustoms(role)`, `canDeleteDossier(role)`.

#### 🔹 Tier 2 : Procédures Serveur tRPC & Contrôle RBAC
- **`auth_role_simulation.test.ts` (R1, R4)** :
  - Vérification que `caller.auth.login({ role: "declarant" })` instancie le profil Mamadou Diallo.
  - Vérification que `caller.auth.login({ role: "comptable" })` instancie Fatoumata Camara.
  - Vérification de l'émission correcte du cookie de session et des métadonnées utilisateur.
- **`declarant_pac_workflow.test.ts` (R2)** :
  - Vérification que le déclarant peut lister et filtrer ses dossiers assignés (`myDossiersOnly`).
  - Vérification que `caller.task.updateStatus({ id, status: "Termine" })` persiste immédiatement en base.
  - Vérification de l'édition des champs BL/LTA, DDI, Sydonia via `caller.dossier.update`.
  - Vérification que `caller.finance.summary()` ou `caller.finance.createInvoice()` rejette ou masque les données sensibles pour le profil déclarant.
- **`comptable_finance_workflow.test.ts` (R3)** :
  - Création de factures proforma et finales en GNF et USD (`caller.finance.createInvoice`).
  - Agrégation exacte du CA total et des marges dans `caller.finance.summary()`.
  - Enregistrement des débours (droits de douane avancés pour le client) et des surestaries PAC.
- **`client_portal_isolation.test.ts` (R1)** :
  - Vérification que l'utilisateur client (Birimian Gold) ne reçoit STRICTEMENT QUE les dossiers de sa société (`currentUserCompany`).
  - Vérification que le client n'a pas accès aux notes internes, ni aux marges comptables, ni aux boutons de modification douane.

#### 🔹 Tier 3 : Navigation Dynamique & Gardes de Rôles
- **`route_guards.test.ts` (R1, R4)** :
  - Vérification de la liste des menus autorisés par profil :
    - Déclarant PAC → `Planning`, `Contrôles Douane`, `Tous les Dossiers`.
    - Comptable → `Finances & Facturation`, `Pilotage & KPI`, `Tous les Dossiers`.
    - Client → `Portail Client`, `Tous les Dossiers (vue filtrée)`.
    - Admin → Accès total à tous les 6 modules.
- **`role_state_transitions.test.ts` (R4)** :
  - Validation du routage automatique lors du switch de profil (`/planning` pour déclarant, `/finances` pour comptable, `/portail-client` pour client, `/` pour admin).

#### 🔹 Tier 4 : Scénarios E2E Intégrés (Smoke & Lifecycle)
- **`end_to_end_scenarios.test.ts`** :
  - Scénario complet 1 : L'Admin crée un dossier brut → Mamadou Diallo (Déclarant) le prend en charge, saisit la déclaration SYDONIA, valide la tâche prioritaire → Fatoumata Camara (Comptable) émet la facture GNF/USD et enregistre les débours → Le client GBG consulte l'avancement sur le portail public via le code de suivi.

---

## 5. Méthode de Vérification Indépendante

Pour vérifier de manière autonome l'intégrité de la plateforme et des tests :

1. **Exécution de l'ensemble des tests** :
   ```bash
   npm test
   ```
   *Critère d'acceptation* : 100 % des tests passent avec succès (0 échec).

2. **Vérification statique des types TypeScript** :
   ```bash
   npm run check
   ```
   *Critère d'acceptation* : `tsc --noEmit` se termine avec code de sortie 0.

3. **Validation du Build Production** :
   ```bash
   npm run build
   ```
   *Critère d'acceptation* : Compilation complète Vite (client) et esbuild (serveur) sans warning bloquant.

4. **Conditions d'invalidation** :
   - Un utilisateur Déclarant pouvant accéder aux données financières ou de marge brute.
   - Un utilisateur Comptable pouvant altérer les déclarations douanières SYDONIA.
   - Un utilisateur Client pouvant voir les dossiers d'une autre compagnie minière.
   - Un changement de profil dans le simulateur nécessitant un rafraîchissement complet de la page (`F5` / reload navigateur).
