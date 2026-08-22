# Comprehensive Technical Survey: Business Logic, Financial/Customs Calculation Engines & Automated Test Suite

**Project:** IGS Transit & Douane Guinée (SaaS Suivi de Dossiers)  
**Surveyed by:** `teamwork_preview_explorer_survey_3`  
**Date:** 2026-08-22  
**Integrity Mode:** Development / Production Audit  

---

## Executive Summary

The IGS Logistics SaaS application features a comprehensive business logic engine and automated testing infrastructure designed for port transit operations at the **Port Autonome de Conakry (PAC)** in the Republic of Guinea.

Key findings of this survey:
1. **Financial & Currency Engine:** Complete end-to-end multi-currency system (GNF, USD, EUR) with live exchange rate synchronization (BCRG / OpenExchange), immutable rate history, mandatory justification for manual overrides, and strict fiscal separation of 18% TVA on transit service fees vs. tax-exempt port/customs disbursements.
2. **Customs & Port Regimes:** Implementation of Guinea's official 7-regime SYDONIA World / DDI GUCEG customs taxonomy, with automated deprecation enforcement, backward-compatible historical reads, and state-machine transitions requiring physical release dates and declaration numbers for regularized status.
3. **Demurrage & Storage Calculation:** 7-day port franchise monitoring with automated proactive J-2 warnings and overdue demurrage alert dispatching across persisted notifications, WhatsApp HSM templates, and transactional emails.
4. **Document Generation:** Client-side and server-side PDF generator (`jsPDF` + `jspdf-autotable`) producing tamper-proof pro-forma and definitive invoices with dynamic 2D QR verification codes linking directly to the client portal.
5. **Test & Build Infrastructure:** A suite of 54 test files comprising 600 passing tests across four rigor tiers (pure business logic, tRPC RBAC integration, UI route guards, and end-to-end regression), with zero TypeScript compilation errors (`npm run check`) and clean production builds (`npm run build`).

---

## 1. Deep Dive: Business & Financial Calculation Engines

### 1.1 Demurrage Risk & Port Detention Calculations

#### Business Rules & Formula
- **Port of Operations:** Port Autonome de Conakry (PAC) / Conakry Terminal.
- **Port Free Time (Franchise Portuaire):** Standard 7 calendar days from vessel arrival (`eta`).
- **Engine Location:** `server/dossierRules.ts` (`calculateDemurrageRisk`), `server/cronDemurrageReminders.ts` (`runDemurrageReminderJob`), and `server/alertsService.ts` (`generateProactiveAlerts`).

```typescript
// Core Formula in server/dossierRules.ts
const diffMs = referenceDate.getTime() - etaDate.getTime();
const daysOnQuay = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
const daysRemaining = Math.max(0, freeDays - daysOnQuay);
const daysOverFreeTime = Math.max(0, daysOnQuay - freeDays);
```

#### State Machine & Urgency Levels
| Condition | Urgency Level | Status Label | Triggered Actions |
|---|---|---|---|
| `goodsReleaseDate !== null` | `resolved` | `"Sorti"` | Days on quay set to 0; no alerts sent. |
| `daysOnQuay < 5` | `normal` | `"Sous Franchise"` | Standard monitoring; days remaining displayed. |
| `5 <= daysOnQuay < 7` | `warning` | `"Risque Surestarie (J-2)"` | Warning alert dispatched via Notification + WhatsApp + Email. |
| `daysOnQuay >= 7` | `critical` | `"Surestarie Dépassée"` | Critical alert; calculated overdue days (`daysOverFreeTime`); penalty fees accrue. |

#### Storage & Demurrage Fee Integration
- The database schema (`drizzle/schema.ts:166`) includes `storageAndDemurrageFees: integer("storageAndDemurrageFees").notNull().default(0)`.
- When calculating invoices (`calculateInvoiceFinancials`), demurrage and storage are classified as non-taxable disbursements and summed into the total payable amount:
  $$\text{Total Payable} = \text{Amount TTC} + \text{Disbursements} + \text{Storage \& Demurrage}$$

---

### 1.2 Customs Regime Handling (Guinean Customs & SYDONIA World)

#### Official vs. Deprecated Regimes
The application enforces Guinea's official customs nomenclature (`server/dossierRules.ts` & `server/routers.ts`):

