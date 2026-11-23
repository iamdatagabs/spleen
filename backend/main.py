"""SPLEEN reference API v0.4.0. Experimental coupled ODE model; not clinically validated."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SPLEEN API", version="0.4.0")
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
    return {"model_version": "0.4.0", "method": "explicit_euler_coupled_ode",
            "dt_min": p.dt_min, "warnings": ["research/education only; not clinically validated"],
            "timeline": timeline}

@app.get("/health")
def health():
    return {"status": "ok", "model_version": "0.4.0"}

@app.post("/api/v1/simulations")
def run_simulation(request: Request):
    return simulate(request)

@app.post("/api/v1/sensitivity")
def sensitivity(request: Request):
    """One-at-a-time local sensitivity; ±10% for model coefficients, other inputs fixed."""
    base_p = request.parameters.model_copy(update={"dt_min": min(request.parameters.dt_min, .0025)})
    baseline = simulate(Request(parameters=base_p))["timeline"][-1]
    metrics = ("total_flow_l_min", "portal_pressure_mmhg",
               "hepatic_portal_outflow_l_min", "hepatic_oxygen_delivery_ml_min")
    bounds = {"portal_compliance": (.005, .5), "hepatic_resistance": (.1, 30),
              "portal_feedback_gain": (0, .08), "tau_scale": (.25, 4)}
    parameters = tuple(bounds)
    results = []
    for name in parameters:
        value = getattr(base_p, name)
        delta = max(abs(value)*.10, 1e-6)
        lower_bound, upper_bound = bounds[name]
        low_value = max(lower_bound, value-delta)
        high_value = min(upper_bound, value+delta)
        if high_value <= low_value:
            high_value = min(upper_bound, low_value + max(delta, 1e-6))
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
    return {"model_version": "0.4.0", "method": "one_at_a_time_local_sensitivity",
            "perturbation": "±10% (bounded by parameter constraints)", "baseline": baseline,
            "results": results,
            "warnings": ["Local sensitivity only; not a global uncertainty analysis.",
                         "Perturbation ranges and coefficients are illustrative, not empirical or clinically calibrated."]}


PARAMETER_BOUNDS = {
    "portal_compliance": (.01, .30),
    "hepatic_resistance": (2.0, 12.0),
    "portal_feedback_gain": (.002, .05),
    "tau_scale": (.5, 2.0),
}
OUTPUT_METRICS = (
    "total_flow_l_min", "portal_pressure_mmhg",
    "hepatic_portal_outflow_l_min", "hepatic_oxygen_delivery_ml_min",
)

class GlobalAnalysisRequest(BaseModel):
    parameters: Parameters = Parameters()
    method: str = Field("lhs", pattern="^(lhs|monte_carlo|mcmc)$")
    samples: int = Field(300, ge=20, le=3000)
    seed: int = Field(2026, ge=0, le=2147483647)
    burn_in: int = Field(500, ge=50, le=5000)
    thin: int = Field(2, ge=1, le=50)
    observations: list[dict] = Field(default_factory=list)

def _uniform_parameters(rng, base, values):
    return base.model_copy(update=values)

def _latin_hypercube(rng, n, bounds):
    cols = {}
    for name, (lo, hi) in bounds.items():
        strata = [(i + rng.random()) / n for i in range(n)]
        rng.shuffle(strata)
        cols[name] = [lo + x * (hi-lo) for x in strata]
    return [{name: cols[name][i] for name in bounds} for i in range(n)]

def _sample_outputs(params, base):
    stable_base = base.model_copy(update={"dt_min": min(base.dt_min, .0025)})
    p = _uniform_parameters(None, stable_base, params)
    out = simulate(Request(parameters=p))
    if "error" in out:
        raise ValueError(out["error"])
    return out["timeline"][-1]

def _quantiles(values):
    vals = sorted(float(v) for v in values)
    def pct(q):
        pos = (len(vals)-1)*q
        lo = int(pos); hi = min(lo+1, len(vals)-1)
        return vals[lo] + (vals[hi]-vals[lo])*(pos-lo)
    return {"p05": pct(.05), "p50": pct(.50), "p95": pct(.95),
            "mean": sum(vals)/len(vals), "min": vals[0], "max": vals[-1]}

def _summarize(rows):
    summary = {}
    for metric in OUTPUT_METRICS:
        summary[metric] = _quantiles([row[metric] for row in rows])
    return summary

@app.post("/api/v1/uncertainty")
def global_uncertainty(request: GlobalAnalysisRequest):
    """Prior-predictive global uncertainty using LHS or ordinary Monte Carlo."""
    import random
    rng = random.Random(request.seed)
    if request.method not in ("lhs", "monte_carlo"):
        return {"error": "Use lhs or monte_carlo for prior-predictive uncertainty."}
    base = request.parameters
    if request.method == "lhs":
        draws = _latin_hypercube(rng, request.samples, PARAMETER_BOUNDS)
    else:
        draws = [{name: rng.uniform(lo, hi) for name, (lo, hi) in PARAMETER_BOUNDS.items()}
                 for _ in range(request.samples)]
    outputs, parameter_draws = [], []
    for draw in draws:
        outputs.append(_sample_outputs(draw, base))
        parameter_draws.append(draw)
    return {"model_version": "0.4.0", "method": request.method,
            "sampling": "independent uniform parameter priors; prior-predictive",
            "samples": request.samples, "seed": request.seed,
            "parameter_bounds": PARAMETER_BOUNDS,
            "summary": _summarize(outputs),
            "parameter_samples": parameter_draws,
            "output_samples": [{k: row[k] for k in OUTPUT_METRICS} for row in outputs],
            "warnings": ["Uniform bounds are exploratory assumptions, not literature-derived distributions.",
                         "Percentiles describe propagated model uncertainty, not clinical confidence intervals."]}

@app.post("/api/v1/mcmc")
def posterior_mcmc(request: GlobalAnalysisRequest):
    """Random-walk Metropolis posterior inference against explicitly supplied observations."""
    import math, random
    if not request.observations:
        return {"error": "MCMC requires observations: [{metric, value, sd}, ...]."}
    for obs in request.observations:
        if obs.get("metric") not in OUTPUT_METRICS or not isinstance(obs.get("value"), (int, float)) or not isinstance(obs.get("sd"), (int, float)) or obs["sd"] <= 0:
            return {"error": "Each observation needs a supported metric, numeric value, and positive sd."}
    rng = random.Random(request.seed)
    base = request.parameters
    names = tuple(PARAMETER_BOUNDS)
    def likelihood(values):
        row = _sample_outputs(values, base)
        ll = 0.0
        for obs in request.observations:
            z = (row[obs["metric"]] - obs["value"]) / obs["sd"]
            ll += -.5*z*z - math.log(obs["sd"])
        return ll, row
    current = {name: (lo+hi)/2 for name, (lo, hi) in PARAMETER_BOUNDS.items()}
    current_ll, current_out = likelihood(current)
    chain, output_chain, accepted = [], [], 0
    total = request.burn_in + request.samples*request.thin
    proposal_sd = {name: (hi-lo)*.06 for name, (lo, hi) in PARAMETER_BOUNDS.items()}
    for iteration in range(total):
        proposal = {name: current[name] + rng.gauss(0, proposal_sd[name]) for name in names}
        in_bounds = all(PARAMETER_BOUNDS[name][0] <= proposal[name] <= PARAMETER_BOUNDS[name][1] for name in names)
        if in_bounds:
            proposed_ll, proposed_out = likelihood(proposal)
            if math.log(max(rng.random(), 1e-300)) < proposed_ll-current_ll:
                current, current_ll, current_out = proposal, proposed_ll, proposed_out
                accepted += 1
        if iteration >= request.burn_in and (iteration-request.burn_in) % request.thin == 0:
            chain.append(dict(current))
            output_chain.append({k: current_out[k] for k in OUTPUT_METRICS})
    return {"model_version": "0.4.0", "method": "random_walk_metropolis",
            "sampling": "posterior conditional on supplied Gaussian observation errors and uniform bounded priors",
            "samples": len(chain), "burn_in": request.burn_in, "thin": request.thin,
            "acceptance_rate": accepted/total, "parameter_bounds": PARAMETER_BOUNDS,
            "posterior_summary": _summarize(output_chain),
            "parameter_summary": {name: _quantiles([x[name] for x in chain]) for name in names},
            "parameter_samples": chain, "output_samples": output_chain,
            "observations": request.observations,
            "warnings": ["Posterior results depend on the supplied observations, stated standard deviations, priors and proposal settings.",
                         "Check convergence with multiple chains, trace plots, effective sample size and R-hat before scientific inference.",
                         "This implementation is an exploratory single-chain Metropolis sampler, not a validated clinical inference pipeline."]}
