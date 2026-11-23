"""SPLEEN reference API v0.3.0. Experimental coupled ODE model; not clinically validated."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SPLEEN API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
FRACTIONS = (.18, .62, .13, .07)
TAU = (1.8, 2.8, 1.5, 2.2)
NAMES = ("stomach", "intestine", "spleen", "pancreas")
HEPATIC_VENOUS_PRESSURE = 5.0

class Parameters(BaseModel):
    map_mmhg: float = Field(85, ge=45, le=120)
    pneumoperitoneum_mmhg: float = Field(12, ge=0, le=20)
    vasopressor_index: float = Field(0, ge=0, le=100)
    blood_loss_pct: float = Field(0, ge=0, le=40)
    duration_min: float = Field(20, ge=1, le=60)
    dt_min: float = Field(.025, ge=.005, le=.1)
    portal_compliance: float = Field(.08, gt=.005, le=.5, description="L/mmHg; illustrative model parameter")
    hepatic_resistance: float = Field(5.0/.984, gt=.1, le=30, description="mmHg/(L/min); illustrative model parameter")
    portal_feedback_gain: float = Field(.018, ge=0, le=.08, description="dimensionless gain; illustrative")
    tau_scale: float = Field(1.0, ge=.25, le=4, description="multiplier for regional time constants")

class Request(BaseModel):
    parameters: Parameters = Parameters()

def regional_targets(p, portal_pressure):
    map_eff = max(20, p.map_mmhg + .12*p.vasopressor_index - .45*p.blood_loss_pct)
    venous_pressure = max(3, 5 + .20*p.pneumoperitoneum_mmhg)
    perfusion_gradient = max(8, map_eff - venous_pressure - .45*p.pneumoperitoneum_mmhg)
    portal_feedback = max(.65, 1 - p.portal_feedback_gain*(portal_pressure - 10))
    total = max(.12, 1.2*(perfusion_gradient/72.2)*(1-.010*p.blood_loss_pct)*portal_feedback)
    pneu_factor = max(.35, 1-.025*(p.pneumoperitoneum_mmhg-12))
    weights = [FRACTIONS[0]*(1+.0015*p.vasopressor_index),
               FRACTIONS[1]*pneu_factor,
               FRACTIONS[2]*(1+.0005*p.vasopressor_index),
               FRACTIONS[3]*(1+.0015*p.vasopressor_index)]
    return [total*w/sum(weights) for w in weights]

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
        hepatic_out = max(0.0, (portal_pressure-HEPATIC_VENOUS_PRESSURE)/p.hepatic_resistance)
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
        q = [max(0.0, v+p.dt_min*(goal[i]-v)/(TAU[i]*p.tau_scale)) for i, v in enumerate(q)]
        portal_pressure = max(HEPATIC_VENOUS_PRESSURE,
                              portal_pressure+p.dt_min*(portal_in-hepatic_out)/p.portal_compliance)
    return {"model_version": "0.3.0", "method": "explicit_euler_coupled_ode",
            "dt_min": p.dt_min, "warnings": ["research/education only; not clinically validated"],
            "timeline": timeline}

@app.get("/health")
def health():
    return {"status": "ok", "model_version": "0.3.0"}

@app.post("/api/v1/simulations")
def run_simulation(request: Request):
    return simulate(request)

@app.post("/api/v1/sensitivity")
def sensitivity(request: Request):
    """One-at-a-time local sensitivity; ±10% for model coefficients, other inputs fixed."""
    base_p = request.parameters
    baseline = simulate(Request(parameters=base_p))["timeline"][-1]
    metrics = ("total_flow_l_min", "portal_pressure_mmhg",
               "hepatic_portal_outflow_l_min", "hepatic_oxygen_delivery_ml_min")
    parameters = ("portal_compliance", "hepatic_resistance", "portal_feedback_gain", "tau_scale")
    results = []
    for name in parameters:
        value = getattr(base_p, name)
        delta = max(abs(value)*.10, 1e-6)
        low_value, high_value = max(delta, value-delta), value+delta
        low_p = base_p.model_copy(update={name: low_value})
        high_p = base_p.model_copy(update={name: high_value})
        low = simulate(Request(parameters=low_p))["timeline"][-1]
        high = simulate(Request(parameters=high_p))["timeline"][-1]
        row = {"parameter": name, "baseline": value, "low": low_value, "high": high_value, "metrics": {}}
        for metric in metrics:
            denominator = high_value-low_value
            derivative = (high[metric]-low[metric])/denominator
            elasticity = derivative*value/baseline[metric] if baseline[metric] else None
            row["metrics"][metric] = {
                "baseline": baseline[metric], "low": low[metric], "high": high[metric],
                "relative_change_pct": ((high[metric]-low[metric])/baseline[metric]*100) if baseline[metric] else None,
                "normalized_elasticity": elasticity
            }
        results.append(row)
    return {"model_version": "0.3.0", "method": "one_at_a_time_local_sensitivity",
            "perturbation": "±10% (bounded by parameter constraints)", "baseline": baseline,
            "results": results,
            "warnings": ["Local sensitivity only; not a global uncertainty analysis.",
                         "Perturbation ranges and coefficients are illustrative, not empirical or clinically calibrated."]}
