"""SPLEEN reference API. Experimental reduced-order model; not clinically validated."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SPLEEN API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
FRACTIONS = (.18, .62, .13, .07)
TAU = (1.8, 2.8, 1.5, 2.2)
NAMES = ("stomach", "intestine", "spleen", "pancreas")

class Parameters(BaseModel):
    map_mmhg: float = Field(85, ge=45, le=120)
    pneumoperitoneum_mmhg: float = Field(12, ge=0, le=20)
    vasopressor_index: float = Field(0, ge=0, le=100)
    blood_loss_pct: float = Field(0, ge=0, le=40)
    duration_min: float = Field(20, ge=1, le=60)
    dt_min: float = Field(.05, ge=.01, le=.1)

class Request(BaseModel):
    parameters: Parameters = Parameters()

def target(p):
    map_eff=max(20,p.map_mmhg+.12*p.vasopressor_index-.45*p.blood_loss_pct)
    dp=max(8,map_eff-.65*p.pneumoperitoneum_mmhg-8)
    total=max(.12,1.2*(dp/69)*(1-.010*p.blood_loss_pct))
    pneu=max(.35,1-.025*p.pneumoperitoneum_mmhg)
    weights=[FRACTIONS[0]*(1+.0015*p.vasopressor_index),FRACTIONS[1]*pneu,FRACTIONS[2]*(1+.0005*p.vasopressor_index),FRACTIONS[3]*(1+.0015*p.vasopressor_index)]
    return [total*w/sum(weights) for w in weights]

@app.get("/health")
def health():
    return {"status":"ok","model_version":"0.1.0"}

@app.post("/api/v1/simulations")
def simulate(request: Request):
    p=request.parameters
    steps=round(p.duration_min/p.dt_min)
    if steps>6000:
        return {"error":"integration step limit exceeded"}
    q=[1.2*f for f in FRACTIONS]
    goal=target(p)
    timeline=[]
    stride=max(1,round(.25/p.dt_min))
    for n in range(steps+1):
        if n%stride==0 or n==steps:
            total=sum(q); portal=q[1]+q[2]+q[3]
            do2=(portal+.2*total)*18.5/10
            timeline.append({"time_min":round(n*p.dt_min,5),"regional_flow_l_min":dict(zip(NAMES,[round(v,6) for v in q])),"total_flow_l_min":round(total,6),"portal_flow_l_min":round(portal,6),"hepatic_oxygen_delivery_ml_min":round(do2,6)})
        q=[v+p.dt_min*(goal[i]-v)/TAU[i] for i,v in enumerate(q)]
    return {"model_version":"0.1.0","method":"explicit_euler","dt_min":p.dt_min,"warnings":["research/education only; not clinically validated"],"timeline":timeline}
