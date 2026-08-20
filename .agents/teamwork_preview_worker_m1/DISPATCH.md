## 2026-08-20T13:03:28Z

You are Worker 1 on the IGS Transit & Douane Guinée SaaS project.
Your working directory is: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m1
Project root: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Authoritative Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md (Refer to section ## 2026-08-20T12:57:04Z)
Project Specification: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
Explorer Survey Report: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_1/survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission: Implement Milestone 1 — Module d'Administration & Gestion des 100 Employés (/utilisateurs):
1. Database Schema (`drizzle/schema.ts`):
   - Add `isActive` (`boolean("isActive").default(true).notNull()`), `sessionRevokedAt` (`timestamp("sessionRevokedAt")`) to `users` table.
2. Data Store & 100+ Collaborators Seed (`server/db.ts`):
   - Enrich `_memoryUsers` with a comprehensive, realistic seed of 100+ Guinean collaborators (+224 phone numbers, realistic names, roles: admin, declarant, comptable, client, manager; clientCompany for clients).
   - Implement data helper methods: `listUsers({ search, role, isActive, limit, offset })`, `createUser(data)`, `updateUser(id, data)`, `toggleUserStatus(id, isActive)`, `getHRStats()`.
   - Ensure HR stats accurately compute: `totalEmployees`, `activeDeclarantsAtPort`, `activeComptables`, `connectedClients`, `totalActive`, `totalInactive`.
3. Session Revocation & Auth Security (`server/_core/sdk.ts`, `server/_core/trpc.ts`):
   - Reject authentication/requests if `user.isActive === false` in `sdk.authenticateRequest` and `requireUser`.
4. tRPC Router (`server/routers.ts`):
   - Implement `user` router with `list`, `create`, `update`, `toggleStatus`, `getHRStats` under `adminProcedure`.
5. Frontend Integration:
   - `client/src/hooks/usePermissions.ts`: Add `canManageUsers: boolean` (true for admin).
   - `client/src/pages/UsersPage.tsx`: Build complete, polished, responsive admin page with 4 KPI cards, search & filter bars, 100-employee table with badges, active/inactive switch, create & edit modal with Zod validation.
   - `client/src/components/DashboardLayout.tsx`: Add sidebar menu entry for `/utilisateurs` restricted to `admin`.
   - `client/src/App.tsx`: Register `/utilisateurs` route guarded by `ProtectedRoute` (`allowedRoles={["admin"]}`).
6. Testing:
   - Write comprehensive unit & integration tests in `server/__tests__/user_admin_management.test.ts` covering: CRUD, non-admin 403 rejection, session revocation on inactive user, and HR stats calculation accuracy.
   - Execute `npm run check` and `npm run test` to verify 100% passing tests with zero regressions.
7. Document your work in `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m1/handoff.md` and send a completion message to the orchestrator.
