# Original User Request

## 2026-08-18T15:48:41Z

Rendre 100 % opérationnels les profils du simulateur de rôles pour l'application SaaS logistique et douanière IGS Guinée (Déclarant PAC Mamadou Diallo, Comptable Fatoumata Camara, Administrateur IGS, et Portail Client), avec RBAC dynamique, filtrage strict des vues et routes, tâches opérationnelles assignées interactives et module financier multi-devises GNF/USD.

Working directory: /Users/alphasalinkobarry/Downloads/igs-suivis de dossier SaaS
Integrity mode: development

## Requirements

### R1. Gestion d'État Global & RBAC (Role-Based Access Control)
Connecter l'état d'authentification et de simulation de rôle (admin, declarant_pac, comptable, client) dans toute l'application (client et serveur tRPC). Filtrer dynamiquement la barre latérale, les routes protégées, les badges de rôle et les permissions d'action (boutons, formulaires de saisie, accès financiers vs douaniers).

### R2. Profil Opérationnel Déclarant PAC (Mamadou Diallo)
- Vues accessibles : Planning & Échéances, Contrôles Douane & PAC, Tous les Dossiers (consultation et mise à jour technique), Tâches Opérationnelles Assignées.
- Vues masquées : Finances & Facturation, marges bénéficiaires et administration globale.
- Fonctionnalités :
  - Section dynamique « Tâches Opérationnelles Assignées » affichant les actions prioritaires de Mamadou Diallo (ex: Déposer DDI GUCEG pour DOS-0054, Valider déclaration SYDONIA pour DOS-0023, Obtenir BAD Port Autonome de Conakry), avec case à cocher pour validation en temps réel.
  - Saisie et mise à jour des identifiants douaniers (BL/LTA, DDI GUCEG, Sydonia World, statut douanier et portuaire).
  - Gestion et validation des documents de transit (Connaissement, Facture, Certificat d'origine).

### R3. Profil Opérationnel Comptable (Fatoumata Camara)
- Vues accessibles : Finances & Facturation, Pilotage & KPI (version financière), Tous les Dossiers (consultation financière et factures).
- Vues masquées : Actions techniques de dédouanement terrain et configurations système admin.
- Fonctionnalités :
  - Facturation proforma et définitive par dossier client (ex: Guinean Birimian Gold, Guinee Yongchuang).
  - Suivi des débours douaniers (taxes douanières, droits de port PAC, frais de manutention).
  - Conversion et affichage multi-devises GNF et USD avec taux de change paramétrable.
  - Suivi des règlements clients (Payé, Partiel, En attente, Échu) et génération de quittances.

### R4. Simulateur de Rôles & Expérience Utilisateur Immédiate
- Le clic sur « Déclarant PAC (Mamadou Diallo) » bascule instantanément l'interface sur son profil, met à jour le badge utilisateur en bas à gauche, masque les finances et alimente la colonne des tâches opérationnelles assignées.
- Le clic sur « Comptable (Fatoumata Camara) » redirige automatiquement vers l'espace financier avec les indicateurs de trésorerie et créances à recouvrer.
- Le clic sur « Administrateur » réactive la vue complète à 360°.

## Acceptance Criteria

### RBAC & Navigation
- [ ] La barre latérale et les routes s'adaptent instantanément au rôle sélectionné sans rechargement de page.
- [ ] Un déclarant ne peut pas accéder aux pages/données financières (redirection ou message d'accès restreint).
- [ ] Une comptable a un accès direct aux factures, débours et règlements multi-devises GNF/USD.

### Opérations Déclarant & Tâches
- [ ] La colonne « Tâches Opérationnelles Assignées » sur la page Planning affiche les tâches réelles associées aux dossiers (DOS-0054, DOS-0023, DOS-0021, DOS-0003, etc.).
- [ ] Le déclarant peut cocher/terminer une tâche ou modifier un statut douanier avec persistance en base.

### Opérations Comptables & Multi-Devises
- [ ] Les montants s'affichent correctement en Francs Guinéens (GNF) et en Dollars US (USD).
- [ ] Le suivi des débours douaniers et des factures proforma/définitives est opérationnel.

### Tests & Déploiement
- [ ] Tous les tests unitaires et d'intégration TypeScript passent avec succès (npm test).
- [ ] Build Vercel sans erreur et déploiement vérifié sur l'URL de production.
