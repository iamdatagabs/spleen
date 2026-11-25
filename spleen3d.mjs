import { distributeTerritoryFlow, territoryVisualMetrics } from "./spatial-model.mjs";
import { calculateTerritoryOxygen } from "./oxygen-transport.mjs";
import { solveTissueOxygen, sampleTissuePO2 } from "./tissue-oxygen.mjs";
import { createSplenicAnatomy } from "./anatomy-3d.mjs";

const host=document.getElementById("spleen3d"),canvas=document.getElementById("spleen3dCanvas"),fallback=document.getElementById("spleen3dFallback");
if(host&&canvas){
  try{
    const THREE=await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
    const scene=new THREE.Scene();scene.background=new THREE.Color("#0b1925");
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(.1,.15,5.1);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    scene.add(new THREE.HemisphereLight(0xd9eaff,0x382338,2.1));
    const key=new THREE.DirectionalLight(0xffd7ca,3);key.position.set(-3,4,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0x6e9fff,2);rim.position.set(3,-2,-3);scene.add(rim);
    const organ=new THREE.Group();scene.add(organ);
    const territories=[{key:"superior",label:"Superior",color:"#f4bd67",center:new THREE.Vector3(-.15,.43,.27),radius:.34},{key:"middle",label:"Intermediário",color:"#58d6c2",center:new THREE.Vector3(.02,0,.39),radius:.36},{key:"inferior",label:"Inferior",color:"#69a9ff",center:new THREE.Vector3(-.18,-.43,.25),radius:.33}];
    const anatomy=createSplenicAnatomy(THREE,organ,territories);
    const {geometry,vascular,territoryVessels,layers}=anatomy;
    const pos=geometry.attributes.position;
    const zoneMeshes=[],pressureNodes=[];
    const oxygenCenters=territories.map(t=>({x:t.center.x,y:t.center.y,z:t.center.z}));
    const oxygenLow=new THREE.Color("#ef626b"),oxygenMid=new THREE.Color("#f4bd67"),oxygenHigh=new THREE.Color("#58d6c2");
    let tissueOxygenField=null;
    const updateOxygenSurface=()=>{
      tissueOxygenField=solveTissueOxygen(territoryState,{durationSeconds:180,dt:1});
      const colors=geometry.attributes.color,low=new THREE.Color("#ef626b"),mid=new THREE.Color("#f4bd67"),high=new THREE.Color("#58d6c2");
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const pO2=sampleTissuePO2(tissueOxygenField,{x:x/1.38*60,y:y/.79*40,z:z/.52*25});
        const value=pO2===null?40:pO2;
        const color=value<25?low.clone().lerp(mid,Math.max(0,value/25)):mid.clone().lerp(high,Math.min(1,(value-25)/45));
        colors.setXYZ(i,color.r,color.g,color.b);
      }
      colors.needsUpdate=true;
      const stats=tissueOxygenField.stats;
      const mean=document.getElementById("tissuePO2Mean"),range=document.getElementById("tissuePO2Range"),time=document.getElementById("tissuePO2Time"),density=document.getElementById("capillaryDensityMean"),distance=document.getElementById("exchangeDistanceMean");
      if(mean)mean.textContent=stats.meanPO2.toFixed(1).replace(".",",")+" mmHg";
      if(range)range.textContent=stats.minPO2.toFixed(1).replace(".",",")+"–"+stats.maxPO2.toFixed(1).replace(".",",")+" mmHg";
      if(time)time.textContent=stats.simulatedSeconds.toFixed(0)+" s · "+stats.steps+" passos";
      if(density)density.textContent=stats.meanCapillaryDensityIndex.toFixed(2).replace(".",",")+" × ref.";
      if(distance)distance.textContent=stats.meanExchangeDistanceMm.toFixed(1).replace(".",",")+" mm";
    };
    territories.forEach(t=>{const zone=new THREE.Mesh(new THREE.SphereGeometry(t.radius,32,24),new THREE.MeshPhysicalMaterial({color:t.color,transparent:true,opacity:.25,roughness:.25,metalness:.05,depthWrite:false,emissive:t.color,emissiveIntensity:.12}));zone.position.copy(t.center);zone.scale.set(1.2,.85,.58);organ.add(zone);zoneMeshes.push(zone);const node=new THREE.Mesh(new THREE.SphereGeometry(.075,20,16),new THREE.MeshStandardMaterial({color:"#58d6c2",emissive:"#58d6c2",emissiveIntensity:.35,roughness:.3}));node.position.copy(t.center).add(new THREE.Vector3(0,0,.12));organ.add(node);pressureNodes.push(node);});
    territoryVessels.forEach(v=>{
      for(let j=0;j<4;j++){
        const a=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:"#fff1d7"}));
        const b=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:"#d8edff"}));
        vascular.add(a,b);
        v.arterialBeads.push({mesh:a,phase:j/4});
        v.venousBeads.push({mesh:b,phase:j/4});
      }
    });
    document.querySelectorAll("[data-anatomy-layer]").forEach(input=>{
      const layer=layers[input.dataset.anatomyLayer];
      if(layer){layer.visible=input.checked;input.addEventListener("change",()=>{layer.visible=input.checked;});}
    });
    const floorGrid=new THREE.GridHelper(5,20,"#284255","#172d3d");floorGrid.position.y=-1.12;floorGrid.material.transparent=true;floorGrid.material.opacity=.28;scene.add(floorGrid);
    let yaw=-.16,pitch=.08,drag=false,px=0,py=0,zoom=5.1;
    canvas.addEventListener("pointerdown",e=>{drag=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-px)*.008;pitch=Math.max(-.8,Math.min(.8,pitch+(e.clientY-py)*.006));px=e.clientX;py=e.clientY;});
    const stop=()=>drag=false;canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);canvas.addEventListener("lostpointercapture",stop);
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(3.6,Math.min(7,zoom+e.deltaY*.004));},{passive:false});
    document.getElementById("spleenViewReset")?.addEventListener("click",()=>{yaw=-.16;pitch=.08;zoom=5.1;});
    const resize=()=>{const r=host.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
    let state=window.SPLEEN_MODEL_STATE||null,resistances=[1,1,1],territoryState=[];
    const fmt=n=>Number(n).toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3});
    const pressureColor=level=>level==="high"?"#ef626b":level==="raised"?"#f4bd67":level==="low"?"#69a9ff":"#58d6c2";
    const updateCompartments=()=>{
      const total=Number(state?.regionalFlows?.spleen??.156),dynamic=state?.splenicTerritories;
      territoryState=dynamic?.length===3?dynamic:distributeTerritoryFlow(total,resistances).map((q,i)=>({arterialInflow:q,venousOutflow:q,pressure:10,relativeResistance:resistances[i]}));
      territoryState=calculateTerritoryOxygen(territoryState);
      territoryState=territoryState.map((d,i)=>({...d,capillaryDensity:Number(document.getElementById(["capDensitySuperior","capDensityMiddle","capDensityInferior"][i])?.value??1)}));
      updateOxygenSurface();
      territories.forEach((t,i)=>{
        const d=territoryState[i],visual=territoryVisualMetrics({arterialInflow:Number(d.arterialInflow),venousOutflow:Number(d.venousOutflow),pressure:Number(d.pressure)}),frac=total>0?Number(d.arterialInflow)/total:1/3;
        zoneMeshes[i].material.opacity=.13+.46*frac;zoneMeshes[i].material.emissiveIntensity=.08+.55*frac;
        const tint=pressureColor(visual.pressureLevel),oxygenTint=Number(d.relativeOxygenDelivery)>=.9?"#58d6c2":Number(d.relativeOxygenDelivery)>=.7?"#f4bd67":"#ef626b";zoneMeshes[i].material.color.set(t.color).lerp(new THREE.Color(tint),visual.pressureLevel==="reference"?.08:.34).lerp(new THREE.Color(oxygenTint),.28);zoneMeshes[i].material.emissive.copy(zoneMeshes[i].material.color);
        pressureNodes[i].material.color.set(tint);pressureNodes[i].material.emissive.set(tint);pressureNodes[i].scale.setScalar(.85+Math.min(1.5,Math.abs(visual.pressureRatio-1)));
        const updateTube=(entry,radius)=>{entry.mesh.geometry.dispose();entry.mesh.geometry=new THREE.TubeGeometry(entry.curve,40,radius,8,false);};
        updateTube(territoryVessels[i].artery,visual.arterialRadius);updateTube(territoryVessels[i].vein,visual.venousRadius);
        const label=t.label==="Intermediário"?"Middle":t.label,rEl=document.getElementById("r"+label+"Value"),qEl=document.getElementById("q"+label);
        if(rEl)rEl.textContent=Number(d.relativeResistance??resistances[i]).toFixed(1).replace(".",",")+"×";
        if(qEl)qEl.textContent="Q arterial "+fmt(d.arterialInflow)+" · Q venosa "+fmt(d.venousOutflow)+" L/min · P "+fmt(d.pressure)+" mmHg";
        const oxygenEl=document.getElementById("o2"+label);if(oxygenEl)oxygenEl.textContent=fmt(d.oxygenDelivery)+" mL O₂/min · "+fmt(100*d.relativeOxygenDelivery)+"% ref.";
        const pathEl=document.getElementById("path"+label),ap=d.arterialPath,vp=d.venousPath;
        if(pathEl&&ap?.length===4&&vp?.length===4)pathEl.textContent="P arterial: "+fmt(ap[0].pressure_mmhg)+" → "+fmt(ap[3].pressure_mmhg)+" · P venosa: "+fmt(vp[0].pressure_mmhg)+" → "+fmt(vp[3].pressure_mmhg)+" mmHg";
      });
    };
    ["Superior","Middle","Inferior"].forEach(name=>{
      const input=document.getElementById("capDensity"+name),value=document.getElementById("capDensity"+name+"Value");
      input?.addEventListener("input",()=>{if(value)value.textContent=Number(input.value).toFixed(1).replace(".",",")+"×";updateCompartments();});
    });
    ["Superior","Middle","Inferior"].forEach((name,i)=>{const input=document.getElementById("r"+name);input?.addEventListener("input",()=>{resistances[i]=Number(input.value);window.dispatchEvent(new CustomEvent("spleen-territory-resistance-change"));updateCompartments();});});
    document.getElementById("resetTerritories")?.addEventListener("click",()=>{resistances=[1,1,1];["Superior","Middle","Inferior"].forEach(name=>{const input=document.getElementById("r"+name);if(input)input.value="1";});window.dispatchEvent(new CustomEvent("spleen-territory-resistance-change"));updateCompartments();});
    window.updateSpleenSpatialState=next=>{state=next;updateCompartments();};updateCompartments();
    const clock=new THREE.Clock();
    const animate=()=>{requestAnimationFrame(animate);const t=clock.getElapsedTime();organ.rotation.y=yaw;organ.rotation.x=pitch;camera.position.z=zoom;camera.lookAt(0,0,0);territoryVessels.forEach((v,i)=>{const d=territoryState[i]||{arterialInflow:.052,venousOutflow:.052,pressure:10};const visual=territoryVisualMetrics({arterialInflow:Number(d.arterialInflow),venousOutflow:Number(d.venousOutflow),pressure:Number(d.pressure??10)});v.arterialBeads.forEach(p=>p.mesh.position.copy(v.artery.curve.getPoint((p.phase+t*visual.arterialParticleSpeed)%1)));v.venousBeads.forEach(p=>p.mesh.position.copy(v.vein.curve.getPoint((p.phase+t*visual.venousParticleSpeed)%1)));});renderer.render(scene,camera);};
    animate();window.addEventListener("resize",resize);
  }catch(error){console.error("SPLEEN 3D initialization failed",error);fallback.hidden=false;canvas.hidden=true;}
}
