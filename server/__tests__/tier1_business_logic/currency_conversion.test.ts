import { describe, expect, it } from "vitest";

/**
 * Fonctions de logique métier pure pour la conversion de devises,
 * le calcul de TVA guinéenne (18%), la séparation des débours douaniers
 * et l'estimation de la marge brute de transit IGS.
 */
export const DEFAULT_USD_GNF_RATE = 8650; // 1 USD = 8 650 GNF
export const GUINEA_VAT_RATE = 0.18; // TVA 18 %

export interface InvoiceFinancialsInput {
  amountHt: number;
  disbursementsAmount?: number;
  storageAndDemurrageFees?: number;
  directCosts?: number;
  currency?: "GNF" | "USD";
  exchangeRate?: number;
}

export interface InvoiceFinancialsOutput {
  amountHt: number;
  amountTva: number;
  amountTtc: number;
  disbursementsAmount: number;
  storageAndDemurrageFees: number;
  totalPayable: number;
  estimatedMargin: number;
  marginRate: number;
}

export function calculateInvoiceFinancials(input: InvoiceFinancialsInput): InvoiceFinancialsOutput {
  if (input.amountHt < 0) throw new Error("Le montant HT ne peut pas être négatif");
  const disbursements = Math.max(0, input.disbursementsAmount ?? 0);
  const storage = Math.max(0, input.storageAndDemurrageFees ?? 0);
  const amountTva = Math.round(input.amountHt * GUINEA_VAT_RATE);
  const amountTtc = input.amountHt + amountTva;
  const totalPayable = amountTtc + disbursements + storage;

  // Si des coûts directs sont fournis, marge = HT - coûts directs; sinon estimation forfaitaire à 25% du HT
  const estimatedMargin = input.directCosts !== undefined
    ? input.amountHt - input.directCosts
    : Math.round(input.amountHt * 0.25);

  const marginRate = input.amountHt > 0 ? Math.round((estimatedMargin / input.amountHt) * 1000) / 10 : 0;

  return {
    amountHt: input.amountHt,
    amountTva,
    amountTtc,
    disbursementsAmount: disbursements,
    storageAndDemurrageFees: storage,
    totalPayable,
    estimatedMargin,
    marginRate,
  };
}

export function convertCurrency(
  amount: number,
  from: "GNF" | "USD",
  to: "GNF" | "USD",
  rate = DEFAULT_USD_GNF_RATE
): number {
  if (amount < 0) throw new Error("Le montant à convertir ne peut pas être négatif");
  if (rate <= 0) throw new Error("Le taux de change doit être strictement positif");
  if (from === to) return amount;
  if (from === "USD" && to === "GNF") {
    return Math.round(amount * rate);
  }
  // GNF to USD
  return Math.round((amount / rate) * 100) / 100;
}

