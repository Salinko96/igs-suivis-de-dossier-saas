# Handoff Report — Milestone 2 Adversarial Stress-Test & Concurrency Challenge

**Agent:** Challenger 1 (`teamwork_preview_challenger_m2_m3_1`)  
**Role:** Empirical Challenger (critic, specialist)  
**Parent Agent:** `f7bcce2f-9a8f-4812-bea3-9b914f48ebb1`  
**Date:** 2026-08-20T13:35:15Z  
**Verdict:** **REQUEST_CHANGES**  

---

## 1. Observation

Direct empirical observations from executing the stress test suite:

### Test Suite Execution:
Executed command:
```bash
npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts
```

### Direct Verbatim Test Output:
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  server/__tests__/challenger_optimistic_locking_stress.test.ts > Empirical Challenger Stress-Test Suite: Milestone 2 Optimistic Locking & Concurrency > 1. High-Concurrency Simultaneous Updates Stress Test > handles 15 simultaneous writers at DB layer: exactly 1 succeeds, 14 fail with CONFLICT
AssertionError: expected 15 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 15

 ❯ server/__tests__/challenger_optimistic_locking_stress.test.ts:57:32
     55| 
     56|       // Invariant 1: Exactly 1 update must succeed
     57|       expect(fulfilled.length).toBe(1);
       |                                ^
     58|       expect(fulfilled[0].value.version).toBe(2);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  server/__tests__/challenger_optimistic_locking_stress.test.ts > Empirical Challenger Stress-Test Suite: Milestone 2 Optimistic Locking & Concurrency > 1. High-Concurrency Simultaneous Updates Stress Test > handles 12 simultaneous writers through tRPC router (dossier.update): exactly 1 succeeds, 11 fail with CONFLICT
AssertionError: expected 12 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 12

 ❯ server/__tests__/challenger_optimistic_locking_stress.test.ts:115:32
    115|       expect(fulfilled.length).toBe(1);
       |                                ^
    116|       expect(fulfilled[0].value.version).toBe(2);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  server/__tests__/challenger_optimistic_locking_stress.test.ts > Empirical Challenger Stress-Test Suite: Milestone 2 Optimistic Locking & Concurrency > 1. High-Concurrency Simultaneous Updates Stress Test > handles mixed endpoint race condition (5 dossier.update vs 5 dossier.updateCustoms)
AssertionError: expected 10 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 10

 ❯ server/__tests__/challenger_optimistic_locking_stress.test.ts:177:32
    177|       expect(fulfilled.length).toBe(1);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  server/__tests__/challenger_optimistic_locking_stress.test.ts > Empirical Challenger Stress-Test Suite: Milestone 2 Optimistic Locking & Concurrency > 5. Simulated Real-World Client Optimistic Retry Loop > converges 10 concurrent competing workers to all successfully commit through retry loops
AssertionError: expected 2 to be 11 // Object.is equality

- Expected
+ Received

- 11
+ 2 

 ❯ server/__tests__/challenger_optimistic_locking_stress.test.ts:512:37
    511|       const finalDossier = await db.getDossier(testDossier.id);
    512|       expect(finalDossier?.version).toBe(11);
       |                                     ^

 Test Files  1 failed (1)
      Tests  4 failed | 6 passed (10)
