import { distributeTerritoryFlow, territoryVisualMetrics } from "./spatial-model.mjs";
import { calculateTerritoryOxygen } from "./oxygen-transport.mjs";
import { solveTissueOxygen, sampleTissuePO2 } from "./tissue-oxygen.mjs";

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
    const geometry=new THREE.SphereGeometry(1,80,64),pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const notch=Math.exp(-Math.pow((x-.58)/.24,2)-Math.pow(y/.24,2)-Math.pow((z-.72)/.45,2));const taper=1-.13*Math.pow(Math.abs(x),2);x=x*1.38*taper;y=y*.79*(1-.05*x);z=z*.52-notch*.18;pos.setXYZ(i,x,y,z);}
    geometry.computeVertexNormals();
    geometry.setAttribute("color",new THREE.BufferAttribute(new Float32Array(pos.count*3),3));
    const capsule=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:"#ffffff",vertexColors:true,roughness:.48,metalness:.02,clearcoat:.28,clearcoatRoughness:.35}));capsule.castShadow=true;capsule.receiveShadow=true;organ.add(capsule);
    const hilum=new THREE.Mesh(new THREE.SphereGeometry(.095,24,16),new THREE.MeshStandardMaterial({color:"#f0c68f",emissive:"#6b3b28",emissiveIntensity:.35}));hilum.position.set(.78,0,.39);organ.add(hilum);
    const vascular=new THREE.Group();organ.add(vascular);
    const territories=[{key:"superior",label:"Superior",color:"#f4bd67",center:new THREE.Vector3(-.15,.43,.27),radius:.34},{key:"middle",label:"Intermediário",color:"#58d6c2",center:new THREE.Vector3(.02,0,.39),radius:.36},{key:"inferior",label:"Inferior",color:"#69a9ff",center:new THREE.Vector3(-.18,-.43,.25),radius:.33}];
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
      if(time)time.textContent=stats.simulatedSeconds.toFixed(0)+" s · "+stats.steps+" passos";\n      if(density)density.textContent=stats.meanCapillaryDensityIndex.toFixed(2).replace(".",",")+" × ref.";\n      if(distance)distance.textContent=stats.meanExchangeDistanceMm.toFixed(1).replace(".",",")+" mm";
    };
    territories.forEach(t=>{const zone=new THREE.Mesh(new THREE.SphereGeometry(t.radius,32,24),new THREE.MeshPhysicalMaterial({color:t.color,transparent:true,opacity:.25,roughness:.25,metalness:.05,depthWrite:false,emissive:t.color,emissiveIntensity:.12}));zone.position.copy(t.center);zone.scale.set(1.2,.85,.58);organ.add(zone);zoneMeshes.push(zone);const node=new THREE.Mesh(new THREE.SphereGeometry(.075,20,16),new THREE.MeshStandardMaterial({color:"#58d6c2",emissive:"#58d6c2",emissiveIntensity:.35,roughness:.3}));node.position.copy(t.center).add(new THREE.Vector3(0,0,.12));organ.add(node);pressureNodes.push(node);});
    const tube=(points,radius,color,parent=vascular)=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const material=new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.04,emissive:color,emissiveIntensity:.18});const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,10,false),material);parent.add(mesh);return{mesh,curve,material};};
    tube([[-2.05,.05,.12],[-1.55,.04,.16],[-1.12,.02,.2],[-.78,0,.25]],.065,"#ff746d");
    tube([[-.82,0,.25],[-.48,.28,.32],[-.25,.48,.29],[-.05,.53,.22]],.035,"#ff746d");
    tube([[-.82,0,.25],[-.42,.02,.43],[-.12,.04,.43],[.18,.04,.38]],.034,"#ff746d");
    tube([[-.82,0,.25],[-.48,-.3,.32],[-.28,-.49,.27],[-.08,-.54,.2]],.035,"#ff746d");
    const territoryVessels=[];
    territories.forEach(t=>{const c=t.center;const artery=tube([[-.55,0,.36],[-.38,c.y*.7,.42],[c.x-.05,c.y,.42],[c.x,c.y,c.z]],.025,"#ff746d");const vein=tube([[c.x,c.y,c.z],[c.x+.2,c.y*.65,.44],[.52,c.y*.28,.44],[.82,0,.38]],.026,"#78b5ff");const arterialBeads=[],venousBeads=[];for(let j=0;j<4;j++){const a=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:"#fff1d7"}));const v=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:"#d8edff"}));vascular.add(a,v);arterialBeads.push({mesh:a,phase:j/4});venousBeads.push({mesh:v,phase:j/4});}territoryVessels.push({artery,vein,arterialBeads,venousBeads});});
    tube([[.82,0,.38],[1.2,.02,.32],[1.62,.05,.24],[2.05,.08,.15]],.065,"#78b5ff");
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
    ["Superior","Middle","Inferior"].forEach((name,i)=>{const input=document.getElementById("r"+name);input?.addEventListener("input",()=>{resistances[i]=Number(input.value);window.dispatchEvent(new CustomEvent("spleen-territory-resistance-change"));updateCompartments();});});
    document.getElementById("resetTerritories")?.addEventListener("click",()=>{resistances=[1,1,1];["Superior","Middle","Inferior"].forEach(name=>{const input=document.getElementById("r"+name);if(input)input.value="1";});window.dispatchEvent(new CustomEvent("spleen-territory-resistance-change"));updateCompartments();});
    window.updateSpleenSpatialState=next=>{state=next;updateCompartments();};updateCompartments();
    const clock=new THREE.Clock();
    const animate=()=>{requestAnimationFrame(animate);const t=clock.getElapsedTime();organ.rotation.y=yaw;organ.rotation.x=pitch;camera.position.z=zoom;camera.lookAt(0,0,0);territoryVessels.forEach((v,i)=>{const d=territoryState[i]||{arterialInflow:.052,venousOutflow:.052,pressure:10};const visual=territoryVisualMetrics({arterialInflow:Number(d.arterialInflow),venousOutflow:Number(d.venousOutflow),pressure:Number(d.pressure??10)});v.arterialBeads.forEach(p=>p.mesh.position.copy(v.artery.curve.getPoint((p.phase+t*visual.arterialParticleSpeed)%1)));v.venousBeads.forEach(p=>p.mesh.position.copy(v.vein.curve.getPoint((p.phase+t*visual.venousParticleSpeed)%1)));});renderer.render(scene,camera);};
    animate();window.addEventListener("resize",resize);
  }catch(error){console.error("SPLEEN 3D initialization failed",error);fallback.hidden=false;canvas.hidden=true;}
}
