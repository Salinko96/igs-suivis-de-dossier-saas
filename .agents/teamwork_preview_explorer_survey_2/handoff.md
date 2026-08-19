# Rapport d'Exploration Détaillé : R3 (UX Contrôles Actions Prioritaires) & R4 (Performance Fiche Dossier)

**Agent :** `teamwork_preview_explorer_survey_2`  
**Date :** 2026-08-19T11:24:45Z  
**Type de handoff :** Hard (Recherche & analyse complètes)  

---

## 1. Observation

### 1.1 Exigences Spécifiées (ORIGINAL_REQUEST.md)
* **R3 : Amélioration UX du Tableau « Actions Prioritaires » (`/controles`)**
  * *Problème :* Le tableau des dossiers à régulariser déborde horizontalement et masque les boutons d'action (« Régulariser », « Fiche ») sans indication visuelle.
  * *Solution :* Conteneur avec scrollbar horizontale fluide et visible / ombre de dégradé, et mode cartes empilées responsive (mobile/tablette).
* **R4 : Optimisation des Performances de Chargement (`/dossiers/[id]`)**
  * *Problème :* L'ouverture d'une fiche dossier individuelle prend 5 à 8 secondes avec skeleton loader prolongé.
  * *Solution :* Supprimer tout délai artificiel, requêtes redondantes / N+1, et optimiser le cache client + requêtes backend pour un affichage < 300ms.

---

### 1.2 R3 — Examen du Code Source (`/controles`)

**Fichier :** `client/src/pages/ControlsPage.tsx`
* **Lignes 283–358 :**
  ```tsx
  <Card className="overflow-hidden border-0 bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[750px] text-left text-sm">
        <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase tracking-[0.12em] text-[#7d8d87]">
          <tr>
            <th className="px-5 py-3">Dossier</th>
            <th className="px-5 py-3">Client</th>
            <th className="px-5 py-3">Marchandise</th>
            <th className="px-5 py-3">Anomalies détectées</th>
            <th className="px-5 py-3 text-right">Régularisation Rapide</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf2ef]">
          {anomalies.map(dossier => {
            ...
            return (
              <tr key={dossier.id} className="hover:bg-[#f8faf9] transition">
                ...
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => setEditingCustomsDossier(dossier)}
                      className="h-7 rounded-lg bg-[#0b3b32] text-white hover:bg-[#164d41] text-xs px-2.5 shadow-sm"
                    >
                      <Edit3 size={12} className="mr-1" /> Régulariser
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(`/dossiers/${dossier.id}`)}
                      className="h-7 text-xs text-muted-foreground hover:text-emerald-900 px-2"
                    >
                      Fiche <ChevronRight size={12} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
  ```
* **Lignes 363–367 :**
  ```tsx
  <CustomsEditModal
    isOpen={Boolean(editingCustomsDossier)}
    onClose={() => setEditingCustomsDossier(null)}
    dossier={editingCustomsDossier}
  />
  ```

---

### 1.3 R4 — Examen du Code Source (`/dossiers/[id]`)

**Fichier Frontend :** `client/src/pages/DossierDetailPage.tsx`
* **Lignes 274–280 (Sur-requêtage massif sur chaque fiche) :**
  ```tsx
  const { data: dossier, isLoading, isError, error, refetch } = trpc.dossier.get.useQuery(
    { id: rawId! },
    { enabled: !isNew && Boolean(rawId), retry: 1 }
  );
  const { data: references = [] } = trpc.reference.list.useQuery();
  const { data: dossiers = [] } = trpc.dossier.list.useQuery(); // <-- PROBLÈME: Télécharge tous les dossiers de la base
  ```
* **Lignes 303–307 (Exécution eagerly de toutes les sous-requêtes) :**
  ```tsx
  const docsQuery = trpc.document.list.useQuery({ dossierId: numericId }, { enabled: !isNew && Boolean(numericId) });
  const auditQuery = trpc.audit.list.useQuery({ dossierId: numericId }, { enabled: !isNew && Boolean(numericId) && perms.canViewAudit });
  const invoicesQuery = trpc.finance.listInvoices.useQuery({ dossierId: numericId }, { enabled: !isNew && Boolean(numericId) && perms.canViewFinances });
  const tasksQuery = trpc.task.list.useQuery({ dossierId: numericId }, { enabled: !isNew && Boolean(numericId) });
  const commentsQuery = trpc.comment.list.useQuery({ dossierId: numericId }, { enabled: !isNew && Boolean(numericId) });
  ```
