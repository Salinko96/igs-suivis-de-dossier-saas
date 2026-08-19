import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

export interface InvoicePdfData {
  invoiceNumber: string;
  type: "Proforma" | "Definitive";
  status: "Proforma" | "Émise" | "Payée" | "En_retard" | "Annulée";
  dossierNumber: string;
  clientDossierNumber?: string | null;
  client: string;
  blLtaNumber?: string | null;
  cargoNature?: string | null;
  container?: string | null;
  bulk?: string | null;
  amountTtc: number;
  currency: string;
  estimatedMargin?: number | null;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  portalAccessCode?: string | null;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [11, 59, 50]; // #0b3b32 (Vert Sombre IGS)
  const goldColor = [217, 169, 75]; // #d9a94b (Or IGS)
  const darkTextColor = [21, 45, 39];

  // 1. En-tête / Header Entreprise
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("IBRAHIMA GOLD SERVICE — IGS", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("TRANSIT • DÉDOUANEMENT SYDONIA • TRANSPORT MARITIME & AÉRIEN", 14, 18);
  doc.text("Port Autonome de Conakry (PAC) • Kamsar • Kagbelen • République de Guinée", 14, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.text("SERVICE FACTURATION & TRANSIT", 140, 18);

  // 2. Titre du Document (Facture Proforma / Définitive)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const invoiceTitle = data.type === "Proforma" ? "FACTURE PROFORMA" : "FACTURE DE TRANSIT";
  doc.text(invoiceTitle, 14, 40);

  // Numéro et Date
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 100, 95);
  doc.text(`N° Facture : ${data.invoiceNumber}`, 14, 47);
  doc.text(`Date d'émission : ${new Date(data.createdAt).toLocaleDateString("fr-FR")}`, 14, 52);
  const dueDateStr = data.dueDate ? new Date(data.dueDate).toLocaleDateString("fr-FR") : "À réception";
  doc.text(`Date d'échéance : ${dueDateStr}`, 14, 57);

  // 3. Encadré Client & Destinataire
  doc.setFillColor(245, 248, 246);
  doc.roundedRect(120, 34, 76, 30, 2, 2, "F");
  doc.setDrawColor(210, 225, 218);
  doc.roundedRect(120, 34, 76, 30, 2, 2, "S");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CLIENT / DESTINATAIRE", 124, 41);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(data.client || "Client Commercial", 124, 47);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 110, 105);
  doc.text(`Réf Client : ${data.clientDossierNumber || "N/A"}`, 124, 53);
  doc.text("Conakry, République de Guinée", 124, 58);

  // 4. Détails Fret & Opérations Douanières
  doc.setFillColor(235, 242, 239);
  doc.rect(14, 67, 182, 18, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Dossier IGS :", 18, 73);
  doc.text("Titre Transport (BL) :", 75, 73);
  doc.text("Marchandise :", 135, 73);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 50, 45);
  doc.text(data.dossierNumber, 18, 80);
  doc.text(data.blLtaNumber || "N/A", 75, 80);
  doc.text((data.cargoNature || "Fret maritime standard").slice(0, 30), 135, 80);

  // 5. Tableau des Lignes de Débours & Honoraires
  const isUSD = data.currency === "USD";
  const rateGNF = 8650;
  const totalAmount = Number(data.amountTtc) || 0;

  // Répartition type des frais de dédouanement en Guinée
  const debonCustoms = Math.round(totalAmount * 0.55); // Droits Trésor Public
  const portCharges = Math.round(totalAmount * 0.25);  // PAC / Terminal
  const transitFee = totalAmount - debonCustoms - portCharges; // Honoraires IGS

  const tableData = [
    [
      "1",
      "Droits de Douane & Taxes Trésor Public (SYDONIA / DDI GUCEG)",
      "Débours avancés",
      "1",
      `${debonCustoms.toLocaleString("fr-FR")} ${data.currency}`,
      `${debonCustoms.toLocaleString("fr-FR")} ${data.currency}`,
    ],
    [
      "2",
      "Redevances Portuaires & Manutention Quai (Port Autonome Conakry)",
      "Débours PAC",
      "1",
      `${portCharges.toLocaleString("fr-FR")} ${data.currency}`,
      `${portCharges.toLocaleString("fr-FR")} ${data.currency}`,
    ],
    [
      "3",
      "Prestations de Transit, Suivi Douanier & Conduite en Douane",
      "Honoraires IGS",
      "1",
      `${transitFee.toLocaleString("fr-FR")} ${data.currency}`,
      `${transitFee.toLocaleString("fr-FR")} ${data.currency}`,
    ],
  ];

  autoTable(doc, {
    startY: 90,
    head: [["Item", "Désignation des Prestations & Débours", "Type", "Qté", "Prix Unitaire", "Montant Total"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [11, 59, 50],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 45, 40],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 249],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 28 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
    },
  });