**Valid Customs Regimes (7 Official Categories):**
1. `Mise à la consommation directe (IM4 - TTC)`
2. `Mise à la consommation sous exonération (IM4 - EXO)`
3. `Transit National / International (IM8 - DDI / TRIE)`
4. `Admission Temporaire (IM5 - AT)`
5. `Enlèvement provisoire` *(positioned immediately after IM5 AT)*
6. `Entrepôt de Douane (IM7 - ED)`
7. `Exportation / Réexportation (EX)`

**Deprecated Values (Rejected on Create/Edit):**
- `"TTC"`
- `"EXO"`
- `"AT"`
- `"Régime Minier / Convention (EXO-MIN)"`

#### Customs Document Milestones & Validation
- **DDI GUCEG:** `ddiGucegNumber` (Format: `DDI-YYYY-XXXX` or `DDI-XXXX`).
- **SYDONIA Declaration:** `declarationNumber` (Format: `S <num>- <year>` or `S <num>- DD/MM/YYYY`).
- **Bulletin de Liquidation (BLD):** `bulletinNumber` (Format: `L <num>- <year>` or `BLD-<num>`).
- **Bon à Délivrer (BAD):** `badStatus` (`"Non_recu" | "Demande" | "Obtenu"`).
- **Bon à Enlever (BAE):** `baeStatus` (`"En_attente" | "Delivre" | "Bloque"`).
- **PAC Exit:** `goodsReleaseDate` (Timestamp).

#### State Transition Gatekeeper (`validateStatusTransition`)
To prevent invalid customs clearance status, transitioning a dossier to `"Régularisé"` strictly requires:
1. `goodsReleaseDate` (Effective physical release date)
2. `declarationNumber` (Official SYDONIA declaration number)

If either field is missing, `validateStatusTransition` rejects the mutation with an explicit HTTP 400 error.

---

### 1.3 PAC Storage Fee Curves & Tariff Schedules

#### Current PAC Fee Architecture
- PAC storage fees are tracked via `portFeesAmount` (dock fees, handling, container traction) and `storageAndDemurrageFees` (terminal storage beyond 7 days).
- In `server/db.ts`, disbursements are tracked across distinct categories in `pacDisbursements`:
  - `douane`: Trésor Public customs duties.
  - `port`: Port Autonome de Conakry port authority fees.
  - `surestaries`: Demurrage charges from shipping lines (MSC, Maersk, CMA CGM, Hapag-Lloyd).
  - `acconage`: Stevedoring and container handling at Conakry Terminal.
- Financial aggregates in `db.getProfitabilityMetrics` track the **Disbursements-to-Revenue Ratio** (`deboursToCARatioPct = (totalAdvancedDeboursGNF / totalInvoicedGNF) * 100`). An alert `isRiskAlert` is triggered if this ratio exceeds 150%, flagging excessive cash advances for port dues.

---

### 1.4 Currency Calculations, VAT (TVA 18%) & Multi-Currency Engine

#### Currencies & Exchange Rate Architecture
- **Primary Accounting Currency:** Guinean Franc (GNF).
- **Secondary Currencies:** US Dollar (USD) and Euro (EUR), heavily used by mining consortia (e.g. SMB, Guinean Birimian Gold, Capdrill).
- **Reference Rates:** Standard baseline: $1\text{ USD} = 8,650\text{ GNF}$, $1\text{ EUR} = 9,450\text{ GNF}$.

#### Live Rate Sync & Governance (`server/exchangeRateService.ts`)
1. **Live Synchronization (`syncDailyExchangeRate`):** Fetches market rates from `https://open.er-api.com/v6/latest/USD` with a 2,500ms timeout. Falls back gracefully to BCRG reference rates if offline.
2. **Immutable Audit History (`exchange_rates`):** Daily rates are persisted with timestamps and provider sources.
3. **Manual Overrides with Governance (`overrideExchangeRate`):** Accountants can enter custom rates for special mining agreements. Requires a mandatory audit justification ($\ge 5$ characters) and records an immutable entry in the audit trail (`TAUX_CHANGE_MODIFIE`).

#### Tax Engine & Guinean VAT Rules (TVA 18%)
Under Guinean tax law, freight forwarding (transit) services are taxed at 18%, whereas government customs duties and port disbursements paid on behalf of clients are non-taxable débours:

