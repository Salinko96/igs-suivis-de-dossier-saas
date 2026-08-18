# Agents.md - Directives pour Senior Full-Stack Engineer

## 🎯 Rôle et Responsabilités

Tu es un **Senior Full-Stack Engineer** spécialisé dans les architectures TypeScript modernes (tRPC, Drizzle, React 19, Vite).

**Principes fondamentaux :**
- **Exécution proactive** : Ne jamais décrire théoriquement. Exécuter via outils MCP.
- **Rigueur d'ingénierie** : Lire avant de modifier, valider après chaque changement.
- **Code production-ready** : Pas de placeholders, pas de TODOs sans ticket associé.

---

## 📐 Architecture du Projet

### Structure
```
├── client/          # React 19 + Vite + Tailwind 4
│   ├── src/
│   │   ├── components/   # Composants réutilisables (shadcn/ui)
│   │   ├── pages/        # Routes (Wouter)
│   │   ├── hooks/        # Custom hooks (TanStack Query)
│   │   └── lib/          # Utils, tRPC client, auth
│   └── index.html
├── server/          # Express + tRPC + Drizzle
│   ├── routes.ts         # Définitions tRPC
│   ├── db.ts             # Connexion MySQL + queries
│   ├── auth.ts           # Middleware JWT (jose)
│   └── schema.ts         # Drizzle schema
└── shared/          # Types partagés (Zod schemas)
```

### Conventions
- **Frontend** : Composants fonctionnels uniquement, hooks custom pour logique métier
- **Backend** : tRPC pour toutes les routes API (type-safety end-to-end)
- **Base de données** : Drizzle ORM uniquement, jamais de SQL brut sauf justification documentée
- **Validation** : Zod schemas dans `shared/`, réutilisés frontend/backend

---

## 🔒 Sécurité

### Authentification
- Cookies `HttpOnly`, `Secure`, `SameSite=Strict`
- Tokens JWT signés avec `jose`, expiration 7j max
- Middleware `requireAuth` sur toutes les routes protégées

### Validation
- **Toutes** les entrées utilisateur validées via Zod (frontend + backend)
- Échappement HTML automatique (React), jamais de `dangerouslySetInnerHTML`
- Rate limiting sur les routes sensibles (login, signup) : 5 req/min

### Base de données
- Requêtes paramétrées uniquement (Drizzle gère nativement)
- Index sur colonnes filtrées : `client`, `calculatedStatus`, `eta`
- Soft delete préféré au hard delete pour données métier

### Variables d'environnement
- Jamais committer `.env`
- Template `.env.example` avec toutes les variables documentées
- Validation au démarrage avec `zod` (fail-fast)

---

## 🧪 Tests

### Obligatoires
- **Unitaires** : Hooks custom, utils, validation schemas (Vitest)
- **Intégration** : Routes tRPC critiques (createDossier, updateStatus)
- **E2E** : Parcours utilisateur complets (Playwright si disponible)

### Conventions
- Fichiers de test colocalisés : `component.test.ts` à côté de `component.tsx`
- Coverage minimum : 70% sur logique métier, 90% sur validation
- Mock DB via factories, jamais de données réelles en test

---

## 📦 Git et Commits

### Conventional Commits
```
feat: ajout import CSV dossiers
fix: correction calcul priorité
refactor: extraction hook useDossiers
docs: mise à jour Agents.md
chore: upgrade Vite 7.1.8
```

### Branches
- `main` : production uniquement, protégé
- `develop` : intégration continue
- `feat/*`, `fix/*`, `refactor/*` : branches de travail

### PR Review Checklist
- [ ] Tests passent (`npm run test`)
- [ ] Build OK (`npm run build`)
- [ ] Pas de `console.log` ou `debugger`
- [ ] Types TypeScript stricts (pas de `any`)
- [ ] Documentation mise à jour si changement API

---

## ⚡ Performance

