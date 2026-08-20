# Rapport d'Investigation Approfondi : R2 (Optimistic Locking) & R3 (Audit Trail & Traçabilité Réglementaire)

**Projet :** IGS Transit & Douane Guinée SaaS  
**Agent :** Explorer 2  
**Date :** 2026-08-20  
**Statut :** Investigation terminée — Prêt pour spécification et implémentation  

---

## 1. Résumé Exécutif

L'investigation de la base de code d'IGS Transit & Douane Guinée SaaS a porté sur deux exigences critiques pour la robustesse et la conformité légale de la plateforme multi-collaborateurs :
1. **R2 — Détection des conflits d'édition simultanée (Optimistic Locking)** : Protection des fiches dossiers contre l'écrasement de données lorsqu'au moins deux déclarants, gestionnaires ou comptables modifient simultanément un dossier.
2. **R3 — Journal d'audit & Traçabilité réglementaire (Audit Trail)** : Enregistrement immuable et exhaustif de toutes les transitions de statuts douaniers (DDI, SYDONIA, BLD, BAD, BAE, Sortie PAC) et des opérations financières (facturation, encaissements, avances de débours PAC).

### Constats Majeurs :
- **Absence totale de contrôle de concurrence optimiste (R2)** : Aucune colonne `version` n'existe dans la table `dossiers` (`drizzle/schema.ts`). Les mutations tRPC `dossier.update` et `dossier.updateCustoms` n'acceptent ni `version` ni `expectedUpdatedAt`, écrasant aveuglément les données en cas d'édition concurrente ("Last-Write-Wins"). Côté frontend (`DossierDetailPage.tsx`, `CustomsEditModal.tsx`), aucun modal de résolution de conflit ni comparaison de diff n'est actuellement implémenté.
- **Traçabilité partielle et fragmentée (R3)** : La table actuelle `dossier_status_history` capture les modifications directes de champs de dossiers lors de `updateDossier`, mais ne dispose pas d'un schéma d'audit d'entreprise normalisé (absence d'identifiant d'action, d'entité cible `entityType`/`entityId`, de charge utile JSON avant/après, d'adresse IP et de métadonnées de session). De plus, les opérations critiques telles que l'émission de factures (`createInvoice`) ou les avances de débours portuaires (`createPacDisbursement`) ne génèrent pas systématiquement d'entrée d'audit dédiée dans l'historique.

---

## 2. Architecture du Schéma des Dossiers & Modèle de Données

### 2.1. Schéma de la table `dossiers` (`drizzle/schema.ts` & `server/db.ts`)

La table `dossiers` constitue le cœur opérationnel de l'application. Elle contient actuellement les colonnes suivantes :

