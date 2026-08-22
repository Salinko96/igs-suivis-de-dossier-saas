# Project: IGS Logistics Dossier SaaS Resilience Hardening

## Architecture
- **Backend Stack**: Express 4, tRPC v11, Drizzle ORM, Supabase/PostgreSQL with automatic fail-safe in-memory dual-layer store.
- **Frontend Stack**: React 19, Vite 7, Tailwind CSS 4, TanStack Query v5, Wouter routing, shadcn/ui components, Lucide icons, PWA Service Worker.
- **External Integrations**: BCRG/OpenExchange rates, Terminal49 maritime tracking, Meta WhatsApp Cloud API, Resend transactional emails, AWS S3 / Supabase storage.
- **Core Modules**:
  1. Dossiers Management & Timeline Tracking (`/dossiers`, `/dossiers/:id`)
  2. Customs & SYDONIA Regimes (`/controles`)
  3. Port Autonome de Conakry & Demurrage Engine (`/port-conakry`)
  4. Finance, Invoicing & Multi-Currency (`/finances`)
  5. Audit Trail & Regulatory Compliance (`/audit`)
  6. Client Portal & Public Verification (`/portail-client`)
  7. Team Tasks & Operations (`/taches`)
  8. Notifications & Alerts Engine
  9. Users & RBAC Administration (`/utilisateurs`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Serverless DB Timeout Standard | Standardize all DB queries and `withDbTimeout` to <= 1500ms | M1 | survey_1 |
| 2 | Batch Import DB Timeout Wrapping | Wrap batch writes in `importDossiersBatch` with `withDbTimeout` | M1 | survey_1 |
| 3 | External API Timeout Protection | Add `AbortController` (3000ms) to WhatsApp & Resend APIs | M1 | survey_1 |
| 4 | Storage Upload Fail-Safe | Add timeout (3000ms) with fallback to Base64 in storage uploads | M1 | survey_1 |
| 5 | Frontend Query & Loader Stability | Triple-layer chunk recovery, lazy retry, and instant feedback | M2 | survey_2 |
| 6 | Optimistic UI & Concurrency Diffs | Optimistic updates for notifications and conflict resolution modal | M2 | survey_2 |
| 7 | Business Logic & PAC Storage Curves | Progressive 7-day franchise and storage fee calculations | M3 | survey_3 |
| 8 | Currency & 18% VAT Fiscal Logic | Taxable agency fee isolation and multi-currency exchange rates | M3 | survey_3 |
| 9 | 4-Tier Automated Test Suite Expansion | Full unit, integration, stress, and multi-module workflow tests | M4 | survey_1,2,3 |
| 10 | 100% Production Build & Typecheck | Zero TypeScript errors (`npm run check`) & clean build (`npm run build`) | M4 | survey_1,2,3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Serverless & DB Resilience Hardening | `server/db.ts`, `server/alertsService.ts`, `server/whatsappService.ts`, `server/cloudStorageService.ts`, `server/supabase.ts` | none | DONE |
| 2 | Frontend Query & UX Stability Review | `client/src/main.tsx`, `client/src/App.tsx`, `client/src/pages/`, `client/src/components/` | none | DONE |
| 3 | Business Calculations & Multi-Currency Engine | `server/dossierRules.ts`, `server/exchangeRateService.ts`, `server/services/`, `client/src/lib/pdfGenerator.ts` | M1 | DONE |
| 4 | 4-Tier Automated E2E Hardening & Verification | Complete test suite execution (636 tests), stress testing, `npm run check`, `npm run build` | M1, M2, M3 | DONE |

## Interface Contracts
### `server/db.ts` ↔ tRPC Routers
- `withDbTimeout<T>(queryPromise: Promise<T>, timeoutMs = 1500): Promise<T>`
- Fallback to in-memory store occurs within <= 1500ms on DB delay/failure.

### External Notifications ↔ `server/alertsService.ts` & `server/whatsappService.ts`
- External HTTP `fetch` requests bounded by `AbortSignal.timeout(3000)`.
- Fails gracefully without throwing unhandled promise rejections.

## Code Layout
```
├── client/
│   ├── src/
│   │   ├── components/   # UI components (shadcn/ui, modals, layout)
│   │   ├── hooks/        # Custom React hooks (realtime, auth, queries)
│   │   ├── pages/        # 9 module pages & client portal
│   │   ├── lib/          # utils, tRPC client, PDF/Excel generators, PWA sync
│   │   ├── App.tsx       # Routing with lazyWithRetry & ErrorBoundary
│   │   └── main.tsx      # Entrypoint & custom fetch network interceptor
├── server/
│   ├── _core/            # Express app, serverless handlers
│   ├── routers.ts        # 18 tRPC routers & RBAC procedures
│   ├── db.ts             # Drizzle ORM + in-memory dual layer store
│   ├── auth.ts           # JWT authentication & session verification
│   ├── dossierRules.ts   # Demurrage, customs regimes, status state machine
│   ├── exchangeRateService.ts # Currency rates & history
│   ├── alertsService.ts  # Multi-channel alerts (in-app, WhatsApp, email)
│   ├── whatsappService.ts # Meta WhatsApp Cloud API integration
│   ├── cloudStorageService.ts # AWS S3 / Supabase storage
│   └── __tests__/        # Automated Vitest test suites (56 test suites, 636 tests)
└── shared/
    └── schema.ts         # Shared Zod schemas & TypeScript types
```
