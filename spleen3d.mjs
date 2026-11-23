import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { distributeTerritoryFlow } from "./spatial-model.mjs";

const host=document.getElementById("spleen3d");
const canvas=document.getElementById("spleen3dCanvas");
const fallback=document.getElementById("spleen3dFallback");
if(host&&canvas){
  try{
    const scene=new THREE.Scene();
    scene.background=new THREE.Color("#0b1925");
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0.1,.15,5.1);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.25;
    scene.add(new THREE.HemisphereLight(0xd9eaff,0x382338,2.1));
    const key=new THREE.DirectionalLight(0xffd7ca,3.0);key.position.set(-3,4,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0x6e9fff,2.0);rim.position.set(3,-2,-3);scene.add(rim);
    const organ=new THREE.Group();scene.add(organ);
    const geometry=new THREE.SphereGeometry(1,80,64);
    const pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const notch=Math.exp(-Math.pow((x-.58)/.24,2)-Math.pow(y/.24,2)-Math.pow((z-.72)/.45,2));
      const taper=1-.13*Math.pow(Math.abs(x),2);
      x=x*1.38*taper;
      y=y*.79*(1-.05*x);
      z=z*.52-notch*.18;
      pos.setXYZ(i,x,y,z);
    }
    geometry.computeVertexNormals();
    const capsule=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:"#a95068",roughness:.48,metalness:.02,clearcoat:.28,clearcoatRoughness:.35}));
    capsule.castShadow=true;capsule.receiveShadow=true;organ.add(capsule);
    const hilum=new THREE.Mesh(new THREE.SphereGeometry(.095,24,16),new THREE.MeshStandardMaterial({color:"#f0c68f",emissive:"#6b3b28",emissiveIntensity:.35}));
    hilum.position.set(.78,0,.39);organ.add(hilum);
    const vascular=new THREE.Group();organ.add(vascular);
    const territories=[
      {key:"superior",label:"Superior",color:"#f4bd67",center:new THREE.Vector3(-.15,.43,.27),radius:.34},
      {key:"middle",label:"Intermediário",color:"#58d6c2",center:new THREE.Vector3(.02,0,.39),radius:.36},
      {key:"inferior",label:"Inferior",color:"#69a9ff",center:new THREE.Vector3(-.18,-.43,.25),radius:.33}
    ];
    const zoneMeshes=[];
    territories.forEach(t=>{
      const m=new THREE.Mesh(new THREE.SphereGeometry(t.radius,32,24),new THREE.MeshPhysicalMaterial({color:t.color,transparent:true,opacity:.25,roughness:.25,metalness:.05,depthWrite:false,emissive:t.color,emissiveIntensity:.12}));
      m.position.copy(t.center);m.scale.set(1.2,.85,.58);organ.add(m);zoneMeshes.push(m);
    });
    const tube=(points,radius,color,parent=vascular)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,10,false),new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.04,emissive:color,emissiveIntensity:.18}));
      parent.add(mesh);return {mesh,curve};
    };
    tube([[-2.05,.05,.12],[-1.55,.04,.16],[-1.12,.02,.2],[-.78,0,.25]],.065,"#ff746d");
    tube([[-.82,0,.25],[-.48,.28,.32],[-.25,.48,.29],[-.05,.53,.22]],.035,"#ff746d");
    tube([[-.82,0,.25],[-.42,.02,.43],[-.12,.04,.43],[.18,.04,.38]],.034,"#ff746d");
    tube([[-.82,0,.25],[-.48,-.3,.32],[-.28,-.49,.27],[-.08,-.54,.2]],.035,"#ff746d");
    const territoryVessels=[];
    territories.forEach((t,i)=>{
      const c=t.center;
      const artery=tube([[-.55,0,.36],[-.38,c.y*.7,.42],[c.x-.05,c.y,.42],[c.x,c.y,c.z]],.025,"#ff746d");
      const vein=tube([[c.x,c.y,c.z],[c.x+.2,c.y*.65,.44],[.52,c.y*.28,.44],[.82,0,.38]],.026,"#78b5ff");
      territoryVessels.push({artery,vein});
    });
    tube([[.82,0,.38],[1.2,.02,.32],[1.62,.05,.24],[2.05,.08,.15]],.065,"#78b5ff");
    const flowParticles=[];
    for(let i=0;i<18;i++){
      const bead=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:"#fff1d7"}));
      vascular.add(bead);flowParticles.push({mesh:bead,t:i/18});
    }
    const floorGrid=new THREE.GridHelper(5,20,"#284255","#172d3d");floorGrid.position.y=-1.12;floorGrid.material.transparent=true;floorGrid.material.opacity=.28;scene.add(floorGrid);
    let yaw=-.16,pitch=.08,drag=false,px=0,py=0,zoom=5.1;
    canvas.addEventListener("pointerdown",e=>{drag=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-px)*.008;pitch=Math.max(-.8,Math.min(.8,pitch+(e.clientY-py)*.006));px=e.clientX;py=e.clientY;});
    const stop=()=>drag=false;
    canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);canvas.addEventListener("lostpointercapture",stop);
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(3.6,Math.min(7,zoom+e.deltaY*.004));},{passive:false});
    document.getElementById("spleenViewReset")?.addEventListener("click",()=>{yaw=-.16;pitch=.08;zoom=5.1;});
    const resize=()=>{const r=host.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    new ResizeObserver(resize).observe(host);resize();
    let state=window.SPLEEN_MODEL_STATE||null;
    let resistances=[1,1,1],flows=[.052,.052,.052];
    const fmt=n=>Number(n).toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3});
    const updateCompartments=()=>{
      const total=Number(state?.regionalFlows?.spleen??.156);
      flows=distributeTerritoryFlow(total,resistances);
      territories.forEach((t,i)=>{
        const frac=total>0?flows[i]/total:1/3;
        zoneMeshes[i].material.opacity=.13+.46*frac;
        zoneMeshes[i].material.emissiveIntensity=.08+.55*frac;
        const width=.012+.055*Math.sqrt(frac);
        territoryVessels[i].artery.mesh.geometry.dispose();
        territoryVessels[i].artery.mesh.geometry=new THREE.TubeGeometry(territoryVessels[i].artery.curve,40,width,8,false);
        territoryVessels[i].vein.mesh.geometry.dispose();
        territoryVessels[i].vein.mesh.geometry=new THREE.TubeGeometry(territoryVessels[i].vein.curve,40,width,8,false);
        const label=t.key[0].toUpperCase()+t.key.slice(1);
        const rEl=document.getElementById("r"+label+"Value"),qEl=document.getElementById("q"+label);
        if(rEl)rEl.textContent=resistances[i].toFixed(1).replace(".",",")+"×";
        if(qEl)qEl.textContent=fmt(flows[i])+" L/min";
      });
    };
    ["Superior","Middle","Inferior"].forEach((name,i)=>{
      const input=document.getElementById("r"+name);
      input?.addEventListener("input",()=>{resistances[i]=Number(input.value);updateCompartments();});
    });
    document.getElementById("resetTerritories")?.addEventListener("click",()=>{resistances=[1,1,1];["Superior","Middle","Inferior"].forEach(name=>{const input=document.getElementById("r"+name);if(input)input.value="1";});updateCompartments();});
    window.updateSpleenSpatialState=next=>{state=next;updateCompartments();};
    if(state)updateCompartments();
    const clock=new THREE.Clock();
    const animate=()=>{
      requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      organ.rotation.y=yaw;organ.rotation.x=pitch;
      camera.position.z=zoom;camera.lookAt(0,0,0);
      flowParticles.forEach((p,i)=>{
        const k=(p.t+t*.12)%1;
        p.mesh.position.set(-2.0+2.5*k,.04+Math.sin(k*Math.PI*2)*.13,.16+.16*Math.sin(k*Math.PI));
      });
      renderer.render(scene,camera);
    };
    animate();
    window.addEventListener("resize",resize);
  }catch(error){
    console.error("SPLEEN 3D initialization failed",error);
    fallback.hidden=false;
    canvas.hidden=true;
  }
}