* **Lignes 421–427 (Raison de l'appel à `dossier.list`) :**
  ```tsx
  const sortedDossiers = useMemo(
    () => [...dossiers].sort((a, b) => a.dossierNumber.localeCompare(b.dossierNumber)),
    [dossiers]
  );
  const currentIndex = sortedDossiers.findIndex(item => item.id === numericId || item.dossierNumber === rawId);
  const prev = currentIndex > 0 ? sortedDossiers[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < sortedDossiers.length - 1 ? sortedDossiers[currentIndex + 1] : null;
  ```

**Fichier Backend :** `server/routers.ts`
* **Lignes 231–243 :**
  ```ts
  get: protectedProcedure
    .input(z.object({ id: z.union([z.number(), z.string()]) }))
    .query(async ({ ctx, input }) => {
      const dossier = await db.getDossier(input.id);
      if (!dossier) {
        console.error(`[tRPC] Dossier introuvable pour l'identifiant: "${input.id}"`);
        throw new TRPCError({ code: "NOT_FOUND", message: `Dossier introuvable pour l'identifiant "${input.id}"` });
      }
      if (ctx.user?.role === "client" && ctx.user?.clientCompany && dossier.client !== ctx.user.clientCompany) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce dossier" });
      }
      return dossier;
    }),
  ```

**Fichier DB / Repository :** `server/db.ts`
* **Lignes 514–552 :**
  ```ts
  export async function getDossier(idOrIdentifier: number | string) {
    const db = await getDb();
    const rawStr = String(idOrIdentifier).trim();
    const numId = Number(idOrIdentifier);
    const isValidNum = !isNaN(numId) && Number.isInteger(numId) && numId > 0;
    const formattedNum = isValidNum ? formatDossierNumber(numId) : null;
    const upperStr = rawStr.toUpperCase();

    if (db) {
      try {
        const conditions = [];
        if (isValidNum) {
          conditions.push(eq(dossiers.id, numId));
        }
        if (formattedNum) {
          conditions.push(eq(dossiers.dossierNumber, formattedNum));
        }
        conditions.push(eq(dossiers.dossierNumber, upperStr));
        conditions.push(eq(dossiers.portalAccessCode, upperStr));
        conditions.push(eq(dossiers.blLtaNumber, upperStr));
        conditions.push(eq(dossiers.clientDossierNumber, upperStr));

        const row = (await db.select().from(dossiers).where(or(...conditions)).limit(1))[0];
        if (row) return row;
      } catch (e) {
        console.error("[DB] getDossier database query error:", e);
      }
    }
  ```

**Vérification des Délais Artificiels :**
* Commande : Recherche globale de `setTimeout`, `sleep`, `delay` dans `server/` et `client/`.
* Résultat : **Aucun délai artificiel `setTimeout` ni `sleep`** n'est présent dans le code de récupération des dossiers.

---

## 2. Logic Chain

### 2.1 Logic Chain pour R3 (Tableau Actions Prioritaires `/controles`)
1. **Observation 1.2 :** Dans `ControlsPage.tsx`, la table est contrainte par `min-w-[750px]` dans un `<div className="overflow-x-auto">` sans style de barre de défilement personnalisé ni ombre d'indication de scroll.
2. **Déduction :** Sur les écrans de taille moyenne ou petite (tablettes, mobiles, ou fenêtres desktop étroites avec barre latérale de 270px ouverte), la largeur utile est inférieure à 750px.
3. **Conséquence :** La dernière colonne ("Régularisation Rapide") qui héberge les boutons « Régulariser » et « Fiche » est repoussée hors de l'écran visible vers la droite. L'absence d'indicateur visuel (shadow/scrollbar contrastée) fait croire à l'utilisateur que les boutons ont disparu.
4. **Conclusion R3 :**
   - Implémenter une **vue double responsive** :
     - Sur écran large (`md:block`) : Tableau avec conteneur à défilement fluide, indicateur de scroll ou colonne d'actions sticky (`sticky right-0 bg-white`).
     - Sur écran mobile / tablette (`block md:hidden`) : Mode **cartes empilées** avec chaque anomalie présentée dans une Card contenant l'en-tête (Dossier, Client, BL), les badges d'anomalies, et la barre d'action immédiate avec boutons pleins et ergonomiques (« Régulariser » et « Fiche »).

### 2.2 Logic Chain pour R4 (Performance de `/dossiers/[id]`)
1. **Observation 1.3 :** `DossierDetailPage.tsx` (ligne 279) exécute systématiquement `trpc.dossier.list.useQuery()`, qui interroge et sérialise la totalité de la table `dossiers`.
2. **Observation 1.3 :** Simultanément, 5 requêtes secondaires (`document.list`, `audit.list`, `finance.listInvoices`, `task.list`, `comment.list`) sont toutes lancées en eager loading via `httpBatchLink` sur le premier rendu alors que l'utilisateur n'est que sur le premier onglet `general`.
3. **Observation 1.3 :** Si l'identifiant dans l'URL est un code métier (ex: `/dossiers/DOS-0054`), `numericId` est initialement `0`, entraînant une cascade séquentielle : d'abord le batch avec `dossier.get`, puis une fois le dossier résolu, un 2nd batch avec les 5 sous-requêtes.
4. **Observation 1.3 :** Le repository `db.getDossier` effectue une requête Postgres avec 6 clauses `OR` sur des colonnes varchar non indexées en composite, forçant un scan de table.
5. **Déduction :** L'accumulation de (1) requête totale `dossier.list` + (2) batch de 8 requêtes simultanées + (3) requêtes en cascade pour les routes textuelles + (4) absence d'utilisation du cache client TanStack Query crée le délai ressenti de 5 à 8 secondes.
6. **Conclusion R4 :**
   - Supprimer le fetch global `dossier.list` sur la page de détail (utiliser les données de cache ou une pagination légère).
   - Rendre paresseux (*lazy*) les 5 sous-requêtes des onglets secondaires (`enabled: activeTab === '...'`).
   - Optimiser `getDossier` dans `db.ts` pour résoudre directement par clé primaire / identifiant indexé.
   - Utiliser `placeholderData` depuis le cache TanStack Query pour un affichage instantané (< 100ms).

---

## 3. Caveats

1. **Permissions RBAC :** Les requêtes d'onglets (`finance.listInvoices`, `audit.list`) sont déjà soumises à `perms.canViewFinances` et `perms.canViewAudit`. Le lazy loading doit préserver ces vérifications.
2. **Navigation Précédent / Suivant :** Les boutons `<ChevronLeft>` et `<ChevronRight>` dans l'en-tête de `DossierDetailPage` utilisent actuellement `sortedDossiers`. Si `dossier.list` est retiré, ces flèches peuvent utiliser le cache React Query existant (`utils.dossier.list.getData()`) sans déclencher de requête réseau bloquante.
3. **Données de test en mémoire vs Postgres :** En mode développement sans `DATABASE_URL`, l'application utilise les tableaux mémoire `_memoryDossiers`. Les optimisations s'appliquent identiquement au mode mémoire et au mode Postgres Drizzle.

---

## 4. Conclusion

### Plan d'implémentation ciblé :

#### Pour R3 (`ControlsPage.tsx`) :
1. Structurer la section "Actions prioritaires" en composant responsive bi-mode :
   - Mode `<div className="hidden md:block">` : Table avec `overflow-x-auto`, scrollbar stylisée et colonne d'actions avec boutons toujours visibles.
   - Mode `<div className="block md:hidden space-y-3">` : Liste de cartes empilées. Chaque carte affiche le numéro de dossier, le client, le connaissement BL/LTA, la liste des badges d'anomalies, et deux boutons d'action pleine largeur (« Régulariser » et « Fiche »).
2. Tester le comportement sur viewports mobiles (375px, 414px, 768px) et desktop (1024px, 1440px).

#### Pour R4 (`DossierDetailPage.tsx` + `db.ts`) :
1. **Frontend `DossierDetailPage.tsx`** :
   - Remplacer `const { data: dossiers = [] } = trpc.dossier.list.useQuery();` par la lecture du cache `utils.dossier.list.getData() || []` pour les flèches prev/next.
   - Activer les sous-requêtes des onglets à la demande :
     - `docsQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "documents"`
     - `auditQuery`: `enabled: !isNew && Boolean(numericId) && perms.canViewAudit && activeTab === "audit"`
     - `invoicesQuery`: `enabled: !isNew && Boolean(numericId) && perms.canViewFinances && activeTab === "finances"`
     - `tasksQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "tasks"`
     - `commentsQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "tasks"`
   - Ajouter `placeholderData` pour afficher instantanément les données déjà présentes en mémoire cache.
2. **Backend `server/db.ts`** :
   - Optimiser `getDossier` : recherche ciblée directe `eq(dossiers.id, numId)` en priorité si numérique, sinon recherche exacte par `dossierNumber` ou `portalAccessCode`.

---

## 5. Verification Method

1. **Vérification R3 (UX Contrôles) :**
   - Inspecter `ControlsPage.tsx` sur écran étroit (< 768px).
   - Constater la présence immédiate des boutons « Régulariser » et « Fiche » sur chaque carte de dossier sans besoin de défilement horizontal.
   - Cliquer sur « Régulariser » : vérifier que la modale `CustomsEditModal` s'ouvre correctement.
   - Cliquer sur « Fiche » : vérifier que la navigation vers `/dossiers/:id` s'effectue instantanément.

2. **Vérification R4 (Performance Fiche Dossier) :**
   - Lancer les tests unitaires et d'intégration :
     ```bash
     npm test
     ```
   - Vérifier le temps d'exécution de la suite `dossier_detail_dynamic_route.test.ts` (< 100ms).
   - Vérifier le build de production :
     ```bash
     npm run build
     ```
   - Valider la résolution de la route dynamique avec identifiant numérique (`/dossiers/1`), chaîne (`/dossiers/54`) et code métier (`/dossiers/DOS-0054`, `/dossiers/IGS-1001`).

3. **Conditions d'invalidation :**
   - Si les boutons d'action sont encore tronqués ou invisibles sur mobile/tablette sur `/controles`.
   - Si l'ouverture d'une fiche dossier prend plus de 500ms ou bloque sur le skeleton loader.