```typescript
// Extrait de drizzle/schema.ts
export const dossiers = pgTable("dossiers", {
  id: serial("id").primaryKey(),
  dossierNumber: varchar("dossierNumber", { length: 16 }).notNull(), // ex: "DOS-0001"
  clientDossierNumber: varchar("clientDossierNumber", { length: 120 }), // ex: "CKYSI26000340"
  clientId: integer("clientId"),
  client: varchar("client", { length: 255 }),
  blLtaNumber: varchar("blLtaNumber", { length: 160 }), // Connaissement BL maritime / LTA aérien
  cargoNature: text("cargoNature"),
  transportMode: varchar("transportMode", { length: 64 }), // Maritime, Aérien, Routier
  eta: timestamp("eta"), // Estimated Time of Arrival
  originPort: varchar("originPort", { length: 255 }),
  destinationPort: varchar("destinationPort", { length: 255 }),
  port: varchar("port", { length: 120 }).default("Port Autonome de Conakry (PAC)"),
  container: varchar("container", { length: 255 }), // ex: "04TC20'"
  bulk: varchar("bulk", { length: 255 }), // Colis / Vrac
  goodsReleaseDate: timestamp("goodsReleaseDate"), // Date de sortie PAC effective
  daysOnQuay: integer("daysOnQuay").default(0),
  
  // Identifiants & Statuts Douane Guinée
  declarationNumber: varchar("declarationNumber", { length: 160 }), // N° Déclaration SYDONIA (ex: S 142- 27/07/2026)
  bulletinNumber: varchar("bulletinNumber", { length: 160 }), // N° Bulletin de Liquidation BLD (ex: L 1774)
  finalDeclarationNumber: varchar("finalDeclarationNumber", { length: 160 }), // Déclaration Définitive C
  ddiGucegNumber: varchar("ddiGucegNumber", { length: 160 }), // N° DDI GUCEG Guinée
  badStatus: varchar("badStatus", { length: 64 }), // Bon à Délivrer (Non_recu, Demande, Obtenu)
  baeStatus: varchar("baeStatus", { length: 64 }), // Bon à Enlever (En_attente, Delivre, Bloque)
  
  // Statuts Calculés & Métier
  calculatedStatus: calculatedStatusEnum("calculatedStatus").notNull(), // "Régularisé" | "À régulariser"
  calculatedPriority: calculatedPriorityEnum("calculatedPriority").notNull(), // "Haute" | "Normale" | "Basse"
  completionRate: integer("completionRate").notNull().default(0), // Pourcentage 0 - 100%
  documentStatus: varchar("documentStatus", { length: 80 }),
  customsStatus: varchar("customsStatus", { length: 80 }),
  portStatus: varchar("portStatus", { length: 100 }),
  financialStatus: varchar("financialStatus", { length: 100 }), // "En attente", "Fact. Proforma", "Facturé", "Payé"
  fieldOperation: varchar("fieldOperation", { length: 160 }),
  responsible: varchar("responsible", { length: 120 }),
  nextAction: varchar("nextAction", { length: 255 }),
  fieldAlert: varchar("fieldAlert", { length: 120 }),
  deliveryLocation: varchar("deliveryLocation", { length: 120 }),
  declarant: varchar("declarant", { length: 120 }),
  service: varchar("service", { length: 80 }),
  regime: varchar("regime", { length: 80 }),
  notes: text("notes"),
  portalAccessCode: varchar("portalAccessCode", { length: 32 }), // Code direct portail client (ex: "IGS-1001")
  
  createdById: integer("createdById"),
  updatedById: integer("updatedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
```

### 2.2. Analyse des Champs Financiers et Tables Connexes
Le dossier porte un champ résumé `financialStatus` ("En attente", "Fact. Proforma", "Facturé", "Payé"), tandis que les détails financiers sont normalisés dans trois tables :
1. **`invoices`** : `invoiceNumber`, `client`, `currency` (GNF, USD), `invoiceType` (Proforma, Definitive), `amountHt`, `amountTva` (18%), `amountTtc`, `disbursementsAmount`, `customsDutiesAmount`, `portFeesAmount`, `storageAndDemurrageFees`, `estimatedMargin`, `status` (Proforma, Émise, Payée, En_retard, Annulée), `receiptNumber`, `paidAt`.
2. **`invoice_payments`** : `invoiceId`, `amount`, `currency`, `paymentMethod`, `paymentReference`, `paymentDate`, `proofUrl` (justificatif Supabase Storage).
3. **`pac_disbursements`** : `dossierId`, `invoiceId`, `type` (douane, port, surestaries, acconage), `amountAdvanced`, `amountReimbursed`, `status` (avance, rembourse_partiel, rembourse_total), `receiptNumber`.

### 2.3. Modèle de Persistance Hybride (In-Memory + Supabase PostgreSQL)
Dans `server/db.ts`, l'architecture maintient un cache mémoire haute performance (`_memoryDossiers`, `_memoryInvoices`, `_memoryHistory`) avec synchronisation asynchrone non-bloquante vers PostgreSQL via Drizzle (`withDbTimeout`). Toute modification appliquée en mémoire doit refléter fidèlement l'état de la base de données et vice-versa.

---

## 3. Investigation de R2 : Optimistic Locking & Édition Concurrente

### 3.1. État des Lieux & Diagnostic des Vulnérabilités

#### A. Absence de Contrôle de Version Côté Serveur
- Dans `server/routers.ts` (lignes 347-365) :
  ```typescript
  dossier: router({
    update: internalProcedure
      .input(z.object({ id: z.union([z.number(), z.string()]), data: dossierPayload }))
      .mutation(async ({ ctx, input }) => {
        const numId = Number(input.id);
        invalidateDashboardCache();
        return await db.updateDossier(numId, input.data, ctx.user.id, ctx.user.name || "Opérateur");
      }),
  ```
- Dans `server/db.ts` (lignes 843-899) :
  `updateDossier(id, input, userId, authorName)` charge `current = await getDossier(id)`, applique les modifications de `input` sur `current`, met à jour `updatedAt = new Date()`, et sauvegarde le résultat sans jamais comparer `current.updatedAt` ou un `version` avec ce que le client avait reçu lors de la lecture.

