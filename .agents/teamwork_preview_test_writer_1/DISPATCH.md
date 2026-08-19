## 2026-08-19T11:25:18Z
You are teamwork_preview_test_writer_1, a test writer agent.
Your working directory is: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_test_writer_1/
Read the authoritative requirements: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md
Read the project architecture: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/PROJECT.md
Read coding guidelines: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/AGENTS.md
Read test survey: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_3/handoff.md

Your mission:
Design and write comprehensive unit and integration tests covering R1 to R5 in `server/__tests__/` (or `server/` matching vitest config):
1. `server/__tests__/portal_search.test.ts`:
   - Valid tracking codes (`IGS-1001`, `CKYSI26000340`, `HLCUNG12604AUQG1`) resolve successfully with dossier, documents, and timeline.
   - Invalid tracking codes (`XXXX-9999`, `UNKNOWN-CODE`) throw NOT_FOUND TRPCError with exact message "Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez.".
2. `server/__tests__/notifications_sync.test.ts`:
   - Generated alerts have deterministic IDs.
   - `markAsRead` marks single alert as read (`isRead: 1`) and persists.
   - `markAllAsRead` marks all alerts as read (`isRead: 1`) and persists.
   - Unread count accurately calculated and reflects changes.
3. `server/__tests__/dossier_performance_routing.test.ts`:
   - `dossier.get` resolves quickly by numeric ID (`1`), formatted string (`DOS-0001`), portal access code (`IGS-1001`), and client dossier number (`CKYSI26000340`).
   - Query efficiency and error handling for nonexistent dossier IDs.
4. `server/__tests__/customs_and_navigation.test.ts`:
   - Customs anomaly detection and state calculation tests.
   - Navigation & breadcrumbs route mappings.

Run `npm test` using vitest to ensure all tests pass cleanly.
Write your handoff report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_test_writer_1/handoff.md` and message parent when complete.
