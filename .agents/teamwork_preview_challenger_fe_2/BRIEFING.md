# BRIEFING — 2026-08-18T16:12:00Z

## Mission
Empirically challenge and test the Financial & Role Simulator UI implementation for M2, M3, M4 (FinancesPage, GNF/USD multi-currency, payment quittances, role simulator, tests, typecheck, build).

## 🔒 My Identity
- Archetype: empirical-challenger
- Roles: critic, specialist
- Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_challenger_fe_2
- Original parent: 3bba92c2-33c3-493f-8daa-7cb66a8d90a8
- Milestone: M2, M3, M4 Frontend & Role Simulator Verification
- Instance: 2 of 2

## 🔒 Key Constraints
- Review and empirical stress-testing — do NOT modify implementation code unless creating tests in test directories if appropriate
- Verification must be empirical: run tests, run typecheck, run builds, stress-test calculations and currency edge cases
- Verdict (APPROVE or CHALLENGE_FAILED) in handoff.md

## Current Parent
- Conversation ID: 3bba92c2-33c3-493f-8daa-7cb66a8d90a8
- Updated: not yet

## Review Scope
- **Files to review & challenge**: `client/src/pages/FinancesPage.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/hooks/usePermissions.ts`, `client/src/components/ProtectedRoute.tsx`, `client/src/pages/PlanningPage.tsx`, `client/src/pages/ControlsPage.tsx`, `client/src/pages/DossierDetailPage.tsx`, `client/src/components/CustomsEditModal.tsx`
- **Interface contracts**: `PROJECT.md` & `ORIGINAL_REQUEST.md`
- **Review criteria**: Multi-currency GNF/USD switching, exchange rate modification, invoice calculation accuracy (TVA, débours, totals), payment receipt / quittance formatting and print layout, RBAC security, typecheck, tests, build.

## Attack Surface
- **Hypotheses tested**: [TBD]
- **Vulnerabilities found**: [TBD]
- **Untested angles**: [TBD]

## Key Decisions Made
- Starting rigorous empirical testing of FinancesPage calculations, exchange rate logic, receipt generation, and RBAC UI boundaries.

## Artifact Index
- `.agents/teamwork_preview_challenger_fe_2/DISPATCH.md` — Inbound instructions
- `.agents/teamwork_preview_challenger_fe_2/progress.md` — Execution progress log
- `.agents/teamwork_preview_challenger_fe_2/handoff.md` — Final handoff report
