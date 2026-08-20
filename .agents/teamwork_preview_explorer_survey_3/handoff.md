# Handoff Report — Explorer 3 (Survey: Navigation, PWA / Offline, Test & Build)

## 1. Observation

### A. Frontend Layout & Navigation
- `client/src/components/DashboardLayout.tsx` (lines 35-42): Menu items are defined in `allMenuItems`:
  ```typescript
  const allMenuItems = [
    { icon: LayoutDashboard, label: "Pilotage & KPI", path: "/", roles: ["admin", "comptable", "manager"] },
    { icon: FolderKanban, label: "Tous les Dossiers", path: "/dossiers", roles: ["admin", "declarant", "comptable", "manager", "client"] },
    { icon: CircleDollarSign, label: "Finances & Facturation", path: "/finances", roles: ["admin", "comptable", "manager"] },
    { icon: CalendarDays, label: "Planning & Échéances", path: "/planning", roles: ["admin", "declarant", "manager"] },
    { icon: ShieldAlert, label: "Contrôles Douane & PAC", path: "/controles", roles: ["admin", "declarant", "manager"] },
    { icon: Globe, label: "Portail Client Externe", path: "/portail-client", roles: ["admin", "client"] },
  ];
  ```
- `client/src/App.tsx` (lines 30-97): Wouter `<Switch>` with `<ProtectedRoute>` components handling role checks (`allowedRoles` and `requirePermission`).
- `client/src/hooks/usePermissions.ts` (lines 4-25, 44-77): `resolvePermissions` creates a permission matrix based on role (`admin`, `declarant`, `comptable`, `client`, `manager`, `user`).
- `client/src/components/Breadcrumbs.tsx`: Contextual breadcrumbs component with back button and path navigation trail.

### B. PWA & Offline Support
- `client/index.html` (lines 1-19): Currently has `<title>IGS Dossiers — Transit & Douane</title>` and `<link rel="icon" type="image/png" href="/favicon.png" />`, but **no** `<link rel="manifest">`, **no** `<meta name="theme-color">`, **no** Apple PWA meta tags.
- `client/public/`: Contains `favicon.png` (131 KB), `igs-logo-icon.png` (89 KB), `igs-logo-sidebar.png` (118 KB), `igs-logo-transparent.png` (131 KB). No `manifest.json` or `sw.js` is currently present.
- `client/src/main.tsx` (lines 11-20, 123-145): `QueryClient` configured with `staleTime: 3min` and `gcTime: 15min`. The tRPC `httpBatchLink` custom fetch catches network exceptions and returns code `503` with a friendly French error message.

### C. Test & Build Infrastructure
- Commands executed:
  - `npm run check` (`tsc --noEmit`): Exited code 0 (0 TypeScript errors).
  - `npm run build` (`vite build && esbuild ...`): Exited code 0 in 5.28s.
  - `npm run test` (`vitest run`): Exited code 0, **31 test files passed, 311 tests passed in 11.82s**.
- `vitest.config.ts` (line 17): `include: ["server/**/*.test.ts", "server/**/*.spec.ts"]`. Client tests in `client/src/__tests__/` and `client/src/hooks/` are currently excluded from default test discovery.

---

## 2. Logic Chain

1. **Navigation & Admin Access (`/utilisateurs`) :**
   - Observations show `allMenuItems` in `DashboardLayout.tsx` filters by `item.roles.includes(userRole)`.
   - By adding `{ icon: Users, label: "Gestion Collaborateurs", path: "/utilisateurs", roles: ["admin"] }` and routing in `App.tsx` via `<ProtectedRoute allowedRoles={["admin"]} />`, only administrators will see and access the user management interface.
   - Adding `canManageUsers: isAdmin` to `usePermissions.ts` ensures standard type-safe permission checks across the entire client codebase.

2. **PWA & Offline Quai Mode (Port de Conakry) :**
   - Since network stability at Port de Conakry is intermittent (3G/4G loss between cargo containers), a Progressive Web App requires:
     - `manifest.json` in `client/public/` referencing existing assets (`igs-logo-icon.png`, `igs-logo-transparent.png`), with `theme_color: "#0b3b32"` and `display: "standalone"`.
     - PWA tags in `client/index.html`.
     - Service Worker (`client/public/sw.js`) with Cache-First strategy for static assets and Network-First with Cache fallback for read API/tRPC queries (`dossier.list`, `dossier.get`, `dashboard.get`).
     - Network status hook `useOnlineStatus.ts` and UI banner `NetworkStatusBanner.tsx` to inform agents on the docks when they are viewing offline cached data.
     - PWA installation prompt component (`PWAInstallBanner.tsx`) using the `beforeinstallprompt` browser event.

3. **Build & Test Validation :**
   - The project builds cleanly with zero TypeScript errors and passes all 311 backend tests.
   - Updating `vitest.config.ts` to include `client/src/**/*.test.ts` will ensure frontend test suites (`challenger_fe_stress.test.ts`, `usePermissions.test.ts`) are continuously verified during CI/CD.

---

## 3. Caveats

- **Supabase User Provisioning :** User creation/modification in `/utilisateurs` interacts with the Supabase `users` table or auth schema. The backend router should use `adminProcedure` to enforce server-side security.
- **Service Worker in Dev Mode :** In local development (`vite dev`), Service Workers can occasionally cache older modules if not configured with `skipWaiting` and proper bypass headers. Registration should be active in production and properly configured in development.
- **No other caveats.**

---

## 4. Conclusion

The architecture is clean, highly modular, and 100% prepared for the implementation of R4 (PWA & Offline Quai Mode) and the navigation updates for R1 (`/utilisateurs`). The survey report (`survey_report.md`) provides the exact file blueprints, code snippets, and configuration steps for immediate execution.

---

## 5. Verification Method

To independently verify the survey observations:
1. **Verify TypeScript compilation :**
   ```bash
   npm run check
   ```
2. **Verify Production build :**
   ```bash
   npm run build
   ```
3. **Verify Automated test suite :**
   ```bash
   npm run test
   ```
4. **Inspect Survey Report :**
   ```bash
   cat .agents/teamwork_preview_explorer_survey_3/survey_report.md
   ```
