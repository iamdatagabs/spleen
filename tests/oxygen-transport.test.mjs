import test from "node:test";
import assert from "node:assert/strict";
import { calculateTerritoryOxygen, sampleOxygenField } from "../oxygen-transport.mjs";

const equalTerritories = [0,1,2].map(() => ({ arterialInflow: 0.052 }));
const centers = [{x:-.15,y:.43,z:.27},{x:.02,y:0,z:.39},{x:-.18,y:-.43,z:.25}];

test("basal regional oxygen delivery matches the declared reference", () => {
  const result = calculateTerritoryOxygen(equalTerritories);
  for (const territory of result) {
    assert.ok(Math.abs(territory.oxygenDelivery - 9.62) < 1e-10);
    assert.equal(territory.relativeOxygenDelivery, 1);
    assert.equal(territory.oxygenDeliveryLevel, "preserved");
  }
});

test("oxygen delivery scales linearly with flow and oxygen content", () => {
  const result = calculateTerritoryOxygen([{arterialInflow:.026},{arterialInflow:.052},{arterialInflow:.104}], {arterialOxygenContent:20});
  assert.ok(Math.abs(result[0].oxygenDelivery * 2 - result[1].oxygenDelivery) < 1e-10);
  assert.ok(Math.abs(result[2].oxygenDelivery - result[1].oxygenDelivery * 2) < 1e-10);
});

test("regional delivery classes are descriptive and ordered", () => {
  const result = calculateTerritoryOxygen([{arterialInflow:.052},{arterialInflow:.04},{arterialInflow:.02}]);
  assert.deepEqual(result.map(x=>x.oxygenDeliveryLevel), ["preserved","reduced","markedly-reduced"]);
});

test("oxygen field is closest to its regional value at the territory center", () => {
  const regions = calculateTerritoryOxygen([{arterialInflow:.052},{arterialInflow:.026},{arterialInflow:.013}]);
  const value = sampleOxygenField(centers[0], regions, centers);
  assert.ok(Math.abs(value - regions[0].relativeOxygenDelivery) < 0.03);
});

test("field interpolation remains between regional extrema", () => {
  const regions = calculateTerritoryOxygen([{arterialInflow:.052},{arterialInflow:.026},{arterialInflow:.013}]);
  const value = sampleOxygenField({x:0,y:0,z:.3}, regions, centers);
  const values = regions.map(x=>x.relativeOxygenDelivery);
  assert.ok(value >= Math.min(...values) && value <= Math.max(...values));
});

test("invalid flows and malformed spatial inputs are rejected", () => {
  assert.throws(()=>calculateTerritoryOxygen([{arterialInflow:-1},...equalTerritories.slice(1)]), RangeError);
  assert.throws(()=>sampleOxygenField({x:0,y:0,z:0}, [], centers), RangeError);
});
