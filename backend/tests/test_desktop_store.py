import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop_store import ExperimentCreate, create_experiment, delete_experiment, get_experiment, list_experiments


def test_experiment_round_trip_uses_local_sqlite(tmp_path, monkeypatch):
    monkeypatch.setenv("SPLEEN_DATA_DIR", str(tmp_path))
    payload = ExperimentCreate(
        title="Baseline run",
        model_version="0.9.0",
        inputs={"map_mmhg": 85},
        results={"total_flow_l_min": 1.2},
    )
    created = create_experiment(payload)
    assert created["title"] == "Baseline run"
    assert created["inputs"]["map_mmhg"] == 85
    assert get_experiment(created["id"])["results"]["total_flow_l_min"] == 1.2
    assert list_experiments(10)[0]["id"] == created["id"]
    assert (tmp_path / "experiments.sqlite3").exists()


def test_delete_experiment(tmp_path, monkeypatch):
    monkeypatch.setenv("SPLEEN_DATA_DIR", str(tmp_path))
    created = create_experiment(ExperimentCreate(inputs={}, results={}))
    assert delete_experiment(created["id"]) is True
    assert get_experiment(created["id"]) is None
    assert delete_experiment(created["id"]) is False


def test_payload_size_limit(tmp_path, monkeypatch):
    monkeypatch.setenv("SPLEEN_DATA_DIR", str(tmp_path))
    payload = ExperimentCreate(inputs={"large": "x" * 1_000_100}, results={})
    try:
        create_experiment(payload)
    except ValueError as exc:
        assert "1 MB" in str(exc)
    else:
        raise AssertionError("Oversized experiment should be rejected")
