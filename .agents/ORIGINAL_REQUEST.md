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
