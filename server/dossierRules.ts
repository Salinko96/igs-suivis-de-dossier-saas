export type DossierStateInput = {
  clientDossierNumber?: string | null;
  client?: string | null;
  blLtaNumber?: string | null;
  cargoNature?: string | null;
  transportMode?: string | null;
  eta?: Date | string | null;
  originPort?: string | null;
  destinationPort?: string | null;
  container?: string | null;
  bulk?: string | null;
  goodsReleaseDate?: Date | string | null;
  declarationNumber?: string | null;
  bulletinNumber?: string | null;
};

export const REQUIRED_DOSSIER_FIELDS = [
  "clientDossierNumber",
  "client",
  "blLtaNumber",
  "cargoNature",
  "transportMode",
  "eta",
  "originPort",
  "destinationPort",
  "goodsReleaseDate",
  "declarationNumber",
  "bulletinNumber",
] as const;

const hasValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

export function calculateDossierState(input: DossierStateInput & { isDraft?: boolean; calculatedStatus?: string }) {
  if (input.isDraft || input.calculatedStatus === "Brouillon") {
    return {
      calculatedStatus: "Brouillon" as const,
      calculatedPriority: "Normale" as const,
      completionRate: 20,
      missingFields: [],
    };
  }

  const missingFields = REQUIRED_DOSSIER_FIELDS.filter(field => !hasValue(input[field]));
  const hasPackaging = hasValue(input.container) || hasValue(input.bulk);

  if (!hasPackaging) missingFields.push("container" as (typeof REQUIRED_DOSSIER_FIELDS)[number]);

  const calculatedStatus = missingFields.length === 0 ? "Régularisé" : "À régulariser";
  return {
    calculatedStatus,
    calculatedPriority: calculatedStatus === "Régularisé" ? "Basse" : "Haute",
    completionRate: Math.round(((REQUIRED_DOSSIER_FIELDS.length + 1 - missingFields.length) / (REQUIRED_DOSSIER_FIELDS.length + 1)) * 100),
    missingFields,
  } as const;
}

export function formatDossierNumber(sequence: number) {
  return `DOS-${String(sequence).padStart(4, "0")}`;
}

export interface StatusValidationResult {
  valid: boolean;
  error?: string;
  missingFields?: string[];
}

export function validateStatusTransition(
  currentDossier: DossierStateInput & { calculatedStatus?: string },
  targetStatus: string,
  updateData?: Partial<DossierStateInput>
): StatusValidationResult {
  if (targetStatus === "Régularisé") {
    const effectiveGoodsReleaseDate = updateData?.goodsReleaseDate !== undefined ? updateData.goodsReleaseDate : currentDossier.goodsReleaseDate;
    const effectiveDeclarationNumber = updateData?.declarationNumber !== undefined ? updateData.declarationNumber : currentDossier.declarationNumber;

    const missing: string[] = [];
    if (!hasValue(effectiveGoodsReleaseDate)) {
      missing.push("Date de sortie marchandise (goodsReleaseDate)");
    }
    if (!hasValue(effectiveDeclarationNumber)) {
      missing.push("Numéro de déclaration douanière (declarationNumber)");
    }

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Transition refusée vers « Régularisé » : les champs obligatoires suivants doivent être renseignés : ${missing.join(", ")}.`,
        missingFields: missing,
      };
    }
  }

  return { valid: true };
}

export interface DemurrageRiskInfo {
  daysOnQuay: number;
  freeDays: number;
  isRisk: boolean;
  isOverdue: boolean;
  isWarningJ2: boolean;
  daysRemaining: number;
  daysOverFreeTime: number;
  statusLabel: "Sorti" | "Sous Franchise" | "Risque Surestarie (J-2)" | "Surestarie Dépassée";
  urgencyLevel: "normal" | "warning" | "critical" | "resolved";
}

export function calculateDemurrageRisk(
  eta?: Date | string | null,
  goodsReleaseDate?: Date | string | null,
  freeDays = 7,
  referenceDate = new Date()
): DemurrageRiskInfo {
  if (goodsReleaseDate) {
    return {
      daysOnQuay: 0,
      freeDays,
      isRisk: false,
      isOverdue: false,
      isWarningJ2: false,
      daysRemaining: 0,
      daysOverFreeTime: 0,
      statusLabel: "Sorti",
      urgencyLevel: "resolved",
    };
  }

  if (!eta) {
    return {
      daysOnQuay: 0,
      freeDays,
      isRisk: false,
      isOverdue: false,
      isWarningJ2: false,
      daysRemaining: freeDays,
      daysOverFreeTime: 0,
      statusLabel: "Sous Franchise",
      urgencyLevel: "normal",
    };
  }

  const etaDate = eta instanceof Date ? eta : new Date(eta);
  const diffMs = referenceDate.getTime() - etaDate.getTime();
  const daysOnQuay = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, freeDays - daysOnQuay);
  const daysOverFreeTime = Math.max(0, daysOnQuay - freeDays);

  if (daysOnQuay >= freeDays) {
    return {
      daysOnQuay,
      freeDays,
      isRisk: true,
      isOverdue: true,
      isWarningJ2: false,
      daysRemaining: 0,
      daysOverFreeTime,
      statusLabel: "Surestarie Dépassée",
      urgencyLevel: "critical",
    };
  }

  if (daysOnQuay >= freeDays - 2) {
    return {
      daysOnQuay,
      freeDays,
      isRisk: true,
      isOverdue: false,
      isWarningJ2: true,
      daysRemaining,
      daysOverFreeTime: 0,
      statusLabel: "Risque Surestarie (J-2)",
      urgencyLevel: "warning",
    };
  }

  return {
    daysOnQuay,
    freeDays,
    isRisk: false,
    isOverdue: false,
    isWarningJ2: false,
    daysRemaining,
    daysOverFreeTime: 0,
    statusLabel: "Sous Franchise",
    urgencyLevel: "normal",
  };
}