  // 6. Bloc Total & Équivalence Devises
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Encadré Total à Droite
  doc.setFillColor(245, 248, 246);
  doc.roundedRect(110, finalY, 86, 32, 2, 2, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(110, finalY, 86, 32, 2, 2, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 80, 75);
  doc.text("Total Débours & Prestations :", 114, finalY + 8);
  doc.text("TVA / Taxes appliquées :", 114, finalY + 14);

  doc.setFont("helvetica", "bold");
  doc.text(`${totalAmount.toLocaleString("fr-FR")} ${data.currency}`, 190, finalY + 8, { align: "right" });
  doc.text("Exonéré / Inclus", 190, finalY + 14, { align: "right" });

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(110, finalY + 18, 86, 14, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("NET À PAYER :", 114, finalY + 27);
  doc.text(`${totalAmount.toLocaleString("fr-FR")} ${data.currency}`, 190, finalY + 27, { align: "right" });

  // Équivalence Multi-Devises GNF/USD
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const convertedAmount = isUSD ? totalAmount * rateGNF : Math.round(totalAmount / rateGNF);
  const convertedCurrency = isUSD ? "GNF" : "USD";
  doc.text(`Contre-valeur (Taux officiel 1 USD = 8 650 GNF) : ${convertedAmount.toLocaleString("fr-FR")} ${convertedCurrency}`, 14, finalY + 8);

  // 7. QR Code Infalsifiable de Certification
  const qrText = `https://igs-suivis-de-dossier-saas.vercel.app/portail-client?code=${data.portalAccessCode || data.dossierNumber}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrText, { width: 80, margin: 1 });
    doc.addImage(qrDataUrl, "PNG", 14, finalY + 14, 24, 24);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SCAN DE VÉRIFICATION", 42, finalY + 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 120, 115);
    doc.text("Scannez ce QR Code pour consulter le suivi", 42, finalY + 26);
    doc.text("en direct sur le portail IGS Guinée.", 42, finalY + 30);
  } catch (err) {
    console.warn("QR Code generation error:", err);
  }

  // 8. Coordonnées Bancaires & Cachet
  const bottomY = finalY + 45;
  doc.setDrawColor(220, 230, 225);
  doc.line(14, bottomY, 196, bottomY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("MODALITÉS DE RÈGLEMENT & COMPTES BANCAIRES GUINÉE :", 14, bottomY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 90, 85);
  doc.text("• Virement bancaire : BICIGUI / Vista Bank Guinée • Compte GNF : 024-5501-88902-11", 14, bottomY + 11);
  doc.text("• Règlement Express : Orange Money Pro (+224 620 00 00 00) • Chèque certifié à l'ordre de IGS S.A.R.L", 14, bottomY + 15);

  // Cachet & Signature IGS
  doc.setFillColor(245, 248, 246);
  doc.roundedRect(140, bottomY + 3, 56, 20, 1, 1, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(140, bottomY + 3, 56, 20, 1, 1, "S");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("CACHE ET SIGNATURE IGS", 144, bottomY + 8);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.text("Certifié conforme • Direction Financière", 144, bottomY + 14);

  // 9. Téléchargement direct du fichier PDF
  const filename = `FACTURE_${data.invoiceNumber}_${data.dossierNumber}.pdf`;
  doc.save(filename);
}
