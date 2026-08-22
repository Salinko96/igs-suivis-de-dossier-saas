## 2026-08-22T13:02:53Z

Authoritative request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md

Mission:
Execute a comprehensive technical survey of the BUSINESS LOGIC, FINANCIAL/CUSTOMS CALCULATION ENGINES, and AUTOMATED TEST SUITE of the IGS Logistics Dossier SaaS application.

Scope:
1. Examine business calculation logic in `server/services/`, `client/src/lib/`, `shared/`, and calculation helpers:
   - Demurrage risk calculations and port detention fees
   - Customs regime handling (DDI, SYDONIA, BLD, BAD, BAE, PAC exit)
   - PAC storage fee calculation curves and tariff schedules
   - Currency calculations (GNF vs USD/EUR, exchange rates, VAT/TVA 18%, rounding, total amounts)
   - Pro-forma and definitive invoice generators (PDF/Excel data preparation)
2. Audit the test suite, build setup, and type checking:
   - Current test setup in `vitest.config.ts`, `package.json`, `server/__tests__/`, `client/src/__tests__/`
   - Run baseline analysis: inspect test scripts, identify what tests currently exist, and assess coverage gaps across all tRPC routers and calculation engines
   - Inspect TypeScript build configuration (`tsconfig.json`, `npm run check`, `npm run build`) and identify any typing ambiguities or compilation risks.
3. Identify missing test cases (Tier 1 Feature Coverage, Tier 2 Boundary/Corner, Tier 3 Cross-Feature, Tier 4 Real-World Workloads) needed to guarantee 100% reliability.
