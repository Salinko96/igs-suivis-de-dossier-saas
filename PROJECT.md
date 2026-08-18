# Project: IGS Guinée SaaS — Role Simulation & Operational RBAC

## Architecture
- **Tech Stack**: React 19, Vite 7, Tailwind CSS 4, tRPC 11, Drizzle ORM, PostgreSQL (with dual memory fallback), Wouter, Zod, Vitest.
- **Role Simulation Engine**:
  - **Identities**:
    - `admin`: Administrateur IGS (Full access to all 6 modules, creation, deletion, configuration)
    - `declarant`: Déclarant PAC (Mamadou Diallo) (Focus: Planning, Contrôles Douane, Tous les Dossiers technique, Tâches Opérationnelles, Customs IDs modal; Finances hidden)
    - `comptable`: Comptable (Fatoumata Camara) (Focus: Finances & Facturation, Pilotage & KPI financier, Tous les Dossiers facturation, Proforma/Final invoices, Débours, GNF/USD multi-currency converter, Quittances; Field customs editing hidden)
    - `client`: Portail Client (Guinean Birimian Gold S.A) (Isolated tracking, public files, strictly no internal margins/notes)
- **Data Flow**:
  - Client state (`useAuth` + `usePermissions`) synchronizes with server tRPC session (`app_session_id` JWT / openId).
  - Server middleware enforces RBAC at procedure level (`adminProcedure`, `declarantProcedure`, `comptableProcedure`, `internalProcedure`).
  - Frontend router (`App.tsx` + `ProtectedRoute`) guards routes and auto-redirects on profile switch without full page reload.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | RBAC Middleware & tRPC Procedures | Implement `declarantProcedure`, `comptableProcedure`, `internalProcedure` and protect tRPC routers | M1: RBAC & Core Backend | R1 / Survey E2 |
