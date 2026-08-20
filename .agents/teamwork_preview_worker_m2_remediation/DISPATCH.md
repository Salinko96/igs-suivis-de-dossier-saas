## 2026-08-20T13:38:12Z

You are Worker 3 on the IGS Transit & Douane Guinée SaaS project.
Your working directory is: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m2_remediation
Project root: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Authoritative Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md (Section ## 2026-08-20T12:57:04Z)
Project Specification: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
Challenger 1 Stress Report: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_challenger_m2_m3_1/handoff.md
Reviewer 1 Report: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_reviewer_m2_m3_1/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission: Fix Concurrency TOCTOU Race Condition in server/db.ts and sync batch audit logs:
1. Concurrency TOCTOU Fix (`server/db.ts`):
   - In `updateDossier`: implement a per-dossier mutex/promise queue (e.g. `const dossierMutexMap = new Map<number, Promise<any>>()`) or atomic check-and-lock to serialize concurrent mutations on the same `dossierId`.
   - Ensure that when 15 simultaneous writers attempt an update on `version = 1` via `Promise.all(...)`, exactly 1 succeeds and 14 fail with `TRPCError({ code: "CONFLICT" })`.
   - Also ensure that when `forceOverwrite: true` is passed, the update succeeds and increments the version.
2. Batch Audit Log Memory Sync (`server/db.ts`):
   - In `importDossiersBatch`, ensure the generated audit history items are pushed to `_memoryHistory` in addition to PostgreSQL.
3. Date Formatting in Audit Logs (`server/db.ts`):
   - Standardize date representations in audit entries to ISO strings (`date.toISOString()`).
4. Verification:
   - Run `npx vitest run server/__tests__/challenger_optimistic_locking_stress.test.ts` and verify 10/10 tests pass.
   - Run `npx vitest run server/__tests__/optimistic_locking_and_audit.test.ts` and verify 11/11 tests pass.
   - Run `npx vitest run server/__tests__/challenger_audit_trail_stress.test.ts` and verify 20/20 tests pass.
   - Run `npm run check` and `npm run test` ensuring 100% of all tests pass.
5. Write your handoff report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m2_remediation/handoff.md` and send a completion message.
