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
    assert math.isclose(result["portal_inflow_l_min"], 1.1784, rel_tol=0, abs_tol=1e-8)
    assert math.isclose(result["hepatic_portal_outflow_l_min"], 1.1784, rel_tol=0, abs_tol=1e-8)
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
    assert abs(result["portal_inflow_l_min"] - result["hepatic_portal_outflow_l_min"]) < 1e-8


def test_time_step_refinement_is_consistent():
    coarse = final_state(Parameters(duration_min=20, dt_min=0.05))
    medium = final_state(Parameters(duration_min=20, dt_min=0.025))
    fine = final_state(Parameters(duration_min=20, dt_min=0.0125))
    for key in ("stomach", "intestine", "spleen", "pancreas"):
        assert abs(coarse["regional_flow_l_min"][key] - fine["regional_flow_l_min"][key]) < 0.005
    assert abs(coarse["portal_pressure_mmhg"] - fine["portal_pressure_mmhg"]) < 0.05
    assert abs(medium["portal_pressure_mmhg"] - fine["portal_pressure_mmhg"]) < 0.02


def test_sensitivity_returns_all_model_parameters_and_metrics():
    result = sensitivity(Request(parameters=Parameters(duration_min=20)))
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
    payload = Parameters(duration_min=2, portal_compliance=.0051, hepatic_resistance=.1001,
                         portal_feedback_gain=0, tau_scale=.25)
    result = sensitivity(Request(parameters=payload))
    assert len(result["results"]) == 4
    assert all(row["high"] > row["low"] for row in result["results"])


def test_lhs_and_monte_carlo_return_predictive_summaries():
    from main import GlobalAnalysisRequest, global_uncertainty
    for method in ("lhs", "monte_carlo"):
        result = global_uncertainty(GlobalAnalysisRequest(
            method=method, samples=20, seed=123,
            parameters=Parameters(duration_min=2, dt_min=.05)
        ))
        assert result["method"] == method
        assert len(result["parameter_samples"]) == 20
        assert result["summary"]["portal_pressure_mmhg"]["p05"] <= result["summary"]["portal_pressure_mmhg"]["p95"]


def test_mcmc_requires_observations():
    from main import GlobalAnalysisRequest, posterior_mcmc
    result = posterior_mcmc(GlobalAnalysisRequest(method="mcmc", samples=20, burn_in=50))
    assert "error" in result


def test_mcmc_runs_with_explicit_observations():
    from main import GlobalAnalysisRequest, posterior_mcmc
    result = posterior_mcmc(GlobalAnalysisRequest(
        method="mcmc", samples=20, burn_in=50, thin=1, seed=7, chains=2,
        parameters=Parameters(duration_min=2, dt_min=.05),
        observations=[{"metric": "portal_pressure_mmhg", "value": 10.0, "sd": 1.0}]
    ))
    assert result["method"] == "multi_chain_random_walk_metropolis"
    assert len(result["parameter_samples"]) == 40
    assert len(result["acceptance_rates"]) == 2
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
    truth = {"portal_compliance": .12, "hepatic_resistance": 7.0,
             "portal_feedback_gain": .02, "tau_scale": 1.1}
    base = Parameters(duration_min=4, dt_min=.05)
    synthetic = _sample_outputs(truth, base)
    alternative = dict(truth)
    alternative["hepatic_resistance"] = 10.5
    alt_output = _sample_outputs(alternative, base)
    truth_loss = sum(((synthetic[k] - synthetic[k]) / .01) ** 2 for k in OUTPUT_METRICS)
    alt_loss = sum(((alt_output[k] - synthetic[k]) / .01) ** 2 for k in OUTPUT_METRICS)
    assert truth_loss == 0
    assert alt_loss > truth_loss
    assert all(PARAMETER_BOUNDS[k][0] <= truth[k] <= PARAMETER_BOUNDS[k][1] for k in truth)


def test_local_identifiability_screen_returns_scaled_jacobian():
    from main import GlobalAnalysisRequest, identifiability
    result = identifiability(GlobalAnalysisRequest(
        samples=20, parameters=Parameters(duration_min=1, dt_min=.05)
    ))
    assert result["method"] == "local_scaled_sensitivity_rank_screen"
    assert len(result["scaled_sensitivity_matrix"]) == 4
    assert 0 <= result["local_rank"] <= result["maximum_rank"]
    assert "hepatic_resistance__portal_feedback_gain" in result["sensitivity_column_cosines"]


