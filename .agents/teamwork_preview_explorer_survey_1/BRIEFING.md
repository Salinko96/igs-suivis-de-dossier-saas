# BRIEFING — 2026-08-19T11:24:50Z

## Mission
Explore and analyze R1 (Client Portal search bug infinite loading) and R2 (Notification bell mark as read & badge counter updates) to determine root causes, affected files/components, and precise fix recommendations.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, analysis, synthesis
- Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_1
- Original parent: 7e34697f-8374-458f-91db-f80cdb8a5ab3
- Milestone: survey_r1_r2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Target R1: /portail-client search bug (invalid code infinite loading)
- Target R2: Notification bell system ("Marquer lu" / "Tout marquer lu" not updating state or badge)

## Current Parent
- Conversation ID: 7e34697f-8374-458f-91db-f80cdb8a5ab3
- Updated: 2026-08-19T11:21:45Z

## Investigation State
- **Explored paths**:
  - `client/src/pages/ClientPortalPage.tsx`
  - `client/src/components/DashboardLayout.tsx`
  - `client/src/main.tsx`
  - `server/routers.ts` (`portal.track`, `notification.*`)
  - `server/db.ts` (`getDossierByPortalCode`, `listNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`)
  - `server/alertsService.ts` (`generateProactiveAlerts`)
  - `server/__tests__/tier2_trpc_rbac_integration/client_portal_isolation.test.ts`
  - `server/__tests__/tier1_business_logic/proactive_alerts_service.test.ts`
- **Key findings**:
  - R1: `portal.track` query had default `retry: 1`, lacked `retry: false`, button/view state checked `isLoading` instead of `isFetching`, missing `clientDossierNumber` search in `db.getDossierByPortalCode`, and generic `Error` thrown instead of explicit `TRPCError` with code `NOT_FOUND`.
  - R2: `DashboardLayout.tsx` lacked `trpc.useUtils()` and optimistic cache updates (`setData`/`invalidate`); backend `alertsService.ts` generated unstable dynamic IDs (`idCounter++`) that shifted when dossiers reordered on update, breaking `_readNotificationIds` tracking.
- **Unexplored areas**: None for R1/R2 scope.

## Key Decisions Made
- Formulated exact architectural fix for R1 (query options, UI state handling, DB search expansion, tRPC error code).
- Formulated exact architectural fix for R2 (deterministic alert IDs in alertsService, TanStack query optimistic mutation & invalidation in DashboardLayout).

## Artifact Index
- `handoff.md` — Complete 5-component handoff report for R1 and R2
