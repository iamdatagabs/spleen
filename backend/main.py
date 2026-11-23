"""SPLEEN reference API v0.2.0. Experimental coupled ODE model; not clinically validated."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SPLEEN API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
FRACTIONS = (.18, .62, .13, .07)
TAU = (1.8, 2.8, 1.5, 2.2)
NAMES = ("stomach", "intestine", "spleen", "pancreas")
PORTAL_COMPLIANCE = .08  # L/mmHg, illustrative
HEPATIC_VENOUS_PRESSURE = 5.0  # mmHg, illustrative
HEPATIC_RESISTANCE = 5.0 / .984  # mmHg/(L/min), chosen for baseline equilibrium

class Parameters(BaseModel):
    map_mmhg: float = Field(85, ge=45, le=120)
    pneumoperitoneum_mmhg: float = Field(12, ge=0, le=20)
    vasopressor_index: float = Field(0, ge=0, le=100)
    blood_loss_pct: float = Field(0, ge=0, le=40)
    duration_min: float = Field(20, ge=1, le=60)
    dt_min: float = Field(.025, ge=.005, le=.1)

class Request(BaseModel):
    parameters: Parameters = Parameters()

def regional_targets(p, portal_pressure):
    map_eff = max(20, p.map_mmhg + .12*p.vasopressor_index - .45*p.blood_loss_pct)
    venous_pressure = max(3, 5 + .20*p.pneumoperitoneum_mmhg)
    perfusion_gradient = max(8, map_eff - venous_pressure - .45*p.pneumoperitoneum_mmhg)
    portal_feedback = max(.65, 1 - .018*(portal_pressure - 10))
    total = max(.12, 1.2*(perfusion_gradient/72.2)*(1-.010*p.blood_loss_pct)*portal_feedback)
    pneu_factor = max(.35, 1-.025*(p.pneumoperitoneum_mmhg-12))
    weights = [FRACTIONS[0]*(1+.0015*p.vasopressor_index),
               FRACTIONS[1]*pneu_factor,
               FRACTIONS[2]*(1+.0005*p.vasopressor_index),
               FRACTIONS[3]*(1+.0015*p.vasopressor_index)]
    return [total*w/sum(weights) for w in weights]

@app.get("/health")
def health():
    return {"status": "ok", "model_version": "0.2.0"}

@app.post("/api/v1/simulations")
def simulate(request: Request):
    p = request.parameters
    steps = round(p.duration_min/p.dt_min)
    if steps > 12000:
        return {"error": "integration step limit exceeded"}
    q = [1.2*f for f in FRACTIONS]
    portal_pressure = 10.0
    timeline = []
    stride = max(1, round(.25/p.dt_min))
    for n in range(steps+1):
        portal_in = q[1] + q[2] + q[3]
        hepatic_out = max(0.0, (portal_pressure-HEPATIC_VENOUS_PRESSURE)/HEPATIC_RESISTANCE)
        total = sum(q)
        hepatic_arterial = .2*total*min(1.3, max(.7, 1+.03*(10-portal_pressure)))
        if n % stride == 0 or n == steps:
            timeline.append({
                "time_min": round(n*p.dt_min, 5),
                "regional_flow_l_min": dict(zip(NAMES, [round(v, 6) for v in q])),
                "total_flow_l_min": round(total, 6),
                "portal_inflow_l_min": round(portal_in, 6),
                "portal_pressure_mmhg": round(portal_pressure, 6),
                "hepatic_portal_outflow_l_min": round(hepatic_out, 6),
                "hepatic_arterial_flow_l_min": round(hepatic_arterial, 6),
                "hepatic_oxygen_delivery_ml_min": round((hepatic_out+hepatic_arterial)*185, 6)
            })
        goal = regional_targets(p, portal_pressure)
        q = [max(0.0, v+p.dt_min*(goal[i]-v)/TAU[i]) for i, v in enumerate(q)]
        portal_pressure = max(HEPATIC_VENOUS_PRESSURE,
                              portal_pressure+p.dt_min*(portal_in-hepatic_out)/PORTAL_COMPLIANCE)
    return {"model_version": "0.2.0", "method": "explicit_euler_coupled_ode",
            "dt_min": p.dt_min, "warnings": ["research/education only; not clinically validated"],
            "timeline": timeline}
