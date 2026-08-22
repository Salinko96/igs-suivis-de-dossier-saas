## 2026-08-22T13:27:59Z

Implement the Serverless & Database Resilience Hardening for Milestone 1:
1. In `server/db.ts`:
   - Set default `timeoutMs = 1500` in `withDbTimeout` (around line 575).
   - Standardize all explicit calls using 2000ms (e.g. `getDossierByPortalCode` at line 1353, `listAuditLogs` at line 1542, `updateDossier` at line 1805) to 1500ms.
   - In `importDossiersBatch` (around lines 2170–2195), ensure the database batch write `Promise.allSettled(dbPromises)` is wrapped with `withDbTimeout(Promise.allSettled(dbPromises), 1500)`.
2. In `server/alertsService.ts` and `server/whatsappService.ts`:
   - Add timeout protection (`AbortSignal.timeout(3000)` or `AbortController` with 3000ms) to all external HTTP `fetch` calls (WhatsApp API and Resend API). Ensure errors are caught gracefully and do not produce unhandled promise rejections.
3. In `server/cloudStorageService.ts` and `server/supabase.ts`:
   - Wrap remote S3 / Supabase storage upload commands with a 3000ms timeout promise race / controller, falling back gracefully to Base64 data URIs on timeout or failure.
4. Verification:
   - Run `npm run check` (verify 0 TypeScript errors).
   - Run `npm test` (verify 100% test pass rate).
   - Run `npm run build` (verify production bundle compiles without errors).

Deliverables:
- Write your implementation details and test verification outputs to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m1/handoff.md`.
- Send a completion message back to the orchestrator with verification summary.
