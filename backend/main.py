import math
"""SPLEEN reference API v0.6.0. Experimental coupled ODE model; not clinically validated."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SPLEEN API", version="0.6.0")
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
    return {"model_version": "0.5.0", "method": "explicit_euler_coupled_ode",
            "dt_min": p.dt_min, "warnings": ["research/education only; not clinically validated"],
            "timeline": timeline}

@app.get("/health")
def health():
    return {"status": "ok", "model_version": "0.6.0"}

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
    return {"model_version": "0.6.0", "method": "one_at_a_time_local_sensitivity",
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
    chains: int = Field(4, ge=2, le=8)

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
    return {"model_version": "0.6.0", "method": request.method,
            "sampling": "independent uniform parameter priors; prior-predictive",
            "samples": request.samples, "seed": request.seed,
            "parameter_bounds": PARAMETER_BOUNDS,
            "summary": _summarize(outputs),
            "parameter_samples": parameter_draws,
            "output_samples": [{k: row[k] for k in OUTPUT_METRICS} for row in outputs],
            "warnings": ["Uniform bounds are exploratory assumptions, not literature-derived distributions.",
                         "Percentiles describe propagated model uncertainty, not clinical confidence intervals."]}

def _split_rhat(chains):
    """Classical split-R-hat; each chain is split into two halves."""
    import math
    split = []
    for chain in chains:
        half = len(chain)//2
        if half < 2:
            return None
        split.extend((chain[:half], chain[-half:]))
    m, n = len(split), len(split[0])
    means = [sum(x)/n for x in split]
    variances = [sum((v-means[i])**2 for v in x)/(n-1) for i,x in enumerate(split)]
    grand = sum(means)/m
    between = n*sum((v-grand)**2 for v in means)/(m-1)
    within = sum(variances)/m
    if within <= 0:
        return 1.0 if between <= 0 else None
    var_hat = ((n-1)/n)*within + between/n
    return math.sqrt(max(0.0, var_hat/within))

def _autocorrelation(values, lag):
    n = len(values)
    mean = sum(values)/n
    denom = sum((x-mean)**2 for x in values)
    if denom <= 0:
        return 0.0
    return sum((values[i]-mean)*(values[i+lag]-mean) for i in range(n-lag))/denom

def _effective_sample_size(chains):
    """Conservative initial-positive-sequence ESS approximation."""
    m, n = len(chains), min(len(c) for c in chains)
    if n < 4:
        return float(m*n)
    rho_sum = 0.0
    for lag in range(1, min(n//2, 1000)):
        rho = sum(_autocorrelation(c[:n], lag) for c in chains)/m
        if rho <= 0:
            break
        rho_sum += rho
    return min(float(m*n), (m*n)/(1+2*rho_sum))


def _matrix_rank(matrix, tolerance=1e-8):
    if not matrix:
        return 0
    a = [list(map(float, row)) for row in matrix]
    rows, cols = len(a), len(a[0])
    scale = max((abs(v) for row in a for v in row), default=1.0)
    tol = tolerance * max(1.0, scale)
    rank = 0
    for col in range(cols):
        pivot = max(range(rank, rows), key=lambda r: abs(a[r][col]), default=rank)
        if rank >= rows or abs(a[pivot][col]) <= tol:
            continue
        a[rank], a[pivot] = a[pivot], a[rank]
        div = a[rank][col]
        a[rank] = [v/div for v in a[rank]]
        for r in range(rows):
            if r != rank:
                factor = a[r][col]
                a[r] = [x-factor*y for x,y in zip(a[r],a[rank])]
        rank += 1
        if rank == rows:
            break
    return rank

@app.post("/api/v1/identifiability")
def identifiability(request: GlobalAnalysisRequest):
    """Local, scaled sensitivity-rank screening; not a proof of structural identifiability."""
    base = request.parameters.model_copy(update={"dt_min": min(request.parameters.dt_min, .01)})
    baseline = _sample_outputs({k: (lo+hi)/2 for k,(lo,hi) in PARAMETER_BOUNDS.items()}, base)
    metrics = OUTPUT_METRICS
    names = tuple(PARAMETER_BOUNDS)
    columns = []
    for name in names:
        lo, hi = PARAMETER_BOUNDS[name]
        center = (lo+hi)/2
        delta = (hi-lo)*1e-3
        low = {k:(a+b)/2 for k,(a,b) in PARAMETER_BOUNDS.items()}
        high = dict(low)
        low[name] = max(lo, center-delta)
        high[name] = min(hi, center+delta)
        yl, yh = _sample_outputs(low, base), _sample_outputs(high, base)
        columns.append([(yh[m]-yl[m])/(high[name]-low[name])*(hi-lo)/max(abs(baseline[m]),1e-8) for m in metrics])
    matrix = [[columns[j][i] for j in range(len(names))] for i in range(len(metrics))]
    norms = [math.sqrt(sum(v*v for v in col)) for col in columns]
    correlations = {}
    for i,a in enumerate(names):
        for j in range(i+1,len(names)):
            b=names[j]
            denom=norms[i]*norms[j]
            correlations[a+"__"+b] = sum(x*y for x,y in zip(columns[i],columns[j]))/denom if denom else None
    rank = _matrix_rank(matrix)
    return {"method":"local_scaled_sensitivity_rank_screen","parameters":names,"metrics":metrics,
            "scaled_sensitivity_matrix":matrix,"column_norms":dict(zip(names,norms)),
            "sensitivity_column_cosines":correlations,"local_rank":rank,
            "maximum_rank":min(len(metrics),len(names)),
            "interpretation":"A deficient or ill-conditioned local sensitivity matrix indicates weakly distinguishable parameter effects for these outputs and this operating point. Full rank does not prove global or structural identifiability.",
            "warnings":["Local finite differences at one operating point only.",
                        "Results depend on selected outputs, scaling, numerical integration and parameter bounds.",
                        "Structural identifiability requires analysis of the full model and observation process."]}

@app.post("/api/v1/prior-sensitivity")
def prior_sensitivity(request: GlobalAnalysisRequest):
    """Compare prior-predictive summaries under contracted, reference and expanded uniform bounds."""
    import random
    base=request.parameters.model_copy(update={"dt_min":min(request.parameters.dt_min,.01)})
    rng=random.Random(request.seed)
    scenarios={}
    for label,factor in (("narrow",.5),("reference",1.0),("wide",1.5)):
        bounds={}
        for name,(lo,hi) in PARAMETER_BOUNDS.items():
            center=(lo+hi)/2
            half=(hi-lo)*factor/2
            bounds[name]=(max(0.0,center-half),center+half)
        draws=[{name:rng.uniform(*bounds[name]) for name in bounds} for _ in range(request.samples)]
        outputs=[_sample_outputs(draw,base) for draw in draws]
        scenarios[label]={"bounds":bounds,"summary":_summarize(outputs)}
    comparison={}
    for metric in OUTPUT_METRICS:
        ref=scenarios["reference"]["summary"][metric]
        comparison[metric]={label:{
            "p05_shift_pct":100*(scenarios[label]["summary"][metric]["p05"]-ref["p05"])/max(abs(ref["p05"]),1e-8),
            "p50_shift_pct":100*(scenarios[label]["summary"][metric]["p50"]-ref["p50"])/max(abs(ref["p50"]),1e-8),
            "p95_shift_pct":100*(scenarios[label]["summary"][metric]["p95"]-ref["p95"])/max(abs(ref["p95"]),1e-8)
        } for label in ("narrow","wide")}
    return {"method":"prior_predictive_sensitivity","samples_per_scenario":request.samples,
            "scenarios":scenarios,"relative_quantile_shifts_vs_reference":comparison,
            "warnings":["Uniform distributions are stress-test assumptions, not evidence-based priors.",
                        "This compares prior-predictive output distributions; it is not posterior robustness analysis."]}

@app.post("/api/v1/synthetic-recovery")
def synthetic_recovery(request: GlobalAnalysisRequest):
    """Preliminary importance-sampling rank/recovery experiment on self-generated synthetic data."""
    import random
    base=request.parameters.model_copy(update={"duration_min":min(request.parameters.duration_min,5.0),
                                               "dt_min":min(request.parameters.dt_min,.01)})
    rng=random.Random(request.seed)
    names=tuple(PARAMETER_BOUNDS)
    metrics=OUTPUT_METRICS
    reps=min(20,max(3,request.samples//20))
    candidate_count=min(500,max(100,request.samples))
    ranks={name:[] for name in names}
    errors={name:[] for name in names}
    importance_ess=[]
    for rep in range(reps):
        truth={name:rng.uniform(*PARAMETER_BOUNDS[name]) for name in names}
        truth_output=_sample_outputs(truth,base)
        sds={metric:max(abs(truth_output[metric])*.03,1e-3) for metric in metrics}
        observed={metric:truth_output[metric]+rng.gauss(0,sds[metric]) for metric in metrics}
        candidates=[{name:rng.uniform(*PARAMETER_BOUNDS[name]) for name in names} for _ in range(candidate_count)]
        log_weights=[]
        for candidate in candidates:
            pred=_sample_outputs(candidate,base)
            log_weights.append(-.5*sum(((pred[m]-observed[m])/sds[m])**2 for m in metrics))
        max_log=max(log_weights)
        weights=[math.exp(v-max_log) for v in log_weights]
        total=sum(weights)
        normalized=[w/total for w in weights]
        importance_ess.append(1/sum(w*w for w in normalized))
        # Weighted empirical posterior ranks: randomized tie handling is not required for continuous draws.
        for name in names:
            rank=sum(w for candidate,w in zip(candidates,normalized) if candidate[name] < truth[name])
            ranks[name].append(rank)
            ordered=sorted((candidate[name],w) for candidate,w in zip(candidates,normalized))
            cumulative=0.0
            median=ordered[-1][0]
            for value,weight in ordered:
                cumulative+=weight
                if cumulative>=.5:
                    median=value
                    break
            errors[name].append(abs(median-truth[name])/(PARAMETER_BOUNDS[name][1]-PARAMETER_BOUNDS[name][0]))
    return {"method":"synthetic_importance_sampling_recovery_rank_check",
            "replications":reps,"prior_candidates_per_replication":candidate_count,
            "rank_fraction_summary":{name:{"mean":sum(v)/len(v),"values":v} for name,v in ranks.items()},
            "normalized_median_absolute_error":{name:sum(v)/len(v) for name,v in errors.items()},
            "importance_sampling_ess":{"mean":sum(importance_ess)/len(importance_ess),"per_replication":importance_ess},
            "synthetic_observation_noise":"independent Gaussian SD = 3% of absolute model output (minimum 0.001 output units)",
            "warnings":["Preliminary SBC-style rank check using finite prior importance sampling, not formal simulation-based calibration.",
                        "Low importance-sampling ESS indicates posterior approximation degeneracy; increase candidate count or use a validated sampler.",
                        "Data are generated and analyzed with the same forward model; this is not independent physiological validation.",
                        "Short simulation horizon and selected observables limit conclusions about parameter recovery."]}

@app.post("/api/v1/mcmc")
def posterior_mcmc(request: GlobalAnalysisRequest):
    """Independent-chain Random-Walk Metropolis with exploratory convergence diagnostics."""
    import math, random
    if not request.observations:
        return {"error": "MCMC requires observations: [{metric, value, sd}, ...]."}
    for obs in request.observations:
        if (obs.get("metric") not in OUTPUT_METRICS
            or not isinstance(obs.get("value"), (int, float))
            or not isinstance(obs.get("sd"), (int, float)) or obs["sd"] <= 0):
            return {"error": "Each observation needs a supported metric, numeric value, and positive sd."}
    base = request.parameters
    names = tuple(PARAMETER_BOUNDS)
    def likelihood(values):
        row = _sample_outputs(values, base)
        ll = 0.0
        for obs in request.observations:
            z = (row[obs["metric"]] - obs["value"]) / obs["sd"]
            ll += -.5*z*z - math.log(obs["sd"])
        return ll, row
    def run_chain(chain_id):
        rng = random.Random(request.seed + 104729*chain_id)
        current = {}
        for name, (lo, hi) in PARAMETER_BOUNDS.items():
            # Dispersed deterministic starts; remain inside the uniform prior.
            fraction = ((chain_id + 1) / (request.chains + 1))
            current[name] = lo + (hi-lo)*fraction
        current_ll, current_out = likelihood(current)
        chain, output_chain, accepted = [], [], 0
        total = request.burn_in + request.samples*request.thin
        proposal_sd = {name: (hi-lo)*.06 for name, (lo, hi) in PARAMETER_BOUNDS.items()}
        for iteration in range(total):
            proposal = {name: current[name] + rng.gauss(0, proposal_sd[name]) for name in names}
            inside = all(PARAMETER_BOUNDS[name][0] <= proposal[name] <= PARAMETER_BOUNDS[name][1] for name in names)
            if inside:
                proposed_ll, proposed_out = likelihood(proposal)
                if math.log(max(rng.random(), 1e-300)) < proposed_ll-current_ll:
                    current, current_ll, current_out = proposal, proposed_ll, proposed_out
                    accepted += 1
            if iteration >= request.burn_in and (iteration-request.burn_in) % request.thin == 0:
                chain.append(dict(current))
                output_chain.append({k: current_out[k] for k in OUTPUT_METRICS})
        return chain, output_chain, accepted/total

    results = [run_chain(i) for i in range(request.chains)]
    parameter_chains = [[row[name] for row in item[0]] for name in names for item in []]
    parameter_diagnostics = {}
    for name in names:
        series = [[row[name] for row in item[0]] for item in results]
        rhat = _split_rhat(series)
        ess = _effective_sample_size(series)
        acf1 = sum(_autocorrelation(c, 1) for c in series)/len(series) if len(series[0]) > 1 else None
        parameter_diagnostics[name] = {"r_hat": rhat, "ess": ess, "autocorrelation_lag1": acf1}
    pooled_outputs = [row for item in results for row in item[1]]
    pooled_params = [row for item in results for row in item[0]]
    valid_rhats = [d["r_hat"] for d in parameter_diagnostics.values() if d["r_hat"] is not None]
    max_rhat = max(valid_rhats) if valid_rhats else None
    min_ess = min(d["ess"] for d in parameter_diagnostics.values())
    converged = max_rhat is not None and max_rhat < 1.05 and min_ess >= 100
    return {"model_version": "0.5.0", "method": "multi_chain_random_walk_metropolis",
            "sampling": "posterior conditional on supplied Gaussian observation errors and uniform bounded priors",
            "chains": request.chains, "samples_per_chain": request.samples,
            "total_samples": len(pooled_params), "burn_in_per_chain": request.burn_in, "thin": request.thin,
            "acceptance_rates": [item[2] for item in results],
            "parameter_bounds": PARAMETER_BOUNDS,
            "posterior_summary": _summarize(pooled_outputs),
            "parameter_summary": {name: _quantiles([x[name] for x in pooled_params]) for name in names},
            "diagnostics": {"parameters": parameter_diagnostics, "max_r_hat": max_rhat,
                            "min_ess": min_ess, "thresholds": {"r_hat": 1.05, "ess": 100},
                            "status": "exploratory_pass" if converged else "not_converged_or_insufficient_ess"},
            "chain_samples": [[{k: row[k] for k in names} for row in item[0]] for item in results],
            "parameter_samples": pooled_params, "output_samples": pooled_outputs,
            "observations": request.observations,
            "warnings": ["R-hat and ESS are approximate diagnostics; passing thresholds is not proof of model validity.",
                         "Single-parameter diagnostics do not establish identifiability or exclude multimodality.",
                         "Results depend on observations, stated standard deviations, uniform bounds and proposal settings.",
                         "This is exploratory computational inference, not a validated clinical pipeline."]}

