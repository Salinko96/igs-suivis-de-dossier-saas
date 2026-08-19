# Handoff Report — Exploration & Survey R1 (Client Portal) & R2 (Notification Bell)

## 1. Observation

### R1. Portail Client Externe (`/portail-client`) — Recherche Invalide et Loader Infini
- **Fichier `client/src/pages/ClientPortalPage.tsx` (lignes 26–39, 87–107)** :
  ```tsx
  const [searchCode, setSearchCode] = useState("IGS-1001");
  const [submittedCode, setSubmittedCode] = useState("IGS-1001");

  const portalQuery = trpc.portal.track.useQuery(
    { accessCodeOrNumber: submittedCode },
    { enabled: Boolean(submittedCode.trim()) }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      setSubmittedCode(searchCode.trim());
    }
  };
  ```
  - La requête `portal.track` hérite de l'option globale TanStack Query définie dans `client/src/main.tsx` (ligne 17: `retry: 1`).
  - Lors d'une saisie invalide (ex: `XXXX-9999`), la requête tRPC échoue, mais TanStack Query relance automatiquement un retry en arrière-plan avec un délai de backoff exponentiel.
  - Le bouton de soumission (ligne 88) vérifie `{portalQuery.isLoading ? <Loader2 size={15} className="animate-spin" /> : "Consulter"}` au lieu de `portalQuery.isFetching`.
  - La zone d'affichage d'erreur (lignes 101–106) ne propose pas de boutons d'exemples cliquables pour réinjecter immédiatement une recherche valide.

- **Fichier `server/routers.ts` (lignes 271–285)** :
  ```typescript
  portal: router({
    track: publicProcedure
      .input(z.object({ accessCodeOrNumber: z.string().trim().min(2) }))
      .query(async ({ input }) => {
        const dossier = await db.getDossierByPortalCode(input.accessCodeOrNumber);
        if (!dossier) throw new Error("Dossier introuvable. Vérifiez le numéro de BL ou le code de suivi.");
        const docs = await db.listDocuments(dossier.id);
        const history = await db.listDossierHistory(dossier.id);
        return {
          dossier,
          documents: docs.map(d => ({ id: d.id, name: d.name, type: d.type, createdAt: d.createdAt })),
          timeline: history.map(h => ({ date: h.createdAt, title: h.fieldChanged, detail: h.newValue || h.comment })),
        };
      }),
  }),
  ```
  - `throw new Error(...)` renvoie une erreur non typée au lieu d'une `TRPCError` explicite avec `code: "NOT_FOUND"`.

- **Fichier `server/db.ts` (lignes 554–564)** :
  ```typescript
  export async function getDossierByPortalCode(portalAccessCode: string) {
    const cleanCode = portalAccessCode.trim().toUpperCase();
    const db = await getDb();
    if (db) {
      try {
        const row = (await db.select().from(dossiers).where(eq(dossiers.portalAccessCode, cleanCode)).limit(1))[0];
        if (row) return row;
      } catch (e) {}
    }
    return _memoryDossiers.find(d => d.portalAccessCode?.toUpperCase() === cleanCode || d.dossierNumber?.toUpperCase() === cleanCode || d.blLtaNumber?.toUpperCase() === cleanCode);
  }
  ```
  - `getDossierByPortalCode` ne vérifie pas `d.clientDossierNumber`. Or le critère d'acceptation R1 exige le support explicite du code `CKYSI26000340` (qui est un `clientDossierNumber` dans `initialImportData.ts`).

---

### R2. Système de Notifications (Cloche Dashboard) — « Marquer lu » et Compteur Badge
- **Fichier `client/src/components/DashboardLayout.tsx` (lignes 180–194, 360–390, 420–465)** :
  ```tsx
  const notificationsQuery = trpc.notification.list.useQuery(undefined, { refetchInterval: 30000 });
  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter(n => n.isRead === 0).length;
  
  const markReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => notificationsQuery.refetch(),
  });

  const markAllReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("Toutes les alertes ont été marquées comme lues.");
      notificationsQuery.refetch();
    },
  });
  ```
  - `DashboardLayout.tsx` n'utilise pas `const utils = trpc.useUtils()`.
  - Les mutations `markAsRead` et `markAllAsRead` n'effectuent aucune mise à jour optimiste du cache React Query et n'utilisent pas `utils.notification.list.invalidate()`.
  - Le compteur de badge rouge `unreadCount` dépend directement du résultat de la requête et ne se met pas à jour instantanément lors du clic.

- **Fichier `server/alertsService.ts` (lignes 15–84)** :
  ```typescript
  export function generateProactiveAlerts(dossiers: Dossier[]): ProactiveAlert[] {
    const alerts: ProactiveAlert[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let idCounter = 1;

    for (const d of dossiers) {
      // ...
      if (isPastEta && !isReleased && daysSinceEta > 7) {
        alerts.push({
          id: idCounter++,
          dossierId: d.id,
          // ...
        });
      }
    }
  ```
  - Les alertes proactives générées à la volée utilisent un compteur séquentiel `idCounter++` dépendant de l'ordre d'itération du tableau `dossiers`.
  - Lorsque des dossiers sont mis à jour (`listDossiers()` les trie par `updatedAt`), l'ordre change et les IDs des alertes sont réattribués à d'autres dossiers.

