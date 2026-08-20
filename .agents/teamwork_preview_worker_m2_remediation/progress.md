# Progress — Worker 3 (Milestone 2 & 3 Remediation)

Last visited: 2026-08-20T13:42:30Z

## Status: COMPLETE (100% Tests Passing)

### Completed Tasks:
1. **Concurrency TOCTOU Fix in `server/db.ts`**:
   - Implemented per-dossier promise mutex queue (`dossierMutexMap` / `runWithDossierLock`) to serialize concurrent updates per dossier ID.
   - Guaranteed that 15 simultaneous writers on version 1 result in exactly 1 success and 14 rejections with `TRPCError({ code: "CONFLICT" })`.
   - Verified that `forceOverwrite: true` succeeds and increments the version monotonically.
   - Verified that 10 concurrent competing workers in an optimistic retry loop converge to version 11.

2. **Batch Audit Log Memory Sync in `server/db.ts`**:
   - Updated `importDossiersBatch` to unshift audit history entries (`IMPORT_BATCH_FUSION` and `DOSSIER_CREE`) into `_memoryHistory`.

3. **Date Formatting in Audit Logs in `server/db.ts`**:
   - Created `formatAuditValue` helper standardizing `Date` instances to ISO strings (`date.toISOString()`).
   - Integrated `formatAuditValue` in `updateDossier` and `logAuditEvent`.

4. **Verification & Quality Gate**:
   - `npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts`: **10/10 PASS**
   - `npx vitest run server/__tests__/optimistic_locking_and_audit.test.ts`: **11/11 PASS**
   - `npx vitest run server/__tests__/challenger_audit_trail_stress.test.ts`: **20/20 PASS**
   - `npm run check`: **PASS (0 errors)**
   - `npm test`: **37/37 files passed, 428/428 tests passed (100%)**
   - `npm run build`: **PASS**
