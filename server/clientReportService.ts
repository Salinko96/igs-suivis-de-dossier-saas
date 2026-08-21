import { listDossiers, listInvoices, listPacDisbursements, getExchangeRate } from "./db";
import type { Dossier, Invoice, PacDisbursement } from "../drizzle/schema";

export interface ClientReportSummary {
  clientName: string;
  accountCategory: "mining_major" | "industrial" | "standard";
  periodStart?: Date | string;
  periodEnd?: Date | string;
  generatedAt: Date;
  
  // Statistiques Volumes & Opérations
  totalDossiers: number;
  regularizedDossiersCount: number;
  pendingDossiersCount: number;
  regularizationRatePct: number;
  demurrageRiskCount: number;
  averageClearanceDays: number; // Délai moyen de dédouanement (Lead Time)
  
  // Statistiques Financières
  totalInvoicedGNF: number;
  totalInvoicedUSD: number;
  totalDisbursementsGNF: number;
  totalMarginGNF: number;
  marginRatePct: number;
  exchangeRate: number;

  // Détail des dossiers de la période
  dossiers: Array<{
    dossierNumber: string;
    blLtaNumber: string | null;
    cargoNature: string | null;
    container: string | null;
    transportMode: string | null;
    eta: Date | null;
    goodsReleaseDate: Date | null;
    calculatedStatus: string;
    declarationNumber: string | null;
    clearanceDays: number | null;
    invoicedAmountGNF: number;
  }>;
}

