# Context & Survey Findings Summary

## Survey Findings
1. **R1 (Users & Admin)**:
   - Drizzle schema `users` requires `isActive: boolean` and `sessionRevokedAt: timestamp`.
   - In-memory store `_memoryUsers` in `server/db.ts` should be seeded with 100+ realistic Guinean profiles (Admins, Declarants PAC, Comptables, Clients).
   - `sdk.authenticateRequest` and `requireUser` must reject accounts with `isActive === false`.
   - tRPC `user` router with `list`, `create`, `update`, `toggleStatus`, `getHRStats` under `adminProcedure`.
   - Frontend `UsersPage.tsx` with 4 KPI cards, filterable table, modal, sidebar link and `ProtectedRoute`.

2. **R2 (Optimistic Locking)**:
   - `dossiers` table needs `version: integer` column.
   - `updateDossier` in `server/db.ts` and `server/routers.ts` must check `expectedVersion` and throw `TRPCError({ code: "CONFLICT" })`.
   - `ConflictResolutionModal.tsx` on frontend with side-by-side diff, reload fresh data without data loss, or force overwrite.

3. **R3 (Audit Trail)**:
   - `dossierStatusHistory` / `auditLogs` schema needs `action`, `entityType`, `entityId`, `userRole`, `beforeData`, `afterData`, `ipAddress`, `metadata`.
   - Central `logAuditEvent` helper in `server/db.ts` or `server/auditService.ts`.
   - Log transitions for DDI, SYDONIA, BLD, BAD, BAE, PAC release, and financial operations (`createInvoice`, `recordInvoicePayment`, `createPacDisbursement`).
   - Audit timeline on `/dossiers/[id]` with role badges and detailed diffs.

4. **R4 (PWA & Mobile Quai Mode)**:
   - `client/public/manifest.json` with theme `#0b3b32`, standalone display, icons (`/igs-logo-icon.png`, `/igs-logo-transparent.png`).
   - `client/public/sw.js` with Cache-First for static assets, Network-First for tRPC API with offline cache fallback.
   - `useOnlineStatus.ts` hook, `NetworkStatusBanner.tsx`, `PWAInstallBanner.tsx`.
   - Meta tags in `client/index.html`.