export function formatCurrencyDisplay(
  amount: number,
  currency: "GNF" | "USD",
  rate = DEFAULT_USD_GNF_RATE
): string {
  if (currency === "USD") {
    const inUsd = amount;
    return `$ ${inUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(amount).toLocaleString("fr-FR")} GNF`;
}

describe("Tier 1 - Pure Business Logic: Currency Conversion & Financial Engine (R3)", () => {
  describe("1. Conversions GNF ↔ USD au taux de référence", () => {
    it("convertit correctement les USD en GNF au taux standard de 8 650", () => {
      const usdAmount = 1000;
      const gnfAmount = convertCurrency(usdAmount, "USD", "GNF", DEFAULT_USD_GNF_RATE);
      expect(gnfAmount).toBe(8_650_000);
    });

    it("convertit correctement les GNF en USD avec 2 décimales", () => {
      const gnfAmount = 8_650_000;
      const usdAmount = convertCurrency(gnfAmount, "GNF", "USD", DEFAULT_USD_GNF_RATE);
      expect(usdAmount).toBe(1000.0);
    });

    it("gère un taux de change personnalisé (ex: 8 750 GNF/USD)", () => {
      const customRate = 8750;
      const usd = 2500;
      const gnf = convertCurrency(usd, "USD", "GNF", customRate);
      expect(gnf).toBe(21_875_000);

      const convertedBack = convertCurrency(gnf, "GNF", "USD", customRate);
      expect(convertedBack).toBe(2500.0);
    });

    it("renvoie le montant d'origine sans modification si from === to", () => {
      expect(convertCurrency(500000, "GNF", "GNF")).toBe(500000);
      expect(convertCurrency(1200, "USD", "USD")).toBe(1200);
    });

    it("rejette les montants négatifs ou les taux nuls/négatifs", () => {
      expect(() => convertCurrency(-500, "USD", "GNF")).toThrow("Le montant à convertir ne peut pas être négatif");
      expect(() => convertCurrency(100, "USD", "GNF", 0)).toThrow("Le taux de change doit être strictement positif");
      expect(() => convertCurrency(100, "USD", "GNF", -8650)).toThrow("Le taux de change doit être strictement positif");
    });
  });

  describe("2. Calcul TVA Guinéenne (18%) et Séparation des Débours", () => {
    it("calcule la TVA à 18% sur le montant des prestations HT", () => {
      const input: InvoiceFinancialsInput = {
        amountHt: 25_000_000, // 25 millions GNF
      };
      const result = calculateInvoiceFinancials(input);
      expect(result.amountTva).toBe(4_500_000); // 25M * 18%
      expect(result.amountTtc).toBe(29_500_000); // 25M + 4.5M
    });

    it("exclut strictement les débours douaniers et PAC de la base TVA", () => {
      const input: InvoiceFinancialsInput = {
        amountHt: 20_000_000, // Prestation transit
        disbursementsAmount: 60_000_000, // Droits de douane + PAC avancés
      };
      const result = calculateInvoiceFinancials(input);

      // TVA doit être calculée UNIQUEMENT sur 20M GNF (pas sur 80M)
      expect(result.amountTva).toBe(3_600_000);
      expect(result.amountTtc).toBe(23_600_000);
      // Le total à payer inclut les débours non taxés
      expect(result.totalPayable).toBe(83_600_000); // 23.6M TTC + 60M Débours
    });

    it("intègre les frais de magasinage et surestaries dans le total à payer", () => {
      const input: InvoiceFinancialsInput = {
        amountHt: 10_000_000,
        disbursementsAmount: 30_000_000,
        storageAndDemurrageFees: 5_000_000,
      };
      const result = calculateInvoiceFinancials(input);
      expect(result.amountTva).toBe(1_800_000);
      expect(result.amountTtc).toBe(11_800_000);
      expect(result.totalPayable).toBe(46_800_000); // 11.8M + 30M + 5M
    });
  });

  describe("3. Calcul de la Marge Brute Estimée", () => {
    it("calcule la marge forfaitaire par défaut à 25% du HT", () => {
      const input: InvoiceFinancialsInput = {
        amountHt: 40_000_000,
      };
      const result = calculateInvoiceFinancials(input);
      expect(result.estimatedMargin).toBe(10_000_000); // 25% de 40M
      expect(result.marginRate).toBe(25.0);
    });

    it("calcule la marge réelle lorsque les coûts directs de transit sont renseignés", () => {
      const input: InvoiceFinancialsInput = {
        amountHt: 50_000_000,
        directCosts: 32_000_000, // Coûts réels de manutention/acconage
      };
      const result = calculateInvoiceFinancials(input);
      expect(result.estimatedMargin).toBe(18_000_000); // 50M - 32M
      expect(result.marginRate).toBe(36.0); // (18 / 50) * 100
    });
  });

  describe("4. Formatage et Affichage des Devises", () => {
    it("formate les montants en GNF avec séparateurs de milliers", () => {
      const formatted = formatCurrencyDisplay(25000000, "GNF");
      // Format fr-FR standard (espace ou espace insécable)
      expect(formatted).toMatch(/25[\s\u202f]000[\s\u202f]000 GNF/);
    });

    it("formate les montants en USD avec préfixe $ et 2 décimales", () => {
      const formatted = formatCurrencyDisplay(2890.17, "USD");
      expect(formatted).toBe("$ 2,890.17");
    });
  });

  describe("5. Cas Limites & Robustesse (Adversarial)", () => {
    it("gère un dossier à montant HT nul sans division par zéro", () => {
      const result = calculateInvoiceFinancials({ amountHt: 0, disbursementsAmount: 10_000_000 });
      expect(result.amountHt).toBe(0);
      expect(result.amountTva).toBe(0);
      expect(result.amountTtc).toBe(0);
      expect(result.totalPayable).toBe(10_000_000);
      expect(result.estimatedMargin).toBe(0);
      expect(result.marginRate).toBe(0);
    });

    it("gère de très grands volumes financiers miniers (ex: 15 milliards GNF)", () => {
      const highVolumeGnf = 15_000_000_000;
      const result = calculateInvoiceFinancials({
        amountHt: highVolumeGnf,
        disbursementsAmount: 45_000_000_000,
      });
      expect(result.amountTva).toBe(2_700_000_000);
      expect(result.amountTtc).toBe(17_700_000_000);
      expect(result.totalPayable).toBe(62_700_000_000);
    });
  });
});
