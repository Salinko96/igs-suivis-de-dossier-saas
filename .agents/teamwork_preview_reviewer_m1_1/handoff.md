# Reviewer Report & Handoff — Milestone 1 : Backend & RBAC Implementation

**Project:** IGS Guinée SaaS — Role Simulation & Operational RBAC  
**Reviewer:** `teamwork_preview_reviewer_m1_1` (Reviewer & Adversarial Critic)  
**Date:** 2026-08-18  
**Verdict:** **APPROVE**  
**Integrity Assessment:** **CLEAN / NO INTEGRITY VIOLATION DETECTED**

---

## 1. Observation

### 1.1. Inspected Files & Key Line References
1. **`server/_core/trpc.ts`**:
   - Lines 51–70: `declarantProcedure` defines middleware permitting `admin`, `manager`, and `declarant`. Rejects other roles with `TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" })`.
   - Lines 72–91: `comptableProcedure` defines middleware permitting `admin`, `manager`, and `comptable`. Rejects other roles with `TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" })`.
   - Lines 93–112: `internalProcedure` defines middleware permitting `admin`, `manager`, `declarant`, and `comptable`. Rejects `client` and other external roles with `TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" })`.

2. **`drizzle/schema.ts` & `shared/types.ts`**:
   - Lines 3–10: Enums defined for `role`, `calculatedStatus`, `calculatedPriority`, `documentType`, `invoiceStatus`, `invoiceType` (`Proforma`, `Definitive`), `taskStatus`, and `notificationType`.
   - Lines 26–76: `dossiers` table extended with `ddiGucegNumber` (varchar 160), `badStatus` (varchar 64), and `baeStatus` (varchar 64).
   - Lines 108–139: `invoices` table extended with `invoiceType`, `exchangeRate` (default 8650), `customsDutiesAmount` (default 0), `portFeesAmount` (default 0), `disbursementsAmount`, `paymentMethod`, `paymentReference`, `receiptNumber`, `notes`, `dueDate`, and `paidAt`.
   - Lines 141–155: `dossierTasks` table with `assignedTo`, `status`, `priority`, `dueDate`, and `completedAt`.
   - `shared/types.ts`: Re-exports all inferred schema types and core error classes cleanly.

3. **`server/db.ts` (Dual Parity Architecture: PostgreSQL & Persistent In-Memory Fallback)**:
   - Lines 1208–1244: `listTasks(filterOrDossierId)` supports filtering by `dossierId`, `status`, and case-insensitive/`LIKE` `assignedTo` across both SQL Drizzle queries and `_memoryTasks`.
   - Lines 1270–1294: `updateTaskStatus` and `toggleTaskStatus` persist timestamped `completedAt` on status change to `Termine` (null when reopened) in both SQL and memory stores.
   - Lines 1010–1061: `createInvoice` computes HT/TVA/TTC/débours and automatically updates the associated dossier's `financialStatus` (`Payé`, `Fact. Proforma`, or `Facturé`).
   - Lines 1063–1108: `updateInvoice` synchronizes invoice data and updates dossier `financialStatus`.
   - Lines 1110–1160: `recordInvoicePayment` generates receipt number formatted as `REC-2026-${id}`, marks invoice `status: "Payée"`, sets `paidAt`, updates dossier `financialStatus: "Payé"`, and creates an entry in `dossierStatusHistory`.
   - Lines 1162–1205: `getExchangeRate` & `setExchangeRate` persist USD/GNF rates in `referenceItems` (category `exchange_rate`) and memory.
   - Lines 463–511 & 216–267: `listDossiers` and `dossier.get` enforce multi-tenant company isolation for `role === "client"`.

4. **`server/routers.ts`**:
   - `finance`: Fully protected via `comptableProcedure` (`listInvoices`, `createInvoice`, `updateInvoice`, `recordPayment`, `setExchangeRate`, `summary`).
   - `finance.summary`: Real dynamic multi-currency aggregation (`totalCA_GNF`, `totalCA_USD`, `totalMargin_GNF`, `totalMargin_USD`, `totalDisbursements_GNF`, `totalCustomsDuties_GNF`, `totalPortFees_GNF`, `pendingInvoices`, `paidInvoices`, `totalDemurrageRisk`, `exchangeRate`).
   - `dossier`: Protected procedures (`create` and `update` use `internalProcedure`; `updateCustoms` and `importBatch` use `declarantProcedure`; `remove` uses `adminProcedure`; `get` checks `ctx.user.clientCompany !== dossier.client` throwing `403 FORBIDDEN`).
   - `task`: Protected procedures (`list` uses `protectedProcedure`, `create`, `updateStatus`, `toggleStatus` use `internalProcedure`).

### 1.2. Automated Verification & Testing Commands
- **TypeScript Type Check:**
  - Command: `npm run check` (`tsc --noEmit`)
  - Result: **0 errors**, Exit Code 0.
- **Vitest Test Suite:**
  - Command: `npm test` (`vitest run`)
  - Result: **15 test files passed (100%)**, **120 tests passed**, 0 failed.
