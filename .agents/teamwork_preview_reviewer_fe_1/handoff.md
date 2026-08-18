# Rapport de Revue Indépendante & Handoff — Reviewer 1 (Frontend & Simulateur de Rôles)

## 1. Observation

### 1.1 Fichiers Examinés & Validés
1. **`client/src/hooks/usePermissions.ts`** :
   - Définit le modèle RBAC complet (`PermissionsMatrix`) pour les rôles `admin`, `declarant`, `comptable`, `client`, `manager`, `user`.
   - Expose les droits : `canViewFinances`, `canViewControls`, `canViewPlanning`, `canEditCustoms`, `canManageInvoices`, `canCreateDossier`, `canDeleteDossier`, `canViewAudit`, `canViewAllCompanies`, `canViewMargin`, `defaultRoute`, `roleBadge`.
   - Fournit `resolvePermissions(role)` et le hook réactif `usePermissions()`.

2. **`client/src/components/ProtectedRoute.tsx`** :
   - Enveloppe les routes sensibles avec vérification d'authentification (`useAuth`) et de permissions (`usePermissions`).
   - Bloque les accès non autorisés, notifie l'utilisateur via `toast.warning`, et le redirige instantanément vers `defaultRoute` ou `fallbackPath` sans rechargement de page.

3. **`client/src/App.tsx`** :
   - Configuration déclarative de l'ensemble des routes sous `ProtectedRoute` :
     - `/` : restreint à `["admin", "comptable", "manager"]`
     - `/dossiers/nouveau` : conditionné par `p.canCreateDossier`
     - `/finances` : conditionné par `p.canViewFinances`
     - `/planning` : conditionné par `p.canViewPlanning`
     - `/controles` : conditionné par `p.canViewControls`
     - `/portail-client` : vue dédiée au suivi public / client

4. **`client/src/components/DashboardLayout.tsx`** :
   - Filtrage dynamique des 6 éléments de menu selon `perms.role`.
   - Simulateur de rôles réactif : fonction `switchRole(role)` exécutant `login({ role, name })` puis redirection immédiate via `setLocation(targetPerms.defaultRoute)` sans rechargement complet.
   - Affichage dynamique du badge de rôle (`roleBadge`) et masquage conditionnel du bouton `+ Nouveau Dossier`.

5. **`client/src/components/CustomsEditModal.tsx`** :
   - Modale réactive d'édition des identifiants douaniers (`blLtaNumber`, `ddiGucegNumber`, `declarationNumber`, `bulletinNumber`, `finalDeclarationNumber`, `goodsReleaseDate`, `badStatus`, `baeStatus`, `customsStatus`, `portStatus`).
   - Persistance via `trpc.dossier.updateCustoms` avec invalidation immédiate des caches TanStack Query (`dossier.list`, `dossier.get`, `dashboard.get`, `task.list`, `notification.list`).

6. **`client/src/pages/PlanningPage.tsx`** :
   - Timeline chronologique des arrivées navires (ETA) avec calcul dynamique des jours restants/retard.
   - Check-list opérationnelle interactive avec bascule de statut (`trpc.task.toggleStatus`), persistance de l'état terminé et horodatage.
   - Filtres par opérateur assigné (Mamadou Diallo, Fatoumata Camara, Alpha Barry, Tous) et par statut.
   - Modale de création de tâche (`trpc.task.create`).

7. **`client/src/pages/ControlsPage.tsx`** :
   - Tableau des anomalies prioritaires (doublons BL, déclarations manquantes, sorties PAC non saisies).
   - Intégration du bouton direct "Régulariser" déclenchant `CustomsEditModal`.

8. **`client/src/pages/DossierDetailPage.tsx`** :
   - Masquage conditionnel strict de l'onglet `<TabsTrigger value="finances">` pour les profils `declarant` et `client`.
   - Bouton d'action rapide "Édition Rapide Douane" réservé à `canEditCustoms`.
   - Restriction du bouton de suppression réservé exclusivement à l'Admin (`canDeleteDossier`).

9. **`client/src/pages/FinancesPage.tsx`** :
   - Sélecteur de devise interactif GNF ⇄ USD ($) avec recalcul dynamique en temps réel.
   - Modale de paramétrage du taux de change officiel (`trpc.finance.setExchangeRate`).
   - Modale d'émission de facture avec décomposition claire : honoraires HT, TVA 18%, et débours exonérés (Droits de douane Trésor, Frais portuaires PAC, Magasinage & surestaries).
   - Enregistrement des paiements avec attribution d'une référence quittance `REC-2026-X`.
   - Prévisualisation et impression haute fidélité d'une Quittance de Paiement / Facture Proforma officielle IGS S.A.R.L.