$$\text{Amount TVA} = \text{round}(\text{Amount HT} \times 0.18)$$
$$\text{Amount TTC} = \text{Amount HT} + \text{Amount TVA}$$
$$\text{Disbursements} = \text{Customs Duties} + \text{Port Fees} + \text{Storage \& Demurrage}$$
$$\text{Grand Total (Net to Pay)} = \text{Amount TTC} + \text{Disbursements}$$

---

### 1.5 Pro-Forma & Definitive Invoice Generators

#### PDF Generation (`client/src/lib/pdfGenerator.ts`)
- Utilizes `jsPDF` with `jspdf-autotable` and `qrcode`.
- **Visual Identity:** Branded IGS header in corporate green (`#0b3b32`) and gold (`#d9a94b`).
- **Line Item Separation:**
  1. Droits de Douane & Taxes Trésor Public (SYDONIA / DDI GUCEG) — Advanced disbursements.
  2. Redevances Portuaires & Manutention Quai (PAC) — Port disbursements.
  3. Prestations de Transit, Suivi Douanier & Conduite en Douane — Taxable agency fees.
- **Multi-Currency Display:** Prints primary currency and automatic counter-value equivalent in GNF/USD based on active rate.
- **Anti-Fraud QR Code:** Encodes direct link to client tracking portal:
  `https://igs-suivis-de-dossier-saas.vercel.app/portail-client?code=<portalCode>`
- **Supabase Cloud Sync:** `generateInvoicePdfBase64` converts the generated PDF to a Base64 URI for background storage upload (`supabase.uploadInvoicePdf`).

---

## 2. Test Suite & Build Infrastructure Audit

### 2.1 Test Architecture & Vitest Configuration

#### Configuration Review (`vitest.config.ts`)
- **Root Directory:** Resolved via `import.meta.dirname`.
- **Path Aliases:** `@` $\to$ `client/src`, `@shared` $\to$ `shared`, `@assets` $\to$ `attached_assets`.
- **Environment:** `node`.
- **Include Patterns:**
  - `server/**/*.test.ts`
  - `server/**/*.spec.ts`
  - `client/src/**/*.test.ts`
  - `client/src/**/*.spec.ts`

*Observation:* `client/src/**/*.test.tsx` was initially excluded from the pattern, though all adversarial UI tests are located in `.test.ts` files. Adding `client/src/**/*.test.tsx` ensures future React component tests execute seamlessly.

#### Test Execution Metrics
- **Total Test Files:** 54 test files.
- **Total Tests:** 600 tests passing (100% pass rate).
- **Execution Duration:** ~25.8 seconds.
- **Test Categories:**
  - `server/__tests__/tier1_business_logic/`: 5 test files (Currency conversion, customs rules, proactive alerts, RBAC).
  - `server/__tests__/tier2_trpc_rbac_integration/`: 8 test files (Auth simulation, client portal isolation, comptable workflow, declarant workflow, dynamic routes).
  - `server/__tests__/tier3_ui_navigation_guards/`: 1 test file (Navigation guards and permissions).
  - `server/__tests__/tier4_e2e_scenarios/`: 2 test files (End-to-end regression validation).
  - Specialized Stress & Security Suites: 38 test files covering optimistic locking, audit trail integrity, session lifecycles, PWA offline synchronization, Terminal49 resilience, and fail-safe timeouts.

---

### 2.2 TypeScript & Production Build Audit

#### TypeScript Check (`npm run check` $\to$ `tsc --noEmit`)
- **Result:** Code 0 (0 errors).
- **Strict Mode:** Enabled (`"strict": true` in `tsconfig.json`).
- **Module Resolution:** `"bundler"`.
- **Type Safety:** Type-safe Drizzle schema infer types (`User`, `Dossier`, `Invoice`, `PacDisbursement`, `ExchangeRate`, `AuditLog`), Zod validation schemas, and end-to-end tRPC contract typing.

#### Production Build (`npm run build`)
- **Vite Client Build:** Bundles React 19 SPA to `dist/public/` with gzip compression and code splitting (`charts`, `excel-engine`, `pdf-engine`, `ui`).
- **Serverless API Build:** `esbuild server/vercel-entry.ts --bundle --platform=node --format=esm --outfile=api/index.mjs --packages=external`.
- **Node Server Build:** `esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`.
- **Build Duration:** Client built in 9.42s; API and Server bundled in < 40ms.

---

## 3. Coverage Analysis & Missing Test Cases Matrix

