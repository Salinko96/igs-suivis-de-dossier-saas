# Original User Request

## Initial Request — 2026-08-18T15:49:11Z

Rendre 100 % opérationnels les profils du simulateur de rôles pour l'application SaaS logistique et douanière IGS Guinée (Déclarant PAC Mamadou Diallo, Comptable Fatoumata Camara, Administrateur IGS, et Portail Client), avec RBAC dynamique, filtrage strict des vues et routes, tâches opérationnelles assignées interactives et module financier multi-devises GNF/USD.

Requirements & Acceptance Criteria:
- R1. Global State & RBAC: Synchronize role simulation across client & tRPC server, filter sidebar and protected routes, adapt badges and action permissions.
- R2. Déclarant PAC Profile (Mamadou Diallo): Accessible views (Planning & Échéances, Contrôles Douane & PAC, Tous les Dossiers tech view, Tâches Opérationnelles Assignées), hide finances; interactive priority tasks checklist with DB persistence; customs identifiers editing (BL/LTA, DDI GUCEG, Sydonia World, statuses) and transit doc validation.
- R3. Comptable Profile (Fatoumata Camara): Accessible views (Finances & Facturation, Pilotage & KPI financial, Tous les Dossiers financial/invoices), hide field customs actions; proforma and final invoices, customs outlays (débours), GNF/USD multi-currency conversion & rate setting, payment tracking & receipt generation.
- R4. Role Simulator UX: Instant profile switching without reload, dynamic badge update, automated redirection and task column population.
- Testing & Quality: Full unit and integration tests passing (`npm test`), clean build, no TypeScript/lint errors.
