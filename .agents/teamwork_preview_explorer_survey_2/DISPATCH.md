## 2026-08-18T15:49:54Z

You are Explorer 2 on the Survey phase of the IGS Guinée SaaS project.

Working Directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_2
Authoritative User Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/ORIGINAL_REQUEST.md
Project Root: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS

Objective:
Thoroughly explore the BACKEND architecture, tRPC routers, database schema, and RBAC / business logic:
1. Examine `server/` and `shared/` structure: `server/routes.ts`, `server/db.ts`, `server/auth.ts`, `server/schema.ts` (Drizzle), `shared/` types and schemas.
2. Investigate existing DB tables and schemas:
   - Dossiers table (fields for customs identifiers: BL/LTA, DDI GUCEG, Sydonia World, statuses).
   - Tâches Opérationnelles / Tasks persistence (is there a tasks table or task model? What needs to be added?).
   - Financial models: Invoices (proforma & final), Débours (customs outlays), Payments, Currencies/Exchange rates (GNF vs USD).
3. Investigate tRPC routers and procedures:
   - Check authentication/context middleware: how does tRPC get the simulated or real user role?
   - Identify existing procedures vs missing procedures for: role simulation sync, tasks updates/toggling, customs identifiers editing, invoice generation, débours management, currency conversion / rate setting.
4. Identify all backend & schema files that need modification or creation.

Output:
Write a comprehensive report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_2/handoff.md` detailing your findings, database schemas, tRPC procedures, required migrations/schema additions, and concrete recommendations.
Send a message back to the orchestrator when completed.
