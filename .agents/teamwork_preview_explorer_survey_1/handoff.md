# Rapport d'Exploration Frontend — Simulateur de Rôles & RBAC IGS Guinée SaaS

## 1. Observation

### 1.1 Architecture Globale & Routage (`client/src/App.tsx`)
- **Fichier** : `client/src/App.tsx` (lignes 28-44)
```tsx
function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dossiers" component={DossiersPage} />
        <Route path="/dossiers/nouveau" component={DossierDetailPage} />
        <Route path="/dossiers/:id" component={DossierDetailPage} />
        <Route path="/finances" component={FinancesPage} />
        <Route path="/planning" component={PlanningPage} />
        <Route path="/controles" component={ControlsPage} />
        <Route path="/portail-client" component={ClientPortalPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```
**Constat direct** : Toutes les routes sont déclarées de manière publique au niveau de Wouter sans wrapper de protection RBAC ni redirection conditionnelle en fonction de `user?.role`.

### 1.2 Barre Latérale & Sélecteur de Profil (`client/src/components/DashboardLayout.tsx`)
- **Menu de navigation statique** (lignes 35-42) :
```tsx
const menuItems = [
  { icon: LayoutDashboard, label: "Pilotage & KPI", path: "/" },
  { icon: FolderKanban, label: "Tous les Dossiers", path: "/dossiers" },
  { icon: CircleDollarSign, label: "Finances & Facturation", path: "/finances" },
  { icon: CalendarDays, label: "Planning & Échéances", path: "/planning" },
  { icon: ShieldAlert, label: "Contrôles Douane & PAC", path: "/controles" },
  { icon: Globe, label: "Portail Client Externe", path: "/portail-client" },
];
```
- **Sélecteur de Profil Simulateur** (lignes 278-297) :
```tsx
<DropdownMenuContent align="end" className="w-56">
  <DropdownMenuLabel className="text-xs font-semibold">Changer de rôle (Simulateur)</DropdownMenuLabel>
  <DropdownMenuItem onClick={() => switchRole("admin")} className="text-xs cursor-pointer">
    👑 Administrateur
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => switchRole("declarant")} className="text-xs cursor-pointer">
    📦 Déclarant PAC (Mamadou Diallo)
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => switchRole("comptable")} className="text-xs cursor-pointer">
    💰 Comptable (Fatoumata Camara)
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => switchRole("client")} className="text-xs cursor-pointer">
    🏢 Client (Guinean Birimian Gold)
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive text-xs">
    <LogOut className="mr-2 h-3.5 w-3.5" />
    Se déconnecter
  </DropdownMenuItem>
</DropdownMenuContent>
```
- **Gestion du switch** (lignes 178-180) :
```tsx
const switchRole = async (role: "admin" | "declarant" | "comptable" | "manager" | "client") => {
  await login({ role });
};
```
**Constat direct** :
- Les 6 éléments de menu sont affichés pour tous les profils sans aucun filtrage.
- Lors d'un changement de rôle via `switchRole`, aucune redirection automatique vers la page d'accueil du profil n'est déclenchée (l'utilisateur reste sur l'URL courante même si elle est interdite pour le nouveau profil).
- Le bouton "+ Nouveau Dossier" dans l'en-tête (lignes 365-371) est visible sans restriction.

### 1.3 Gestion d'État de l'Utilisateur Connecté (`client/src/_core/hooks/useAuth.ts`)
- **Fichier** : `client/src/_core/hooks/useAuth.ts` (lignes 15-27 et 62-88)
- Utilise `trpc.auth.me.useQuery()` et `trpc.auth.login.useMutation()`.
- Met en cache l'utilisateur dans `localStorage.getItem("manus-runtime-user-info")`.
- Invalide `utils.auth.me`, `utils.dossier.list`, `utils.dashboard.get` après login.
**Constat direct** : Il n'existe aucun hook unifié de permissions (ex: `usePermissions()`) fournissant les booléens de capacités (`canViewFinances`, `canEditCustoms`, `canDeleteDossier`, `canCreateInvoice`, `defaultRoute`).

### 1.4 Audit d'Exposition Financière & Fonctionnalités par Profil

#### Profil Déclarant PAC (Mamadou Diallo)
1. **Fuites d'informations financières constatées** :
   - Sidebar : Le lien "Finances & Facturation" (`/finances`) est cliquable.
   - Détail Dossier (`client/src/pages/DossierDetailPage.tsx`, lignes 564-566 et 753-839) : L'onglet `<TabsTrigger value="finances">` affiche le CA, les débours, le montant HT/TTC et la marge brute estimée.
   - Formulaire Dossier (`DossierDetailPage.tsx`, ligne 619) : Le champ `financialStatus` est modifiable.
