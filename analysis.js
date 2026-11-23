/* SPLEEN v0.4.0 — browser-side global uncertainty and exploratory Bayesian inference. */
(()=> {
const $=id=>document.getElementById(id);
const names=["portal_compliance","hepatic_resistance","portal_feedback_gain","tau_scale"];
const bounds={portal_compliance:[.01,.30],hepatic_resistance:[2,12],portal_feedback_gain:[.002,.05],tau_scale:[.5,2]};
const labels={portal_compliance:"Complacência portal (L/mmHg)",hepatic_resistance:"Resistência hepática (mmHg·min/L)",portal_feedback_gain:"Ganho de feedback portal",tau_scale:"Escala das constantes de tempo"};
const metrics=["total_flow_l_min","portal_pressure_mmhg","hepatic_portal_outflow_l_min","hepatic_oxygen_delivery_ml_min"];
const metricLabels={total_flow_l_min:"Fluxo esplâncnico total (L/min)",portal_pressure_mmhg:"Pressão portal (mmHg)",hepatic_portal_outflow_l_min:"Saída portal-hepática (L/min)",hepatic_oxygen_delivery_ml_min:"Entrega hepática de O₂ (mL/min)"};
let latest=null;
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function quantile(values,q){const a=[...values].sort((x,y)=>x-y),p=(a.length-1)*q,l=Math.floor(p),h=Math.min(l+1,a.length-1);return a[l]+(a[h]-a[l])*(p-l);}
function summarize(rows,keys){const out={};keys.forEach(k=>{const a=rows.map(r=>r[k]);out[k]={p05:quantile(a,.05),p50:quantile(a,.5),p95:quantile(a,.95),mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};});return out;}
function simulateFinal(p,struct){const fr=[.18,.62,.13,.07],taus=[1.8,2.8,1.5,2.2],dt=.05,steps=Math.round(p.duration/dt);let q=fr.map(f=>1.2*f),portal=10;
for(let n=0;n<steps;n++){const pin=q[1]+q[2]+q[3],out=Math.max(0,(portal-5)/struct.hepatic_resistance),mapEff=Math.max(20,p.map+.12*p.vaso-.45*p.blood),ven=Math.max(3,5+.2*p.pneu),grad=Math.max(8,mapEff-ven-.45*p.pneu),fb=Math.max(.65,1-struct.portal_feedback_gain*(portal-10)),total=Math.max(.12,1.2*(grad/72.2)*(1-.01*p.blood)*fb),pf=Math.max(.35,1-.025*(p.pneu-12)),w=[fr[0]*(1+.0015*p.vaso),fr[1]*pf,fr[2]*(1+.0005*p.vaso),fr[3]*(1+.0015*p.vaso)],ws=w.reduce((a,b)=>a+b,0),goal=w.map(x=>total*x/ws);
q=q.map((v,i)=>Math.max(0,v+dt*(goal[i]-v)/(taus[i]*struct.tau_scale)));
portal=Math.max(5,portal+dt*(pin-out)/struct.portal_compliance);
}
const total=q.reduce((a,b)=>a+b,0),pin=q[1]+q[2]+q[3],out=Math.max(0,(portal-5)/struct.hepatic_resistance),ha=.2*total*Math.min(1.3,Math.max(.7,1+.03*(10-portal)));
return {total_flow_l_min:total,portal_pressure_mmhg:portal,hepatic_portal_outflow_l_min:out,hepatic_oxygen_delivery_ml_min:(out+ha)*185};}
function baseInputs(){return {map:Number($("map").value),pneu:Number($("pneu").value),vaso:Number($("vaso").value),blood:Number($("blood").value),duration:Number($("duration").value)};}
function drawParams(rng){const x={};names.forEach(k=>{const [lo,hi]=bounds[k];x[k]=lo+rng()*(hi-lo);});return x;}
function lhs(n,seed){let s=seed>>>0;const rng=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;},cols={};names.forEach(k=>{const [lo,hi]=bounds[k],a=Array.from({length:n},(_,i)=>(i+rng())/n);for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}cols[k]=a.map(x=>lo+x*(hi-lo));});return Array.from({length:n},(_,i)=>Object.fromEntries(names.map(k=>[k,cols[k][i]])));}
function mc(n,seed){let s=seed>>>0;const rng=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};return Array.from({length:n},()=>drawParams(rng));}
function validateObs(text){const obs=JSON.parse(text);if(!Array.isArray(obs)||!obs.length)throw Error("Informe uma lista JSON com ao menos uma observação.");obs.forEach(o=>{if(!metrics.includes(o.metric)||!Number.isFinite(o.value)||!Number.isFinite(o.sd)||o.sd<=0)throw Error("Cada observação precisa de metric válida, value numérico e sd positivo.");});return obs;}
function runMCMC(n,burn,thin,seed,p,obs){
const chainCount=4,allChains=[],allOutputs=[],rates=[];
const logLike=x=>{const y=simulateFinal(p,x);return obs.reduce((sum,o)=>{const z=(y[o.metric]-o.value)/o.sd;return sum-.5*z*z-Math.log(o.sd);},0);};
for(let c=0;c<chainCount;c++){
let s=(seed+104729*c)>>>0;const rng=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;},normal=()=>{let u=0,v=0;while(!u)u=rng();while(!v)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const state={};names.forEach(k=>{const [lo,hi]=bounds[k];state[k]=lo+(hi-lo)*(c+1)/(chainCount+1);});
let ll=logLike(state),accepted=0,chain=[],outputs=[],total=burn+n*thin;
for(let i=0;i<total;i++){const proposal={};names.forEach(k=>{const [lo,hi]=bounds[k];proposal[k]=state[k]+normal()*(hi-lo)*.06;});
const inside=names.every(k=>proposal[k]>=bounds[k][0]&&proposal[k]<=bounds[k][1]);
if(inside){const next=logLike(proposal);if(Math.log(Math.max(rng(),1e-300))<next-ll){Object.assign(state,proposal);ll=next;accepted++;}}
if(i>=burn&&(i-burn)%thin===0){chain.push({...state});outputs.push(simulateFinal(p,state));}}
allChains.push(chain);allOutputs.push(outputs);rates.push(accepted/total);
}
const pooled=allChains.flat(),outputs=allOutputs.flat();
function acf(x,lag){const mean=x.reduce((a,b)=>a+b,0)/x.length,den=x.reduce((a,b)=>a+(b-mean)**2,0);return den?x.slice(0,x.length-lag).reduce((a,v,i)=>a+(v-mean)*(x[i+lag]-mean),0)/den:0;}
function rhat(series){const split=[];series.forEach(x=>{const h=Math.floor(x.length/2);if(h<2)return;split.push(x.slice(0,h),x.slice(-h));});if(split.length<4)return null;const n=split[0].length,m=split.length,means=split.map(x=>x.reduce((a,b)=>a+b,0)/n),vars=split.map((x,i)=>x.reduce((a,b)=>a+(b-means[i])**2,0)/(n-1)),grand=means.reduce((a,b)=>a+b,0)/m,W=vars.reduce((a,b)=>a+b,0)/m,B=n*means.reduce((a,b)=>a+(b-grand)**2,0)/(m-1);return W===0?(B===0?1:Infinity):Math.sqrt(Math.max(0,(((n-1)/n)*W+B/n)/W));}
const diagnostics={};names.forEach(k=>{const series=allChains.map(ch=>ch.map(row=>row[k])),rho=series.reduce((a,x)=>a+acf(x,1),0)/series.length;let sum=0;for(let lag=1;lag<Math.min(100,Math.floor(n/2));lag++){const r=series.reduce((a,x)=>a+acf(x,lag),0)/series.length;if(r<=0)break;sum+=r;}diagnostics[k]={r_hat:rhat(series),ess:Math.min(chainCount*n,chainCount*n/(1+2*sum)),autocorrelation_lag1:rho};});
return {chain:pooled,outputs,chains:allChains,acceptance:rates.reduce((a,b)=>a+b,0)/rates.length,acceptanceByChain:rates,diagnostics};
}
function fmt(x){return Number(x).toLocaleString("pt-BR",{maximumFractionDigits:4});}
function drawTrace(samples){const wrap=$("traceWrap"),canvas=$("mcmcTrace");wrap.style.display="block";const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(180*dpr));const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);const w=rect.width,h=180,pad={l:34,r:10,t:12,b:22},colors=["#58d6c2","#69a9ff","#f4bd67","#d98bc1"];ctx.strokeStyle="#263c4e";ctx.fillStyle="#91a6b5";ctx.font="10px system-ui";for(let j=0;j<=4;j++){const y=pad.t+(h-pad.t-pad.b)*j/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((1-j/4).toFixed(2),4,y+3);}const chains=Array.isArray(samples[0])?samples:[samples];names.forEach((name,k)=>{const [lo,hi]=bounds[name];chains.forEach((chain,c)=>{ctx.beginPath();ctx.strokeStyle=colors[k];ctx.globalAlpha=.35+.12*(c%4);ctx.lineWidth=1.2;chain.forEach((sample,i)=>{const x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,chain.length-1),y=pad.t+(h-pad.t-pad.b)*(1-(sample[name]-lo)/(hi-lo));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});});ctx.globalAlpha=1;}
function render(result,method){const trace=$("traceWrap");trace.style.display=result.method==="mcmc"?"block":"none";if(result.method==="mcmc")drawTrace(window.__spleenMcmcChains||[result.parameterSamples]);const s=result.summary,html=metrics.map(k=>{const v=s[k],span=Math.max(1e-9,v.p95-v.p05),left=100*(v.p05-v.min)/Math.max(1e-9,v.max-v.min),width=100*span/Math.max(1e-9,v.max-v.min);return '<div class="uq-metric"><div class="uq-metric-head"><b>'+metricLabels[k]+'</b><strong>'+fmt(v.p50)+'</strong></div><div class="uq-range"><i style="left:'+left+'%;width:'+width+'%"></i></div><div class="uq-quantiles"><span>mín '+fmt(v.min)+'</span><span>P05 '+fmt(v.p05)+'</span><span>P95 '+fmt(v.p95)+'</span><span>máx '+fmt(v.max)+'</span></div><small>Média: '+fmt(v.mean)+'</small></div>';}).join("");
$("uqSummary").innerHTML=html;
const paramRows=names.map(k=>{const v=result.parameterSummary[k];return '<div class="uq-param"><span>'+labels[k]+'</span><b>'+fmt(v.p50)+'</b><small>P05 '+fmt(v.p05)+' · P95 '+fmt(v.p95)+'</small></div>';}).join("");
$("uqParameters").innerHTML=paramRows;
$("uqDiagnostics").innerHTML='<p><b>Método:</b> '+method+' · <b>Amostras analisadas:</b> '+result.outputs.length+(result.acceptance!==undefined?' · <b>Aceitação média MCMC:</b> '+(100*result.acceptance).toFixed(1)+'%':'')+'</p>'+(result.method==="mcmc"?'<p><b>Diagnósticos (4 cadeias):</b> '+Object.entries(window.__spleenMcmcDiagnostics||{}).map(([k,v])=>k+': R-hat '+fmt(v.r_hat)+', ESS '+fmt(v.ess)+', ρ₁ '+fmt(v.autocorrelation_lag1)).join(' · ')+'</p><small>Diagnósticos exploratórios; não comprovam convergência nem validade fisiológica.</small>':'');
latest=result;$("uqCsv").disabled=false;}
function run(){const method=$("uqMethod").value,n=Number($("uqSamples").value),burn=Number($("uqBurn").value),thin=Number($("uqThin").value),seed=Number($("uqSeed").value)||0,p=baseInputs();$("runUQ").disabled=true;$("uqStatus").textContent="Executando "+method.toUpperCase()+"…";
setTimeout(()=>{try{let draws,outputs,acceptance,obs=null;if(method==="lhs")draws=lhs(n,seed);else if(method==="mc")draws=mc(n,seed);else{obs=validateObs($("uqObservations").value);const r=runMCMC(n,burn,thin,seed,p,obs);draws=r.chain;outputs=r.outputs;acceptance=r.acceptance;window.__spleenMcmcDiagnostics=r.diagnostics;window.__spleenMcmcChains=r.chains;}
if(method!=="mcmc")outputs=draws.map(d=>simulateFinal(p,d));
const result={method,outputs,parameterSamples:draws,parameterSummary:summarize(draws,names),summary:summarize(outputs,metrics),acceptance,observations:obs};
render(result,method==="lhs"?"Latin Hypercube Sampling":method==="mc"?"Monte Carlo":"Random-walk Metropolis MCMC");
$("uqStatus").textContent="Concluído. Resultados condicionados às faixas e hipóteses selecionadas.";}catch(e){$("uqStatus").textContent="Não foi possível executar: "+e.message;}finally{$("runUQ").disabled=false;}},30);}
function exportCsv(){if(!latest)return;const rows=[["sample",...names,...metrics].join(",")];latest.outputs.forEach((o,i)=>rows.push([i+1,...names.map(k=>latest.parameterSamples[i][k]),...metrics.map(k=>o[k])].join(",")));const blob=new Blob([rows.join("\n")],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="spleen-global-analysis-"+latest.method+".csv";a.click();URL.revokeObjectURL(url);}
function toggle(){const m=$("uqMethod").value,is=$("observationPanel");is.style.display=m==="mcmc"?"block":"none";$("burnControl").style.display=m==="mcmc"?"block":"none";$("thinControl").style.display=m==="mcmc"?"block":"none";}
const valueTargets={uqSamples:"sampleValue",uqBurn:"burnValue",uqThin:"thinValue"};Object.entries(valueTargets).forEach(([id,target])=>$(id).addEventListener("input",()=>{$(target).textContent=$(id).value;}));
$("uqMethod").addEventListener("change",toggle);$("runUQ").addEventListener("click",run);$("uqCsv").addEventListener("click",exportCsv);toggle();
})();