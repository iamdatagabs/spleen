import test from "node:test";
import assert from "node:assert/strict";
import { solveTissueOxygen, sampleTissuePO2 } from "../tissue-oxygen.mjs";

const equal=[0,1,2].map(()=>({arterialInflow:.052}));
const reduced=[0,1,2].map(()=>({arterialInflow:.026}));

test("perfusion supply and saturable consumption raise tissue pO2 above initial state",()=>{
  const f=solveTissueOxygen(equal,{durationSeconds:180});
  assert.ok(f.stats.meanPO2>40);
  assert.ok(f.stats.minPO2>=0);
  assert.ok(f.stats.maxPO2<=90);
  assert.ok(f.stats.activeVoxels>1000);
});

test("lower regional inflow reduces mean tissue pO2",()=>{
  const normal=solveTissueOxygen(equal,{durationSeconds:240});
  const low=solveTissueOxygen(reduced,{durationSeconds:240});
  assert.ok(low.stats.meanPO2<normal.stats.meanPO2);
});

test("no-flux diffusion and regional supply produce a spatially varying field",()=>{
  const f=solveTissueOxygen([{arterialInflow:.08},{arterialInflow:.026},{arterialInflow:.013}],{durationSeconds:240});
  assert.ok(f.stats.maxPO2-f.stats.minPO2>0.1);
});

test("trilinear sampling returns finite values inside the tissue domain",()=>{
  const f=solveTissueOxygen(equal,{durationSeconds:120});
  const value=sampleTissuePO2(f,{x:0,y:0,z:0});
  assert.ok(Number.isFinite(value));
  assert.ok(value>=f.stats.minPO2&&value<=f.stats.maxPO2);
  assert.equal(sampleTissuePO2(f,{x:100,y:0,z:0}),null);
});

test("explicit solver rejects unstable timesteps and invalid flow",()=>{
  assert.throws(()=>solveTissueOxygen(equal,{dt:100}),RangeError);
  assert.throws(()=>solveTissueOxygen([{arterialInflow:-.1},...equal.slice(1)]),RangeError);
});

test("halving the timestep gives a close solution at matched simulation time",()=>{
  const a=solveTissueOxygen(equal,{durationSeconds:120,dt:1});
  const b=solveTissueOxygen(equal,{durationSeconds:120,dt:.5});
  assert.ok(Math.abs(a.stats.meanPO2-b.stats.meanPO2)<0.03);
});

test("higher regional capillary-density index raises mean tissue pO2",()=>{
  const sparse=solveTissueOxygen(equal.map(t=>({...t,capillaryDensity:.5})),{durationSeconds:240});
  const dense=solveTissueOxygen(equal.map(t=>({...t,capillaryDensity:1.5})),{durationSeconds:240});
  assert.ok(dense.stats.meanPO2>sparse.stats.meanPO2);
  assert.ok(dense.stats.meanCapillaryDensityIndex>sparse.stats.meanCapillaryDensityIndex);
});

test("exchange-distance scale and spatial distance field are explicit",()=>{
  const short=solveTissueOxygen(equal,{durationSeconds:240,exchangeDistanceScaleMm:20});
  const long=solveTissueOxygen(equal,{durationSeconds:240,exchangeDistanceScaleMm:80});
  assert.ok(long.stats.meanPO2>short.stats.meanPO2);
  assert.ok(short.stats.meanExchangeDistanceMm>0);
  assert.ok(short.exchangeDistanceField instanceof Float32Array);
});

test("invalid capillary-density index and exchange-distance scale are rejected",()=>{
  assert.throws(()=>solveTissueOxygen([{arterialInflow:.052,capillaryDensity:0},...equal.slice(1)]),RangeError);
  assert.throws(()=>solveTissueOxygen(equal,{exchangeDistanceScaleMm:0}),RangeError);
});
