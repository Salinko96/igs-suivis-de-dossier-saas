# Rapport d'Investigation Exhaustif — Explorer 3
**Domaines :** R4 (PWA & Mode Hors-Ligne Quai Conakry), Navigation / Layout Frontend, et Infrastructure Test & Build  
**Date :** 2026-08-20  
**Projet :** IGS Transit & Douane Guinée SaaS  

---

## 1. Synthèse Exécutive

Ce rapport détaille l'état actuel et le plan d'ingénierie complet pour les exigences **R4 (PWA & Mode Hors-Ligne Quai Conakry)**, la **Navigation & Layout Frontend** (notamment l'intégration du module `/utilisateurs` R1 et du fil d'Ariane R5), ainsi que la validation de l'infrastructure de **Test & Build**.

### Résultats Clés :
1. **Layout & Navigation :**
   - L'architecture UI repose sur Shadcn UI (`SidebarProvider`, `Sidebar`, `SidebarMenu`) dans `client/src/components/DashboardLayout.tsx` (693 lignes), avec gestion dynamique du redimensionnement, du filtrage par rôles (`usePermissions.ts`) et de la synchronisation optimiste des alertes cloche.
   - L'intégration de la gestion des utilisateurs (`/utilisateurs`) nécessite : (a) l'ajout dans `allMenuItems` (`roles: ["admin"]`), (b) l'enregistrement de la route dans `client/src/App.tsx` protégée par `ProtectedRoute`, (c) l'ajout du flag de permission `canManageUsers` dans `client/src/hooks/usePermissions.ts`.
2. **PWA & Mode Hors-Ligne (Port de Conakry) :**
   - **Constat :** Aucun fichier `manifest.json`, aucun Service Worker (`sw.js`) ni aucune méta-balise PWA n'existent actuellement dans `client/index.html` ou `client/public/`.
   - **Stratégie :** Mise en place d'un `manifest.json` conforme (couleur thème `#0b3b32`, `display: standalone`), d'un Service Worker natif ultra-résilient (`client/public/sw.js`) gérant la mise en cache statique (Cache-First) et les requêtes tRPC dossiers (Network-First avec fallback Cache), d'un hook `useOnlineStatus`, d'un bandeau réseau dynamique (En ligne / Hors-ligne) et d'un composant de bannière d'installation PWA (`beforeinstallprompt`).
3. **Infrastructure Test & Build :**
   - `npm run check` (`tsc --noEmit`) : **0 erreur**.
   - `npm run test` (`vitest run`) : **31/31 fichiers de tests passés, 311/311 tests réussis en ~11.8s**.
   - `npm run build` : **Succès total** (génération de `dist/public`, `dist/index.js` et `api/index.mjs`).
   - **Découverte importante :** `vitest.config.ts` ciblait uniquement `server/**/*.test.ts`, excluant les tests frontend existants (`client/src/__tests__/challenger_fe_stress.test.ts` et `client/src/hooks/usePermissions.test.ts`).

---

## 2. Analyse Approfondie : Frontend Layout & Navigation

### 2.1 Structure du Sidebar (`client/src/components/DashboardLayout.tsx`)
- **Composant Conteneur :** `SidebarProvider` avec style dynamique `--sidebar-width` (min: 220px, max: 380px, défaut: 270px) persisté dans `localStorage.getItem("igs-sidebar-width")` (lignes 44-57).
- **Gestion des Rôles :**
  - Rôles supportés : `"admin" | "declarant" | "comptable" | "manager" | "client" | "user"`.
  - Filtrage des éléments du menu :
    ```typescript
    // DashboardLayout.tsx:181
    const userRole = perms.role;
    const visibleMenuItems = allMenuItems.filter(item => !item.roles || item.roles.includes(userRole));
    ```
- **Éléments de Menu Existants (`allMenuItems`, lignes 35-42) :**
  1. `Pilotage & KPI` (`/`) — Rôles : `admin`, `comptable`, `manager`
  2. `Tous les Dossiers` (`/dossiers`) — Rôles : `admin`, `declarant`, `comptable`, `manager`, `client`
  3. `Finances & Facturation` (`/finances`) — Rôles : `admin`, `comptable`, `manager`
  4. `Planning & Échéances` (`/planning`) — Rôles : `admin`, `declarant`, `manager`
  5. `Contrôles Douane & PAC` (`/controles`) — Rôles : `admin`, `declarant`, `manager`
  6. `Portail Client Externe` (`/portail-client`) — Rôles : `admin`, `client`

### 2.2 Plan d'Intégration du Module `/utilisateurs` (R1)
1. **Dans `DashboardLayout.tsx` :**
   - Importer l'icône `Users` ou `UsersRound` depuis `lucide-react`.
   - Ajouter l'entrée dans `allMenuItems` :
     ```typescript
     { icon: Users, label: "Gestion Collaborateurs", path: "/utilisateurs", roles: ["admin"] }
     ```
   - Ajouter le prefetch dans `handlePrefetch(path)` :
     ```typescript
     if (path === "/utilisateurs") {
       import("../pages/UsersPage");
       utils.user?.list?.prefetch?.();
     }
     ```