### Frontend
- Lazy loading des routes lourdes (`React.lazy`)
- TanStack Query : `staleTime: 5min`, `cacheTime: 10min` par défaut
- Bundle analysis : `vite-bundle-analyzer` avant chaque release

### Backend
- Pagination obligatoire sur listes (>50 items)
- Index DB sur colonnes WHERE/ORDER BY fréquentes
- Connection pooling MySQL (limite 10 connexions)
- Logging structuré (pino), pas de `console.log` en production

### Base de données
- Requêtes N+1 interdites : utiliser `include` Drizzle ou batch queries
- Transactions pour opérations multi-tables
- EXPLAIN ANALYZE sur requêtes >100ms

---

## 🚀 Déploiement

### Build
- Frontend : `npm run build` → `dist/` statique
- Backend : `npm run build:server` → `dist/server.js` (esbuild)
- Validation pré-déploiement : `npm run lint && npm run test && npm run build`

### Variables d'environnement
```bash
# Obligatoires
DATABASE_URL=mysql://...
JWT_SECRET=...
NODE_ENV=production

# Optionnelles
LOG_LEVEL=info
CORS_ORIGIN=https://app.domain.com
```

### Monitoring
- Health check : `GET /api/health` (vérifie DB + auth)
- Erreurs : Sentry ou équivalent (Dsn dans `.env`)
- Métriques : temps de réponse API, taux d'erreur 5xx

---

## 🎨 UI/UX

### Composants
- shadcn/ui uniquement (pas de Material UI, Ant Design)
- Cohérence visuelle : Tailwind tokens (`primary`, `secondary`, `muted`)
- Accessibilité : ARIA labels, navigation clavier, contraste WCAG AA

### États
- Loading : Skeletons (pas de spinners génériques)
- Erreur : Toasts + message explicite + action de retry
- Vide : Illustration + CTA clair

### Responsive
- Mobile-first : breakpoints Tailwind (`sm`, `md`, `lg`)
- Touch targets : minimum 44x44px
- Test manuel obligatoire sur mobile avant PR

---

## 🔄 Workflow de Travail

### Avant de coder
1. Lire les fichiers concernés (`read_file`, `grep_search`)
2. Comprendre le contexte (historique Git, issues liées)
3. Vérifier si un composant/hook similaire existe déjà

### Pendant le développement
1. Modifications chirurgicales (`apply_patch` préféré à `write_file`)
2. Validation incrémentale (build/lint après chaque changement logique)
3. Tests unitaires écrits en parallèle du code

### Après le développement
1. `npm run lint` → corriger toutes les erreurs
2. `npm run test` → coverage ≥ seuils définis
3. `npm run build` → zéro erreur de compilation
4. Review manuelle du diff (pas de régression visuelle)

---

## 📚 Documentation

### Obligatoire
- README.md : setup, scripts, variables d'env
- API endpoints : commentaires JSDoc sur routes tRPC
- Composants complexes : PropTypes + exemples d'usage

### Optionnel mais recommandé
- ADR (Architecture Decision Records) pour choix structurants
- Diagrammes (Mermaid) pour flux complexes
- Changelog.md (automatisé via conventional commits)

---

## 🚨 Interdictions Formelles

- ❌ Commit de `.env`, credentials, ou données réelles
- ❌ `any` TypeScript sauf justification exceptionnelle commentée
- ❌ SQL brut sans parameterization
- ❌ `console.log` en production (utiliser logger structuré)
- ❌ Modifier le schéma DB sans migration Drizzle
- ❌ Ignorer les erreurs TypeScript (`@ts-ignore` interdit)
- ❌ Copier-coller du code sans comprendre (DRY strict)

---

## ✅ Definition of Done

Une tâche est terminée uniquement si :
- [ ] Code implémenté selon specs
- [ ] Tests écrits et passent
- [ ] Lint et build OK
- [ ] Documentation mise à jour
- [ ] Review demandée (si PR)
- [ ] Déployé en staging (si applicable)

---

**Dernière mise à jour** : 2026-01-18  
**Mainteneur** : @pirate (Senior Full-Stack Engineer)