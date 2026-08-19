## 2026-08-19T11:25:18Z

You are teamwork_preview_worker_2, an implementation worker.
Your working directory is: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_2/
Read the authoritative requirements: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md
Read the project architecture: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/PROJECT.md
Read coding guidelines: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/AGENTS.md
Read exploration survey: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your assigned scope (Files owned exclusively: `client/src/pages/ControlsPage.tsx`, `client/src/pages/DossierDetailPage.tsx`, `client/src/components/Breadcrumbs.tsx`, and other sub-pages for breadcrumb integration):

1. R3 (Controles Actions Prioritaires Table & Responsive Cards):
   - In `client/src/pages/ControlsPage.tsx`:
     - Implement a responsive bi-mode layout:
       - Desktop (`hidden md:block`): Table in an `overflow-x-auto` container with styled, visible scrollbar and sticky or prominent right-hand action column so « Régulariser » and « Fiche » buttons are immediately accessible and visible without being cut off.
       - Mobile/Tablet (`block md:hidden`): Responsive stacked cards displaying Dossier number, Client, BL/LTA, anomaly badges, and full-width touch-friendly action buttons (« Régulariser » opening `CustomsEditModal` and « Fiche » navigating to `/dossiers/:id`).

2. R4 (Dossier Detail Sheet Fast Loading < 300ms):
   - In `client/src/pages/DossierDetailPage.tsx`:
     - Remove the unconditional `trpc.dossier.list.useQuery()` call that was downloading the full database on every single dossier page load.
     - For prev/next navigation buttons, read cached data via `utils.dossier.list.getData() || []` without initiating a blocking network call.
     - Lazy-load tab queries:
       - `docsQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "documents"`
       - `auditQuery`: `enabled: !isNew && Boolean(numericId) && perms.canViewAudit && activeTab === "audit"`
       - `invoicesQuery`: `enabled: !isNew && Boolean(numericId) && perms.canViewFinances && activeTab === "finances"`
       - `tasksQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "tasks"`
       - `commentsQuery`: `enabled: !isNew && Boolean(numericId) && activeTab === "tasks"`
     - Add `placeholderData` from query cache to ensure immediate (<100ms) rendering.

3. R5 (Standardized Breadcrumb & Quick Back Navigation):
   - Create `client/src/components/Breadcrumbs.tsx` (or enhance existing):
     - Provides quick back button (with `ChevronLeft` / `ArrowLeft`) calling `window.history.back()` or navigating to parent route.
     - Standardized contextual path (e.g. *Accueil > Tous les Dossiers > Fiche DOS-0054*, *Accueil > Contrôles Douane*, *Accueil > Planning*, *Accueil > Finances*).
     - Integrate on sub-pages and edit screens: `DossierDetailPage.tsx`, `ControlsPage.tsx`, `PlanningPage.tsx`, `FinancesPage.tsx`, etc.

Run tests (`npm test`) and check TypeScript (`npm run check` or `npm run build`), write a complete handoff report to `/Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_2/handoff.md`, and message parent when complete.
