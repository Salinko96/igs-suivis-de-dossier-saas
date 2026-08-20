# Independent Review Report — Milestones 2 & 3: Optimistic Locking & Audit Trail

**Reviewer:** Reviewer 2 (`teamwork_preview_reviewer_m2_m3_2`)  
**Parent Agent:** `f7bcce2f-9a8f-4812-bea3-9b914f48ebb1`  
**Date:** 2026-08-20T13:36:45Z  
**Verdict:** `REQUEST_CHANGES`  
**Type:** Hard (Review Complete)

---

## 1. Observation

Direct observations from codebase inspection, empirical stress-testing, and build runs:

### A. Test Execution & Build Verification
1. **TypeScript Typecheck (`npm run check`)**:
   - Result: Exit code `0` (0 TypeScript errors).
2. **Production Build (`npm run build`)**:
   - Result: Exit code `0` (Vite client bundle, `api/index.mjs`, and `dist/index.js` generated successfully).
3. **Full Vitest Test Suite (`npm test`)**:
   - Result: Exit code `1`.
   - Outcome: **35 passed files, 1 failed file (404 tests passed, 4 tests failed)**.
   - Failing file: `server/__tests__/challenger_optimistic_locking_stress.test.ts`
   - Failing tests:
     - `1. High-Concurrency Simultaneous Updates Stress Test > handles 15 simultaneous writers at DB layer: exactly 1 succeeds, 14 fail with CONFLICT`:
       ```text
       AssertionError: expected 15 to be 1 // Object.is equality
       - Expected: 1
       + Received: 15
       ```
     - `1. High-Concurrency Simultaneous Updates Stress Test > handles 12 simultaneous writers through tRPC router (dossier.update): exactly 1 succeeds, 11 fail with CONFLICT`:
       ```text
       AssertionError: expected 12 to be 1 // Object.is equality
       - Expected: 1
       + Received: 12
       ```
     - `1. High-Concurrency Simultaneous Updates Stress Test > handles mixed endpoint race condition (5 dossier.update vs 5 dossier.updateCustoms)`:
       ```text
       AssertionError: expected 10 to be 1 // Object.is equality
       - Expected: 1
       + Received: 10
       ```
     - `5. Simulated Real-World Client Optimistic Retry Loop > converges 10 concurrent competing workers to all successfully commit through retry loops`:
       ```text
       AssertionError: expected 2 to be 11 // Object.is equality
       - Expected: 11
       + Received: 2
       ```

### B. Codebase & Implementation Analysis
1. **Concurrency Race Condition in `server/db.ts:1039-1150` (`updateDossier`)**:
   - In `updateDossier`, the first line is `const current = await getDossier(id);`.
   - Because `getDossier` is an `async` function, calling `await getDossier(id)` yields control to the Node.js event loop microtask queue.
   - When multiple concurrent callers invoke `updateDossier` or `caller.dossier.update` in the same tick (e.g. via `Promise.all` / simultaneous user requests), all concurrent callers evaluate `getDossier(id)` before ANY caller reaches line 1132 (`_memoryDossiers[memIdx] = updated`).
   - Consequently, all concurrent callers read the same snapshot `current.version === 1`.
   - Every caller passes the version check `if (current.version !== options.expectedVersion)` (since `1 !== 1` is false), increments version to 2, and overwrites the in-memory record.
   - Instead of 1 write succeeding and N-1 writes failing with `TRPCError({ code: "CONFLICT" })`, **all N concurrent writes succeed and overwrite each other**.

2. **Frontend UX & Side-by-Side Conflict Modal (`ConflictResolutionModal.tsx`, `CustomsEditModal.tsx`, `DossierDetailPage.tsx`)**:
   - `ConflictResolutionModal.tsx`:
     - Beautiful, clean amber banner with explicit conflict explanation.
     - Field-by-field diff comparison table with blue box (local input) vs emerald box (server state).
     - Action buttons: "Fermer sans modifier", "Recharger les données du serveur" (with query invalidation), and "Écraser avec mes modifications" (`forceOverwrite: true`).
   - `CustomsEditModal.tsx` & `DossierDetailPage.tsx`:
     - Correctly transmits `expectedVersion` and `expectedUpdatedAt`.
     - Catches `CONFLICT` / HTTP 409 and triggers `ConflictResolutionModal`.

