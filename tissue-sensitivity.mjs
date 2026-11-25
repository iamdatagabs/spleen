// One-at-a-time sensitivity screening for the 3D tissue pO2 model.
// All perturbations are exploratory engineering scenarios, not clinical ranges.
import { DEFAULT_TISSUE_OXYGEN, solveTissueOxygen } from "./tissue-oxygen.mjs";

const PARAMETERS = Object.freeze([
  { key: "diffusion", label: "Difusão efetiva", unit: "mm²/s" },
  { key: "baselinePerfusionRate", label: "Escala perfusional basal", unit: "s⁻¹" },
  { key: "vmax", label: "Consumo máximo (Vmax)", unit: "mmHg/s" },
  { key: "km", label: "Constante de semissaturação (Km)", unit: "mmHg" },
  { key: "exchangeDistanceScaleMm", label: "Escala de distância de troca", unit: "mm" }
]);

function summarize(field) {
  const s = field.stats;
  return {
    meanPO2: s.meanPO2,
    minPO2: s.minPO2,
    maxPO2: s.maxPO2,
    spatialRangePO2: s.maxPO2 - s.minPO2
  };
}

export function runTissueOxygenSensitivity(territories, options = {}, { relativePerturbation = 0.25 } = {}) {
  if (!Number.isFinite(relativePerturbation) || relativePerturbation <= 0 || relativePerturbation >= 1) {
    throw new RangeError("relativePerturbation must be between 0 and 1");
  }
  const baseOptions = { ...DEFAULT_TISSUE_OXYGEN, ...options };
  const baseline = summarize(solveTissueOxygen(territories, baseOptions));
  const results = PARAMETERS.map(parameter => {
    const baseValue = baseOptions[parameter.key];
    const lowValue = baseValue * (1 - relativePerturbation);
    const highValue = baseValue * (1 + relativePerturbation);
    const low = summarize(solveTissueOxygen(territories, { ...baseOptions, [parameter.key]: lowValue }));
    const high = summarize(solveTissueOxygen(territories, { ...baseOptions, [parameter.key]: highValue }));
    const denominator = baseline.meanPO2 || Number.EPSILON;
    return {
      ...parameter,
      baseValue,
      lowValue,
      highValue,
      lowMeanPO2: low.meanPO2,
      highMeanPO2: high.meanPO2,
      lowMinPO2: low.minPO2,
      highMinPO2: high.minPO2,
      lowMaxPO2: low.maxPO2,
      highMaxPO2: high.maxPO2,
      meanResponsePct: 100 * (high.meanPO2 - low.meanPO2) / denominator,
      normalizedElasticity: ((high.meanPO2 - low.meanPO2) / denominator) / (2 * relativePerturbation)
    };
  });
  return {
    method: "one_at_a_time_centered_sweep",
    relativePerturbation,
    baseline,
    parameters: { ...baseOptions },
    results,
    warnings: [
      "OAT screening varies one parameter at a time and does not capture parameter interactions.",
      "Perturbation factors are computational stress tests, not physiological reference ranges.",
      "Sensitivity is conditional on the selected model structure, scenario and illustrative coefficients."
    ]
  };
}
