# Original User Request

## 2026-08-19T11:20:47Z

Corriger les 5 bugs critiques et optimisations prioritaires pour l'application SaaS IGS Transit & Douane Guinée (Portail Client, Système de notifications, UX Contrôles Douane, Performance de chargement des fiches dossiers, et Navigation Breadcrumb).

Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Integrity mode: development

## Requirements

### R1. Résolution du Bug Critique — Portail Client Externe (`/portail-client`)
- **Problème :** Lors de la recherche d'un code de dossier inexistant ou invalide (ex: `XXXX-9999`), la page reste bloquée indéfiniment sur le loader `"Recherche des informations maritimes et douanières..."`.
- **Solution :**
  - Gérer correctement l'état d'erreur et le statut `isError` / `isFetching` de la requête tRPC/React Query.
  - Afficher un message visuel clair, centré et stylé : *« Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez. »* avec suggestions d'exemples valides.
  - Annuler tout blocage infini du loader et réactiver immédiatement le champ de recherche.

### R2. Correction du Système de Notifications (Cloche Dashboard)
- **Problème :** Le bouton « Marquer lu » sur chaque notification ne met pas à jour l'état ni le badge de compteur d'alertes.
- **Solution :**
  - Assurer la mutation tRPC `notification.markAsRead` et `notification.markAllAsRead` avec mise à jour immédiate du cache TanStack Query (`invalidate` / `refetch`).
  - Mettre à jour en temps réel le compteur du badge rouge sur la cloche.
  - Griser ou masquer les alertes lues selon le filtre actif.

### R3. Amélioration UX du Tableau « Actions Prioritaires » (`/controles`)
- **Problème :** Le tableau des dossiers à régulariser déborde horizontalement et masque les boutons d'action (« Régulariser », « Fiche ») sans indication visuelle.
- **Solution :**
  - Ajouter un conteneur avec scrollbar horizontale fluide et visible, ou ombre de dégradé à droite.
  - Proposer un mode cartes empilées responsive (mobile/tablette) pour une lisibilité optimale sur petits écrans.

### R4. Optimisation des Performances de Chargement (`/dossiers/[id]`)
- **Problème :** L'ouverture d'une fiche dossier individuelle prend 5 à 8 secondes avec skeleton loader prolongé.
- **Solution :**
  - Identifier et supprimer tout délai artificiel (`setTimeout`, sleep de simulation, re-fetch redondant ou requête N+1).
  - Optimiser la résolution de la route dynamique `/dossiers/[id]` et le cache client pour un affichage quasi-instantané (< 300ms).

### R5. Cohérence de Navigation & Fil d'Ariane (Breadcrumb)
- **Solution :**
  - Intégrer un bouton de retour rapide et un fil d'Ariane contextuel standardisé (*ex: Accueil > Tous les Dossiers > Fiche DOS-0054*) sur toutes les sous-pages et écrans d'édition.

## Acceptance Criteria

### Portail Client & Recherche
- [ ] Une recherche avec un code inexistant (`XXXX-9999`) affiche immédiatement le message d'erreur sans loader bloqué.
- [ ] Une recherche avec un code valide (`IGS-1001`, `CKYSI26000340`, `HLCUNG12604AUQG1`) affiche immédiatement la timeline et les détails.

### Notifications
- [ ] Cliquer sur « Marquer lu » décrémente immédiatement le compteur et met à jour l'affichage de l'alerte.
- [ ] Cliquer sur « Tout marquer lu » réinitialise le badge à 0.

### UX Contrôles & Actions
- [ ] Tous les boutons d'action (« Régulariser », « Fiche ») sont immédiatement accessibles sur la page `/controles`.

### Performance Fiche Dossier
- [ ] La page `/dossiers/[id]` se charge en moins d'une seconde sans blocage inutile.

### Tests & Déploiement
- [ ] Tous les tests unitaires et d'intégration passent (`npm run test`).
- [ ] Build de production sans erreur (`npm run vercel-build`).

## 2026-08-20T12:57:04Z

# Teamwork Project Prompt — Enterprise 100% Ready

Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Integrity mode: development

## Requirements

