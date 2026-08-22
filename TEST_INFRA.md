# E2E Test Infra: IGS Logistics Dossier SaaS

## Test Philosophy
- Multi-tier testing approach: Category-Partition, Boundary Value Analysis, Pairwise Combinations, Real-World Workloads.
- 100% deterministic test execution in Vitest.
- Complete isolation of external network calls via mock layers and in-memory dual-layer database fallback.

## Feature Inventory & Test Coverage Goals
| # | Feature | Source | Tier 1 (Unit/Feature) | Tier 2 (Boundary/Error) | Tier 3 (Cross-Module) | Tier 4 (Workload/E2E) |
|---|---------|--------|:---------------------:|:-----------------------:|:---------------------:|:---------------------:|
| 1 | Dossiers & SYDONIA Customs | `server/dossierRules.ts` | 15 tests | 10 tests | 5 tests | 4 tests |
| 2 | Port Demurrage & Franchise | `server/dossierRules.ts` | 10 tests | 8 tests | 4 tests | 3 tests |
| 3 | Currency & Exchange Rates | `server/exchangeRateService.ts` | 14 tests | 8 tests | 4 tests | 3 tests |
| 4 | Finances & 18% VAT Invoicing | `server/db.ts`, `server/routers.ts` | 15 tests | 10 tests | 6 tests | 4 tests |
| 5 | Audit Trail & Concurrency | `server/db.ts`, `server/routers.ts` | 10 tests | 6 tests | 4 tests | 3 tests |
| 6 | Client Portal Search & OTP | `server/routers.ts`, `client/src/pages/ClientPortalPage.tsx` | 8 tests | 6 tests | 3 tests | 2 tests |
| 7 | Notifications & Alerts | `server/alertsService.ts` | 10 tests | 5 tests | 4 tests | 2 tests |
| 8 | Serverless DB Resilience | `server/db.ts` | 12 tests | 8 tests | 4 tests | 3 tests |

## Test Architecture
- **Test Runner**: `vitest` (configured in `vitest.config.ts`)
- **Execution Command**: `npm test`
- **Type Checking**: `npm run check` (`tsc --noEmit`)
- **Production Build**: `npm run build`