2. **Fonctionnalités opérationnelles manquantes/incomplètes** :
   - Pas de modale d'édition rapide des identifiants douaniers (BL, Sydonia World, BLD, DDI GUCEG, BAE) depuis la liste `DossiersPage.tsx` ou `ControlsPage.tsx`.
   - La liste des tâches dans `PlanningPage.tsx` n'a pas de filtre "Mes tâches assignées (Mamadou Diallo)".

#### Profil Comptable (Fatoumata Camara)
1. **Exposition douane terrain constatée** :
   - Sidebar : Accès au menu "Contrôles Douane & PAC" (`/controles`).
   - Détail Dossier : Tous les champs techniques douaniers restent éditables sans focalisation sur les débours et la facturation.
2. **Module financier et multi-devises GNF / USD (`client/src/pages/FinancesPage.tsx`)** :
   - **Erreur de compilation TypeScript constatée** :
     `npx tsc --noEmit` renvoie : `error TS17008: JSX element 'DashboardLayout' has no corresponding closing tag`, etc.
   - **Cause directe** : Ligne 139 de `FinancesPage.tsx`, une version antérieure du composant a été tronquée et une seconde implémentation a été collée en plein milieu de `<DialogFooter>` (lignes 140 à 462).
   - Cette seconde implémentation contient un début prometteur de sélecteur GNF / USD (`displayCurrency`), de fonction `printInvoiceReceipt` et de tableau avec quittances/proformas, mais nécessite un nettoyage et une intégration rigoureuse.

#### Profil Portail Client (Guinean Birimian Gold)
1. `client/src/pages/ClientPortalPage.tsx` :
   - Page publique bien conçue avec recherche par code BL (`IGS-1001`, `HLCUNG12604AUQG1`) et téléchargement des documents publics.
   - Lorsque le simulateur bascule sur `role: "client"`, l'utilisateur ne doit pas être exposé aux menus internes de l'application SaaS.

---

## 2. Logic Chain

1. **Prémisse 1 (Routage et Navigation)** : Le routeur `App.tsx` et la barre latérale `DashboardLayout.tsx` affichent actuellement les mêmes vues à tous les utilisateurs sans distinction de rôle.
2. **Prémisse 2 (Exposition Financière)** : Un Déclarant PAC (Mamadou Diallo) peut accéder à `/finances` et à l'onglet "Facturation & Marges" de `DossierDetailPage.tsx`, ce qui viole l'exigence d'étanchéité financière R2.
3. **Prémisse 3 (Besoins Opérationnels Déclarant)** : Le travail sur le terrain nécessite de modifier rapidement les numéros SYDONIA, DDI et BLD sans recharger la page complète ou naviguer sur des formulaires lourds.
4. **Prémisse 4 (Besoins Comptable & Multi-Devises)** : La comptabilité exige un double affichage dynamique GNF / USD (taux paramétrable, par exemple 1 USD = 8 650 GNF), le suivi des débours douaniers/portuaires, et la génération de quittances/factures proforma imprimables.
5. **Prémisse 5 (Qualité du Code)** : `FinancesPage.tsx` contient un doublon de code à la ligne 139 qui empêche la compilation TypeScript (`tsc`).
6. **Conclusion Logique** : Pour atteindre 100 % d'opérabilité sur les profils :
   - Créer un système RBAC propre côté client (`usePermissions` + `ProtectedRoute`).
   - Filtrer dynamiquement la navigation et rediriger automatiquement au switch de profil.
   - Cloisonner strictement les onglets et colonnes (masquer la finance au déclarant, masquer les contrôles terrain au comptable).
   - Corriger et enrichir `FinancesPage.tsx` avec le switch GNF/USD et l'impression de quittance.
   - Créer une modale d'édition rapide des identifiants douaniers.

---

## 3. Caveats

- **Authentification simulée** : La simulation s'appuie sur `trpc.auth.login` qui crée/met à jour des utilisateurs fictifs (`igs_admin_conakry`, `declarant_conakry`, `comptable_conakry`, `client_birimian`). Aucun serveur OAuth externe n'est requis en mode local.
- **Stockage des documents** : Le téléversement actuel simule les fichiers via encodage Base64 `data:` URI dans la base de données.
- **Taux de change** : Le taux GNF/USD par défaut retenu est de 1 USD = 8 650 GNF (taux représentatif Marché/BCRG Conakry).

---

## 4. Conclusion & Plan d'Action Recommandé

### 4.1 Fichiers à Créer (3 fichiers)

| Fichier | Emplacement | Rôle & Contenu |
|---|---|---|
| `usePermissions.ts` | `client/src/hooks/usePermissions.ts` | Hook RBAC centralisé : retourne les capacités (`canViewFinances`, `canViewControls`, `canEditCustoms`, `canManageInvoices`, `canDeleteDossier`, `isDeclarant`, `isComptable`, `isAdmin`, `isClient`, `defaultRoute`). |
| `ProtectedRoute.tsx` | `client/src/components/ProtectedRoute.tsx` | Composant de protection de route pour Wouter : vérifie les permissions et redirige vers la route par défaut du rôle avec un avertissement si accès refusé. |
| `CustomsEditModal.tsx` | `client/src/components/CustomsEditModal.tsx` | Modale d'édition rapide des identifiants douaniers (BL, DDI GUCEG, Sydonia World, BLD, BAE, Statut Douane & Port) pour Déclarant PAC et Admin. |

