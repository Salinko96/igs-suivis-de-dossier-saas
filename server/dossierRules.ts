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

export function calculateDossierState(input: DossierStateInput) {
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