To achieve enterprise-grade 100% test reliability across all calculation engines and edge cases, the following test matrix classifies existing coverage against recommended additional cases:

```
+-----------------------------------------------------------------------------+
|                               TEST TIERS MATRIX                             |
+-------------------+--------------------------------+------------------------+
| Tier              | Current Coverage               | Recommended Additions  |
+-------------------+--------------------------------+------------------------+
| Tier 1: Feature   | - Currency conversion          | - Tiered PAC demurrage |
| Coverage          | - VAT 18% calculation          |   progressive schedule |
|                   | - 7 Customs regimes            | - Auto-proforma rate   |
|                   | - 7-day demurrage logic        |   lock invariants      |
+-------------------+--------------------------------+------------------------+
| Tier 2: Boundary  | - Zero/negative amount guards  | - Floating-point round |
| & Corner Cases    | - Invalid Sydonia formats      |   precision (>100B GNF)|
|                   | - Deprecated regime rejection  | - Leap year & UTC/GMT  |
|                   | - Null/undefined handling      |   Conakry time shifts  |
+-------------------+--------------------------------+------------------------+
| Tier 3: Cross-    | - 3-Way reconciliation         | - Realtime rate change |
| Feature Scenarios | - Optimistic locking diffs     |   impact on drafts     |
|                   | - Client portal token auth     | - Concurrent payments  |
|                   | - Audit log generation         |   during status change |
+-------------------+--------------------------------+------------------------+
| Tier 4: Real-     | - 54-dossier initial dataset   | - 1,000+ batch import  |
| World Workloads   | - E2E full lifecycle test      | - High-load aggregate  |
|                   | - Terminal49 API simulation    |   cache invalidation   |
+-------------------+--------------------------------+------------------------+
```

### Detailed Recommended Test Specifications

#### 1. Tier 1 (Feature Coverage): Tiered Progressive PAC Storage Schedule
- **Test:** Verify storage fee calculations across PAC rate tiers:
  - Days 1–7: 0 GNF/day (Franchise).
  - Days 8–15: Tranche 1 tariff (e.g., 250,000 GNF/day for 20', 450,000 GNF/day for 40').
  - Days 16–30: Tranche 2 tariff (e.g., 500,000 GNF/day for 20', 900,000 GNF/day for 40').
  - Days 31+: Tranche 3 penal tariff (e.g., 1,000,000 GNF/day for 20', 1,800,000 GNF/day for 40').

#### 2. Tier 2 (Boundary & Precision): Floating Point & Large Scale GNF
- **Test:** Mining invoices exceeding 50,000,000,000 GNF ($5.7M USD). Verify integer safety and absence of IEEE 754 precision artifacts when converting between GNF and USD.
- **Test:** Midnight timezone boundaries: Test ETA set at `2026-08-22T23:59:59Z` evaluated at `2026-08-23T00:00:01Z` in Conakry Local Time (GMT+0).

#### 3. Tier 3 (Cross-Feature): Concurrent Rate Override & Invoicing
- **Test:** Verify that when an exchange rate override occurs (e.g., $1\text{ USD} \to 8,800\text{ GNF}$), invoices already emitted preserve their `exchangeRate` snapshot (`rateLockedAt`), while newly created pro-formas immediately adopt the new rate.

#### 4. Tier 4 (Real-World Workloads): High-Volume Stress & Cache Invalidation
- **Test:** Batch import of 1,000 dossiers with random missing fields, triggering simultaneous recalculation of `getCachedDashboard`, `finance_summary`, and `finance_profitability` under simulated concurrent queries.

---

## 4. Key Decisions & Architectural Insights

1. **Strict Separation of Taxable vs. Non-Taxable Financials:** The engine strictly enforces that VAT 18% is calculated only on transit agency fees (`amountHt`), preventing fiscal compliance breaches in Guinea.
2. **In-Memory Fallback with Timeouts (`withDbTimeout`):** All database operations execute with strict 1,500ms timeouts and graceful in-memory dataset fallbacks, preventing serverless function execution freezes.
3. **Audit Trail Completeness:** Every financial mutation (`FACTURE_CREEE`, `FACTURE_MODIFIEE`, `PAIEMENT_ENCAISSE`, `DEBOURS_AVANCE`, `TAUX_CHANGE_MODIFIE`, `RAPPROCHEMENT_FACTURE`) records immutable structured before/after snapshots for regulatory compliance.
