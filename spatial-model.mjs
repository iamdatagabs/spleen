export function distributeTerritoryFlow(totalFlow, relativeResistances) {
  if (!Number.isFinite(totalFlow) || totalFlow < 0) {
    throw new RangeError("totalFlow must be a finite non-negative number");
  }
  if (!Array.isArray(relativeResistances) || relativeResistances.length !== 3) {
    throw new TypeError("exactly three territory resistances are required");
  }
  const resistances = relativeResistances.map(value => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError("relative resistances must be finite and positive");
    }
    return value;
  });
  const conductances = resistances.map(value => 1 / value);
  const totalConductance = conductances.reduce((sum, value) => sum + value, 0);
  const flows = conductances.map(value => totalFlow * value / totalConductance);
  flows[2] = totalFlow - flows[0] - flows[1];
  return flows;
}
