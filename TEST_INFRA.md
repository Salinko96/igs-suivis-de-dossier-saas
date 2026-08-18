# E2E Test Infra: IGS Guinée SaaS — Role Simulation & Operational RBAC

## Test Philosophy
- Requirement-driven verification based on `ORIGINAL_REQUEST.md` (R1, R2, R3, R4).
- Strict separation of personas: Déclarant PAC (Mamadou Diallo), Comptable (Fatoumata Camara), Administrateur IGS, and Client (Guinean Birimian Gold S.A).
- Multi-tier validation: Pure Unit Logic (Tier 1) -> Server RBAC & tRPC Integration (Tier 2) -> Dynamic Navigation & Route Guards (Tier 3) -> Real-World Operational Persona Scenarios (Tier 4).

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------------|:------:|:------:|:------:|:------:|
| 1 | RBAC Middleware & Procedure Guards | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |
| 2 | Role Simulation State & Profile Switching | ORIGINAL_REQUEST §R1, §R4 | ✓ | ✓ | ✓ | ✓ |
| 3 | Déclarant PAC Operational Tasks Checklist & Persistence | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 4 | Customs Identifiers Editing (BL, DDI, Sydonia, BLD, BAE) | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ |
| 5 | Financial Data & Margin Shielding for Déclarant & Client | ORIGINAL_REQUEST §R2, §R1 | ✓ | ✓ | ✓ | ✓ |
| 6 | Multi-Currency Engine GNF / USD & Rate Setting | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 7 | Invoicing Lifecycle (Proforma, Émise, Payée) & Débours | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 8 | Payment Tracking & Receipt / Quittance Generation | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ |
| 9 | Client Portal Company Isolation & Public Tracking | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- **Runner**: Vitest v3 (`npm test` / `npx vitest run`)
- **Location**: `server/__tests__/` and subdirectories
- **Pass/Fail Semantics**: 0 failures, 100% assertions passing, 0 TypeScript compile errors (`npm run check`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Personas Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | End-to-End Dossier Lifecycle: Dossier creation by Admin -> Customs filing & Sydonia entry by Mamadou Diallo -> Operational task checkbox toggle -> Multi-currency invoicing & payment receipt by Fatoumata Camara -> Public tracking by Client GBG | Admin, Déclarant, Comptable, Client | High |
| 2 | RBAC Security Penetration & Leak Prevention: Déclarant attempts to access finance summary / invoice creation -> Client attempts to access internal notes or dossiers of other companies -> Comptable attempts to modify customs inspection data | Déclarant, Comptable, Client | High |
| 3 | Instant Role Switching & Route Protection: Rapid switching between all 4 personas without reload -> verification of auto-redirection, menu visibility, and badge synchronization | All 4 Personas | Medium |

## Coverage Thresholds
- Tier 1: Pure business logic & conversions (≥5 tests per feature domain)
- Tier 2: tRPC Server RBAC & Integration (≥5 tests per persona/procedure domain)
- Tier 3: Navigation, Menu Filtering & Route Guarding (complete matrix coverage)
- Tier 4: Real-world multi-persona integrated workflows (≥3 comprehensive scenarios)
