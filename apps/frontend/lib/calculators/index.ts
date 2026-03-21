export { calculCotisationsURSSAF } from "./cotisations";
export type { ResultatCotisations, DetailCotisation } from "./cotisations";

export { calculIR } from "./fiscalite";
export type { ResultatFiscalite, ParamsFiscalite, DetailTranche } from "./fiscalite";

export { calculIFI } from "./ifi";
export type { ResultatIFI, ParamsIFI } from "./ifi";

export { projectionRetraite, simulationCER } from "./retraite";
export type { ResultatRetraite, ResultatCER, ParamsRetraite, ParamsCER } from "./retraite";

export { calculGapPrevoyance } from "./prevoyance";
export type { ResultatPrevoyance, ParamsPrevoyance } from "./prevoyance";

export { simulationPER } from "./per";
export type { ResultatPER, ParamsPER } from "./per";

export { simulationRemuneration } from "./remuneration";
export type { ResultatRemuneration, ParamsRemuneration } from "./remuneration";

export {
  cessionPatientele,
  simulationDonation,
  simulationDutreil,
} from "./transmission";
export type {
  ResultatCessionPatientele,
  ResultatDonation,
  ResultatDutreil,
} from "./transmission";

export { projectionPatrimoniale } from "./projection";
export type { ResultatProjection, ParamsProjection } from "./projection";
