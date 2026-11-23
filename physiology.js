/* SPLEEN — derived physiology indicators.
   Values are read from the simulator's structured state, never scraped from rendered text.
   Thresholds and baselines remain exploratory and require clinical review. */
(()=> {
  const $ = id => document.getElementById(id);
  const fmt = (n,d=1) => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const indicator = (name,value,unit,level,description) => ({name,value,unit,level,description});
  function update(){
    const state=window.SPLEEN_MODEL_STATE;
    if(!state) return;
    window.updateSpleenSpatialState?.(state);
    const map=Number(state.inputs.map),iap=Number(state.inputs.pneu),app=map-iap;
    const total=Number(state.totalFlow),portal=Number(state.portalPressure);
    const spleen=Number(state.regionalFlows.spleen);
    const spleenIndex=100*spleen/.156,totalIndex=100*total/1.2;
    const spatialModel=$("spleen3d");
    if(spatialModel){const flowScale=Math.max(.2,Math.min(1.8,spleen/.156));spatialModel.style.setProperty("--flow-scale",flowScale.toFixed(3));spatialModel.style.setProperty("--portal-load",Math.max(.2,Math.min(1.8,portal/10)).toFixed(3));
      spatialModel.style.setProperty("--artery-width",(6*flowScale).toFixed(2)+"px");
      spatialModel.style.setProperty("--branch-width",(2.7*flowScale).toFixed(2)+"px");
      spatialModel.style.setProperty("--capillary-width",(1.2*flowScale).toFixed(2)+"px");
      spatialModel.style.setProperty("--branch-opacity",Math.max(.48,Math.min(1,.48+flowScale*.3)).toFixed(3));
      spatialModel.style.setProperty("--micro-opacity",Math.max(.28,Math.min(.9,.28+flowScale*.34)).toFixed(3));}
    $("spleen3dFlow").textContent=fmt(spleen,3)+" L/min";
    $("spleen3dPerfusion").textContent=fmt(spleenIndex,0)+"%";
    $("spleen3dPortal").textContent=fmt(portal,1)+" mmHg";
    const portalGradient=portal-5;
    const gastricPortal=Number(state.portalInflowComponents?.stomach ?? 0);
    const gastricSystemic=Number(state.gastricSystemicReturn ?? 0);
    $("appValue").textContent=fmt(app,0)+" mmHg";
    $("spleenFlow").textContent=fmt(spleen,3)+" L/min";
    $("spleenIndex").textContent=fmt(spleenIndex,0)+"%";
    $("portalGradient").textContent=fmt(portalGradient,1)+" mmHg";
    $("gastricPortalFlow").textContent=fmt(gastricPortal,3)+" L/min";
    $("gastricSystemicFlow").textContent=fmt(gastricSystemic,3)+" L/min";
    const appLevel=app<50?"critical":app<60?"watch":"normal";
    const spleenLevel=spleenIndex<70?"critical":spleenIndex<85?"watch":"normal";
    const portalLevel=portal>20?"critical":portal>15?"watch":"normal";
    const totalLevel=totalIndex<60?"critical":totalIndex<80?"watch":"normal";
    const items=[
      indicator("APP",fmt(app,0),"mmHg",appLevel,"PAM − PIA; limiares exploratórios 50/60 mmHg."),
      indicator("Fluxo arterial esplênico",fmt(spleenIndex,0),"% do basal",spleenLevel,"Fluxo do compartimento arterial esplênico; basal ilustrativo de 0,156 L/min."),
      indicator("Pressão portal",fmt(portal,1),"mmHg",portalLevel,"Pressão do compartimento portal; limiares exploratórios."),
      indicator("Fluxo esplâncnico total",fmt(totalIndex,0),"% do basal",totalLevel,"Soma dos quatro compartimentos arteriais; basal ilustrativo de 1,20 L/min.")
    ];
    const severity={normal:0,watch:1,critical:2};
    const worst=items.reduce((a,b)=>severity[b.level]>severity[a.level]?b:a,items[0]);
    $("criticalityIndicators").innerHTML=items.map(x=>'<div class="criticality-item" data-level="'+x.level+'"><span>'+x.name+'</span><strong>'+x.value+' <small>'+x.unit+'</small></strong><small>'+x.description+'</small></div>').join("");
    const status=$("criticalityStatus");status.dataset.level=worst.level;
    status.textContent=worst.level==="critical"?"ALERTA ELEVADO":worst.level==="watch"?"ATENÇÃO":"CENÁRIO FAVORÁVEL";
    $("criticalityHeadline").textContent=worst.level==="critical"?"Um ou mais indicadores ultrapassaram a faixa de alerta elevado do protótipo.":worst.level==="watch"?"Há indicador(es) na faixa intermediária de atenção do protótipo.":"Nenhum dos quatro indicadores ultrapassou as faixas de alerta configuradas.";
    $("criticalityExplanation").textContent="Indicador mais alterado: "+worst.name+". Resultados vinculados ao último estado calculado pelo simulador; APP usa os controles atuais.";
  }
  ["run","reset"].forEach(id=>$(id)?.addEventListener("click",()=>requestAnimationFrame(update)));
  ["map","pneu","vaso","blood","gastricPortalPct","duration"].forEach(id=>$(id)?.addEventListener("input",()=>requestAnimationFrame(update)));
  const model=$("spleen3d");
  if(model){
    let dragging=false,lastX=0,lastY=0,rx=12,ry=-18;
    const resetView=()=>{rx=12;ry=-18;model.style.animation="spleenFloat 8s ease-in-out infinite";model.style.transform="rotateX(12deg) rotateY(-18deg)";};
    $("spleenViewReset")?.addEventListener("click",resetView);
    model.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;model.setPointerCapture(e.pointerId);});
    model.addEventListener("pointermove",e=>{if(!dragging)return;ry+=(e.clientX-lastX)*.45;rx=Math.max(-15,Math.min(45,rx-(e.clientY-lastY)*.35));lastX=e.clientX;lastY=e.clientY;model.style.animation="none";model.style.transform="rotateX("+rx+"deg) rotateY("+ry+"deg)";});
    model.addEventListener("pointerup",()=>dragging=false);
    model.addEventListener("lostpointercapture",()=>dragging=false);
    model.addEventListener("pointercancel",()=>dragging=false);
  }
  update();
})();