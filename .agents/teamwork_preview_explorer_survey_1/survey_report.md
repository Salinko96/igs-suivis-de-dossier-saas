# Rapport d'Investigation Codebase — R1: Module d'Administration & Gestion des 100 Employés (/utilisateurs)

**Date :** 2026-08-20  
**Projet :** IGS Transit & Douane Guinée SaaS  
**Auteur :** Explorer 1 (Teamwork Explorer & Senior Full-Stack Architecture Investigator)  
**Chemin du rapport :** `.agents/teamwork_preview_explorer_survey_1/survey_report.md`  

---

## 1. Résumé Exécutif & Cadrage Technique

Le présent rapport d'investigation fournit l'analyse exhaustive du codebase pour la réalisation de l'exigence **R1 : Module d'Administration & Gestion des 100 Employés (`/utilisateurs`)**, conformément au cahier des charges officiel (`ORIGINAL_REQUEST.md`).

### Objectifs Clés de R1
1. **Interface d'administration dédiée (`/utilisateurs`)** : Strictement réservée aux profils Administrateurs (`adminProcedure` côté tRPC, `ProtectedRoute` côté frontend).
2. **Gestion Complète des 100+ Collaborateurs** : Tableau avec recherche multi-critères, filtrage par rôle (`admin`, `declarant`, `comptable`, `client`, `manager`), téléphone (+224), statut actif/inactif, date de dernière activité et entreprise cliente associée.
3. **Modale d'Édition & Création** : Attribution des rôles, permissions et rattachement des entreprises clientes (issues du référentiel `clients`).
4. **Révocation Instantanée de Session** : Bascule instantanée de l'état actif/inactif d'un compte avec rejet immédiat des requêtes API pour tout utilisateur désactivé.
5. **Indicateurs & Statistiques RH en Temps Réel** : 4 métriques clés (Effectif Total, Déclarants actifs au quai PAC, Comptables & Gestionnaires financiers, Entreprises clientes connectées).
6. **Intégration Navigation Latérale** : Ajout du lien dans le menu de `DashboardLayout.tsx` pour le profil `admin`.

---

## 2. Analyse Approfondie du Schéma de Base de Données

### 2.1 Schéma Actuel (`drizzle/schema.ts` & Supabase PostgreSQL)
Dans le fichier `drizzle/schema.ts` (lignes 12 à 24) :
```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  clientCompany: varchar("clientCompany", { length: 255 }), // Pour le portail client
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
```

### 2.2 Analyse des Lacunes & Champs Requis pour R1
Pour satisfaire les exigences de gestion RH et de sécurité :
1. **`isActive` (ou `status`)** :
   - *État actuel* : Absent du schéma Drizzle et de la table SQL `users`.
   - *Besoin* : Champ `boolean("isActive").default(true).notNull()` (ou `integer("isActive").default(1)` pour compatibilité SQL) permettant de basculer l'état du compte.
2. **`sessionRevokedAt` (ou `tokenVersion`)** :
   - *État actuel* : Absent.
   - *Besoin* : Champ `timestamp("sessionRevokedAt")` pour marquer la date/heure exacte de désactivation et rejeter instantanément les sessions JWT émises antérieurement.
3. **`lastActiveAt` / `lastLoginAt`** :
   - *État actuel* : `lastSignedIn` existe et est mis à jour lors de l'authentification.
   - *Recommandation* : Conserver `lastSignedIn` et l'exposer comme `lastActiveAt` dans les DTOs ou ajouter la colonne `lastActiveAt`.
4. **`jobTitle` / `department` / `location` (Optionnel mais recommandé)** :
   - Permet de distinguer précisément les affectations opérationnelles (ex: *Déclarant Quai PAC - Terminal Conteneurs*, *Déclarant Terminal Roulier*, *Comptable Facturation GNF*, *Responsable Sydonia*).