#### B. Scénario de Perte de Données ("Lost Update")
1. **Utilisateur A (Déclarant)** ouvre le dossier `DOS-0001` à 10:00:00 (données initiales : `declarationNumber: null`, `bulletinNumber: null`).
2. **Utilisateur B (Comptable)** ouvre le dossier `DOS-0001` à 10:00:05.
3. À 10:01:00, l'Utilisateur B ajoute une note interne et valide : le serveur sauvegarde les modifications de B (`updatedAt` = 10:01:00).
4. À 10:01:30, l'Utilisateur A renseigne la déclaration SYDONIA `S 142- 27/07/2026` et clique sur "Enregistrer" : son formulaire contenait l'état de 10:00:00 (sans la note de B).
5. **Résultat :** Les modifications de l'Utilisateur B sont silencieusement écrasées et perdues sans aucun avertissement.

#### C. Code d'Erreur Attendu
En cas de détection de conflit (inadéquation de `version` ou de `updatedAt`), le serveur tRPC doit lever l'erreur standardisée :
```typescript
throw new TRPCError({
  code: "CONFLICT", // HTTP 409
  message: "Conflit d'édition simultanée : ce dossier a été modifié par un autre utilisateur. Veuillez recharger ou fusionner vos modifications.",
  cause: {
    serverDossier: current, // Optionnel : renvoyer les données fraîches pour le diff
    conflictTimestamp: current.updatedAt,
  }
});
```

### 3.2. Analyse du Frontend (`DossierDetailPage.tsx` & `CustomsEditModal.tsx`)

1. **`DossierDetailPage.tsx`** :
   - `useQuery` charge `dossier` mais ne stocke pas de référence immuable de `loadedVersion` ou `initialUpdatedAt`.
   - `handleSubmit` et `handleSaveDraft` appellent `updateMutation.mutate({ id: numericId, data: payload })`.
   - Le gestionnaire d'erreur `updateMutation` affiche uniquement `toast.error(err.message)`.
   - Il n'existe **aucune modale de conflit**, aucun diff entre valeurs locales saisies et valeurs distantes sur le serveur, ni d'option de fusion (merge) ou de rechargement sécurisé sans perte de données.
2. **`CustomsEditModal.tsx`** :
   - Formulaire d'édition rapide douane. Même constat : aucun numéro de version transmis dans `dossier.updateCustoms`.

---

## 4. Investigation de R3 : Journal d'Audit & Traçabilité Réglementaire

### 4.1. État Actuel de la Table `dossier_status_history`

La table `dossierStatusHistory` dans `drizzle/schema.ts` contient :
- `id` (serial PK)
- `dossierId` (integer)
- `changedById` (integer)
- `authorName` (varchar 120)
- `fieldChanged` (varchar 80)
- `previousValue` (text)
- `newValue` (text)
- `comment` (text)
- `createdAt` (timestamp defaultNow)

### 4.2. Écarts par Rapport aux Normes d'Audit Réglementaire (Compliance Gap)

| Exigence Réglementaire | État Actuel | Écart / Action Requise |
| :--- | :--- | :--- |
| **Identifiant d'action normalisé (`action`)** | ❌ Absent (seul `fieldChanged` libre existe) | Ajouter `action: varchar("action", { length: 120 })` (ex: `CUSTOMS_STATUS_UPDATE`, `INVOICE_GENERATED`, `PAYMENT_RECORDED`, `DISBURSEMENT_ADVANCED`) |
| **Type d'entité & ID cible (`entityType`, `entityId`)** | ⚠️ Partiel (`dossierId` uniquement) | Ajouter `entityType` (`dossier`, `invoice`, `disbursement`, `document`) et `entityId` pour auditer précisément les finances et documents |
| **Structure Before / After complète** | ⚠️ Limité à une chaîne texte par champ modifié | Conserver `previousValue` et `newValue` texte, et optionnellement `beforeData` / `afterData` (JSON formaté) |
| **Rôle de l'utilisateur (`userRole`)** | ❌ Absent | Enregistrer `userRole` (`admin`, `declarant`, `comptable`, `manager`, `client`) |
| **Métadonnées de sécurité (IP, User-Agent)** | ❌ Absent | Ajouter `ipAddress` et `metadata` (JSON) pour garantir l'infalsifiabilité |
| **Immutabilité stricte** | ⚠️ Non protégée au niveau API | Aucune route tRPC ne permet de modifier l'historique (lecture seule `audit.list`), ce qui est conforme, mais une politique RLS/trigger d'interdiction d'UPDATE/DELETE en base est recommandée |

