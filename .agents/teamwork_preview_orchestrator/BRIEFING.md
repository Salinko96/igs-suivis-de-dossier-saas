# BRIEFING — 2026-08-18T15:49:58Z

## Mission
Rendre 100 % opérationnels les profils du simulateur de rôles pour l'application SaaS logistique et douanière IGS Guinée (Déclarant PAC Mamadou Diallo, Comptable Fatoumata Camara, Administrateur IGS, et Portail Client), avec RBAC dynamique, filtrage strict des vues et routes, tâches opérationnelles assignées interactives et module financier multi-devises GNF/USD.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/.agents/teamwork_preview_orchestrator
- Original parent: parent
- Original parent conversation ID: bc9ea8ad-f31b-4eba-88c7-38bd395cfdf2

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS/PROJECT.md
1. **Decompose**: Decompose into modular milestones (RBAC/Global State, Déclarant PAC features & persisted tasks, Comptable features & multi-currency billing, Role Simulator UX & end-to-end integration/testing)
2. **Dispatch & Execute**:
   - **Survey (Step 0)**: Dispatch 3 parallel Explorers / Spec Miners to map existing codebase, tRPC routes, schema, client components, and role simulation infrastructure.
   - **Milestones**: Run dual track (E2E Testing Track + Implementation Track per milestone via Explorer -> Worker -> Reviewer -> Challenger -> Auditor gate loop).
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign -> Escalate
4. **Succession**: Threshold 16 spawns -> dump handoff.md, cancel timers, spawn successor.
- **Work items**:
  1. Survey & Scope Mapping [in-progress]
  2. RBAC & Global Simulation Sync [pending]
  3. Déclarant PAC Profile & Operational Tasks [pending]
  4. Comptable Profile & Multi-Currency Financial Module [pending]
  5. Role Simulator UX & Dynamic Permissions [pending]
  6. E2E Testing & Quality Verification [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Survey phase (waiting for 3 Explorers)

## 🔒 Key Constraints
- DISPATCH-ONLY orchestrator: Never write/edit source code directly, never run tests directly.
- Delegate all technical work and verification to subagents.
- Mandatory audit enforcement (teamwork_preview_auditor integrity check is binary veto).
- Strict adherence to AGENTS.md (React 19, Vite, Tailwind 4, tRPC, Drizzle ORM, Zod, Vitest).
- Pass all E2E and unit tests (`npm test`), clean build, no lint errors.

## Current Parent
- Conversation ID: bc9ea8ad-f31b-4eba-88c7-38bd395cfdf2
- Updated: 2026-08-18T15:49:58Z

## Key Decisions Made
- Dispatched 3 parallel Explorers for Step 0 Survey covering Frontend, Backend/Schema, and Testing.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_1 | teamwork_preview_explorer | Frontend & UI Architecture Survey | in-progress | 522ad65d-f2ac-4261-be46-03080da7350b |
| explorer_survey_2 | teamwork_preview_explorer | Backend & DB Schema Survey | in-progress | 306934be-8c81-43c6-b7da-c1aaf97ef3c2 |
| explorer_survey_3 | teamwork_preview_explorer | Testing & Quality Gates Survey | in-progress | 4aa9ba1e-1849-4553-bcb6-ba9acf7add51 |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: 522ad65d-f2ac-4261-be46-03080da7350b, 306934be-8c81-43c6-b7da-c1aaf97ef3c2, 4aa9ba1e-1849-4553-bcb6-ba9acf7add51
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 3bba92c2-33c3-493f-8daa-7cb66a8d90a8/task-11
- Safety timer: none

## Artifact Index
- ORIGINAL_REQUEST.md — Verbatim user mission and acceptance criteria
- DISPATCH.md — Agent dispatch log
- BRIEFING.md — Persistent working memory and identity
- progress.md — State tracking and heartbeat log
