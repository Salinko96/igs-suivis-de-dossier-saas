## 2026-08-20T13:18:38Z
Mission: Implement Milestone 2 (Optimistic Locking & Simultaneous Edition Conflicts) AND Milestone 3 (Audit Trail & Regulatory Logging):

Part 1: Milestone 2 — Optimistic Locking (R2)
1. Schema (`drizzle/schema.ts`):
   - Add `version: integer("version").notNull().default(1)` to `dossiers` table.
2. Backend Concurrency Control (`server/db.ts` & `server/routers.ts`):
   - In `updateDossier` and `updateCustoms`: accept `expectedVersion` (number) and `expectedUpdatedAt` (string | Date).
   - If `expectedVersion !== undefined && current.version !== expectedVersion` (or `expectedUpdatedAt` diverges > 1000ms), throw `new TRPCError({ code: "CONFLICT", message: "Conflit d'édition simultanée : ce dossier a été modifié par un autre utilisateur..." })`.
   - On successful update: increment `version: (current.version || 1) + 1` and update `updatedAt: new Date()`.
   - Update `dossier.update` and `dossier.updateCustoms` input Zod schemas in `server/routers.ts` to accept `expectedVersion`, `expectedUpdatedAt`, and `forceOverwrite`.
3. Frontend Conflict Resolution UI:
   - Create `client/src/components/ConflictResolutionModal.tsx`: modal showing conflict warning, side-by-side comparison (field, your local value, server current value), buttons to "Recharger les données du serveur" (refreshes query cache without data loss) and "Écraser avec mes modifications" (re-submits with fresh version).
   - Update `client/src/pages/DossierDetailPage.tsx` and `client/src/components/CustomsEditModal.tsx` to transmit `expectedVersion: dossier.version` on mutations and trigger `ConflictResolutionModal` when a `CONFLICT` error occurs.

Part 2: Milestone 3 — Audit Trail & Regulatory Logging (R3)
1. Schema (`drizzle/schema.ts`):
   - Enrich `dossierStatusHistory` (or add `auditLogs`) with fields: `action` (varchar 120), `entityType` (varchar 64), `entityId` (integer), `userRole` (varchar 64), `beforeData` (text/json), `afterData` (text/json), `ipAddress` (varchar 64), `metadata` (text/json), `createdAt` (timestamp).
2. Centralized Audit Service & Operation Logging (`server/db.ts`):
   - Implement `logAuditEvent` helper function.
   - Automatically log all customs status transitions: DDI, SYDONIA declaration, Bulletin BLD liquidation, BAD status, BAE status, Sortie PAC release.
   - Automatically log all financial operations: invoice generation (`createInvoice`), payment collection (`recordInvoicePayment`), PAC disbursement advances (`createPacDisbursement`).
   - Log document creation and deletion.
3. tRPC Audit Procedures (`server/routers.ts`):
   - In `audit.list`, return full enriched audit history for a dossier.
4. Frontend Audit Timeline:
   - In `client/src/pages/DossierDetailPage.tsx`, display the rich timeline in the "Audit & Historique" tab with action badges, agent name, user role, localized date/time, and before/after details.

Part 3: Tests & Validation
- Write comprehensive unit & integration tests in `server/__tests__/optimistic_locking_and_audit.test.ts` testing:
  - Optimistic locking conflict detection (throws CONFLICT on stale version), successful version increment on valid update.
  - Audit log creation on customs transitions and financial operations (`createInvoice`, `recordInvoicePayment`, `createPacDisbursement`).
  - Audit list query returning correct history.
- Run `npm run check` and `npm run test` ensuring 100% tests pass.
- Write handoff report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m2_m3/handoff.md` and send completion message.