10. **`client/src/pages/DossiersPage.tsx`** & **`client/src/pages/ClientPortalPage.tsx`** :
    - Filtres et actions douanières rapides, export/import CSV/Excel, isolation multi-tenant pour le client.

### 1.2 Commandes et Résultats de Vérification
- **TypeScript Check (`npm run check`)** :
  ```bash
  tsc --noEmit
  # Exit Code: 0 (0 error)
  ```
- **Build de Production (`npm run build`)** :
  ```bash
  vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
  # Exit Code: 0 (Tous les assets et chunks client/serveur générés avec succès)
  ```
- **Suite de Tests Vitest (`npm test`)** :
  ```bash
  vitest run
  # Test Files: 18 passed (18)
  # Tests: 171 passed (171)
  # Exit Code: 0
  ```

---

## 2. Logic Chain

1. **Intégrité et Absence de Tricherie** : Le code source a été vérifié contre tout résultat en dur, fausse implémentation ou contournement. Les calculs de débours, TVA (18%), conversion de devises (GNF/USD) et mutations tRPC s'appuient sur une architecture Drizzle ORM et TanStack Query réelle.
2. **Cloisonnement RBAC & Sécurité UI** : `usePermissions.ts` applique une logique unifiée avec le backend. Tout forçage d'URL non autorisée par un Déclarant (ex: `/finances`) ou un Client (ex: `/controles`) est intercepté par `ProtectedRoute.tsx` et redirigé vers la route par défaut du rôle avec un avertissement explicite.
3. **Expérience Déclarant PAC (Mamadou Diallo)** : Le flux terrain est optimisé grâce à `CustomsEditModal` présent sur `/dossiers`, `/controles` et `/dossiers/:id`, permettant de régulariser les identifiants Sydonia et BLD sans friction, tandis que les données financières et marges restent strictement invisibles.
4. **Expérience Comptable (Fatoumata Camara)** : La gestion multi-devises GNF/USD et la distinction nette entre honoraires assujettis à la TVA et débours portuaires/douaniers répondent aux exigences légales et métier guinéennes. L'émission de quittances imprimables fournit un livrable opérationnel immédiat.
5. **Fluidité du Simulateur de Rôles** : Le basculement de persona dans `DashboardLayout.tsx` met à jour le contexte utilisateur et navigue instantanément vers la vue dédiée sans recharger toute la page web.

---

## 3. Caveats

- **Rendu d'impression** : La fonction d'impression de quittance ouvre une fenêtre popup `window.open` stylisée pour impression A4/PDF; le navigateur client doit autoriser les pop-ups pour cette action spécifique.
- **Taux de change par défaut** : Le taux initial est fixé à 1 USD = 8 650 GNF, modifiable à tout moment par l'administrateur ou le comptable via l'interface dédiée.
- Aucun caveat bloquant.

---

## 4. Conclusion

**Verdict**: **`APPROVE`**

L'implémentation des jalons Frontend & Simulateur de Rôles (M2, M3, M4) est complète, robuste, sécurisée et conforme aux exigences fonctionnelles du projet IGS Guinée SaaS. La suite de tests Vitest (18 fichiers, 171 tests), la compilation TypeScript et le build de production sont validés à 100%.

---

## 5. Verification Method

Pour reproduire indépendamment les vérifications :

1. **Vérification TypeScript** :
   ```bash
   npm run check
   ```
2. **Vérification des Tests Unitaires & Intégration** :
   ```bash
   npm test
   ```
3. **Vérification du Build Complet** :
   ```bash
   npm run build
   ```
4. **Vérification Manuelle des 4 Personas** :
   - Déclarant PAC : Sélectionner "Déclarant PAC" dans le simulateur -> redirection vers `/planning`, vérification du masquage des finances et de l'accès à `CustomsEditModal`.
   - Comptable : Sélectionner "Comptable" -> redirection vers `/finances`, test de conversion GNF/USD, modification du taux, émission de facture et impression de quittance.
   - Client : Sélectionner "Portail Client" -> redirection vers `/portail-client`, test de tracking par numéro de BL.
   - Admin : Sélectionner "Administrateur" -> accès illimité à l'ensemble des modules.
