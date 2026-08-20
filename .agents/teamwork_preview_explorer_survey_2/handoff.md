# Handoff Report — Explorer 2 Survey (R2 & R3)

## 1. Observation

- **Project Root**: `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS`
- **Baseline Test Suite Execution**:
  - Command: `npm test`
  - Output: `31 passed (31) - 311 passed (311)` across all test files in 11.18s. Zero test failures in baseline.
- **Table `dossiers` Schema (`drizzle/schema.ts:41-94`)**:
  - Columns: `id`, `dossierNumber`, `clientDossierNumber`, `clientId`, `client`, `blLtaNumber`, `cargoNature`, `transportMode`, `eta`, `originPort`, `destinationPort`, `port`, `container`, `bulk`, `goodsReleaseDate`, `daysOnQuay`, `declarationNumber`, `bulletinNumber`, `finalDeclarationNumber`, `ddiGucegNumber`, `badStatus`, `baeStatus`, `calculatedStatus`, `calculatedPriority`, `completionRate`, `documentStatus`, `customsStatus`, `portStatus`, `financialStatus`, `fieldOperation`, `responsible`, `nextAction`, `fieldAlert`, `deliveryLocation`, `declarant`, `service`, `regime`, `notes`, `portalAccessCode`, `createdById`, `updatedById`, `createdAt`, `updatedAt`.
  - **No `version` column** exists on table `dossiers`.
- **Dossier Mutations (`server/routers.ts:347-389`)**:
  - `dossier.update`: `input: z.object({ id: z.union([z.number(), z.string()]), data: dossierPayload })` (line 348). No `version` or `expectedUpdatedAt` in input schema.
  - `dossier.updateCustoms`: `input: z.object({ id: z.union([z.number(), z.string()]), data: dossierPayload.partial() })` (line 366-372). No `version` or `expectedUpdatedAt` in input schema.
  - `db.updateDossier` (`server/db.ts:843-899`): Performs `current = await getDossier(id)` and updates directly without concurrency check or throwing `TRPCError({ code: "CONFLICT" })`.
- **Frontend Mutation & Conflict UI (`client/src/pages/DossierDetailPage.tsx:489-497`, `CustomsEditModal.tsx:72-92`)**:
  - Neither component stores or sends `version` or `expectedUpdatedAt`.
  - `onError` handler only displays a generic error toast. No conflict detection dialog (`ConflictResolutionModal`), diff comparison, or merge/reload option exists.
- **Audit Trail Schema & Services (`drizzle/schema.ts:111-124`, `server/db.ts:1214-1246`, `server/routers.ts:486-490`)**:
  - Existing table: `dossierStatusHistory` with columns `id`, `dossierId`, `changedById`, `authorName`, `fieldChanged`, `previousValue`, `newValue`, `comment`, `createdAt`.
  - Missing standard compliance fields: `action` (e.g. `STATUT_DOUANE_MODIFIE`, `FACTURE_CREEE`), `entityType` (`dossier`, `invoice`, `disbursement`), `entityId`, `userRole`, `beforeData`/`afterData` (JSON), `ipAddress`, and `metadata`.
  - Financial operations: `createInvoice` (`server/db.ts:1271-1336`) does not insert an explicit invoice creation record into history; `createPacDisbursement` (`server/db.ts:1503-1528`) does not log to history at all.
  - Frontend display (`client/src/pages/DossierDetailPage.tsx:1433-1458`): Renders a timeline under the "Audit & Historique" tab if `perms.canViewAudit` is true.

## 2. Logic Chain

1. **R2 Concurrency Vulnerability**:
   - Because `dossiers` lacks a `version` column and mutations do not validate `expectedUpdatedAt`/`version`, two concurrent edits will overwrite each other silently (last-write-wins).
   - Therefore, to satisfy R2, `dossiers` needs `version: integer("version").default(1).notNull()`, `dossier.update` must validate `expectedVersion` or `expectedUpdatedAt`, throw `TRPCError({ code: "CONFLICT" })` on mismatch, and the frontend must display a conflict modal with server diff and reload/merge choices.
2. **R3 Audit Trail Gaps**:
   - Because `dossierStatusHistory` only tracks field-level text changes and lacks entity typing (`entityType`, `entityId`, `action`), operations like invoice creation, invoice payments, and PAC disbursement advances are either untracked or partially tracked without structured action metadata.
   - Therefore, to satisfy R3, the audit trail schema must be generalized to track all customs transitions and financial operations with user role, action, and structured previous/new values.

## 3. Caveats

- **Dual-Storage Synchronization**: The application uses a hybrid storage model (`_memoryDossiers` and PostgreSQL). Concurrency control and audit log insertion must update both the in-memory store and the PostgreSQL tables consistently.
- **Import Batch**: `importDossiersBatch` modifies multiple records simultaneously; optimistic locking should either be bypassed with an explicit admin/batch override flag or bulk-versioned.

## 4. Conclusion

The codebase is cleanly structured and fully tested (311/311 tests passing), but completely lacks optimistic locking mechanisms (R2) and has an incomplete audit schema (R3). Both features can be implemented with zero disruption to existing business logic by:
1. Adding `version: integer("version").default(1).notNull()` to `dossiers` in `drizzle/schema.ts` and enforcing version checks in `server/db.ts` / `server/routers.ts`.
2. Implementing `ConflictResolutionModal` in `client/src/components/ConflictResolutionModal.tsx` and handling `TRPCError CONFLICT` in `DossierDetailPage.tsx` and `CustomsEditModal.tsx`.
3. Enriching `dossierStatusHistory` / `audit_logs` in `drizzle/schema.ts` and ensuring all customs status changes and financial events (`createInvoice`, `recordPayment`, `createPacDisbursement`) generate audit entries.

## 5. Verification Method

To independently verify this investigation:
1. Run the test suite: `npm test`
2. Inspect schema: `drizzle/schema.ts` lines 41-94 (`dossiers`), lines 111-124 (`dossierStatusHistory`).
3. Inspect tRPC mutations: `server/routers.ts` lines 347-389 (`dossier.update`, `dossier.updateCustoms`), lines 486-490 (`audit`), lines 493-657 (`finance`).
4. Inspect database helper: `server/db.ts` lines 843-899 (`updateDossier`), lines 1214-1246 (`listDossierHistory`, `addDossierHistory`).
5. Inspect frontend components: `client/src/pages/DossierDetailPage.tsx` lines 489-497, 1433-1458, and `client/src/components/CustomsEditModal.tsx` lines 72-115.
