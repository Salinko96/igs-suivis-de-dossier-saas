# Project: IGS Transit & Douane Guinée SaaS — Enterprise 100% Ready

## Architecture
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React, Shadcn UI components, TanStack Query, Wouter routing, PWA Service Worker.
- **Backend**: Node.js, Express, tRPC (end-to-end type safety), Jose JWT session auth, Drizzle ORM.
- **Database**: Supabase PostgreSQL + in-memory resilient data store in `server/db.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Users DB Schema & Seed | Add `isActive`, `sessionRevokedAt` to `users` table; seed 111 realistic Guinean collaborator profiles | M1 | ORIGINAL_REQUEST R1 |
| 2 | Session Revocation & Auth Security | Immediate rejection of inactive users in `sdk.authenticateRequest` and `requireUser` | M1 | ORIGINAL_REQUEST R1 |
| 3 | HR & User Admin tRPC Routes | Create `user.list`, `user.create`, `user.update`, `user.toggleStatus`, `user.getHRStats` under `adminProcedure` | M1 | ORIGINAL_REQUEST R1 |
| 4 | Admin User Management UI (`/utilisateurs`) | Dedicated interface with 4 KPI cards, filterable 100-employee table, status toggle, create/edit modal | M1 | ORIGINAL_REQUEST R1 |
| 5 | Sidebar & Route Guards | Add menu item in `DashboardLayout.tsx` for admin, route guard in `App.tsx`, `canManageUsers` in `usePermissions.ts` | M1 | ORIGINAL_REQUEST R1 |
| 6 | Optimistic Locking Schema & Backend | Add `version` to `dossiers`, check `expectedVersion`/`expectedUpdatedAt` in `updateDossier`, throw `TRPCError CONFLICT` | M2 | ORIGINAL_REQUEST R2 |
| 7 | Conflict Detection & Resolution UI | Create `ConflictResolutionModal` with side-by-side diff preview, merge options and fresh reload | M2 | ORIGINAL_REQUEST R2 |
| 8 | Audit Trail DB Schema & Service | Enrich audit log model (`action`, `entityType`, `entityId`, `userRole`, before/after data snapshots, metadata) and `logAuditEvent` service | M3 | ORIGINAL_REQUEST R3 |
| 9 | Comprehensive Action Logging | Log customs transitions (DDI, SYDONIA, BLD, BAD, BAE, Sortie PAC) and financial operations (`createInvoice`, `recordInvoicePayment`, `createPacDisbursement`) | M3 | ORIGINAL_REQUEST R3 |
| 10 | Dossier Audit History View | Complete audit history timeline on `/dossiers/[id]` with timestamp, actor name, action badge, and detailed field diffs | M3 | ORIGINAL_REQUEST R3 |
| 11 | PWA Manifest & App Icons | High-res icons, theme color `#0b3b32`, standalone display, meta tags in `index.html` | M4 | ORIGINAL_REQUEST R4 |
| 12 | Service Worker & Offline Cache Strategy | `sw.js` with Cache-First static assets and Network-First cache fallback for tRPC dossier data on Conakry docks | M4 | ORIGINAL_REQUEST R4 |
| 13 | Network Status Indicator & PWA Install Banner | `useOnlineStatus` hook, `NetworkStatusBanner`, `PWAInstallBanner` with `beforeinstallprompt` support | M4 | ORIGINAL_REQUEST R4 |
| 14 | E2E & Full Regression Verification | Comprehensive automated unit, integration, and E2E tests for all 4 enterprise modules, build validation | M5 | ORIGINAL_REQUEST Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Module d'Administration & Gestion des 100 Employés | Schema `users`, 111 collaborators seed, `adminProcedure` tRPC routes, session revocation, `/utilisateurs` page, sidebar integration | none | DONE |
| M2 | Détection des Conflits d'Édition Simultanée | Column `version` on `dossiers`, tRPC `expectedVersion` check, `TRPCError CONFLICT`, `ConflictResolutionModal`, merge/reload logic | none | DONE |
| M3 | Journal d'Audit & Traçabilité Réglementaire | Audit schema with `action`/`entityType`/`userRole`, `logAuditEvent` helper, customs & financial event logging, `/dossiers/[id]` timeline | none | DONE |
| M4 | Mode Mobile & PWA Installable pour Agents sur le Quai | `manifest.json`, `sw.js` cache-first & network-first, `NetworkStatusBanner`, `PWAInstallBanner`, `useOnlineStatus` | none | PLANNED |
| M5 | Final E2E Test Verification & Hardening | Pass 100% test suite, adversarial tests, TypeScript check (`npm run check`), build (`npm run build`) | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### User Admin ↔ Client / Nav
- `user.list`: `adminProcedure.input({ search?: string, role?: Role, isActive?: boolean, limit?: number, offset?: number }) => { users: User[], total: number }`
- `user.getHRStats`: `adminProcedure.query() => { totalEmployees: number, activeDeclarantsAtPort: number, activeComptables: number, connectedClients: number, totalActive: number, totalInactive: number }`
- `user.toggleStatus`: `adminProcedure.input({ id: number, isActive: boolean }) => { success: boolean, user: User }`

### Dossier Concurrency ↔ Frontend
- `dossier.update`: `internalProcedure.input({ id: number | string, expectedVersion?: number, expectedUpdatedAt?: string | Date, forceOverwrite?: boolean, data: Partial<Dossier> }) => Dossier`
- On mismatch: throws `TRPCError({ code: "CONFLICT", message: "Conflit d'édition simultanée..." })`

### Audit Trail ↔ Dossier Detail
- `audit.list`: `protectedProcedure.input({ dossierId: number }) => AuditLogItem[]`
- Audit log entry: `{ id: number, dossierId: number, userId: number, userName: string, userRole: string, action: string, entityType: string, entityId: number, fieldChanged?: string, previousValue?: string, newValue?: string, comment?: string, createdAt: Date }`

## Code Layout
- `drizzle/schema.ts` — PostgreSQL table definitions (`users`, `dossiers`, `audit_logs` / `dossier_status_history`, etc.)
- `server/db.ts` — Data access layer, in-memory store, seed data
- `server/routers.ts` — tRPC procedures (`user`, `dossier`, `audit`, `invoice`, `auth`)
- `server/_core/sdk.ts` & `server/_core/trpc.ts` — Auth context and session validation
- `client/src/App.tsx` — Routing and protected routes
- `client/src/components/DashboardLayout.tsx` — Main sidebar and header navigation
- `client/src/pages/UsersPage.tsx` — Collaborator administration and HR stats
- `client/src/components/ConflictResolutionModal.tsx` — Concurrency conflict diff and merge modal
- `client/src/components/NetworkStatusBanner.tsx` & `PWAInstallBanner.tsx` — PWA & offline support
- `client/public/manifest.json` & `client/public/sw.js` — PWA manifest and Service Worker