2. **Dans `client/src/hooks/usePermissions.ts` :**
   - Étendre `PermissionsMatrix` :
     ```typescript
     export interface PermissionsMatrix {
       // ... existants
       canManageUsers: boolean;
     }
     ```
   - Mettre à jour `resolvePermissions(role)` :
     ```typescript
     canManageUsers: isAdmin,
     ```
3. **Dans `client/src/App.tsx` :**
   - Ajouter le lazy import :
     ```typescript
     const UsersPage = lazy(() => import("./pages/UsersPage"));
     ```
   - Déclarer la route protégée :
     ```tsx
     <Route path="/utilisateurs">
       {() => (
         <ProtectedRoute
           component={UsersPage}
           allowedRoles={["admin"]}
         />
       )}
     </Route>
     ```

### 2.3 Fil d'Ariane & Navigation Rapide (`client/src/components/Breadcrumbs.tsx`)
- Composant réutilisable standardisé avec support du bouton retour (`showBackButton`), historique de navigation et affichage contextuel (`Home > Section > Sous-page / Fiche DOS-XXXX`).
- Déjà déployé sur :
  - `ControlsPage.tsx`
  - `DossierDetailPage.tsx`
  - `DossiersPage.tsx`
  - `FinancesPage.tsx`
  - `PlanningPage.tsx`

---

## 3. Analyse & Spécifications PWA & Mode Hors-Ligne Quai (R4)

### 3.1 Contexte Opérationnel au Port Autonome de Conakry (PAC)
Les déclarants et agents de transit opérant sur les terminaux à conteneurs (Bolloré / Conakry Terminal) font face à :
- Des zones d'ombre 3G/4G fréquentes entre les piles de conteneurs.
- Des micro-coupures réseau lors des inspections physiques ou contrôles SYDONIA.
- Le besoin impératif de consulter les numéros de conteneur, BL, DDI, statut BAE et contacts clients même sans signal.

### 3.2 Actifs Visuels & Icônes Disponibles (`client/public/`)
- `client/public/favicon.png` (131 KB)
- `client/public/igs-logo-icon.png` (89 KB) — Idéal pour icône 192x192
- `client/public/igs-logo-transparent.png` (131 KB) — Idéal pour icône 512x512
- `client/public/igs-logo-sidebar.png` (118 KB)

### 3.3 Spécification du `manifest.json` (`client/public/manifest.json`)
```json
{
  "name": "IGS Transit & Douane Guinée",
  "short_name": "IGS Dossiers",
  "description": "Plateforme logistique et suivi des dossiers de transit & dédouanement (Port de Conakry)",
  "start_url": "/",
  "id": "/",
  "display": "standalone",
  "background_color": "#0b2923",
  "theme_color": "#0b3b32",
  "orientation": "any",
  "icons": [
    {
      "src": "/igs-logo-icon.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/igs-logo-transparent.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/favicon.png",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/png"
    }
  ],
  "categories": ["business", "productivity", "logistics"],
  "screenshots": []
}
```

### 3.4 Configuration `client/index.html`
Balises à insérer dans `<head>` :
```html
<meta name="theme-color" content="#0b3b32" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="IGS Dossiers" />
<link rel="apple-touch-icon" href="/igs-logo-icon.png" />
<link rel="manifest" href="/manifest.json" />
```

### 3.5 Architecture du Service Worker (`client/public/sw.js`)
Stratégie hybride à 2 niveaux :
1. **Cache Statique (`igs-static-v1`) :**
   - Mise en cache préventive des assets principaux (`/`, `/index.html`, `/favicon.png`, `/igs-logo-icon.png`, `/igs-logo-transparent.png`, `/igs-logo-sidebar.png`, polices Google Fonts).
   - Stratégie *Cache-First* pour les images, polices, fichiers JS et CSS versionnés.
2. **Cache API & tRPC (`igs-api-v1`) :**
   - Stratégie *Network-First* avec Fallback sur Cache pour toutes les requêtes tRPC `GET` ou lecture (`/api/trpc/dossier.list`, `dossier.get`, `dashboard.get`, etc.).
   - Permet aux agents de terrain d'ouvrir immédiatement les fiches déjà consultées même en cas de perte subite du réseau au quai.
3. **Gestion du Cycle de Vie :**
   - `self.skipWaiting()` lors de l'installation.
   - `clients.claim()` lors de l'activation.
   - Purge automatique des anciens caches.

### 3.6 Hook de Détection Réseau `useOnlineStatus.ts`
```typescript
import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      const timer = setTimeout(() => setWasOffline(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
```