### 4.2 Fichiers à Modifier (7 fichiers)

| Fichier | Emplacement | Modifications Requises |
|---|---|---|
| `App.tsx` | `client/src/App.tsx` | Envelopper les routes sensibles (`/finances`, `/controles`, etc.) avec `ProtectedRoute`. |
| `DashboardLayout.tsx` | `client/src/components/DashboardLayout.tsx` | - Filtrer `menuItems` selon `usePermissions`.</br>- Rediriger automatiquement l'utilisateur vers sa page d'accueil lors du changement de profil (`/planning` pour Déclarant, `/finances` pour Comptable, `/` pour Admin, `/portail-client` pour Client).</br>- Adapter les badges et masquer le bouton "Nouveau Dossier" pour les profils non autorisés. |
| `FinancesPage.tsx` | `client/src/pages/FinancesPage.tsx` | - Corriger le bogue de code dupliqué à la ligne 139.</br>- Activer le toggle multi-devises GNF / USD avec calcul dynamique.</br>- Ajouter le bouton et la vue d'impression de Quittance de paiement / Facture Proforma.</br>- Permettre de marquer une facture comme "Payée". |
| `DossierDetailPage.tsx` | `client/src/pages/DossierDetailPage.tsx` | - Masquer l'onglet "Facturation & Marges" si `!canViewFinances` (Déclarant PAC).</br>- Masquer ou désactiver la suppression/édition technique si Comptable.</br>- Adapter les valeurs par défaut des assignations de tâches. |
| `DossiersPage.tsx` | `client/src/pages/DossiersPage.tsx` | - Intégrer l'action d'édition rapide douanière (`CustomsEditModal`).</br>- Adapter les colonnes visibles selon le profil.</br>- Forcer le filtre société pour le profil `client`. |
| `PlanningPage.tsx` | `client/src/pages/PlanningPage.tsx` | - Ajouter un filtre de tâches "Mes tâches assignées (Mamadou Diallo)".</br>- Ajouter un bouton de création rapide de tâche directement sur le planning. |
| `ControlsPage.tsx` | `client/src/pages/ControlsPage.tsx` | - Permettre la régularisation instantanée des anomalies via ouverture du `CustomsEditModal`. |

---

## 5. Méthode de Vérification

### 5.1 Vérification de la Compilation et des Types
```bash
npx tsc --noEmit
```
- **Condition de succès** : 0 erreur TypeScript signalée.

### 5.2 Exécution des Tests Unitaires et d'Intégration
```bash
npm test
```
- **Condition de succès** : Tous les tests passent avec succès (`server/routers.integration.test.ts`, `server/dossierRules.test.ts`, `server/initialImportData.test.ts`, etc.).

### 5.3 Build de Production
```bash
npm run build
```
- **Condition de succès** : Build Vite + esbuild serveur terminé sans avertissement bloquant.

### 5.4 Matrice de Test Manuel des 4 Profils

1. **Déclarant PAC (Mamadou Diallo)** :
   - Changer vers "Déclarant PAC" : redirection automatique vers `/planning`.
   - La sidebar ne contient **pas** "Finances & Facturation".
   - Taper manuellement `/finances` dans l'URL : redirection immédiate vers `/planning`.
   - Ouvrir un dossier : l'onglet "Facturation & Marges" est **invisible**.
   - Ouvrir `CustomsEditModal` sur un dossier et modifier le N° Sydonia : mise à jour immédiate et persistance en base.
   - Cocher/décocher une tâche assignée à Mamadou Diallo : persistance immédiate de l'état.

2. **Comptable (Fatoumata Camara)** :
   - Changer vers "Comptable" : redirection automatique vers `/finances`.
   - La sidebar ne contient **pas** "Contrôles Douane & PAC".
   - Basculer le sélecteur de devise GNF ⇄ USD : tous les montants et KPIs s'ajustent instantanément avec le taux de conversion.
   - Cliquer sur "Quittance / Proforma" : ouverture du document officiel imprimable aux couleurs d'IGS.
   - Émettre une nouvelle facture avec débours douaniers séparés.

3. **Administrateur IGS** :
   - Accès complet à l'ensemble des 6 menus et de toutes les fonctionnalités de création, édition et suppression.

4. **Portail Client** :
   - Recherche d'un BL (`HLCUNG12604AUQG1` ou `IGS-1001`) : affichage fluide du statut, sans aucune fuite de marge ou de notes internes.
