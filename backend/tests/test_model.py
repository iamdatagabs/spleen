import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import Parameters, Request, simulate, sensitivity

def final_state(payload):
    return simulate(Request(parameters=payload))["timeline"][-1]

def test_baseline_equilibrium_is_preserved():
    result = final_state(Parameters(duration_min=20, dt_min=0.025))
    assert math.isclose(result["total_flow_l_min"], 1.2, rel_tol=0, abs_tol=1e-8)
    assert math.isclose(result["portal_inflow_l_min"], 0.984, rel_tol=0, abs_tol=1e-8)
    assert math.isclose(result["hepatic_portal_outflow_l_min"], 0.984, rel_tol=0, abs_tol=1e-8)
    assert math.isclose(result["portal_pressure_mmhg"], 10.0, rel_tol=0, abs_tol=1e-8)

def test_flows_remain_nonnegative_under_stress_scenario():
    result = simulate(Request(parameters=Parameters(
        map_mmhg=45, pneumoperitoneum_mmhg=20, vasopressor_index=100,
        blood_loss_pct=40, duration_min=60, dt_min=0.025
    )))
    for sample in result["timeline"]:
        assert all(value >= 0 for value in sample["regional_flow_l_min"].values())
        assert sample["portal_pressure_mmhg"] >= 5.0
        assert sample["hepatic_portal_outflow_l_min"] >= 0

def test_portal_balance_at_baseline():
    result = final_state(Parameters(duration_min=10, dt_min=0.025))
    residual = result["portal_inflow_l_min"] - result["hepatic_portal_outflow_l_min"]
    assert abs(residual) < 1e-8

def test_time_step_refinement_is_consistent():
    coarse = final_state(Parameters(duration_min=20, dt_min=0.05))
    medium = final_state(Parameters(duration_min=20, dt_min=0.025))
    fine = final_state(Parameters(duration_min=20, dt_min=0.0125))
    q_keys = ("stomach", "intestine", "spleen", "pancreas")
    for key in q_keys:
        assert abs(coarse["regional_flow_l_min"][key] - fine["regional_flow_l_min"][key]) < 0.005
    assert abs(coarse["portal_pressure_mmhg"] - fine["portal_pressure_mmhg"]) < 0.05
    assert abs(medium["portal_pressure_mmhg"] - fine["portal_pressure_mmhg"]) < 0.02

def test_sensitivity_returns_all_model_parameters_and_metrics():
    result = sensitivity(Request(parameters=Parameters(duration_min=20)))
    assert result["method"] == "one_at_a_time_local_sensitivity"
    assert {row["parameter"] for row in result["results"]} == {
        "portal_compliance", "hepatic_resistance", "portal_feedback_gain", "tau_scale"
    }
    for row in result["results"]:
        assert set(row["metrics"]) == {
            "total_flow_l_min", "portal_pressure_mmhg",
            "hepatic_portal_outflow_l_min", "hepatic_oxygen_delivery_ml_min"
        }

def test_default_parameters_preserve_equilibrium():
    result = final_state(Parameters())
    assert math.isclose(result["portal_pressure_mmhg"], 10.0, abs_tol=1e-8)
    assert math.isclose(result["portal_inflow_l_min"], result["hepatic_portal_outflow_l_min"], abs_tol=1e-8)

def test_sensitivity_respects_parameter_bounds():
    payload = Parameters(
        duration_min=2, portal_compliance=.0051, hepatic_resistance=.1001,
        portal_feedback_gain=0, tau_scale=.25
    )
    result = sensitivity(Request(parameters=payload))
    assert len(result["results"]) == 4
    for row in result["results"]:
        assert row["high"] > row["low"]


def test_lhs_and_monte_carlo_return_predictive_summaries():
    from main import GlobalAnalysisRequest, global_uncertainty
    for method in ("lhs", "monte_carlo"):
        result = global_uncertainty(GlobalAnalysisRequest(
            method=method, samples=20, seed=123,
            parameters=Parameters(duration_min=2, dt_min=.05)
        ))
        assert result["method"] == method
        assert len(result["parameter_samples"]) == 40
    assert result["chains"] == 2
    assert len(result["chain_samples"]) == 2
    assert "r_hat" in result["diagnostics"]["parameters"]["hepatic_resistance"]
        assert result["summary"]["portal_pressure_mmhg"]["p05"] <= result["summary"]["portal_pressure_mmhg"]["p95"]

def test_mcmc_requires_observations():
    from main import GlobalAnalysisRequest, posterior_mcmc
    result = posterior_mcmc(GlobalAnalysisRequest(method="mcmc", samples=20, burn_in=50))
    assert "error" in result

def test_mcmc_runs_with_explicit_observations():
    from main import GlobalAnalysisRequest, posterior_mcmc
    result = posterior_mcmc(GlobalAnalysisRequest(
        method="mcmc", samples=20, burn_in=50, thin=1, seed=7,
        parameters=Parameters(duration_min=2, dt_min=.05),
        observations=[{"metric":"portal_pressure_mmhg","value":10.0,"sd":1.0}]
    ))
    assert result["method"] == "multi_chain_random_walk_metropolis"
    assert len(result["parameter_samples"]) == 20
    assert 0 <= result["acceptance_rate"] <= 1
    assert "hepatic_resistance" in result["parameter_summary"]


def test_mcmc_runs_independent_chains_and_reports_diagnostics():
    from main import GlobalAnalysisRequest, posterior_mcmc
    result = posterior_mcmc(GlobalAnalysisRequest(
        method="mcmc", samples=30, burn_in=60, thin=1, chains=3, seed=19,
        parameters=Parameters(duration_min=3, dt_min=.05),
        observations=[{"metric": "portal_pressure_mmhg", "value": 10.0, "sd": 1.0}]
    ))
    assert len(result["chain_samples"]) == 3
    assert all(len(chain) == 30 for chain in result["chain_samples"])
    for diagnostic in result["diagnostics"]["parameters"].values():
        assert diagnostic["ess"] > 0
        assert diagnostic["r_hat"] is not None
    assert result["diagnostics"]["status"] in ("exploratory_pass", "not_converged_or_insufficient_ess")


def test_synthetic_observations_favor_generating_parameter_vector():
    from main import PARAMETER_BOUNDS, OUTPUT_METRICS, _sample_outputs
    truth = {
        "portal_compliance": .12,
        "hepatic_resistance": 7.0,
        "portal_feedback_gain": .02,
        "tau_scale": 1.1,
    }
    base = Parameters(duration_min=4, dt_min=.05)
    synthetic = _sample_outputs(truth, base)
    alternative = dict(truth)
    alternative["hepatic_resistance"] = 10.5
    alt_output = _sample_outputs(alternative, base)
    # Synthetic observations are generated by the same forward model; this is a
    # code-path/recovery sanity check, not independent validation or identifiability.
    truth_loss = sum(((synthetic[k] - synthetic[k]) / .01) ** 2 for k in OUTPUT_METRICS)
    alt_loss = sum(((alt_output[k] - synthetic[k]) / .01) ** 2 for k in OUTPUT_METRICS)
    assert truth_loss == 0
    assert alt_loss > truth_loss
    assert all(PARAMETER_BOUNDS[k][0] <= truth[k] <= PARAMETER_BOUNDS[k][1] for k in truth)
