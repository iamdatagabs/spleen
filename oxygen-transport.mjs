// Reduced-order regional oxygen delivery calculations. Units are explicit:
// flow: L/min; arterial oxygen content: mL O2/dL; delivery: mL O2/min.
export function calculateTerritoryOxygen(territories, {
  arterialOxygenContent = 18.5,
  referenceFlow = 0.052,
  referenceContent = 18.5
} = {}) {
  if (!Array.isArray(territories) || territories.length !== 3) {
    throw new TypeError("exactly three splenic territories are required");
  }
  if (![arterialOxygenContent, referenceFlow, referenceContent].every(Number.isFinite) ||
      arterialOxygenContent <= 0 || referenceFlow <= 0 || referenceContent <= 0) {
    throw new RangeError("oxygen content and reference values must be finite and positive");
  }
  return territories.map((territory, index) => {
    const flow = Number(territory.arterialInflow);
    if (!Number.isFinite(flow) || flow < 0) {
      throw new RangeError(`territory ${index} arterialInflow must be finite and non-negative`);
    }
    const delivery = flow * 10 * arterialOxygenContent;
    const referenceDelivery = referenceFlow * 10 * referenceContent;
    const relativeDelivery = delivery / referenceDelivery;
    return {
      ...territory,
      oxygenDelivery: delivery,
      relativeOxygenDelivery: relativeDelivery,
      oxygenDeliveryLevel: relativeDelivery >= 0.9 ? "preserved" :
        relativeDelivery >= 0.7 ? "reduced" : "markedly-reduced"
    };
  });
}

// Gaussian interpolation of normalized regional delivery over a parametric 3D field.
// Coordinates and sigma are dimensionless display-space values, not anatomical units.
export function sampleOxygenField(point, territories, centers, { sigma = 0.42 } = {}) {
  if (!point || !["x", "y", "z"].every(k => Number.isFinite(point[k]))) {
    throw new TypeError("point must contain finite x, y and z coordinates");
  }
  if (!Array.isArray(territories) || territories.length !== 3 ||
      !Array.isArray(centers) || centers.length !== 3 ||
      !Number.isFinite(sigma) || sigma <= 0) {
    throw new RangeError("three territories, three centers and positive sigma are required");
  }
  let weighted = 0, weights = 0;
  territories.forEach((territory, i) => {
    const center = centers[i];
    if (!center || !["x", "y", "z"].every(k => Number.isFinite(center[k]))) {
      throw new TypeError("each center must contain finite x, y and z coordinates");
    }
    const distance2 = ["x", "y", "z"].reduce((sum, key) =>
      sum + (point[key] - center[key]) ** 2, 0);
    const weight = Math.exp(-distance2 / (2 * sigma * sigma));
    weighted += weight * Number(territory.relativeOxygenDelivery);
    weights += weight;
  });
  if (!Number.isFinite(weighted) || !Number.isFinite(weights) || weights <= 0) {
    throw new RangeError("oxygen field contains invalid regional values");
  }
  return weighted / weights;
}