### 4.3. Analyse de la Traçabilité des Opérations Critiques

1. **Transitions de Statuts Douaniers (DDI, SYDONIA, BLD, BAD, BAE, Sortie PAC)** :
   - Dans `db.updateDossier`, chaque champ modifié dans `input` génère une ligne dans `dossierStatusHistory`.
   - Lors de l'import batch (`importDossiersBatch`), une entrée de synthèse `Mise à jour Import` est insérée.
   - Les boutons d'action rapide dans `DossierDetailPage.tsx` (ex: "Marquer BAE Accordé") appellent `updateCustoms` qui génère bien les entrées d'historique.
2. **Opérations Financières (Factures, Paiements, Débours PAC)** :
   - `createInvoice` : **NON audité directement** dans `dossierStatusHistory` (seul `financialStatus` du dossier est mis à jour indirectement).
   - `recordInvoicePayment` : **Audité** dans `dossierStatusHistory` via un appel explicite à `addDossierHistory` avec le détail du mode de paiement et du reçu.
   - `createPacDisbursement` : **NON audité du tout** dans `dossierStatusHistory`.
   - `deleteDocument` / `uploadBase64` : Seul l'ajout de document est audité ; la suppression ne génère pas d'entrée d'audit.

### 4.4. Affichage de l'Audit sur le Frontend

Dans `client/src/pages/DossierDetailPage.tsx` (lignes 1433-1458) :
- L'onglet **"Audit & Historique"** est conditionné par la permission `perms.canViewAudit`.
- Il consomme la procédure tRPC `trpc.audit.list.useQuery({ dossierId: numericId })`.
- Le composant affiche une timeline verticale élégante avec puce verte, horodatage localisé en français (`fr-FR`), nom de l'auteur, intitulé du changement, transition `previousValue ➔ newValue`, et commentaire associé.
- Le portail client externe (`/portail-client`) utilise également `db.listDossierHistory(dossier.id)` pour afficher la timeline publique des événements du fret.

---

## 5. Plan d'Implémentation et Recommandations Techniques

### 5.1. Spécification Technique pour R2 (Optimistic Locking)

#### Étape 1 : Évolution du Schéma Base de Données (`drizzle/schema.ts`)
Ajouter la colonne `version` à la table `dossiers` :
```typescript
export const dossiers = pgTable("dossiers", {
  // ...
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
```

#### Étape 2 : Évolution des Schémas de Mutation tRPC (`server/routers.ts`)
Modifier l'input de `dossier.update` et `dossier.updateCustoms` :
```typescript
const updateDossierSchema = z.object({
  id: z.union([z.number(), z.string()]),
  expectedVersion: z.number().int().positive().optional(),
  expectedUpdatedAt: z.union([z.date(), z.string()]).optional(),
  data: dossierPayload,
});
```

