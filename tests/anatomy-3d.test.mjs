import test from "node:test";
import assert from "node:assert/strict";
import { SPLENIC_SURFACE_LANDMARKS, SPLENIC_VESSEL_HIERARCHY, validateSplenicVesselHierarchy } from "../anatomy-3d.mjs";

test("splenic vascular hierarchy follows arterial, microvascular and venous sequence", () => {
  assert.equal(validateSplenicVesselHierarchy(), true);
  assert.deepEqual(SPLENIC_VESSEL_HIERARCHY.map(v => v.name), [
    "splenic_artery",
    "hilar_segmental_arteries",
    "trabecular_arteries",
    "central_arterioles",
    "penicillar_arterioles",
    "sheathed_capillaries",
    "splenic_sinusoids",
    "pulp_venules",
    "trabecular_veins",
    "splenic_vein"
  ]);
});

test("hierarchy validator rejects missing, reordered or malformed vessel levels", () => {
  assert.equal(validateSplenicVesselHierarchy([]), false);
  assert.equal(validateSplenicVesselHierarchy(SPLENIC_VESSEL_HIERARCHY.slice(1)), false);
  const reordered = [...SPLENIC_VESSEL_HIERARCHY].reverse();
  assert.equal(validateSplenicVesselHierarchy(reordered), false);
  const malformed = SPLENIC_VESSEL_HIERARCHY.map(v => ({...v}));
  malformed[4].order = 8;
  assert.equal(validateSplenicVesselHierarchy(malformed), false);
});


test("visceral surface exposes the main impressions and peritoneal reflections", () => {
  const names = SPLENIC_SURFACE_LANDMARKS.map(item => item.name);
  assert.ok(names.includes("gastric_impression"));
  assert.ok(names.includes("renal_impression"));
  assert.ok(names.includes("colic_impression"));
  assert.ok(names.includes("gastrosplenic_ligament"));
  assert.ok(names.includes("splenorenal_ligament"));
  assert.ok(names.includes("superior_border_notches"));
});
