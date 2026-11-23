export function distributeTerritoryFlow(totalFlow, relativeResistances) {
  if (!Number.isFinite(totalFlow) || totalFlow < 0) throw new RangeError("totalFlow must be finite and non-negative");
  if (!Array.isArray(relativeResistances) || relativeResistances.length !== 3) throw new TypeError("exactly three territory resistances are required");
  const resistances = relativeResistances.map(value => {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError("relative resistances must be finite and positive");
    return value;
  });
  const conductances = resistances.map(value => 1 / value);
  const totalConductance = conductances.reduce((sum, value) => sum + value, 0);
  const flows = conductances.map(value => totalFlow * value / totalConductance);
  flows[2] = totalFlow - flows[0] - flows[1];
  return flows;
}

// Display-only mapping from reduced-order territory states to 3D visual parameters.
export function territoryVisualMetrics({ arterialInflow, venousOutflow, pressure }, { referenceFlow = 0.052, referencePressure = 10 } = {}) {
  const values = [arterialInflow, venousOutflow, pressure, referenceFlow, referencePressure];
  if (!values.every(Number.isFinite) || arterialInflow < 0 || venousOutflow < 0 || referenceFlow <= 0 || referencePressure <= 0) {
    throw new RangeError("territory state and visual references must be finite and bounded");
  }
  const arterialRatio = arterialInflow / referenceFlow;
  const venousRatio = venousOutflow / referenceFlow;
  const pressureRatio = pressure / referencePressure;
  return {
    arterialRadius: 0.012 + 0.026 * Math.sqrt(arterialRatio),
    venousRadius: 0.012 + 0.026 * Math.sqrt(venousRatio),
    arterialParticleSpeed: Math.max(0.035, Math.min(0.24, 0.10 * Math.sqrt(arterialRatio))),
    venousParticleSpeed: Math.max(0.035, Math.min(0.24, 0.10 * Math.sqrt(venousRatio))),
    pressureRatio,
    pressureLevel: pressureRatio >= 1.5 ? "high" : pressureRatio > 1.05 ? "raised" : pressureRatio < 0.8 ? "low" : "reference"
  };
}
