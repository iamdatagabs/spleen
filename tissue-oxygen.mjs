// Reduced-order 3D tissue oxygen reaction-diffusion model with phenomenological microvascular heterogeneity.
// Units: coordinates mm, time s, pO2 mmHg, D mm^2/s, rates 1/s or mmHg/s.
// Exchange centers are computational abstractions, not segmented capillaries or measured anatomy.
export const DEFAULT_TISSUE_OXYGEN = Object.freeze({
  nx: 25, ny: 17, nz: 11,
  xMin: -60, xMax: 60, yMin: -40, yMax: 40, zMin: -25, zMax: 25,
  diffusion: 0.002,
  baselinePerfusionRate: 0.003,
  arterialPO2: 90,
  vmax: 0.03,
  km: 2,
  initialPO2: 40,
  durationSeconds: 300,
  dt: 1,
  territorySigmaMm: 17,
  exchangeDistanceScaleMm: 45
});

const finitePositive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be finite and positive");
};

export function solveTissueOxygen(territories, options = {}) {
  if (!Array.isArray(territories) || territories.length !== 3) {
    throw new TypeError("exactly three splenic territories are required");
  }
  const p = { ...DEFAULT_TISSUE_OXYGEN, ...options };
  for (const key of ["nx", "ny", "nz"]) {
    if (!Number.isInteger(p[key]) || p[key] < 3) throw new RangeError(key + " must be an integer >= 3");
  }
  for (const key of ["diffusion", "baselinePerfusionRate", "arterialPO2", "vmax", "km", "durationSeconds", "dt", "territorySigmaMm", "exchangeDistanceScaleMm"]) {
    finitePositive(p[key], key);
  }
  if (!Number.isFinite(p.initialPO2) || p.initialPO2 < 0) throw new RangeError("initialPO2 must be finite and non-negative");
  const flows = territories.map((t, i) => {
    const q = Number(t.arterialInflow);
    if (!Number.isFinite(q) || q < 0) throw new RangeError("territory " + i + " flow must be finite and non-negative");
    const density = t.capillaryDensity === undefined ? 1 : Number(t.capillaryDensity);
    if (!Number.isFinite(density) || density < 0.1 || density > 5) {
      throw new RangeError("territory " + i + " capillaryDensity must be between 0.1 and 5");
    }
    return { flow: q / 0.052, density };
  });
  const dx = (p.xMax-p.xMin)/(p.nx-1), dy = (p.yMax-p.yMin)/(p.ny-1), dz = (p.zMax-p.zMin)/(p.nz-1);
  const diffusionLimit = 1 / (2*p.diffusion*(1/(dx*dx)+1/(dy*dy)+1/(dz*dz)));
  const reactionLimit = 1 / (p.baselinePerfusionRate*Math.max(1,...flows.map(v=>v.flow*v.density)) + p.vmax/p.km);
  const stableDt = Math.min(diffusionLimit, reactionLimit);
  if (p.dt > stableDt) throw new RangeError("dt exceeds the explicit stability bound " + stableDt);
  const count=p.nx*p.ny*p.nz, mask=new Uint8Array(count), rate=new Float32Array(count);
  const capillaryDensityField=new Float32Array(count), exchangeDistanceField=new Float32Array(count);
  let active=0;
  const centers=[[-15,22,8],[2,0,12],[-18,-22,7]], sigma2=2*p.territorySigmaMm*p.territorySigmaMm;
  const index=(i,j,k)=>(k*p.ny+j)*p.nx+i;
  for(let k=0;k<p.nz;k++) for(let j=0;j<p.ny;j++) for(let i=0;i<p.nx;i++){
    const x=p.xMin+i*dx,y=p.yMin+j*dy,z=p.zMin+k*dz;
    const ell=(x/60)**2+(y/40)**2+(z/25)**2, id=index(i,j,k);
    if(ell>1) continue;
    mask[id]=1;active++;
    let weightedFlow=0,weightedDensity=0,weightedDistance=0,weights=0;
    for(let r=0;r<3;r++){
      const c=centers[r],d2=(x-c[0])**2+(y-c[1])**2+(z-c[2])**2,w=Math.exp(-d2/sigma2);
      weightedFlow+=w*flows[r].flow;
      weightedDensity+=w*flows[r].density;
      weightedDistance+=w*Math.sqrt(d2);
      weights+=w;
    }
    const density=weights?weightedDensity/weights:1;
    const distance=weights?weightedDistance/weights:0;
    capillaryDensityField[id]=density;
    exchangeDistanceField[id]=distance;
    // The exchange-distance attenuation is a phenomenological proxy, not a resolved capillary geometry.
    const distanceFactor=Math.exp(-distance/p.exchangeDistanceScaleMm);
    rate[id]=p.baselinePerfusionRate*(weights?weightedFlow/weights:0)*density*distanceFactor;
  }
  let current=new Float32Array(count),next=new Float32Array(count);
  for(let id=0;id<count;id++) if(mask[id]) current[id]=p.initialPO2;
  const cx=p.diffusion/(dx*dx),cy=p.diffusion/(dy*dy),cz=p.diffusion/(dz*dz);
  const steps=Math.ceil(p.durationSeconds/p.dt),dt=p.durationSeconds/steps;
  if(dt>stableDt) throw new RangeError("adjusted timestep exceeds explicit stability bound");
  for(let step=0;step<steps;step++){
    for(let k=0;k<p.nz;k++) for(let j=0;j<p.ny;j++) for(let i=0;i<p.nx;i++){
      const id=index(i,j,k);if(!mask[id]){next[id]=0;continue;}
      const c=current[id];
      let lap=0;
      if(i>0&&mask[id-1])lap+=cx*(current[id-1]-c);
      if(i<p.nx-1&&mask[id+1])lap+=cx*(current[id+1]-c);
      if(j>0&&mask[id-p.nx])lap+=cy*(current[id-p.nx]-c);
      if(j<p.ny-1&&mask[id+p.nx])lap+=cy*(current[id+p.nx]-c);
      const plane=p.nx*p.ny;
      if(k>0&&mask[id-plane])lap+=cz*(current[id-plane]-c);
      if(k<p.nz-1&&mask[id+plane])lap+=cz*(current[id+plane]-c);
      const supply=rate[id]*(p.arterialPO2-c);
      const consumption=p.vmax*c/(p.km+c);
      next[id]=Math.max(0,c+dt*(lap+supply-consumption));
    }
    const swap=current;current=next;next=swap;
  }
  let sum=0,min=Infinity,max=-Infinity,sumDensity=0,sumDistance=0;
  for(let id=0;id<count;id++)if(mask[id]){
    const v=current[id];sum+=v;if(v<min)min=v;if(v>max)max=v;
    sumDensity+=capillaryDensityField[id];sumDistance+=exchangeDistanceField[id];
  }
  return {
    values:current,mask,capillaryDensityField,exchangeDistanceField,
    grid:{nx:p.nx,ny:p.ny,nz:p.nz,xMin:p.xMin,xMax:p.xMax,yMin:p.yMin,yMax:p.yMax,zMin:p.zMin,zMax:p.zMax,dx,dy,dz},
    stats:{
      meanPO2:sum/active,minPO2:min,maxPO2:max,activeVoxels:active,steps,dt,
      simulatedSeconds:steps*dt,stableDt,meanCapillaryDensityIndex:sumDensity/active,
      meanExchangeDistanceMm:sumDistance/active
    },
    parameters:{
      diffusion:p.diffusion,baselinePerfusionRate:p.baselinePerfusionRate,arterialPO2:p.arterialPO2,
      vmax:p.vmax,km:p.km,initialPO2:p.initialPO2,territorySigmaMm:p.territorySigmaMm,
      exchangeDistanceScaleMm:p.exchangeDistanceScaleMm
    }
  };
}

