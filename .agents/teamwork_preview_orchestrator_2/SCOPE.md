# Scope: Milestone 4 & 5 (Gen 2 Orchestrator)

## Architecture
- **PWA & Offline System**:
  - `client/public/manifest.json`: Web app manifest configured with name "IGS Transit & Douane Guinée", short_name "IGS Transit", start_url "/", display "standalone", theme_color "#0b3b32", background_color "#0b3b32", icons (/igs-logo-icon.png, /igs-logo-transparent.png).
  - `client/public/sw.js`: Service worker implementing Cache-First caching strategy for static assets (js, css, images, fonts) and Network-First caching strategy for tRPC queries (/api/trpc) with fallback to cached responses when offline.
  - `client/src/hooks/useOnlineStatus.ts`: Hook tracking `navigator.onLine` and `online`/`offline` window events.
  - `client/src/components/NetworkStatusBanner.tsx`: Top banner alerting agents at Conakry port when offline ("Mode Hors-Ligne (Quai de Conakry) - Données locales actives").
  - `client/src/components/PWAInstallBanner.tsx`: Banner/button capturing `beforeinstallprompt` event to allow 1-click PWA installation on Android/iOS/Desktop.
  - `client/src/main.tsx` & `client/index.html`: Service worker registration and PWA meta tags (`apple-mobile-web-app-capable`, `theme-color`, `manifest`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M4 | Mode Mobile & PWA Installable pour Agents sur le Quai | `manifest.json`, `sw.js`, `NetworkStatusBanner`, `PWAInstallBanner`, `useOnlineStatus`, service worker registration, unit & integration tests | none | DONE |
| M5 | Final E2E Test Verification & Hardening | Run all test suites (520 tests), `npm run check` (0 errors), `npm run build` | M4 | DONE |