def test_prior_sensitivity_compares_three_uniform_scenarios():
    from main import GlobalAnalysisRequest, prior_sensitivity
    result = prior_sensitivity(GlobalAnalysisRequest(
        samples=20, seed=11, parameters=Parameters(duration_min=1, dt_min=.05)
    ))
    assert set(result["scenarios"]) == {"narrow", "reference", "wide"}
    assert "portal_pressure_mmhg" in result["relative_quantile_shifts_vs_reference"]


def test_synthetic_recovery_returns_rank_and_importance_diagnostics():
    from main import GlobalAnalysisRequest, synthetic_recovery
    result = synthetic_recovery(GlobalAnalysisRequest(
        samples=20, seed=23, parameters=Parameters(duration_min=1, dt_min=.05)
    ))
    assert result["replications"] == 3
    assert result["prior_candidates_per_replication"] == 100
    assert set(result["rank_fraction_summary"]) == {
        "portal_compliance", "hepatic_resistance", "portal_feedback_gain", "tau_scale", "gastric_portal_fraction"
    }
    assert result["importance_sampling_ess"]["mean"] > 0


def test_total_flow_equals_sum_of_regional_arterial_flows():
    result = final_state(Parameters(duration_min=8, dt_min=0.025))
    regional_sum = sum(result["regional_flow_l_min"].values())
    assert math.isclose(result["total_flow_l_min"], regional_sum, rel_tol=0, abs_tol=1e-6)


def test_portal_inflow_matches_current_modelled_draining_compartments():
    result = final_state(Parameters(duration_min=8, dt_min=0.025))
    regional = result["regional_flow_l_min"]
    expected = regional["intestine"] + regional["spleen"] + regional["pancreas"]
    expected += result["gastric_portal_inflow_l_min"]
    assert math.isclose(result["portal_inflow_l_min"], expected, rel_tol=0, abs_tol=1e-6)


def test_hepatic_outflow_obeys_pressure_resistance_relation():
    params = Parameters(duration_min=20, dt_min=0.025)
    result = final_state(params)
    expected = max(0.0, (result["portal_pressure_mmhg"] - 5.0) / params.hepatic_resistance)
    assert math.isclose(result["hepatic_portal_outflow_l_min"], expected, rel_tol=0, abs_tol=1e-6)


def test_hepatic_oxygen_delivery_uses_flow_and_content_conversion():
    result = final_state(Parameters(duration_min=12, dt_min=0.025))
    expected = (result["hepatic_portal_outflow_l_min"] + result["hepatic_arterial_flow_l_min"]) * 185.0
    assert math.isclose(result["hepatic_oxygen_delivery_ml_min"], expected, rel_tol=0, abs_tol=1e-5)


def test_gastric_venous_return_is_partitioned_without_double_counting():
    result = final_state(Parameters(duration_min=8, dt_min=0.025, gastric_portal_fraction=0.90))
    stomach = result["regional_flow_l_min"]["stomach"]
    portal = result["gastric_portal_inflow_l_min"]
    systemic = result["gastric_systemic_return_l_min"]
    assert math.isclose(portal, 0.90 * stomach, rel_tol=0, abs_tol=1e-6)
    assert math.isclose(systemic, 0.10 * stomach, rel_tol=0, abs_tol=1e-6)
    assert math.isclose(portal + systemic, stomach, rel_tol=0, abs_tol=1e-6)


def test_gastric_portal_fraction_zero_excludes_gastric_flow_from_portal_return():
    result = final_state(Parameters(duration_min=8, dt_min=0.025, gastric_portal_fraction=0.0))
    assert result["gastric_portal_inflow_l_min"] == 0
    assert math.isclose(result["gastric_systemic_return_l_min"],
                        result["regional_flow_l_min"]["stomach"], abs_tol=1e-6)


