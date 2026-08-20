## 2026-08-20T13:44:19Z

You are teamwork_preview_worker for Milestone 4 of the IGS Transit & Douane Guinée SaaS project.

Working Directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_m4
Authoritative Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/ORIGINAL_REQUEST.md
Scope Document: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_orchestrator_2/SCOPE.md
Project Document: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope and Requirements for Milestone 4 (Mode Mobile & PWA Installable pour Agents sur le Quai - Port de Conakry):
1. `client/public/manifest.json`:
   - Create genuine Web App Manifest:
     - name: "IGS Transit & Douane Guinée — Suivis de Dossiers"
     - short_name: "IGS Transit"
     - description: "Application SaaS professionnelle de gestion des dossiers de transit, dédouanement et facturation au Port Autonome de Conakry."
     - start_url: "/"
     - display: "standalone"
     - background_color: "#0b3b32"
     - theme_color: "#0b3b32"
     - orientation: "portrait-primary"
     - icons:
       - src: "/igs-logo-icon.png", sizes: "192x192", type: "image/png", purpose: "any maskable"
       - src: "/igs-logo-transparent.png", sizes: "512x512", type: "image/png", purpose: "any maskable"
       - src: "/favicon.png", sizes: "64x64 32x32 24x24 16x16", type: "image/png"
     - categories: ["business", "productivity", "utilities"]
     - lang: "fr-GN"

2. `client/public/sw.js`:
   - Service Worker implementing cache management for Conakry docks (intermittent 3G/4G connection):
     - Cache name: `igs-transit-v1`
     - Static assets precaching (shell assets, images, icons, manifest).
     - Cache-First strategy for static assets (js, css, images, fonts).
     - Network-First with Cache fallback strategy for API / tRPC queries (`/api/trpc`) so agents on the docks can read cached dossiers when network drops.
     - Event listeners: `install` (with skipWaiting), `activate` (with clients.claim and purging obsolete caches), `fetch` (handling static vs API caching properly).

3. `client/src/hooks/useOnlineStatus.ts`:
   - React hook tracking online/offline status with `navigator.onLine`, event listeners for 'online' and 'offline', and tracking when connection is restored (`wasOffline`).

4. `client/src/components/NetworkStatusBanner.tsx`:
   - Visual alert banner rendered when offline ("Mode Hors-Ligne (Quai de Conakry) : Données en cache actives. Les modifications seront synchronisées au rétablissement du réseau.").
   - Temporary green notification when back online ("Connexion rétablie : Synchronisation terminée.").

5. `client/src/components/PWAInstallBanner.tsx`:
   - Interactive banner / button that listens for `beforeinstallprompt` event and triggers the native install prompt when clicked.
   - Includes dismiss option with localStorage state to avoid nagging.

6. `client/index.html`:
   - Add `<link rel="manifest" href="/manifest.json" />`
   - Add `<meta name="theme-color" content="#0b3b32" />`
   - Add iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`).

7. Service Worker Registration & UI Integration:
   - Register `sw.js` in `client/src/main.tsx` if supported in browser environment.
   - Integrate `NetworkStatusBanner` and `PWAInstallBanner` in `client/src/components/DashboardLayout.tsx` or `client/src/App.tsx`.

8. Tests & Validation:
   - Create comprehensive tests in `server/pwa_offline.test.ts` and `client/src/__tests__/pwa_offline.test.ts` verifying:
     - Manifest content and validity (JSON schema, theme color, icons, display mode).
     - Service worker file syntax, cache strategy logic, and offline handling.
     - `useOnlineStatus` hook behavior.
     - `NetworkStatusBanner` and `PWAInstallBanner` component rendering and states.
   - Run `npm run check` (ensure 0 errors).
   - Run `npm run test` (ensure 100% tests pass across the entire codebase).
   - Run `npm run build` (ensure production build passes).