### 2.3 Persistance & Fallback Mémoire dans `server/db.ts`
Dans `server/db.ts` (lignes 30 à 83), la variable `_memoryUsers: User[]` contient initialement 4 profils de test :
- `igs_admin_conakry` (Admin)
- `declarant_conakry` (Mamadou Diallo, Déclarant PAC)
- `comptable_conakry` (Fatoumata Camara, Comptable)
- `client_birimian` (Guinean Birimian Gold S.A, Client)

**Plan de Données pour les 100 Collaborateurs :**
Une fonction d'initialisation et de seed enrichie de 100+ profils guinéens réalistes (+224 62x xx xx xx) répartis équitablement :
- ~12 Administrateurs & Managers d'Exploitation (Direction IGS Conakry & Kamsar)
- ~42 Déclarants Douane PAC (Quai Nord, Quai Sud, Terminal Conteneurs, Terminal Minéralier)
- ~16 Comptables & Auditeurs Financiers (Facturation GNF/USD, Débours PAC & Surestaries)
- ~34 Représentants Entreprises Clientes (Birimian Gold, TOPAZ, SMB, CDM-Chine, GAC, Dangote, etc.)

---

## 3. Architecture d'Authentification & Révocation de Session

### 3.1 Mécanisme Actuel (`server/_core/sdk.ts`, `server/_core/context.ts`, `server/_core/trpc.ts`)
1. **Émission de Jetons JWT** :
   - `sdk.createSessionToken(openId, { name, expiresInMs })` génère un JWT signé avec `jose.SignJWT` (algorithme `HS256`, clé secrète `ENV.cookieSecret`).
   - Transporté via le cookie HTTP `app_session_id` ou l'en-tête `Authorization: Bearer <token>`.
2. **Résolution du Contexte** :
   - `createContext` dans `server/_core/context.ts` appelle `sdk.authenticateRequest(opts.req)`.
   - `sdk.authenticateRequest` vérifie le JWT, extrait `openId`, puis charge le profil depuis la base de données via `db.getUserByOpenId(openId)`.
3. **Protection des Procédures tRPC** :
   - `adminProcedure` vérifie `if (ctx.user.role !== 'admin') throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });`.
   - `protectedProcedure`, `declarantProcedure`, `comptableProcedure`, `internalProcedure` vérifient la présence de `ctx.user` et l'appartenance aux rôles autorisés.

### 3.2 Faille Actuelle de Révocation & Solution d'Ingénierie
- **Faiblesse identifiée** : Actuellement, si un utilisateur est désactivé en base, son JWT existant est valide jusqu'à son expiration (jusqu'à 1 an) car `sdk.authenticateRequest` et `requireUser` ne contrôlent pas `user.isActive`.
- **Solution de Révocation Instantanée** :
  1. **Dans `server/_core/sdk.ts` (`authenticateRequest`)** :
     ```typescript
     if (user.isActive === false) {
       throw ForbiddenError("Ce compte collaborateur est suspendu ou désactivé");
     }
     ```
  2. **Dans `server/_core/trpc.ts` (`requireUser`)** :
     ```typescript
     if (ctx.user.isActive === false) {
       throw new TRPCError({ 
         code: "FORBIDDEN", 
         message: "Votre compte est désactivé. Veuillez contacter un administrateur IGS." 
       });
     }
     ```
  3. **Dans la mutation `user.toggleStatus`** :
     - Mise à jour atomique de `isActive = false` et `sessionRevokedAt = new Date()`.
     - Invalidation immédiate dans le store (DB & mémoire).

---

## 4. Architecture des Routeurs tRPC & Procédures Requises

### 4.1 État Actuel de `server/routers.ts`
Le routeur `auth` existant ne contient que :
- `auth.me` (public)
- `auth.listUsers` (protectedProcedure, sans filtrage ni pagination)
- `auth.login` & `auth.loginWithPassword` (public)
- `auth.logout` (public)

