## 2026-08-22T13:01:56Z

You are the Project Orchestrator for the IGS Logistics Dossier SaaS project.
Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_orchestrator_3
Authoritative request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md

Mission:
Execute a comprehensive audit and resilience hardening of the IGS Logistics Dossier SaaS application to eliminate all potential serverless function invocation timeouts, DB connection stalls, unhandled promise rejections, and performance bottlenecks across every feature (Dossiers, Customs, Port Autonome de Conakry, Finance & Invoicing, Audit Trail, Client Portal, Team Tasks, Notifications, and Users & RBAC).

Requirements:
R1. Full End-to-End Serverless & Database Resilience
- Audit all tRPC routers (`server/routers.ts`), database access layers (`server/db.ts`), auth middlewares (`server/auth.ts`), and external integrations (cron jobs, Terminal49, PDF/Excel engines) to ensure 100% of asynchronous operations and DB queries are wrapped with fail-safe timeouts (`withDbTimeout`), graceful fallbacks, and non-blocking background workers.
- Zero unhandled promises or blocking operations across all procedures in `server/routers.ts` and `server/db.ts`.
- Every database interaction executes within strict timeouts (<= 1500ms) with seamless in-memory fallback.
- Heavy batch tasks (syncAllStates, bulk import, demurrage scans) execute asynchronously or finish in under 500ms.

R2. Frontend Query & Mutation Stability
- Audit all frontend pages and hooks (`client/src/pages/`, `client/src/hooks/`) to verify that all TanStack Query/tRPC queries and mutations handle errors gracefully, invalidate relevant caches properly, provide informative user feedback without infinite loading spinners, and implement retry/reconnection strategies.
- All interactive actions (filters, exports, status toggles, deletions, edits) across all 8 modules execute with instant user feedback.
- No chunk loading failures or dynamic import breakages upon new deployments.

R3. Business Logic, Financial & Customs Rules Validation
- Verify that all calculation engines (demurrage risks, customs regimes, PAC storage fees, VAT/GNF currencies, exchange rates, pro-forma and definitive invoices) execute deterministically with zero unhandled exceptions.

R4. Automated Testing & Verification
- Ensure comprehensive unit and integration test coverage across all routers, utilities, and components with 100% test pass rate (`npm test`), zero TypeScript compilation errors (`npm run check`), and clean production build (`npm run build`).

Follow the standard multi-agent orchestration pattern (decompose tasks, dispatch to specialists / workers, review, test, synthesize, update progress.md and BRIEFING.md, and write handoff.md upon completion).