def test_gastric_portal_fraction_one_routes_all_gastric_flow_to_portal():
    result = final_state(Parameters(duration_min=8, dt_min=0.025, gastric_portal_fraction=1.0))
    assert math.isclose(result["gastric_portal_inflow_l_min"],
                        result["regional_flow_l_min"]["stomach"], abs_tol=1e-6)
    assert result["gastric_systemic_return_l_min"] == 0


def test_splenic_territory_windkessel_baseline_is_conservative():
    result = final_state(Parameters(duration_min=20, dt_min=0.025))
    territories = result["splenic_territories"]
    assert len(territories) == 3
    assert math.isclose(sum(x["arterial_inflow_l_min"] for x in territories),
                        result["regional_flow_l_min"]["spleen"], abs_tol=1e-6)
    assert math.isclose(sum(x["venous_outflow_l_min"] for x in territories),
                        result["regional_flow_l_min"]["spleen"], abs_tol=1e-6)
    assert all(math.isclose(x["pressure_mmhg"], 10.0, abs_tol=1e-6) for x in territories)


def test_splenic_resistance_asymmetry_creates_transient_pressure_and_outflow_redistribution():
    result = simulate(Request(parameters=Parameters(
        duration_min=8, dt_min=0.01,
        splenic_resistance_superior=2.0,
        splenic_resistance_middle=1.0,
        splenic_resistance_inferior=.5
    )))
    first, last = result["timeline"][0], result["timeline"][-1]
    assert first["splenic_territories"][0]["pressure_mmhg"] == 10.0
    assert last["splenic_territories"][0]["pressure_mmhg"] > last["splenic_territories"][2]["pressure_mmhg"]
    assert math.isclose(sum(x["arterial_inflow_l_min"] for x in last["splenic_territories"]),
                        last["regional_flow_l_min"]["spleen"], abs_tol=2e-6)
    assert math.isclose(sum(x["venous_outflow_l_min"] for x in last["splenic_territories"]),
                        last["splenic_venous_outflow_l_min"], abs_tol=1e-6)


def test_splenic_venous_outflow_drives_portal_inflow_without_double_counting():
    result = final_state(Parameters(duration_min=10, dt_min=0.025,
                                    splenic_resistance_superior=1.8))
    regional = result["regional_flow_l_min"]
    expected = (result["gastric_portal_inflow_l_min"] + regional["intestine"]
                + regional["pancreas"] + result["splenic_venous_outflow_l_min"])
    assert math.isclose(result["portal_inflow_l_min"], expected, abs_tol=1e-6)


def test_distributed_vascular_profiles_have_monotonic_pressure_and_serial_flow():
    result = final_state(Parameters(duration_min=20, dt_min=0.025))
    for territory in result["splenic_territories"]:
        arterial = territory["arterial_path"]
        venous = territory["venous_path"]
        arterial_pressures = [node["pressure_mmhg"] for node in arterial]
        venous_pressures = [node["pressure_mmhg"] for node in venous]
        assert all(a >= b for a, b in zip(arterial_pressures, arterial_pressures[1:]))
        assert all(a >= b for a, b in zip(venous_pressures, venous_pressures[1:]))
        assert math.isclose(arterial_pressures[-1], territory["pressure_mmhg"], abs_tol=1e-6)
        assert math.isclose(venous_pressures[-1], 5.0, abs_tol=1e-6)
        assert all(math.isclose(node["flow_l_min"], territory["arterial_inflow_l_min"], abs_tol=1e-6)
                   for node in arterial)
        assert all(math.isclose(node["flow_l_min"], territory["venous_outflow_l_min"], abs_tol=1e-6)
                   for node in venous)


def test_distributed_pressure_profile_endpoints_follow_effective_arterial_and_venous_pressures():
    result = final_state(Parameters(duration_min=5, dt_min=0.025, map_mmhg=70))
    for territory in result["splenic_territories"]:
        assert math.isclose(territory["arterial_path"][0]["pressure_mmhg"],
                            result["splenic_arterial_source_pressure_mmhg"], abs_tol=1e-6)
        assert math.isclose(territory["arterial_path"][-1]["pressure_mmhg"],
                            territory["pressure_mmhg"], abs_tol=1e-6)
        assert math.isclose(territory["venous_path"][-1]["pressure_mmhg"], 5.0, abs_tol=1e-6)