- **Production Build:**
  - Command: `npm run build` (`vite build && esbuild`)
  - Result: **Successful build**, 0 errors.

---

## 2. Logic Chain

1. **RBAC Protocol Enforcement:**
   - *Observation:* tRPC procedures `declarantProcedure`, `comptableProcedure`, and `internalProcedure` validate `ctx.user.role` against role whitelists and throw `TRPCError` with code `FORBIDDEN` and French message `"Accès refusé pour ce profil"`.
   - *Logic:* This prevents privilege escalation at the router level before any database query or business mutation can execute.
   - *Conclusion:* Verified and secure.

2. **Schema & Business Integrity:**
   - *Observation:* `invoices` and `dossiers` tables in `drizzle/schema.ts` incorporate Guinean trade and customs standards (DDI GUCEG, BAD/BAE, Proforma/Definitive types, Débours douane and PAC breakdown, VAT 18%, receipt number).
   - *Logic:* Full typed schemas guarantee that data passed through tRPC routers matches the required database constraints without type coercion discrepancies.
   - *Conclusion:* Verified and consistent.

3. **Dual Parity Robustness:**
   - *Observation:* `server/db.ts` contains mirroring execution paths for all entity operations (Drizzle SQL when `DATABASE_URL` is available, in-memory structures `_memory*` otherwise).
   - *Logic:* This guarantees deterministic execution whether the backend is run against live PostgreSQL or during serverless/offline unit testing.
   - *Conclusion:* Verified and functional.

4. **Task & Finance Operational Workflows:**
   - *Observation:* `task.list` allows filtering by `assignedTo` (supporting Mamadou Diallo and Fatoumata Camara) and `status`. `finance.recordPayment` updates both invoice and dossier records synchronously while generating quittance `REC-2026-X`.
   - *Logic:* Fulfills the operational requirements of R2 (Déclarant PAC) and R3 (Comptable) as specified in `ORIGINAL_REQUEST.md`.
   - *Conclusion:* Verified and complete.

---

## 3. Adversarial Review & Integrity Analysis

### 3.1. Integrity Verification Checklist
| Check | Status | Evidence |
|---|---|---|
| Hardcoded test results / facade returns | **PASSED** | Aggregations in `finance.summary` and state calculations in `dossierRules.ts` use dynamic reduction and formula calculation over real data. |
| Dummy implementations | **PASSED** | All routes execute complete database mutations and audit logging. |
| Bypassed tasks | **PASSED** | Dual parity implemented across all methods in `server/db.ts`. |
| Fabricated verification outputs | **PASSED** | Live test runs verified: 15 suites, 120 tests passing, clean TypeScript check. |
| Self-certifying without genuine logic | **PASSED** | Full 4-tier testing hierarchy independently verified. |

### 3.2. Attack Surface Stress-Testing
- **Unauthorized finance access:** Attempting to call `finance.summary` or `finance.createInvoice` with role `declarant` or `client` throws `403 FORBIDDEN` (`"Accès refusé pour ce profil"`).
- **Client cross-tenant leakage:** Calling `dossier.get` with client session for a foreign company dossier throws `403 FORBIDDEN` (`"Accès refusé pour ce dossier"`). Calling `dossier.list` strictly scopes the query to `clientCompany`.
- **Administrative deletion:** Attempting `dossier.remove` with non-admin roles (`declarant`, `comptable`, `client`) throws `403 FORBIDDEN`.
- **Unauthenticated requests:** Calling protected procedures without session token throws `401 UNAUTHORIZED`.

---

## 4. Caveats

- **OAuth Warning in Test Environment:** The logged message `[OAuth] ERROR: OAUTH_SERVER_URL is not configured!` in Vitest output is normal in local mock mode and does not affect test execution or security.
- **PostgreSQL Connection in Production:** In production deployments with live PostgreSQL, migrations in `drizzle/` should be applied (`npx drizzle-kit push` or `migrate`). In memory mode, seed data from `initialImportData` is pre-populated.

---

## 5. Conclusion

The Milestone 1 Backend & RBAC Implementation is **fully compliant**, **robust**, and **production-ready**.
- All RBAC procedures (`declarantProcedure`, `comptableProcedure`, `internalProcedure`) operate strictly with 403 error rejection.
- Dual parity (PostgreSQL / In-Memory) is maintained across all CRUD, task management, and financial workflows.
- Task filtering by `assignedTo` operates as expected for Mamadou Diallo and Fatoumata Camara.
- Invoicing lifecycle, GNF/USD multi-currency support, payment recording, and receipt generation (`REC-2026-X`) are fully verified.
- **Verdict: APPROVE.**

---

## 6. Verification Method

Independent verification steps:
```bash
# 1. Verify TypeScript types
npm run check

# 2. Run full test suite (15 suites, 120 tests)
npm test

# 3. Run Milestone 1 dedicated integration tests
npx vitest run server/__tests__/tier2_trpc_rbac_integration/m1_backend_rbac_complete.test.ts

# 4. Run production build
npm run build
```
