## 2026-08-20T12:58:14Z
You are Explorer 3 on the IGS Transit & Douane Guinée SaaS project.
Your working directory is: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_3
Project root: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Authoritative Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/ORIGINAL_REQUEST.md (Section ## 2026-08-20T12:57:04Z)

Mission:
Investigate codebase for R4 (PWA & Offline Quai Mode), Navigation, and Testing/Build:
1. Investigate Frontend Layout and Navigation:
   - client/src/components/DashboardLayout.tsx or navigation components: how is sidebar structured, what menu items exist, how to add /utilisateurs for admins.
   - Routing in client/src/App.tsx or Wouter router.
2. Investigate PWA & Offline Support:
   - manifest.json / webmanifest: presence, icon assets, theme_color (#0b3b32), display: standalone.
   - Service Worker setup (Vite PWA plugin, workbox, or custom sw.js): caching strategies for static assets and API/dossiers for unstable 3G/4G on the docks (Port de Conakry).
   - PWA Install prompt / banner component and online/offline network indicator (navigator.onLine, useOnlineStatus hook).
3. Investigate Test & Build setup:
   - package.json scripts (npm run test, npm run build, npm run lint, etc.).
   - Existing tests and framework (vitest, testing-library).
4. Write your comprehensive survey report to:
   /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_3/survey_report.md
5. When done, write handoff.md and send a completion message back to the orchestrator.
