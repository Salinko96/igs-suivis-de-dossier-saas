# Handoff Report — Explorer 1: Survey & Investigation for R1

**Target Module :** R1: Module d'Administration & Gestion des 100 Employés (`/utilisateurs`)  
**Date :** 2026-08-20  
**Auteur :** Explorer 1 (Teamwork Explorer)  
**Chemin du rapport complet :** `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_1/survey_report.md`  

---

## 1. Observation

1. **Schéma de base de données (`drizzle/schema.ts:12-24`)** :
   - Table `users` définie avec les colonnes : `id` (serial PK), `openId` (varchar(64) unique), `name` (text), `email` (varchar(320)), `loginMethod` (varchar(64)), `role` (enum: `"user" | "declarant" | "comptable" | "manager" | "client" | "admin"`), `clientCompany` (varchar(255)), `phone` (varchar(32)), `createdAt`, `updatedAt`, `lastSignedIn`.
   - Les colonnes `isActive` (ou `status`) et `sessionRevokedAt` (pour la révocation de session) sont actuellement absentes.
   - La table `clients` (`drizzle/schema.ts:26-39`) existe avec `name`, `contactPerson`, `email`, `phone`, `taxId`, `address`.

2. **Persistance & Données en Mémoire (`server/db.ts:30-83`)** :
   - Le tableau `_memoryUsers: User[]` contient actuellement 4 utilisateurs de démonstration (`igs_admin_conakry`, `declarant_conakry`, `comptable_conakry`, `client_birimian`).
   - `server/db.ts` implémente `upsertUser`, `getUserByOpenId`, `listUsers`, mais aucune méthode `toggleUserStatus`, `updateUser`, `createUser` avec validation stricte, ni `getHRStats`.

3. **Authentification & Session JWT (`server/_core/sdk.ts:180-232, 258-320`)** :
   - Les jetons JWT sont générés via `jose.SignJWT` (HS256) avec durée par défaut de 1 an (`ONE_YEAR_MS`).
   - `sdk.authenticateRequest` vérifie le JWT et récupère `user = await db.getUserByOpenId(sessionUserId)`.
   - **Faille observée** : `sdk.authenticateRequest` ne vérifie pas `user.isActive`. Un utilisateur dont le compte est désactivé peut continuer à effectuer des requêtes tant que son cookie JWT est valide.

4. **Procédures tRPC (`server/_core/trpc.ts:30-49`, `server/routers.ts:177-278`)** :
   - `adminProcedure` est déjà implémenté et vérifie `if (ctx.user.role !== 'admin') throw FORBIDDEN`.
   - Le routeur `auth` ne dispose que de `me`, `listUsers` (actuellement `protectedProcedure`), `login`, `loginWithPassword`, `logout`.
   - Il n'existe pas encore de procédures dédiées `user.list` (adminProcedure filtrée), `user.create`, `user.update`, `user.toggleStatus`, `user.getHRStats`.

5. **Routage et Navigation Frontend (`client/src/App.tsx:30-97`, `client/src/components/DashboardLayout.tsx:35-43`)** :
   - Aucune route `/utilisateurs` n'existe dans `client/src/App.tsx`.
   - Le menu `allMenuItems` de `DashboardLayout.tsx` ne contient pas d'entrée pour la gestion des collaborateurs.
   - `ProtectedRoute.tsx` et `usePermissions.ts` fournissent déjà le mécanisme complet de contrôle d'accès basé sur les rôles et permissions.

6. **État de la suite de tests (`npm test`)** :
   - Commande exécutée : `npm test` -> 31 suites de tests, 311 tests passés avec succès (100% de réussite).

---

## 2. Logic Chain

1. **Besoin d'Administration RH & 100 Collaborateurs** :
   - L'exigence R1 requiert une gestion d'un effectif de 100 collaborateurs avec nom, email, téléphone (+224), rôle, entreprise cliente rattachée, statut actif/inactif et dernière activité.
   - *Déduction* : Le schéma `users` dans `drizzle/schema.ts` et le mock/store dans `server/db.ts` doivent être étendus avec `isActive: boolean` et `sessionRevokedAt: Date | null`, et alimentés avec un dataset riche de 100+ profils opérationnels guinéens.

