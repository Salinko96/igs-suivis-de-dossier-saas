# Progress Tracker

Last visited: 2026-08-18T15:59:50Z

## Status
- [x] Initial setup & briefing
- [x] Investigate codebase (ORIGINAL_REQUEST.md, PROJECT.md, survey handoffs, current files)
- [x] Implement RBAC procedures in `server/_core/trpc.ts` (`declarantProcedure`, `comptableProcedure`, `internalProcedure`)
- [x] Update `drizzle/schema.ts` and `shared/types.ts` (`invoices` and `dossiers` fields)
- [x] Update `server/db.ts` (PostgreSQL and memory mode dual parity for tasks, invoices, payments, exchange rate)
- [x] Update `server/routers.ts` (finance endpoints secured with comptableProcedure, multi-currency summary, dossier RBAC, task filters)
- [x] Run typecheck and tests, add new tests to verify all requirements (`15/15` suites, `120/120` tests passing, `0` TypeScript errors)
- [x] Complete self-critique, verification, and write handoff.md
