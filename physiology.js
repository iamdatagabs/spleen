/* SPLEEN — integrated physiology and experimental alert indicators.
   These thresholds are exploratory model flags, not clinical decision rules. */
(()=> {
  const $ = id => document.getElementById(id);
  const fmt = (n, d=1) => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
  const read = id => Number($(id)?.value ?? 0);
  const readMetric = id => Number(String($(id)?.textContent ?? "0").replace(",",".").replace(/[^0-9.-]/g,"")) || 0;
  const indicator = (name,value,unit,level,description) => ({name,value,unit,level,description});
  function update(){
    const map=read("map"), iap=read("pneu"), app=map-iap;
    const total=readMetric("totalFlow"), portal=readMetric("portalPressure");
    const rows=[...document.querySelectorAll("#regional .region-row")];
    const spleen=rows[2] ? Number(String(rows[2].querySelector(".region-value")?.textContent||"").replace(",",".").replace(/[^0-9.-]/g,""))||0 : total*.13;
    const spleenIndex=spleen/.156*100, totalIndex=total/1.2*100, portalGradient=portal-5;
    $("appValue").textContent=fmt(app,0)+" mmHg";
    $("spleenFlow").textContent=fmt(spleen,3)+" L/min";
    $("spleenIndex").textContent=fmt(spleenIndex,0)+"%";
    $("portalGradient").textContent=fmt(portalGradient,1)+" mmHg";
    const appLevel=app<50?"critical":app<60?"watch":"normal";
    const spleenLevel=spleenIndex<70?"critical":spleenIndex<85?"watch":"normal";
    const portalLevel=portal>20?"critical":portal>15?"watch":"normal";
    const totalLevel=totalIndex<60?"critical":totalIndex<80?"watch":"normal";
    const items=[
      indicator("APP",fmt(app,0),"mmHg",appLevel,"PAM − PIA; limiares exploratórios 50/60 mmHg."),
      indicator("Fluxo esplênico",fmt(spleenIndex,0),"% do basal",spleenLevel,"Estimativa do leito esplênico em relação a 0,156 L/min."),
      indicator("Pressão portal",fmt(portal,1),"mmHg",portalLevel,"Pressão calculada pelo compartimento portal do modelo."),
      indicator("Fluxo esplâncnico",fmt(totalIndex,0),"% do basal",totalLevel,"Fluxo total relativo ao basal de 1,20 L/min.")
    ];
    const severity={normal:0,watch:1,critical:2},worst=items.reduce((a,b)=>severity[b.level]>severity[a.level]?b:a,items[0]);
    $("criticalityIndicators").innerHTML=items.map(x=>'<div class="criticality-item" data-level="'+x.level+'"><span>'+x.name+'</span><strong>'+x.value+' <small>'+x.unit+'</small></strong><small>'+x.description+'</small></div>').join("");
    const status=$("criticalityStatus");status.dataset.level=worst.level;
    status.textContent=worst.level==="critical"?"ALERTA ELEVADO":worst.level==="watch"?"ATENÇÃO":"CENÁRIO FAVORÁVEL";
    $("criticalityHeadline").textContent=worst.level==="critical"?"Um ou mais indicadores ultrapassaram a faixa de alerta elevado do protótipo.":worst.level==="watch"?"Há indicador(es) na faixa intermediária de atenção do protótipo.":"Nenhum dos quatro indicadores ultrapassou as faixas de alerta configuradas.";
    $("criticalityExplanation").textContent="Indicador mais alterado: "+worst.name+". A classificação é calculada a partir das variáveis simuladas e deve ser discutida e recalibrada com especialistas.";
  }
  ["run","reset"].forEach(id=>$(id)?.addEventListener("click",()=>requestAnimationFrame(update)));
  ["map","pneu","vaso","blood","duration"].forEach(id=>$(id)?.addEventListener("input",()=>requestAnimationFrame(update)));
  const model=$("spleen3d");
  if(model){
    let dragging=false,lastX=0,lastY=0,rx=12,ry=-18;
    model.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;model.setPointerCapture(e.pointerId);});
    model.addEventListener("pointermove",e=>{if(!dragging)return;ry+=(e.clientX-lastX)*.45;rx=Math.max(-15,Math.min(45,rx-(e.clientY-lastY)*.35));lastX=e.clientX;lastY=e.clientY;model.style.animation="none";model.style.transform="rotateX("+rx+"deg) rotateY("+ry+"deg)";});
    model.addEventListener("pointerup",()=>dragging=false);
    model.addEventListener("pointercancel",()=>dragging=false);
  }
  update();
  setTimeout(update,150);
})();