# Project: IGS Transit & Douane Guinée — Bug Fixes & Priority Optimizations

## Architecture
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui + Wouter + TanStack Query + tRPC client (`client/src/`)
- **Backend**: Express + tRPC 11 + Drizzle ORM + PostgreSQL / In-Memory Fallback (`server/`)
- **Shared**: Zod schemas & shared contracts (`shared/`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Client Portal Search Error Handling | Immediate error display on invalid code, no infinite loader, clickable sample codes | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Client Portal Multi-Identifier Matching | Match portal access code, dossier number, BL/LTA number, and client dossier number (CKYSI26000340) | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Deterministic Notification Alert IDs | Stable IDs in alertsService to ensure read state persistence | M2 | ORIGINAL_REQUEST §R2 |
| 4 | Optimistic Notification & Badge Sync | Real-time unread badge count decrement & TanStack cache invalidation | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Controles Responsive Actions & Cards | Stacked cards on mobile/tablet + smooth visible scrollbar/sticky actions on desktop | M3 | ORIGINAL_REQUEST §R3 |
| 6 | Dossier Detail Route & Query Optimization | Remove full dossier list fetch, lazy tab queries, direct DB index query (<300ms) | M4 | ORIGINAL_REQUEST §R4 |
| 7 | Standardized Breadcrumbs & Quick Back | Reusable Breadcrumb component with quick back button across sub-pages and edit screens | M5 | ORIGINAL_REQUEST §R5 |
| 8 | E2E & Unit Test Suite Validation | Comprehensive test suite (Tiers 1-4) & vercel-build verification | M6 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Client Portal Fix (R1) | `ClientPortalPage.tsx`, `server/routers.ts`, `server/db.ts` | none | DONE |
| M2 | Notifications & Badge Sync (R2) | `alertsService.ts`, `server/db.ts`, `DashboardLayout.tsx` | none | DONE |
| M3 | Controles Responsive Actions (R3) | `ControlsPage.tsx`, table & stacked card UI | none | DONE |
| M4 | Dossier Sheet Performance (R4) | `DossierDetailPage.tsx`, `server/db.ts` | none | DONE |
| M5 | Breadcrumbs & Navigation (R5) | `Breadcrumbs.tsx`, sub-pages navigation integration | none | DONE |
| M6 | Final Verification & Build | Full test suite execution (`npm test`), challenger, auditor, `npm run build` | M1, M2, M3, M4, M5 | DONE |

## Code Layout
- `client/src/components/Breadcrumbs.tsx`: Reusable Breadcrumb & quick back component
- `client/src/components/DashboardLayout.tsx`: Notification bell & navigation layout
- `client/src/pages/ClientPortalPage.tsx`: Public tracking portal
- `client/src/pages/ControlsPage.tsx`: Customs controls & priority actions
- `client/src/pages/DossierDetailPage.tsx`: Detailed dossier sheet & tabs
- `server/alertsService.ts`: Proactive alerts generator
- `server/db.ts`: Data access layer & in-memory store
- `server/routers.ts`: tRPC API routers
- `server/__tests__/`: Unit, integration, and stress test suites (28 test files, 285 tests)
