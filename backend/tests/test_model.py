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