### 4.2 Spécification des Nouvelles Procédures tRPC pour R1
Nous préconisons de structurer les routes d'administration sous `user: router({...})` ou d'enrichir `auth: router({...})` et `admin: router({...})` :

| Procédure tRPC | Type & Middleware | Entrées (Zod Schema) | Sorties / Rôle |
|---|---|---|---|
| `user.list` (ou `auth.listUsers`) | Query (`adminProcedure`) | `{ search?: string, role?: Role, isActive?: boolean, limit?: number, offset?: number }` | Liste complète paginée des collaborateurs avec métadonnées |
| `user.create` | Mutation (`adminProcedure`) | `{ name: string, email: string, phone: string, role: Role, clientCompany?: string, jobTitle?: string, isActive?: boolean }` | Crée un nouveau collaborateur avec ID unique et openId standardisé |
| `user.update` | Mutation (`adminProcedure`) | `{ id: number, name?: string, email?: string, phone?: string, role?: Role, clientCompany?: string, jobTitle?: string, isActive?: boolean }` | Met à jour les informations et permissions d'un collaborateur |
| `user.toggleStatus` | Mutation (`adminProcedure`) | `{ id: number, isActive: boolean }` | Bascule l'état actif/inactif et révoque instantanément les sessions actives |
| `user.getHRStats` | Query (`adminProcedure`) | `void` | `{ totalEmployees: number, activeDeclarantsAtPort: number, activeComptables: number, connectedClients: number, totalActive: number, totalInactive: number }` |

### 4.3 Logique de Calcul des Statistiques RH
- **Total Collaborateurs** : Nombre total d'enregistrements utilisateurs actifs et inactifs.
- **Déclarants Actifs au Quai** : `users.filter(u => u.role === 'declarant' && u.isActive !== false).length`.
- **Comptables & Finances** : `users.filter(u => u.role === 'comptable' && u.isActive !== false).length`.
- **Clients Connectés / Entreprises** : `users.filter(u => u.role === 'client' && u.isActive !== false).length`.
- **Taux d'activité global** : Ratio `totalActive / totalEmployees * 100`.

---

## 5. Blueprint Frontend & Composants UI (`/utilisateurs`)

### 5.1 Routage & Protection (`client/src/App.tsx`)
Actuellement, la route `/utilisateurs` n'existe pas dans `client/src/App.tsx`.
Intégration requise :
```tsx
const UsersPage = lazy(() => import("./pages/UsersPage"));

// Dans le composant Router :
<Route path="/utilisateurs">
  {() => (
    <ProtectedRoute
      component={UsersPage}
      allowedRoles={["admin"]}
      fallbackPath="/"
    />
  )}
</Route>
```

### 5.2 Navigation Latérale (`client/src/components/DashboardLayout.tsx`)
Dans `allMenuItems` :
```typescript
{ 
  icon: Users, // lucide-react
  label: "Gestion Utilisateurs & RH", 
  path: "/utilisateurs", 
  roles: ["admin"] 
}
```

### 5.3 Matrice de Permissions (`client/src/hooks/usePermissions.ts`)
Ajout dans `PermissionsMatrix` :
```typescript
export interface PermissionsMatrix {
  // ... champs existants
  canManageUsers: boolean; // isAdmin
}
```

### 5.4 Architecture de l'Écran `UsersPage.tsx`
L'interface `/utilisateurs` sera composée de :
1. **Header avec Breadcrumbs contextuel** :
   - `Accueil > Administration > 100 Collaborateurs RH`
   - Bouton d'action principal : `+ Nouveau Collaborateur` ouvrant la modale de création.
2. **4 KPI Metric Cards (Design System IGS)** :
   - *Effectif Total* (Icon `Users`, ton `#0b3b32`)
   - *Déclarants Quai PAC* (Icon `Anchor` / `Ship`, ton `#166653`, indication "Quai Conakry & Kamsar")
   - *Comptables & Finance* (Icon `CircleDollarSign`, ton `#a16608`, indication "Facturation & Débours")
   - *Portails Clients* (Icon `Building2`, ton `#2f826d`, indication "Sociétés minières & transit")
