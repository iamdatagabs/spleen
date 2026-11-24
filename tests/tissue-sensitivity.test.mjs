import test from "node:test";
import assert from "node:assert/strict";
import { runTissueOxygenSensitivity } from "../tissue-sensitivity.mjs";

const territories = [
  { arterialInflow: .052, capillaryDensity: 1 },
  { arterialInflow: .052, capillaryDensity: 1 },
  { arterialInflow: .052, capillaryDensity: 1 }
];

test("OAT tissue oxygen sensitivity returns baseline and five parameter sweeps", () => {
  const result = runTissueOxygenSensitivity(territories, { durationSeconds: 60, dt: 1 });
  assert.equal(result.method, "one_at_a_time_centered_sweep");
  assert.equal(result.results.length, 5);
  assert.ok(result.baseline.meanPO2 > 0);
  for (const row of result.results) {
    assert.ok(Number.isFinite(row.meanResponsePct));
    assert.ok(Number.isFinite(row.normalizedElasticity));
    assert.ok(row.highValue > row.lowValue);
  }
});

test("OAT sensitivity is deterministic for a fixed scenario", () => {
  const a = runTissueOxygenSensitivity(territories, { durationSeconds: 45, dt: 1 });
  const b = runTissueOxygenSensitivity(territories, { durationSeconds: 45, dt: 1 });
  assert.deepEqual(a, b);
});

test("OAT sensitivity rejects invalid perturbation factors", () => {
  assert.throws(() => runTissueOxygenSensitivity(territories, {}, { relativePerturbation: 1 }), RangeError);
  assert.throws(() => runTissueOxygenSensitivity(territories, {}, { relativePerturbation: 0 }), RangeError);
});
