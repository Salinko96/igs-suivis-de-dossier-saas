## 2026-08-18T16:04:28Z
You are the Frontend & Role Simulator Implementation Worker for Milestones 2, 3, and 4 of the IGS Guinée SaaS project.

Working Directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_worker_frontend
Authoritative User Request: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/ORIGINAL_REQUEST.md
Project Blueprint: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
Survey Handoffs: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_explorer_survey_1/handoff.md

Scope & Tasks:
1. `client/src/hooks/usePermissions.ts` (Create):
   - Centralize RBAC permissions according to role: `admin`, `declarant`, `comptable`, `client`, `manager`.
   - Capabilities: `canViewFinances`, `canViewControls`, `canViewPlanning`, `canEditCustoms`, `canManageInvoices`, `canCreateDossier`, `canDeleteDossier`, `defaultRoute`, `roleBadge`.
2. `client/src/components/ProtectedRoute.tsx` (Create):
   - Wouter route guard wrapping protected components and redirecting unauthorized roles to their default route with a warning toast.
3. `client/src/App.tsx`:
   - Apply `ProtectedRoute` to `/finances` (requires `canViewFinances`), `/planning` (requires `canViewPlanning`), `/controles` (requires `canViewControls`), `/dossiers/nouveau` (requires `canCreateDossier`).
4. `client/src/components/DashboardLayout.tsx`:
   - Filter `menuItems` with `usePermissions`.
   - In profile switcher: upon `switchRole(newRole)`, await `login({ role: newRole })`, then immediately navigate (`setLocation(perms.defaultRoute)`) without full page reload.
   - Dynamically display active role badge and hide "+ Nouveau Dossier" if not permitted.
5. `client/src/components/CustomsEditModal.tsx` (Create):
   - Fast editing modal for customs and transit identifiers: `blLtaNumber`, `ddiGucegNumber`, `declarationNumber` (Sydonia), `bulletinNumber` (BLD), `badStatus`, `baeStatus`, `customsStatus`, `portStatus`.
   - Persists via `trpc.dossier.updateCustoms` and invalidates queries.
6. `client/src/pages/PlanningPage.tsx`:
   - Interactive operational tasks checklist for Mamadou Diallo: task checkbox toggle with `trpc.task.toggleStatus`, filter by assigned role/name, task creation modal.
7. `client/src/pages/ControlsPage.tsx`:
   - Integrate `CustomsEditModal` for quick anomaly regularisation and Sydonia updates.
8. `client/src/pages/DossierDetailPage.tsx`:
   - Strictly hide "Facturation & Marges" tab if `!canViewFinances` (Déclarant PAC & Client).
   - Integrate `CustomsEditModal` trigger.
   - Restrict delete and customs field edits for Comptable.
9. `client/src/pages/DossiersPage.tsx`:
   - Adapt visible columns per active role (hide margins/finance from Déclarant, hide field actions from Comptable).
   - Integrate `CustomsEditModal` button in action column.
10. `client/src/pages/FinancesPage.tsx`:
    - Clean up any duplicated JSX syntax.
    - Implement interactive GNF / USD multi-currency display switcher (default 8,650 GNF/USD).
    - Rate setting modal (`trpc.finance.setExchangeRate`).
    - Create/Edit invoice modal with débours breakdown (Droits de douane, Redevance PAC, Magasinage) and TVA 18%.
    - Payment recording modal with receipt generation (`REC-2026-X`).
    - Printable Quittance / Proforma receipt preview dialog (`printInvoiceReceipt`).
11. Run `npm run check`, `npm test`, and `npm run build` to verify 0 errors.