2. **Révocation Instantanée de Session** :
   - Pour garantir qu'un compte désactivé ne puisse plus exécuter aucune action sensible :
   - *Déduction* : `sdk.authenticateRequest` (`server/_core/sdk.ts`) et `requireUser` (`server/_core/trpc.ts`) doivent lever une exception `FORBIDDEN` / `UNAUTHORIZED` dès que `user.isActive === false`. La mutation `toggleUserStatus` doit marquer `isActive = false` et enregistrer `sessionRevokedAt = new Date()`.

3. **Sécurisation Serveur tRPC** :
   - R1 stipule que toutes les routes de gestion RH doivent être strictement réservées aux administrateurs.
   - *Déduction* : Toutes les mutations/queries de gestion des employés (`user.list`, `user.create`, `user.update`, `user.toggleStatus`, `user.getHRStats`) doivent utiliser exclusivement `adminProcedure`.

4. **Interface Utilisateur Dédiée (`/utilisateurs`)** :
   - *Déduction* : Créer `client/src/pages/UsersPage.tsx` avec les 4 cartes KPI RH, la barre de recherche multi-critères, le tableau dynamique des 100 collaborateurs avec toggle d'état et la modale accessible de création/modification. Enregistrer la route dans `client/src/App.tsx` enveloppée par `<ProtectedRoute allowedRoles={["admin"]} />` et l'ajouter dans la barre latérale de `DashboardLayout.tsx`.

---

## 3. Caveats

- **Authentification Hybride (OAuth vs Direct/Password)** : Le système supporte à la fois le mode direct (simulateur de persona) et la connexion par mot de passe. Les 100 collaborateurs synthétiques doivent avoir des identifiants valides pour les deux modes.
- **Rattachement Entreprises Clientes** : Seuls les utilisateurs avec le rôle `client` doivent obligatoirement être rattachés à une entreprise cliente issue de la table `clients` (`Guinean Birimian Gold S.A`, `TOPAZ Multi-Industries`, etc.). Pour les rôles internes (`admin`, `declarant`, `comptable`), `clientCompany` doit rester null.
- **Préservation des tests existants** : L'ajout de `isActive: true` par défaut sur tous les comptes existants est impératif pour éviter toute régression sur les 311 tests existants.

---

## 4. Conclusion

L'investigation confirme la faisabilité immédiate et optimale de R1 sans risque de régression :
1. **Database** : Ajouter `isActive` et `sessionRevokedAt` dans `drizzle/schema.ts`, enrichir `server/db.ts` avec le dataset des 100 collaborateurs et les fonctions CRUD/Stats.
2. **Auth & Sécurité** : Bloquer les comptes inactifs dans `server/_core/sdk.ts` et `server/_core/trpc.ts`.
3. **API tRPC** : Exposer le sous-routeur `user` (ou enrichir `auth`) avec `list`, `create`, `update`, `toggleStatus`, `getHRStats` sous `adminProcedure`.
4. **Frontend** : Développer `client/src/pages/UsersPage.tsx`, déclarer `/utilisateurs` dans `App.tsx` et ajouter le lien Admin dans `DashboardLayout.tsx`.

---

## 5. Verification Method

Pour vérifier indépendamment les observations et constats du rapport :
1. **Inspection des fichiers sources** :
   - `view_file` sur `drizzle/schema.ts` (lignes 12 à 25).
   - `view_file` sur `server/_core/sdk.ts` (lignes 258 à 320).
   - `view_file` sur `server/_core/trpc.ts` (lignes 30 à 49).
   - `view_file` sur `client/src/App.tsx` (lignes 30 à 95).
2. **Exécution des tests du projet** :
   ```bash
   npm test
   ```
   Toutes les suites (31 fichiers, 311 tests) doivent être au statut vert.
3. **Lecture du rapport d'investigation détaillé** :
   Consulter `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_1/survey_report.md`.
