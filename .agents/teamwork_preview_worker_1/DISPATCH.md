## 2026-08-19T11:25:18Z

Scope assignment:
Files owned exclusively:
- `client/src/pages/ClientPortalPage.tsx`
- `server/alertsService.ts`
- `client/src/components/DashboardLayout.tsx`
- `server/routers.ts`
- `server/db.ts`

Tasks:
1. R1 (Client Portal Search Bug Fix):
   - In `client/src/pages/ClientPortalPage.tsx`:
     - Set `retry: false` on `trpc.portal.track.useQuery`.
     - Properly handle `portalQuery.isError`, `portalQuery.isFetching`, and `portalQuery.isLoading`.
     - Display a clear, centered, and beautifully styled error card when invalid code entered: « Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez. ».
     - Provide clickable badges for sample codes (`IGS-1001`, `CKYSI26000340`, `HLCUNG12604AUQG1`) that populate the search input and trigger search.
     - Ensure search input and submit button are never stuck or disabled after an error.
   - In `server/routers.ts`:
     - In `portal.track`: if dossier not found, throw `new TRPCError({ code: "NOT_FOUND", message: "Aucun dossier trouvé pour ce code. Vérifiez le code d'accès et réessayez." })`.
   - In `server/db.ts`:
     - In `getDossierByPortalCode`: ensure lookup checks `portalAccessCode`, `dossierNumber`, `blLtaNumber`, AND `clientDossierNumber` (both in DB query and memory fallback) so that codes like `CKYSI26000340` and `HLCUNG12604AUQG1` resolve correctly.

2. R2 (Notifications Read State & Real-Time Badge Sync):
   - In `server/alertsService.ts`:
     - Assign deterministic, stable IDs to generated proactive alerts (e.g. `(d.id * 10) + alertTypeIndex`) so alert IDs do NOT shift when dossiers are updated or re-sorted.
   - In `server/db.ts`:
     - Ensure `listNotifications`, `markNotificationAsRead`, and `markAllNotificationsAsRead` accurately track and persist read alert IDs.
   - In `client/src/components/DashboardLayout.tsx`:
     - Use `const utils = trpc.useUtils()`.
     - In `markAsRead` mutation, add optimistic update to update `isRead: 1` in `utils.notification.list.setData(...)` immediately.
     - In `markAllAsRead` mutation, add optimistic update to mark all items `isRead: 1` immediately.
     - On `onSettled` / `onSuccess`, call `utils.notification.list.invalidate()`.
     - Ensure the red badge counter (`unreadCount`) updates instantly to 0 upon "Tout marquer lu" or decrements upon "Marquer lu".
     - Visually dim read notifications or filter them appropriately.

3. Backend Performance Optimization for R4:
   - In `server/db.ts`: optimize `getDossier` to do direct index/primary key lookup `eq(dossiers.id, numId)` first before scanning multiple string fields.
