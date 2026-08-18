## 2026-08-18T15:54:03Z

You are the Backend & RBAC Implementation Worker for Milestone 1 of the IGS Guinée SaaS project.

Working Directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m1
Authoritative User Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/ORIGINAL_REQUEST.md
Project Blueprint: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
Survey Handoffs: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. `server/_core/trpc.ts`:
   - Implement procedure builders: `declarantProcedure` (allows admin, manager, declarant), `comptableProcedure` (allows admin, manager, comptable), `internalProcedure` (allows admin, manager, declarant, comptable). Ensure unauthorized requests throw `TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" })`.
2. `drizzle/schema.ts` & `shared/types.ts`:
   - Add fields to `invoices`: `invoiceType` (Proforma, Definitive), `exchangeRate` (integer, default 8650), `paymentMethod`, `paymentReference`, `receiptNumber`, `customsDutiesAmount`, `portFeesAmount`.
   - Add fields to `dossiers`: `ddiGucegNumber`, `badStatus`, `baeStatus`.
3. `server/db.ts`:
   - In both PostgreSQL and `_memory` mode:
     - `listTasks({ assignedTo?: string, status?: string })`
     - `updateTaskStatus(id, status)` and task status toggling
     - `updateInvoice(id, data)`
     - `recordInvoicePayment(id, { paymentMethod, paymentReference, paidAmount })` (generates `receiptNumber: "REC-2026-" + id`, sets `status: "Payée"`, sets `paidAt`, updates dossier `financialStatus`)
     - `getExchangeRate()` (default 8650 GNF/USD) and `setExchangeRate(rate)`
     - Maintain dual parity between DB queries and memory fallback.
4. `server/routers.ts`:
   - Secure `finance` procedures with `comptableProcedure` (for creating/updating invoices, recording payments, changing exchange rate, summary).
   - Ensure `finance.summary` calculates multi-currency metrics (total GNF, total USD equivalent at exchange rate, total margin).
   - Ensure `dossier` endpoints validate permissions (client isolated to `currentUserCompany`, declarant can update customs fields, comptable cannot delete dossiers).
   - Ensure `task.list` supports filtering by `assignedTo`.
5. Run `npm test` and `npm run check` to verify 100% passing tests and 0 TypeScript errors.

Output:
Write a comprehensive report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m1/handoff.md` with:
- Summary of changes and modified files
- Commands executed and outputs (tests & typecheck)
- Self-verification results
Send a message back to the orchestrator when finished.