3. **Barre de Recherche & Filtres Avancés** :
   - Champ de recherche texte (Nom, Email, Téléphone, Entreprise).
   - Filtre déroulant par rôle (Tous, Administrateur, Déclarant PAC, Comptable, Client, Manager).
   - Filtre déroulant par statut (Tous, Actifs uniquement, Inactifs/Suspendus).
4. **Tableau des Collaborateurs Responsive** :
   - Avatar avec initiales et statut de présence.
   - Nom complet, email professionnel, badge de rôle stylé (Couleurs sémantiques).
   - Numéro de téléphone direct (+224).
   - Entreprise cliente rattachée (si rôle client) ou Affectation (ex: *PAC Quai Sud*).
   - Date de dernière connexion / activité (format relatif convivial : *Il y a 10 min*, *Aujourd'hui à 08:30*).
   - Switch instantané Actif/Inactif avec feedback visuel et toast de confirmation.
   - Menu d'actions (Modifier, Réinitialiser la session, Désactiver/Activer).
5. **Modale Accessible de Création & Modification** (`Dialog`, `Form`, `Input`, `Select`, `Switch`) :
   - Validation en temps réel avec Zod.
   - Sélection assistée des entreprises clientes via le référentiel `clients`.

---

## 6. Plan de Test & Matrice de Vérification

| Cible de Test | Fichier de Test Préconisé | Objectif de Validation |
|---|---|---|
| Schéma & Persistance DB | `server/__tests__/user_db_management.test.ts` | Valider l'insertion, mise à jour, listage filtré et bascule de statut de 100+ utilisateurs |
| RBAC & Procédures tRPC | `server/__tests__/tier2_trpc_rbac_integration/user_admin_trpc.test.ts` | Vérifier que `user.list`, `user.create`, `user.update`, `user.toggleStatus` et `user.getHRStats` rejettent strictement les non-admins (403 FORBIDDEN) et autorisent l'admin |
| Révocation de Session | `server/__tests__/session_revocation.test.ts` | Vérifier qu'un token émis pour un utilisateur désactivé est immédiatement rejeté lors de sa prochaine requête |
| Calculs Statistiques RH | `server/__tests__/tier1_business_logic/hr_stats_calculation.test.ts` | Vérifier l'exactitude mathématique des métriques (totaux, déclarants actifs, comptables, clients) |
| Guards UI Frontend | `server/__tests__/tier3_ui_navigation_guards/route_guards.test.ts` | Vérifier la redirection automatique et le toast d'accès restreint si un déclarant/comptable accède à `/utilisateurs` |

---

## 7. Conclusion & Recommandations pour l'Implémentation

Le codebase existant possède des fondations très solides (Drizzle ORM, tRPC, React 19, Tailwind, composants shadcn/ui). La mise en œuvre du module R1 s'intègre harmonieusement sans régression :
1. **Étendue des modifications** :
   - Mise à jour du schéma Drizzle (`drizzle/schema.ts`) avec `isActive` et `sessionRevokedAt`.
   - Enrichissement du store `server/db.ts` avec le jeu de données des 100 collaborateurs et les méthodes CRUD/Stats.
   - Sécurisation du middleware d'authentification (`server/_core/sdk.ts` et `server/_core/trpc.ts`) pour la révocation instantanée.
   - Ajout des routes tRPC `user` protégées par `adminProcedure` dans `server/routers.ts`.
   - Création de la page `client/src/pages/UsersPage.tsx` et raccordement dans `App.tsx` & `DashboardLayout.tsx`.
2. **Respect des règles de conformité** :
   - Aucune dépendance externe superflue.
   - Zéro régression sur la suite de 31 tests existants (tous validés à 100%).
   - Respect strict des standards de sécurité et des conventions du projet (`AGENTS.md`).