### 3.7 Composant Indicateur Réseau & Bannière d'Installation PWA
1. **Bandeau d'état réseau (`NetworkStatusBanner.tsx`) :**
   - Hors-Ligne : Bannière ambre/rouge en haut d'écran ou dans le header :
     *« ⚠️ Mode Hors-Ligne (Quai Conakry) — Consultation des données locales en cache. »*
   - Retour en ligne : Toast ou bandeau vert temporaire (4s) :
     *« ✅ Connexion rétablie — Synchronisation active avec le serveur. »*
2. **Bannière d'Installation PWA (`PWAInstallBanner.tsx`) :**
   - Écoute l'événement `window.beforeinstallprompt`.
   - Empêche le prompt natif immédiat et stocke l'événement (`deferredPrompt`).
   - Affiche un bouton élégant dans la barre latérale ou un toast d'invitation :
     *« 📲 Installer l'application IGS sur votre appareil mobile / bureau »*.
   - Déclenche `deferredPrompt.prompt()` au clic et masque la bannière une fois installée (`appinstalled`).

---

## 4. Analyse Infrastructure : Build & Test Setup

### 4.1 Scripts `package.json`
| Script | Commande | Description |
|---|---|---|
| `dev` | `NODE_ENV=development tsx watch server/_core/index.ts` | Serveur de développement avec rechargement à chaud |
| `build` | `vite build && esbuild server/vercel-entry.ts ... && esbuild server/_core/index.ts ...` | Build complet client + backend API + serveur bundle |
| `vercel-build` | `vite build && esbuild server/vercel-entry.ts ...` | Build optimisé pour l'environnement Serverless Vercel |
| `check` | `tsc --noEmit` | Validation stricte des types TypeScript |
| `test` | `vitest run` | Exécution de la suite de tests automatisés |
| `format` | `prettier --write .` | Formatage du code source |
| `db:push` | `drizzle-kit generate && drizzle-kit migrate` | Synchronisation du schéma Drizzle ORM |
| `db:seed` | `tsx server/seed.ts` | Injection des données de test |

### 4.2 Résultats des Vérifications Empiriques
1. **TypeScript (`npm run check`) :**
   - Résultat : **0 erreur**. Code TypeScript strictement typé.
2. **Build de Production (`npm run build`) :**
   - Résultat : **Succès en 5.28s**.
   - Fichiers générés :
     - Client statique dans `dist/public/` (avec manualChunks pour `pdf-engine`, `excel-engine`, `ui`, `trpc`).
     - Serverless entry dans `api/index.mjs` (183.6 KB).
     - Standalone server dans `dist/index.js` (191.4 KB).
3. **Suite de Tests Vitest (`npm run test`) :**
   - Résultat : **31/31 fichiers passés, 311/311 tests validés**.
   - Temps d'exécution : **11.82s**.
   - Couverture : RBAC, Douane PAC, SYDONIA, DDI GUCEG, Facturation multidevise GNF/USD, Débours, Alertes Proactives WhatsApp/Email, Performance routes dynamiques `/dossiers/[id]`, Isolation Portail Client.

### 4.3 Recommandation d'Amélioration pour `vitest.config.ts`
Actuellement, `vitest.config.ts` définit :
```typescript
test: {
  environment: "node",
  include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
}
```
Pour exécuter automatiquement les tests unitaires frontend (tels que `client/src/__tests__/challenger_fe_stress.test.ts` et `client/src/hooks/usePermissions.test.ts`), il est recommandé d'élargir la règle `include` :
```typescript
test: {
  environment: "node",
  include: [
    "server/**/*.test.ts", 
    "server/**/*.spec.ts",
    "client/src/**/*.test.ts",
    "client/src/**/*.test.tsx"
  ],
}
```

---

## 5. Matrice de Conformité aux Critères d'Acceptation R4 & Navigation

| Exigence | Élément | Statut Actuel | Actions d'Implémentation Prévues |
|---|---|---|---|
| **R1 / Nav** | Menu `/utilisateurs` | Non présent dans `DashboardLayout.tsx` | Ajouter l'entrée dans `allMenuItems` (`roles: ["admin"]`) et la route dans `App.tsx` |
| **R1 / Nav** | Route Guard `/utilisateurs` | Non configuré | Utiliser `<ProtectedRoute component={UsersPage} allowedRoles={["admin"]} />` |
| **R4 / PWA** | `manifest.json` | Absent | Créer `client/public/manifest.json` avec `#0b3b32` et `display: standalone` |
| **R4 / PWA** | Meta tags PWA | Absents | Injecter `manifest`, `theme-color`, `apple-touch-icon` dans `client/index.html` |
| **R4 / PWA** | Service Worker | Absent | Créer `client/public/sw.js` (Cache statique + tRPC fallback quai) et l'enregistrer dans `main.tsx` |
| **R4 / PWA** | Indicateur Réseau | Absent | Créer `useOnlineStatus.ts` et `NetworkStatusBanner.tsx` |
| **R4 / PWA** | Bannière Install | Absent | Créer `PWAInstallBanner.tsx` avec écouteur `beforeinstallprompt` |
| **Tests** | Exécution globale | 311 tests passés | Mettre à jour `vitest.config.ts` pour englober les tests frontend |