export async function generateClientConsolidatedReport(
  clientName: string,
  options?: {
    periodStart?: Date | string;
    periodEnd?: Date | string;
  }
): Promise<ClientReportSummary> {
  const [allDossiers, allInvoices, allDebours, { rate }] = await Promise.all([
    listDossiers({ client: clientName }),
    listInvoices(),
    listPacDisbursements(),
    getExchangeRate(),
  ]);

  let clientDossiers = allDossiers.filter(d => 
    d.client?.toLowerCase().trim() === clientName.toLowerCase().trim() ||
    d.client?.toLowerCase().includes(clientName.toLowerCase())
  );

  const pStart = options?.periodStart ? new Date(options.periodStart) : null;
  const pEnd = options?.periodEnd ? new Date(options.periodEnd) : null;

  if (pStart) {
    clientDossiers = clientDossiers.filter(d => new Date(d.createdAt) >= pStart);
  }
  if (pEnd) {
    clientDossiers = clientDossiers.filter(d => new Date(d.createdAt) <= pEnd);
  }

  const clientInvoices = allInvoices.filter(i => 
    clientDossiers.some(d => d.id === i.dossierId) ||
    i.client?.toLowerCase().includes(clientName.toLowerCase())
  );

  // Détermination de la catégorie de compte
  let accountCategory: ClientReportSummary["accountCategory"] = "standard";
  const upper = clientName.toUpperCase();
  if (upper.includes("GOLD") || upper.includes("MINING") || upper.includes("BIRIMIAN") || upper.includes("CAPDRILL") || upper.includes("BAUXITE")) {
    accountCategory = "mining_major";
  } else if (upper.includes("SHIPBUILDING") || upper.includes("LOGISTICS") || upper.includes("INDUSTRIE")) {
    accountCategory = "industrial";
  }

  // Calcul des métriques opérationnelles
  const totalDossiers = clientDossiers.length;
  const regularizedDossiers = clientDossiers.filter(d => d.calculatedStatus === "Régularisé");
  const regularizedDossiersCount = regularizedDossiers.length;
  const pendingDossiersCount = totalDossiers - regularizedDossiersCount;
  const regularizationRatePct = totalDossiers > 0 ? Math.round((regularizedDossiersCount / totalDossiers) * 100) : 0;

  // Calcul du Lead Time moyen (ETA ➔ Release Date)
  let totalClearanceDays = 0;
  let clearedCount = 0;

  const enrichedDossiers = clientDossiers.map(d => {
    let clearanceDays: number | null = null;
    if (d.eta && d.goodsReleaseDate) {
      const etaTime = new Date(d.eta).getTime();
      const releaseTime = new Date(d.goodsReleaseDate).getTime();
      clearanceDays = Math.max(0, Math.round((releaseTime - etaTime) / 86400000));
      totalClearanceDays += clearanceDays;
      clearedCount += 1;
    }

    const relatedInvoices = clientInvoices.filter(i => i.dossierId === d.id);
    const invoicedAmountGNF = relatedInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);

    return {
      dossierNumber: d.dossierNumber,
      blLtaNumber: d.blLtaNumber,
      cargoNature: d.cargoNature,
      container: d.container,
      transportMode: d.transportMode,
      eta: d.eta,
      goodsReleaseDate: d.goodsReleaseDate,
      calculatedStatus: d.calculatedStatus,
      declarationNumber: d.declarationNumber,
      clearanceDays,
      invoicedAmountGNF,
    };
  });

  const averageClearanceDays = clearedCount > 0 ? Math.round((totalClearanceDays / clearedCount) * 10) / 10 : 3.5;

  // Surestaries
  const now = new Date();
  const demurrageRiskCount = clientDossiers.filter(d => 
    d.eta && !d.goodsReleaseDate && (now.getTime() - new Date(d.eta).getTime()) > 86400000 * 7
  ).length;

  // Calculs financiers
  const totalInvoicedGNF = clientInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? i.amountTtc * rate : i.amountTtc), 0);
  const totalInvoicedUSD = Math.round((totalInvoicedGNF / rate) * 100) / 100;
  const totalDisbursementsGNF = clientInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.disbursementsAmount || 0) * rate : (i.disbursementsAmount || 0)), 0);
  const totalMarginGNF = clientInvoices.reduce((sum, i) => sum + (i.currency === "USD" ? (i.estimatedMargin || 0) * rate : (i.estimatedMargin || 0)), 0);
  const marginRatePct = totalInvoicedGNF > 0 ? Math.round(((totalInvoicedGNF - totalDisbursementsGNF) / totalInvoicedGNF) * 1000) / 10 : 0;

  return {
    clientName,
    accountCategory,
    periodStart: options?.periodStart,
    periodEnd: options?.periodEnd,
    generatedAt: new Date(),
    totalDossiers,
    regularizedDossiersCount,
    pendingDossiersCount,
    regularizationRatePct,
    demurrageRiskCount,
    averageClearanceDays,
    totalInvoicedGNF,
    totalInvoicedUSD,
    totalDisbursementsGNF,
    totalMarginGNF,
    marginRatePct,
    exchangeRate: rate,
    dossiers: enrichedDossiers,
  };
}

/**
 * Generate official corporate HTML layout for client PDF report print
 */