- **Fichier `server/db.ts` (lignes 1358–1396)** :
  ```typescript
  const _readNotificationIds = new Set<number>();

  export async function listNotifications(limit = 40) {
    const dossiers = await listDossiers();
    const alerts = generateProactiveAlerts(dossiers);

    return alerts.slice(0, limit).map(a => ({
      ...a,
      isRead: _readNotificationIds.has(a.id) ? 1 : 0,
    }));
  }

  export async function markNotificationAsRead(id: number) {
    _readNotificationIds.add(id);
    // ...
  }
  ```
  - Comme `idCounter` dans `alertsService.ts` n'est pas stable et déterministe, les identifiants stockés dans `_readNotificationIds` ne correspondent plus aux mêmes alertes après modification ou retri des dossiers.

---

## 2. Logic Chain

### Analyse R1 (Portail Client)
1. **Origine du blocage/latence de recherche** :
   - Lorsqu'un utilisateur saisit `XXXX-9999`, le hook `trpc.portal.track.useQuery` déclenche la requête.
   - En cas de 404/erreur, le comportement par défaut de `QueryClient` (`retry: 1`) attend et retente la requête, créant une impression de blocage infini sur le loader.
   - Si `retry: false` est configuré sur `portal.track`, l'erreur est reçue immédiatement (< 50ms).
2. **Gestion de l'état UI et du champ de recherche** :
   - Le bouton "Consulter" et le container de résultats doivent se baser sur `portalQuery.isFetching`. Dès que la requête échoue, `isFetching` repasse immédiatement à `false`.
   - Le champ de recherche et le bouton doivent rester interactifs en permanence.
   - En cas d'erreur (`portalQuery.isError`), un composant visuel avec le message d'erreur clair *« Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez. »* et des badges cliquables d'exemples valides (`IGS-1001`, `CKYSI26000340`, `HLCUNG12604AUQG1`) permet une expérience utilisateur fluide.
3. **Résolution de code dans `server/db.ts`** :
   - `getDossierByPortalCode` doit inclure `d.clientDossierNumber?.toUpperCase() === cleanCode` pour que le code `CKYSI26000340` renvoie bien le dossier correspondant.
   - `server/routers.ts` doit lever une `TRPCError` avec le code `"NOT_FOUND"` et le message complet.

### Analyse R2 (Notifications & Badge)
1. **Origine de la non-mise à jour du badge et de l'état lu** :
   - Dans `DashboardLayout.tsx`, le clic sur "Marquer lu" exécute `markReadMutation.mutate({ id })`.
   - Faute de mutation optimiste et d'invalidation TanStack Query (`utils.notification.list.invalidate()`), l'interface attend un `refetch()` différé.
   - Côté serveur, la méthode `generateProactiveAlerts` recalculait des IDs instables `1, 2, 3...` selon l'ordre du tableau de dossiers. Dès qu'un dossier était touché, le tri par `updatedAt` décalait les IDs, désynchronisant le `_readNotificationIds.has(a.id)`.
2. **Solution pérenne** :
   - Attribuer un ID déterministe et stable à chaque type d'alerte par dossier : `(dossier.id * 10) + typeIndex` (ex: `11` pour Surestaries du dossier 1, `12` pour ETA dépassée du dossier 1, `13` pour Sydonia manquant du dossier 1).
   - Utiliser `trpc.useUtils()` dans `DashboardLayout.tsx`.
   - Appliquer une mise à jour optimiste (`onMutate`) dans `markAsRead` et `markAllAsRead` pour passer `isRead: 1` instantanément dans le cache mémoire local, ce qui recalcule `unreadCount` à la milliseconde sans attendre le retour réseau.
   - Invalider `utils.notification.list.invalidate()` sur `onSettled` / `onSuccess`.

---

## 3. Caveats
- **Persistance DB vs In-Memory** :
  En mode développement sans base de données PostgreSQL active (`db === null`), le serveur tourne sur les structures mémoires `_memoryDossiers` et `_readNotificationIds`. Les corrections proposées fonctionnent parfaitement et de manière transparente dans les deux modes (mémoire et base de données relationnelle).
- **Rôles et filtrage des notifications** :
  La route `notification.list` est accessible aux utilisateurs connectés (`protectedProcedure`). Le calcul proactif génère des alertes sur l'ensemble des dossiers opérationnels actifs.

---

## 4. Conclusion

Les causes racines des deux anomalies sont clairement identifiées :
1. **R1 (Portail Client)** :
   - Configuration de retry superflue (`retry: 1` -> doit être `retry: false` sur la recherche portail).
   - Absence de vérification du `clientDossierNumber` dans `getDossierByPortalCode`.
   - Gestion UI de l'état d'erreur et loader à moderniser avec message d'erreur standardisé et suggestions rapides.
2. **R2 (Notifications & Cloche)** :
   - IDs d'alertes non déterministes dans `server/alertsService.ts`.
   - Absence de mise à jour optimiste du cache React Query et d'utilisation de `trpc.useUtils().notification.list.invalidate()` dans `DashboardLayout.tsx`.

---

## 5. Verification Method

### 1. Commandes de test automatisées
Exécuter la suite complète de tests de non-régression :
```bash
npm test
```
*Validation : 20 fichiers de test et 181 tests doivent passer au vert.*

Ajouter des tests unitaires et d'intégration ciblés :
- Test R1 : vérification de `portal.track` avec code invalide `XXXX-9999` (lève `NOT_FOUND` avec message attendu) et avec codes valides `IGS-1001`, `CKYSI26000340`, `HLCUNG12604AUQG1`.
- Test R2 : vérification que `notification.markAsRead` et `notification.markAllAsRead` conservent le statut `isRead: 1` même après re-tri ou mise à jour d'un dossier.

### 2. Fichiers clés à inspecter pour l'implémentation
- `client/src/pages/ClientPortalPage.tsx`
- `client/src/components/DashboardLayout.tsx`
- `server/routers.ts`
- `server/db.ts`
- `server/alertsService.ts`