#### Étape 3 : Logique de Vérification dans `server/db.ts`
Dans `updateDossier` :
```typescript
export async function updateDossier(
  id: number,
  input: Partial<EditableDossier>,
  userId?: number,
  authorName?: string,
  options?: { expectedVersion?: number; expectedUpdatedAt?: Date | string }
) {
  const current = await getDossier(id);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });

  // Vérification de verrouillage optimiste
  if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Conflit d'édition simultanée : ce dossier a été modifié (version locale: v${options.expectedVersion}, version actuelle: v${current.version}).`,
    });
  }

  if (options?.expectedUpdatedAt) {
    const expectedTime = new Date(options.expectedUpdatedAt).getTime();
    const currentTime = new Date(current.updatedAt).getTime();
    if (Math.abs(currentTime - expectedTime) > 1000) { // Tolérance de 1 seconde pour écart de sérialisation
      throw new TRPCError({
        code: "CONFLICT",
        message: "Conflit d'édition simultanée : le dossier a été mis à jour par un autre collaborateur.",
      });
    }
  }

  const nextVersion = (current.version || 1) + 1;
  const now = new Date();
  // ... mise à jour avec version: nextVersion, updatedAt: now
}
```

#### Étape 4 : Composant de Résolution de Conflit Frontend (`client/src/components/ConflictResolutionModal.tsx`)
Créer une modale dédiée affichant :
1. L'alerte explicative : *"Un autre utilisateur a modifié ce dossier pendant votre édition."*
2. Un tableau comparatif side-by-side :
   - Champ (ex: N° Déclaration, Statut BAE)
   - Votre saisie locale
   - Valeur actuelle sur le serveur
3. Deux boutons d'action :
   - **« Recharger les données du serveur »** (annule la saisie locale et rafraîchit le cache TanStack Query).
   - **« Écraser avec mes modifications »** (force la mise à jour avec le nouveau numéro de version serveur).

---

### 5.2. Spécification Technique pour R3 (Audit Trail & Traçabilité Complète)

#### Étape 1 : Schéma Étendu de Traçabilité (`drizzle/schema.ts`)
Enrichir la table `dossier_status_history` ou créer la table `audit_logs` :
```typescript
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  dossierId: integer("dossierId"), // Nullable pour les logs système globaux
  userId: integer("userId"),
  userName: varchar("userName", { length: 120 }).notNull(),
  userRole: varchar("userRole", { length: 64 }),
  action: varchar("action", { length: 120 }).notNull(), // "STATUT_DOUANE_MODIFIE", "FACTURE_CREEE", "PAIEMENT_ENCAISSE", "DEBOURS_AVANCE"
  entityType: varchar("entityType", { length: 64 }).notNull(), // "dossier", "invoice", "payment", "disbursement", "document"
  entityId: integer("entityId"),
  fieldChanged: varchar("fieldChanged", { length: 80 }),
  previousValue: text("previousValue"),
  newValue: text("newValue"),
  beforeData: text("beforeData"), // JSON snapshot
  afterData: text("afterData"), // JSON snapshot
  comment: text("comment"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  metadata: text("metadata"), // JSON metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("audit_logs_dossier_idx").on(table.dossierId),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  index("audit_logs_created_idx").on(table.createdAt),
]);
```

#### Étape 2 : Service Centralisé d'Audit (`server/auditService.ts`)
Créer une fonction utilitaire universelle `logAuditEvent` :
```typescript
export async function logAuditEvent(params: {
  dossierId?: number;
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  entityType: "dossier" | "invoice" | "payment" | "disbursement" | "document";
  entityId?: number;
  fieldChanged?: string;
  previousValue?: string | null;
  newValue?: string | null;
  comment?: string | null;
  metadata?: Record<string, any>;
}) { ... }
```

Brancher cette fonction sur :
1. `updateDossier` (transitions DDI, SYDONIA, BLD, BAD, BAE, Sortie PAC)
2. `createInvoice` (action: `FACTURE_CREEE`, snapshot montants HT/TVA/TTC/Débours)
3. `recordInvoicePayment` (action: `PAIEMENT_ENCAISSE`, référence quittance et mode)
4. `createPacDisbursement` (action: `DEBOURS_AVANCE`, type et montant avancé)
5. `createDocument` & `deleteDocument` (action: `DOCUMENT_AJOUTE`, `DOCUMENT_SUPPRIME`)

#### Étape 3 : Enrichissement de la Vue Historique (`client/src/pages/DossierDetailPage.tsx`)
Mettre à jour l'onglet "Audit & Historique" pour afficher des icônes distinctes selon le type d'opération (badge bleu pour douane, badge doré pour facturation/paiement, badge violet pour documents, badge émeraude pour création).

---

## 6. Synthèse des Recommandations pour l'Équipe

| Requirement | Composants Clés Concernés | Actions Prioritaires |
| :--- | :--- | :--- |
| **R2 Conflits d'Édition** | `drizzle/schema.ts`<br>`server/db.ts`<br>`server/routers.ts`<br>`DossierDetailPage.tsx`<br>`CustomsEditModal.tsx` | 1. Ajouter la colonne `version` à `dossiers`.<br>2. Transmettre `expectedVersion`/`expectedUpdatedAt` dans les mutations.<br>3. Renvoyer `TRPCError({ code: 'CONFLICT' })` en cas de divergence.<br>4. Intégrer `ConflictResolutionModal` avec rechargement sans perte. |
| **R3 Journal d'Audit** | `drizzle/schema.ts`<br>`server/db.ts`<br>`server/routers.ts`<br>`DossierDetailPage.tsx` | 1. Étendre le schéma d'audit avec `action`, `entityType`, `entityId`, `userRole`.<br>2. Systématiser le logging sur `createInvoice` et `createPacDisbursement`.<br>3. Améliorer la timeline d'audit sur la fiche dossier. |

---
*Rapport rédigé par Explorer 2 — Projet IGS Transit & Douane Guinée.*