| 2 | Schema & DB Persistence (Tasks, Invoices, Exchange Rate) | Extend Drizzle schema & `server/db.ts` for tasks filters, invoice lifecycle, débours breakdown, currency rates | M1: RBAC & Core Backend | R1, R2, R3 / Survey E2 |
| 3 | Frontend RBAC Hooks & Protected Routes | Create `usePermissions.ts` and `ProtectedRoute.tsx`, protect `App.tsx` routes, auto-redirect on profile switch | M2: Role Simulator UX & RBAC Frontend | R1, R4 / Survey E1 |
| 4 | Dynamic Navigation & Header Simulator UX | Filter sidebar items dynamically, adapt badges, hide non-authorized action buttons, instant profile switch | M2: Role Simulator UX & RBAC Frontend | R1, R4 / Survey E1 |
| 5 | Déclarant PAC Operational Tasks & Persistence | Interactive operational task checklist with immediate DB toggle, filter by Mamadou Diallo in Planning & Dossier views | M3: Déclarant PAC Profile | R2 / Survey E1, E2 |
| 6 | Customs Identifiers Editing & Transit Validation | Quick-edit modal (`CustomsEditModal`) for BL/LTA, DDI GUCEG, Sydonia World, BLD, BAD, BAE, status calculation | M3: Déclarant PAC Profile | R2 / Survey E1, E2 |
| 7 | Strict Financial Shielding for Déclarant & Client | Hide finances tab, financial statuses, revenue, and gross margins from Déclarant and Client views | M3: Déclarant PAC Profile | R2 / Survey E1 |
| 8 | Multi-Currency GNF / USD Engine & Rate Setting | Dynamic bidirectional conversion GNF ↔ USD, configurable exchange rate (default 8,650 GNF/USD), consolidated summary | M4: Comptable Profile & Finance | R3 / Survey E1, E2 |
| 9 | Invoicing Lifecycle, Débours & Quittances | Proforma and final invoices, detailed customs outlays (débours douane + PAC), payment recording, printable receipt / quittance | M4: Comptable Profile & Finance | R3 / Survey E1, E2 |
| 10 | Field Customs Actions Shielding for Comptable | Restrict terrain and customs editing actions from Comptable profile | M4: Comptable Profile & Finance | R3 / Survey E1 |
| 11 | Comprehensive 4-Tier Test Suite & Quality Gate | Unit tests, RBAC integration tests, route guard tests, E2E lifecycle scenarios, `npm test`, `npm run check`, `npm run build` | M5: E2E Verification & Hardening | Testing / Survey E3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend RBAC, Schema & Data Persistence | `server/_core/trpc.ts`, `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`, `shared/types.ts` | none | PLANNED |
| M2 | Frontend RBAC, Navigation & Role Simulator UX | `client/src/hooks/usePermissions.ts`, `client/src/components/ProtectedRoute.tsx`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` | M1 | PLANNED |
| M3 | Déclarant PAC (Mamadou Diallo) Operational Profile | `client/src/components/CustomsEditModal.tsx`, `client/src/pages/PlanningPage.tsx`, `client/src/pages/ControlsPage.tsx`, `client/src/pages/DossierDetailPage.tsx`, `client/src/pages/DossiersPage.tsx` | M1, M2 | PLANNED |
| M4 | Comptable (Fatoumata Camara) Multi-Currency & Invoicing | `client/src/pages/FinancesPage.tsx`, `client/src/pages/DossierDetailPage.tsx`, `server/routers.ts` (finance), `server/db.ts` | M1, M2 | PLANNED |
| M5 | E2E Testing Suite (Tiers 1-4) & Quality Assurance | `server/__tests__/tier1_*`, `tier2_*`, `tier3_*`, `tier4_*`, full test pass, typecheck, build validation | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### `server/_core/trpc.ts` ↔ `server/routers.ts`
- Procedures:
  - `declarantProcedure`: allows `admin`, `manager`, `declarant`
  - `comptableProcedure`: allows `admin`, `manager`, `comptable`
  - `internalProcedure`: allows `admin`, `manager`, `declarant`, `comptable`
  - Rejection: throws `TRPCError({ code: "FORBIDDEN", message: "Accès refusé pour ce profil" })`

### `task` Router & DB
- `task.list({ assignedTo?: string; status?: string })` -> returns `DossierTask[]`
- `task.toggleStatus({ id: number, status?: "A_faire" | "En_cours" | "Termine" | "Bloque" })` -> updates task & persists `completedAt`

### `finance` Router & DB
- `finance.getExchangeRate()` -> returns `{ rate: number, currencyPair: "USD/GNF", lastUpdated: string }`
- `finance.setExchangeRate({ rate: number })` -> updates exchange rate (comptable & admin only)
- `finance.createInvoice(data)` & `finance.updateInvoice(id, data)` -> manages proforma vs definitive, TVA 18%, débours
- `finance.recordPayment({ id: number, paymentMethod: string, paymentReference: string, paidAmount: number })` -> records payment, sets status `Payée`, generates `receiptNumber`

### `client/src/hooks/usePermissions.ts` ↔ Frontend Components
- Returns:
  ```ts
  {
    role: "admin" | "declarant" | "comptable" | "client" | "manager",
    isAdmin: boolean,
    isDeclarant: boolean,
    isComptable: boolean,
    isClient: boolean,
    canViewFinances: boolean,
    canViewControls: boolean,
    canViewPlanning: boolean,
    canEditCustoms: boolean,
    canManageInvoices: boolean,
    canCreateDossier: boolean,
    canDeleteDossier: boolean,
    defaultRoute: string,
  }
  ```

## Code Layout
- `client/src/hooks/usePermissions.ts` — Centralized RBAC capabilities
- `client/src/components/ProtectedRoute.tsx` — Route-level RBAC wrapper
- `client/src/components/CustomsEditModal.tsx` — Fast customs identification modal
- `client/src/components/DashboardLayout.tsx` — Dynamic sidebar & profile switcher
- `client/src/pages/FinancesPage.tsx` — Multi-currency invoices, débours, quittance printing
- `client/src/pages/PlanningPage.tsx` — Operational tasks checklist
- `client/src/pages/ControlsPage.tsx` — Customs controls & quick regularisation
- `client/src/pages/DossierDetailPage.tsx` — Conditioned tabs based on permissions
- `server/_core/trpc.ts` — RBAC procedure definitions
- `server/routers.ts` — tRPC endpoints & permissions
- `server/db.ts` — Database queries & memory fallback
- `drizzle/schema.ts` — Drizzle PostgreSQL schema
- `server/__tests__/` — 4-Tier Vitest test suites