export function generateClientReportHtml(report: ClientReportSummary): string {
  const isMining = report.accountCategory === "mining_major";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rapport Consolidé Transit & Douane - ${report.clientName}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #102c26; margin: 0; padding: 15px; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0b3b32; padding-bottom: 15px; }
        .logo-title { font-size: 20px; font-weight: 800; color: #0b3b32; letter-spacing: 0.5px; }
        .subtitle { font-size: 10px; color: #52736b; margin-top: 2px; }
        .badge-mining { background: #0b3b32; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 10px; display: inline-block; }
        .client-banner { margin-top: 18px; padding: 14px 18px; background: #f4f8f6; border-radius: 10px; border-left: 4px solid #d9a94b; display: flex; justify-content: space-between; align-items: center; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
        .kpi-card { background: #ffffff; border: 1px solid #e1ebe7; border-radius: 8px; padding: 10px; text-align: center; }
        .kpi-title { font-size: 9px; text-transform: uppercase; color: #627670; font-weight: bold; }
        .kpi-val { font-size: 16px; font-weight: 800; color: #0b3b32; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
        th { background: #0b3b32; color: #ffffff; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #e1ebe7; }
        .text-right { text-align: right; }
        .status-reg { color: #065f46; font-weight: bold; background: #d1fae5; padding: 2px 6px; border-radius: 4px; }
        .status-att { color: #92400e; font-weight: bold; background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
        .footer { margin-top: 30px; font-size: 9px; text-align: center; color: #789088; border-top: 1px solid #e1ebe7; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-title">IBRAHIMA GOLD SERVICE (IGS) S.A.R.L</div>
          <div class="subtitle">Direction des Opérations Maritimes & Relations Grands Comptes Miniers</div>
          <div class="subtitle">Conakry Terminal • Port Autonome de Conakry (PAC) • République de Guinée</div>
        </div>
        <div class="text-right">
          <div class="badge-mining">${isMining ? "★ COMPTE STRATÉGIQUE MINIER" : "RAPPORT D'ACTIVITÉ"}</div>
          <div style="font-weight: bold; margin-top: 4px; font-size: 11px;">Édition du ${report.generatedAt.toLocaleDateString("fr-FR")}</div>
          <div style="font-size: 9px; color: #666;">Taux de référence : 1 USD = ${report.exchangeRate.toLocaleString("fr-FR")} GNF</div>
        </div>
      </div>

      <div class="client-banner">
        <div>
          <div style="font-size: 9px; font-weight: bold; color: #627670; text-transform: uppercase;">SOCIÉTÉ CLIENTE :</div>
          <div style="font-size: 16px; font-weight: bold; color: #0b3b32;">${report.clientName}</div>
        </div>
        <div class="text-right">
          <div style="font-size: 9px; color: #627670;">Taux de Régularisation :</div>
          <div style="font-size: 14px; font-weight: bold; color: #0b3b32;">${report.regularizationRatePct}% (${report.regularizedDossiersCount}/${report.totalDossiers})</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Total Dossiers Traités</div>
          <div class="kpi-val">${report.totalDossiers}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Délai Moyen Quai (Lead Time)</div>
          <div class="kpi-val">${report.averageClearanceDays} j</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Facturé (GNF)</div>
          <div class="kpi-val">${Math.round(report.totalInvoicedGNF).toLocaleString("fr-FR")} GNF</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Équivalent Facturé USD</div>
          <div class="kpi-val">$ ${report.totalInvoicedUSD.toLocaleString("en-US")}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>N° Dossier</th>
            <th>BL / LTA</th>
            <th>Marchandise & T/C</th>
            <th>Mode</th>
            <th>ETA Navire</th>
            <th>BAE / Sortie</th>
            <th>Délai Quai</th>
            <th>Statut</th>
            <th class="text-right">Montant Facturé</th>
          </tr>
        </thead>
        <tbody>
          ${report.dossiers.map(d => `
            <tr>
              <td><strong>${d.dossierNumber}</strong></td>
              <td style="font-family: monospace;">${d.blLtaNumber || "—"}</td>
              <td>${d.cargoNature || "Cargaison"} ${d.container ? `(${d.container})` : ""}</td>
              <td>${d.transportMode || "Maritime"}</td>
              <td>${d.eta ? new Date(d.eta).toLocaleDateString("fr-FR") : "—"}</td>
              <td>${d.goodsReleaseDate ? new Date(d.goodsReleaseDate).toLocaleDateString("fr-FR") : "—"}</td>
              <td><strong>${d.clearanceDays !== null ? `${d.clearanceDays} j` : "En cours"}</strong></td>
              <td>
                <span class="${d.calculatedStatus === 'Régularisé' ? 'status-reg' : 'status-att'}">
                  ${d.calculatedStatus}
                </span>
              </td>
              <td class="text-right font-bold">${d.invoicedAmountGNF.toLocaleString("fr-FR")} GNF</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="footer">
        Rapport consolidé certifié par le système sécurisé IGS Dossiers. Pour toute demande d'assistance : opérations@igs-logistics.gn / +224 620 00 00 00.
      </div>
    </body>
    </html>
  `;
}