```

### Full Test Suite Output:
`npm test` resulted in 35 passed test files, 1 failed test file (`server/__tests__/challenger_optimistic_locking_stress.test.ts`), 404 passed tests, 4 failed tests.

---

## 2. Logic Chain

1. **Root Cause Analysis (Time-Of-Check to Time-Of-Use / TOCTOU)**:
   - In `server/db.ts` (lines 1039–1070):
     ```typescript
     export async function updateDossier(
       id: number,
       input: Partial<EditableDossier>,
       userId?: number,
       authorName?: string,
       options?: UpdateDossierOptions
     ) {
       const current = await getDossier(id);
       if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });

       // 1. Contrôle de Concurrence Optimiste (Optimistic Locking)
       if (!options?.forceOverwrite) {
         if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
           throw new TRPCError({
             code: "CONFLICT",
             message: `...`,
           });
         }
         ...
       }
       const nextVersion = (current.version || 1) + 1;
       ...
       _memoryDossiers[memIdx] = updated;
     ```
   - `getDossier(id)` is an `async` function. In Node.js / JavaScript V8, invoking `await getDossier(id)` yields to the event loop.
   - When 15 concurrent requests call `updateDossier(testDossier.id, ..., { expectedVersion: 1 })` via `Promise.all(...)`, all 15 execute `await getDossier(id)` before any caller proceeds to line 1050.
   - Consequently, all 15 callers receive a snapshot where `current.version === 1`.
   - When execution resumes after `await getDossier(id)`, each caller checks `current.version (1) !== options.expectedVersion (1)`, which evaluates to `false`.
   - All 15 callers calculate `nextVersion = 2`, overwrite `_memoryDossiers[memIdx]`, and resolve with HTTP 200 / success.
   - **Zero callers receive a `CONFLICT` error (0 rejections instead of 14 rejections)**, resulting in silent concurrent overwrites and complete loss of race-condition protection.

2. **Sequential vs. Concurrent Behavior**:
   - Sequential updates (`1 -> 2 -> 3 -> 4 -> 5`) pass because each update is awaited before the next begins.
   - Force overwrite (`forceOverwrite: true`) passes.
   - However, **true simultaneous concurrency** (the core premise of Milestone 2) completely fails to detect conflicts when multiple users submit edits in the same event-loop window.

---

## 3. Caveats

- Sequential validation tests (single writer advancing state step-by-step) pass cleanly.
- The failure occurs specifically under concurrent asynchronous dispatch (`Promise.all` / multiple concurrent network requests).

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 2 cannot be approved in its current state because concurrent updates on the same dossier suffer from an asynchronous TOCTOU race condition where all simultaneous writers succeed and overwrite each other instead of throwing `CONFLICT` (HTTP 409).

### Required Remediation (for Worker):
1. **Critical Section / Per-Dossier Serialization or Live Re-Check**:
   In `server/db.ts`, synchronize updates per dossier (e.g. using a promise queue per `dossierId` or re-checking the live in-memory `_memoryDossiers[memIdx].version` synchronously before committing the update).
   For example:
   ```typescript
   // Atomic / Mutex queue per dossier:
   const dossierMutexMap = new Map<number, Promise<any>>();

   // Alternatively, inside updateDossier:
   const live = _memoryDossiers.find(d => d.id === id);
   if (!options?.forceOverwrite && options?.expectedVersion !== undefined && live && live.version !== options.expectedVersion) {
     throw new TRPCError({
       code: "CONFLICT",
       message: `Conflit d'édition simultanée : ce dossier a été modifié par un autre utilisateur (version locale: v${options.expectedVersion}, version serveur: v${live.version}). Veuillez recharger ou écraser les modifications.`,
     });
   }
   ```
   *Note: Because `getDossier` may yield, checking `live.version` synchronously right before writing to `_memoryDossiers` and wrapping in a per-dossier promise chain guarantees that concurrent writes are properly serialized and rejected.*

2. **Drizzle SQL Conditional Update**:
   Ensure the database update is atomic by including `eq(dossiers.version, options.expectedVersion)` in the `where` clause when `expectedVersion` is provided.

---

## 5. Verification Method

To verify the failure and subsequent fix:

1. **Run Dedicated Milestone 2 Concurrency Stress Test:**
   ```bash
   npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts
   ```
   - Current status: **4 FAILED, 6 PASSED**
   - Expected after fix: **10 PASSED**

2. **Run Full Test Suite:**
   ```bash
   npm test
   ```
   - Expected after fix: **36/36 test files passed, 408/408 tests passed**.