3. **Audit Trail & Regulatory Logging (`server/db.ts`, `server/routers.ts`, `DossierDetailPage.tsx`)**:
   - Schema `dossierStatusHistory` properly enriched with `userRole`, `action`, `entityType`, `entityId`, `beforeData`, `afterData`, `ipAddress`, `metadata`.
   - Logging coverage:
     - Customs events: `DDI_MODIFIEE`, `SYDONIA_DECLAREE`, `BLD_LIQUIDEE`, `BAD_STATUT_MODIFIE`, `BAE_STATUT_MODIFIE`, `SORTIE_PAC_ENREGISTREE`.
     - Financial operations: `FACTURE_CREEE` (`createInvoice`), `FACTURE_MODIFIEE` (`updateInvoice`), `PAIEMENT_ENCAISSE` (`recordInvoicePayment`), `DEBOURS_AVANCE` (`createPacDisbursement`).
     - Documents: `DOCUMENT_AJOUTE`, `DOCUMENT_SUPPRIME`.
     - Lifecycle: `DOSSIER_CREE`, `IMPORT_BATCH_FUSION`.
   - UI on `DossierDetailPage.tsx`:
     - Gated by `perms.canViewAudit`.
     - Category filters ("Tout l'historique", "Douane & PAC", "Finances & Factures", "Pièces & Documents").
     - Stat summary cards, colored timeline dots, user role badges (`[DECLARANT]`, `[COMPTABLE]`, `[ADMIN]`), localized French timestamps, IP address metadata, and before/after diffs.

---

## 2. Logic Chain

1. **Requirement R2 (Optimistic Locking & Concurrency Protection)** requires protecting dossier records from concurrent overwrite when multiple employees simultaneously edit the same dossier at Port Autonome de Conakry.
2. **Failure Analysis**: In `server/db.ts`, the asynchronous yield `await getDossier(id)` breaks atomicity. Sequential updates (`await step1(); await step2();`) pass because memory has updated before the second call starts. However, true simultaneous updates (`Promise.all([step1(), step2()])`) suffer from a race condition where both callers read the stale version simultaneously and bypass the conflict check.
3. **Required Remediation**:
   - In `server/db.ts`: In `updateDossier`, perform a synchronous check-and-update on `_memoryDossiers` (or use a per-dossier mutex/lock or synchronous memory lookup `_memoryDossiers.find(...)`) before any asynchronous suspension point, ensuring that the first concurrent write atomically increments `version` in-place.
   - For PostgreSQL database updates: Ensure the query enforces conditional matching `WHERE id = $1 AND version = $2` to guarantee atomicity at the SQL level.
4. **All other aspects of Milestones 2 & 3** (Conflict modal UX, audit logging, role badges, tRPC routes, TypeScript compilation, and production build) are exceptionally well-implemented and fully conform to specifications.

---

## 3. Caveats

- The race condition specifically affects simultaneous concurrent async execution (`Promise.allSettled` / simultaneous HTTP requests in the same event loop tick). Sequential edits (one after another) correctly trigger `CONFLICT`.
- No regressions were found in existing portal search, client tracking, or RBAC functionality.

---

## 4. Conclusion

- **Verdict**: `REQUEST_CHANGES`
- **Finding (Major)**: Concurrency race condition in `updateDossier` (`server/db.ts:1039-1150`) allows simultaneous async writes to bypass optimistic locking checks, causing 4 test failures in `server/__tests__/challenger_optimistic_locking_stress.test.ts`.
- **Recommended Action for Worker 2**:
  1. In `server/db.ts` function `updateDossier`:
     - Synchronously look up `_memoryDossiers.find(d => d.id === id)` and execute the version comparison and `memEntry.version = nextVersion` synchronously before any `await` statement, or protect `updateDossier` with a per-dossier asynchronous lock/mutex.
  2. Re-run `npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts` to ensure all 408 tests pass cleanly.

---

## 5. Verification Method

To reproduce and verify the finding:

1. **Run the Stress Test Suite**:
   ```bash
   npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts
   ```
   *Current Result: 4 failing tests in `challenger_optimistic_locking_stress.test.ts`.*  
   *Expected Post-Fix: 408/408 tests passing across all 36 test files.*

2. **Run Full Test Suite**:
   ```bash
   npm test
   ```

3. **Run TypeScript Check & Build**:
   ```bash
   npm run check
   npm run build
   ```
