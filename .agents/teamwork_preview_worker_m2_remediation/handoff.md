# Handoff Report — Worker 3: Remediation of Concurrency TOCTOU & Audit Synchronization

**Agent:** Worker 3 (`teamwork_preview_worker_m2_remediation`)  
**Role:** Implementer & Quality Assurance  
**Parent Agent:** `f7bcce2f-9a8f-4812-bea3-9b914f48ebb1`  
**Date:** 2026-08-20T13:42:35Z  
**Verdict:** **RESOLVED / PASS**

---

## 1. Observation

Direct empirical observations from executing the stress test suites before and after remediation:

### Before Remediation:
1. In `server/__tests__/challenger_optimistic_locking_stress.test.ts`, 4 tests failed due to asynchronous TOCTOU yielding inside `updateDossier`:
   ```
   FAIL handles 15 simultaneous writers at DB layer: exactly 1 succeeds, 14 fail with CONFLICT
   AssertionError: expected 15 to be 1

   FAIL handles 12 simultaneous writers through tRPC router (dossier.update): exactly 1 succeeds, 11 fail with CONFLICT
   AssertionError: expected 12 to be 1

   FAIL handles mixed endpoint race condition (5 dossier.update vs 5 dossier.updateCustoms)
   AssertionError: expected 10 to be 1

   FAIL converges 10 concurrent competing workers to all successfully commit through retry loops
   AssertionError: expected 2 to be 11
   ```
2. In `importDossiersBatch`, newly created and updated batch audit log records were missing from in-memory history cache (`_memoryHistory`).
3. Audit log formatting used default JavaScript string conversion for `Date` objects rather than ISO 8601 strings.

### After Remediation:
1. `npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts server/__tests__/optimistic_locking_and_audit.test.ts server/__tests__/challenger_audit_trail_stress.test.ts`
   ```
   ✓ server/__tests__/challenger_optimistic_locking_stress.test.ts (10 tests) 38ms
   ✓ server/__tests__/optimistic_locking_and_audit.test.ts (11 tests) 72ms
   ✓ server/__tests__/challenger_audit_trail_stress.test.ts (20 tests) 88ms

   Test Files  3 passed (3)
        Tests  41 passed (41)
   ```
2. `npm run check`
   ```
   > igs-dossiers@1.0.0 check
   > tsc --noEmit
   Exit code 0
   ```
3. Full Project Test Suite `npm test`
   ```
   Test Files  37 passed (37)
        Tests  428 passed (428)
   Exit code 0
   ```
4. Production Build `npm run build`
   ```
   vite v7.3.6 building client environment for production...
   ✓ built in 5.47s
   api/index.mjs  258.8kb
   dist/index.js  266.7kb
   Exit code 0
   ```

---

## 2. Logic Chain

1. **Root Cause Analysis**:
   - In `server/db.ts`, `updateDossier` performed an `await getDossier(id)` before checking version compatibility and writing the mutated object back to `_memoryDossiers`.
   - When 15 callers simultaneously invoked `updateDossier` within the same microtask turn (`Promise.all(...)`), all 15 executed `await getDossier(id)` before any caller reached the write statement.
   - Consequently, all 15 callers read `version: 1`, satisfied `current.version === options.expectedVersion`, computed `nextVersion: 2`, and succeeded concurrently.

2. **Remediation Implemented in `server/db.ts`**:
   - **Per-Dossier Promise Mutex Queue (`runWithDossierLock`)**:
     Created a synchronization mechanism using `const dossierMutexMap = new Map<number, Promise<void>>()`.
     Each mutation on a `dossierId` atomically registers a new tail lock in `dossierMutexMap` and awaits the previous operation's resolution before entering the critical section.
     The `try...finally` block guarantees that the lock is released and clean-up occurs even if an error is thrown.
   - **TOCTOU Elimination**:
     With `runWithDossierLock`, Caller 1 acquires the lock, reads version 1, updates `_memoryDossiers` to version 2, and releases the lock.
     Caller 2 then enters the critical section, reads version 2 from `_memoryDossiers`, detects `current.version (2) !== expectedVersion (1)`, and throws `TRPCError({ code: "CONFLICT" })`.
     Callers 3 through 15 similarly reject with `CONFLICT`.
   - **Supervisor Override Support**:
     When `options.forceOverwrite === true`, the version conflict check is bypassed, allowing supervisor overrides while monotonically incrementing the version.
   - **Batch Import Audit Trail Synchronization**:
     In `importDossiersBatch`, both `IMPORT_BATCH_FUSION` and `DOSSIER_CREE` events are unshifted directly into `_memoryHistory` in addition to being batched for PostgreSQL insertion.
   - **ISO Date Formatting in Audit Trail**:
     Implemented `formatAuditValue` helper standardizing all `Date` representations to `.toISOString()` in `updateDossier` and `logAuditEvent`.

---

## 3. Caveats

- The mutex queue operates on a per-process in-memory basis. In a distributed multi-replica deployment across multiple Node.js instances, database-level conditional update queries (`UPDATE dossiers SET version = version + 1 ... WHERE id = $1 AND version = $2`) or distributed Redis locks would be employed in conjunction with this in-memory queue.
- No caveats regarding single-process SaaS operations, test environments, or API requirements.

---

## 4. Conclusion

- The concurrency TOCTOU race condition in `server/db.ts` is completely resolved.
- Simultaneous concurrent writes are strictly serialized per dossier, guaranteeing that exactly 1 write succeeds and (N - 1) writes receive `TRPCError({ code: "CONFLICT" })`.
- In-memory audit trail synchronization for batch imports is fully operational.
- All 37 test files and 428 tests in the repository pass with 100% success rate.
- TypeScript compilation (`npm run check`) and production build (`npm run build`) succeed with 0 errors.

---

## 5. Verification Method

To independently verify the fixes:

1. **Execute Target Stress Suites**:
   ```bash
   npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts server/__tests__/optimistic_locking_and_audit.test.ts server/__tests__/challenger_audit_trail_stress.test.ts
   ```
   *Expected Output: 3 test files passed, 41 tests passed (100%).*

2. **Execute Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected Output: 37 test files passed, 428 tests passed (100%).*

3. **Verify Type-Safety and Build**:
   ```bash
   npm run check && npm run build
   ```
   *Expected Output: Exit code 0, 0 TypeScript errors, clean bundle.*