export function sampleTissuePO2(field, point) {
  if(!field?.values||!field?.mask||!field?.grid) throw new TypeError("a tissue oxygen field is required");
  if(!point||!["x","y","z"].every(k=>Number.isFinite(point[k]))) throw new TypeError("point must contain finite x, y and z coordinates");
  const g=field.grid,{nx,ny,nz}=g;
  const fx=(point.x-g.xMin)/g.dx,fy=(point.y-g.yMin)/g.dy,fz=(point.z-g.zMin)/g.dz;
  if(fx<0||fy<0||fz<0||fx>nx-1||fy>ny-1||fz>nz-1) return null;
  const x0=Math.min(nx-2,Math.floor(fx)),y0=Math.min(ny-2,Math.floor(fy)),z0=Math.min(nz-2,Math.floor(fz));
  const ax=fx-x0,ay=fy-y0,az=fz-z0,idx=(i,j,k)=>(k*ny+j)*nx+i;
  let value=0,weight=0;
  for(let dz=0;dz<=1;dz++)for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
    const id=idx(x0+dx,y0+dy,z0+dz);if(!field.mask[id])continue;
    const w=(dx?ax:1-ax)*(dy?ay:1-ay)*(dz?az:1-az);
    value+=field.values[id]*w;weight+=w;
  }
  return weight>0?value/weight:null;
}
