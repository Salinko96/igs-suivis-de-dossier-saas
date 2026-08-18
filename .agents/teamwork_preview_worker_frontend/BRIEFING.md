# BRIEFING — 2026-08-18T16:04:28Z

## Mission
Frontend & Role Simulator Implementation for Milestones 2, 3, and 4: RBAC permissions hook, ProtectedRoute, DashboardLayout navigation/simulator, CustomsEditModal, PlanningPage checklist, ControlsPage integration, DossierDetailPage/DossiersPage permissions & customs integration, FinancesPage multi-currency & invoices & receipts.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_frontend
- Original parent: 3bba92c2-33c3-493f-8daa-7cb66a8d90a8
- Milestone: Milestones 2, 3, 4

## 🔒 Key Constraints
- Follow AGENTS.md directives (TypeScript strict, shadcn/ui components, tRPC type safety, no placeholders, proper validation, clean architecture).
- Integrity Mandate: no hardcoded cheat tests, real state and real behavior.
- Clean and verified build: `npm run check`, `npm test`, `npm run build`.

## Current Parent
- Conversation ID: 3bba92c2-33c3-493f-8daa-7cb66a8d90a8
- Updated: not yet

## Task Summary
- **What to build**:
  1. `usePermissions.ts` hook for RBAC permissions across `admin`, `declarant`, `comptable`, `client`, `manager`.
  2. `ProtectedRoute.tsx` route guard for wouter.
  3. `App.tsx` guarded routes.
  4. `DashboardLayout.tsx` filtering & role switcher instant navigation.
  5. `CustomsEditModal.tsx` for fast editing customs/transit fields.
  6. `PlanningPage.tsx` operational task checklist with toggle status, filters, and modal.
  7. `ControlsPage.tsx` CustomsEditModal integration for anomalies.
  8. `DossierDetailPage.tsx` tab hiding, permissions gating, CustomsEditModal integration.
  9. `DossiersPage.tsx` column visibility & CustomsEditModal button.
  10. `FinancesPage.tsx` cleanup, GNF/USD multi-currency switcher, rate setting modal, invoice modal with débours breakdown & TVA 18%, payment recording with receipt dialog.
- **Success criteria**: All items implemented cleanly, 0 build/type errors, tests pass.

## Change Tracker
- **Files modified**: TBD
- **Build status**: TBD
- **Pending issues**: None

## Quality Status
- **Build/test result**: TBD
- **Lint status**: TBD
- **Tests added/modified**: TBD

## Loaded Skills
None required.

## Key Decisions Made
- Starting investigation of existing files and survey handoffs.

## Artifact Index
- `.agents/teamwork_preview_worker_frontend/handoff.md` — Final handoff report
