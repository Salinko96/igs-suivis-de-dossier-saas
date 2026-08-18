## 2026-08-18T15:54:03Z
You are the Test Writer for the IGS Guinée SaaS project.

Working Directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_test_writer_m1
Authoritative User Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/ORIGINAL_REQUEST.md
Project Blueprint: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
Test Infra Specs: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/TEST_INFRA.md
Survey Handoffs: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_3/handoff.md

Objective:
Implement the comprehensive 4-Tier test suite according to `TEST_INFRA.md` in `server/__tests__/`:
1. Check `vitest.config.ts` to ensure it includes tests in `server/__tests__/**/*.test.ts` or `server/**/*.test.ts`.
2. Implement:
   - Tier 1 Pure Business Logic:
     - `server/__tests__/tier1_business_logic/currency_conversion.test.ts` (GNF/USD conversion, VAT 18%, débours separation, estimated gross margin)
     - `server/__tests__/tier1_business_logic/customs_rules.test.ts` (Sydonia declaration formatting, BLD rules, completion rate, regularization state)
     - `server/__tests__/tier1_business_logic/rbac_permissions.test.ts` (Permission capabilities per role)
   - Tier 2 tRPC Server RBAC & Integration:
     - `server/__tests__/tier2_trpc_rbac_integration/auth_role_simulation.test.ts` (Role login/switching, session token, profile claims)
     - `server/__tests__/tier2_trpc_rbac_integration/declarant_pac_workflow.test.ts` (Task list filtering by Mamadou Diallo, checkbox persistence, customs fields update, finance shield 403 Forbidden)
     - `server/__tests__/tier2_trpc_rbac_integration/comptable_finance_workflow.test.ts` (Invoice lifecycle Proforma -> Émise -> Payée, débours, GNF/USD multi-currency, payment quittance, field customs shield)
     - `server/__tests__/tier2_trpc_rbac_integration/client_portal_isolation.test.ts` (Multi-tenant company isolation, no margin leak)
   - Tier 3 UI Navigation & Route Guards:
     - `server/__tests__/tier3_ui_navigation_guards/route_guards.test.ts` (Menu filtering and route authorization logic per role)
   - Tier 4 Real-World E2E Scenarios:
     - `server/__tests__/tier4_e2e_scenarios/end_to_end_scenarios.test.ts` (Full multi-persona lifecycle)
3. Execute `npm test` and ensure all tests run cleanly and pass.

Output:
Write a comprehensive report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_test_writer_m1/handoff.md` detailing the test suite files created, number of tests, assertion results, and publish `TEST_READY.md` if ready.
Send a message back to the orchestrator when finished.