### R1. Module d'Administration & Gestion des 100 Employés (`/utilisateurs`)
- Interface complète d'administration réservée aux administrateurs (`adminProcedure`) :
  - Tableau de tous les collaborateurs avec nom, email, téléphone, rôle (`admin`, `declarant`, `comptable`, `client`), date de dernière connexion et statut actif/inactif.
  - Modale de création et de modification d'un collaborateur (attribution des permissions et de l'entreprise cliente).
  - Possibilité de basculer instantanément l'état actif/inactif d'un compte avec révocation immédiate de session.
  - Statistiques RH en temps réel (nombre total d'employés, déclarants actifs au quai, comptables, clients connectés).
  - Intégration dans la barre de navigation latérale (`DashboardLayout.tsx`).

### R2. Détection des Conflits d'Édition Simultanée (Optimistic Locking)
- Sécuriser les fiches dossiers contre l'écrasement involontaire lorsque 2 collaborateurs travaillent sur le même dossier :
  - Vérification du timestamp `updatedAt` ou numéro de version lors de la mutation `dossier.update`.
  - En cas de conflit, affichage d'une modale non-bloquante avec aperçu des modifications concurrentes et option de fusionner ou recharger les données fraîches.

### R3. Journal d'Audit & Traçabilité Réglementaire (Audit Trail)
- Enregistrement automatique et infalsifiable de chaque action critique :
  - Modification d'un statut douanier (DDI, SYDONIA, Bulletin BLD, BAD, BAE, Sortie PAC).
  - Émission de facture, enregistrement d'encaissement et avance de débours.
  - Consultation de l'historique complet par dossier (`/dossiers/[id]`) avec date, heure, nom de l'agent et détail précis avant/après.

### R4. Mode Mobile & PWA Installable pour Agents sur le Quai (Port de Conakry)
- Transformation de l'application en Progressive Web App (PWA) installable sur Android/iOS :
  - `manifest.json` avec icônes IGS haute résolution, thème `#0b3b32` et mode standalone.
  - Service Worker et gestion du cache pour navigation fluide même en cas d'instabilité 3G/4G au port.
  - Bannière d'installation PWA et indicateur de statut réseau (En ligne / Hors-ligne).

## Acceptance Criteria

### Gestion des Utilisateurs
- [ ] La page `/utilisateurs` permet de créer, modifier et désactiver un employé en base Supabase.
- [ ] Les routes tRPC de gestion RH sont strictement protégées et inaccessibles aux non-admins.

### Concurrence & Conflits
- [ ] Une tentative de modification d'un dossier obsolète détecte le conflit et propose le rechargement sans perte de données.

### Audit & Traçabilité
- [ ] Chaque modification de statut ou opération financière génère une entrée d'audit consultable sur la fiche dossier.

### PWA & Expérience Mobile
- [ ] Le manifest PWA est valide et le bouton d'installation sur mobile/ordinateur fonctionne.

### Tests & Déploiement
- [ ] Tous les tests unitaires et d'intégration passent (`npm run test`).
- [ ] Build de production sans aucune erreur TypeScript (`npm run build`).

## 2026-08-22T13:01:01Z

Comprehensive audit and resilience hardening of the IGS Logistics Dossier SaaS application to eliminate all potential serverless function invocation timeouts, DB connection stalls, unhandled promise rejections, and performance bottlenecks across every feature (Dossiers, Customs, Port Autonome de Conakry, Finance & Invoicing, Audit Trail, Client Portal, Team Tasks, Notifications, and Users & RBAC).

Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Integrity mode: development

## Requirements

### R1. Full End-to-End Serverless & Database Resilience
Audit all tRPC routers (`server/routers.ts`), database access layers (`server/db.ts`), auth middlewares (`server/auth.ts`), and external integrations (cron jobs, Terminal49, PDF/Excel engines) to ensure 100% of asynchronous operations and DB queries are wrapped with fail-safe timeouts (`withDbTimeout`), graceful fallbacks, and non-blocking background workers.

### R2. Frontend Query & Mutation Stability
Audit all frontend pages and hooks (`client/src/pages/`, `client/src/hooks/`) to verify that all TanStack Query/tRPC queries and mutations handle errors gracefully, invalidate relevant caches properly, provide informative user feedback without infinite loading spinners, and implement retry/reconnection strategies.

### R3. Business Logic, Financial & Customs Rules Validation
Verify that all calculation engines (demurrage risks, customs regimes, PAC storage fees, VAT/GNF currencies, exchange rates, pro-forma and definitive invoices) execute deterministically with zero unhandled exceptions.

### R4. Automated Testing & Verification
Ensure comprehensive unit and integration test coverage across all routers, utilities, and components with 100% test pass rate (`npm test`), zero TypeScript compilation errors (`npm run check`), and clean production build (`npm run build`).

## Acceptance Criteria

### Serverless & Database Reliability
- [ ] Zero unhandled promises or blocking operations across all procedures in `server/routers.ts` and `server/db.ts`.
- [ ] Every database interaction executes within strict timeouts (<= 1500ms) with seamless in-memory fallback.
- [ ] Heavy batch tasks (syncAllStates, bulk import, demurrage scans) execute asynchronously or finish in under 500ms.

### Frontend & UI Stability
- [ ] All interactive actions (filters, exports, status toggles, deletions, edits) across all 8 modules execute with instant user feedback.
- [ ] No chunk loading failures or dynamic import breakages upon new deployments.

### Quality & Build Verification
- [ ] All Vitest test suites pass (`npm test`).
- [ ] TypeScript strict check passes with 0 errors (`npm run check`).
- [ ] Production build succeeds cleanly (`npm run build`).

