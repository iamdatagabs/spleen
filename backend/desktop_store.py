"""Local SQLite experiment storage for the SPLEEN desktop application.

This store is intended for local research-session metadata and model outputs only.
Do not store patient identifiers or protected health information.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/desktop", tags=["desktop"])

def database_path() -> Path:
    root = Path(os.environ.get("SPLEEN_DATA_DIR", Path.home() / ".spleen"))
    root.mkdir(parents=True, exist_ok=True)
    return root / "experiments.sqlite3"

def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path(), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("""
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            model_version TEXT NOT NULL,
            inputs_json TEXT NOT NULL,
            results_json TEXT NOT NULL
        )
    """)
    connection.execute("CREATE INDEX IF NOT EXISTS idx_experiments_created ON experiments(created_at DESC)")
    connection.commit()
    return connection

def _decode(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "model_version": row["model_version"],
        "inputs": json.loads(row["inputs_json"]),
        "results": json.loads(row["results_json"]),
    }

class ExperimentCreate(BaseModel):
    title: str = Field(default="Experimento SPLEEN", min_length=1, max_length=100)
    model_version: str = Field(default="unknown", max_length=32)
    inputs: dict[str, Any]
    results: dict[str, Any]

    def validate_payload_size(self) -> None:
        encoded = json.dumps({"inputs": self.inputs, "results": self.results}, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > 1_000_000:
            raise ValueError("Experiment payload exceeds 1 MB")

def create_experiment(payload: ExperimentCreate) -> dict[str, Any]:
    payload.validate_payload_size()
    record = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip() or "Experimento SPLEEN",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model_version": payload.model_version,
        "inputs": payload.inputs,
        "results": payload.results,
    }
    with closing(connect()) as db:
        db.execute(
            "INSERT INTO experiments (id,title,created_at,model_version,inputs_json,results_json) VALUES (?,?,?,?,?,?)",
            (record["id"], record["title"], record["created_at"], record["model_version"],
             json.dumps(record["inputs"], separators=(",", ":")),
             json.dumps(record["results"], separators=(",", ":"))),
        )
        db.commit()
    return record

def list_experiments(limit: int = 50) -> list[dict[str, Any]]:
    with closing(connect()) as db:
        rows = db.execute(
            "SELECT * FROM experiments ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_decode(row) for row in rows]

def get_experiment(experiment_id: str) -> dict[str, Any] | None:
    with connect() as db:
        row = db.execute("SELECT * FROM experiments WHERE id = ?", (experiment_id,)).fetchone()
    return _decode(row) if row else None

def delete_experiment(experiment_id: str) -> bool:
    with connect() as db:
        cursor = db.execute("DELETE FROM experiments WHERE id = ?", (experiment_id,))
        return cursor.rowcount > 0

@router.get("/health")
def desktop_health():
    return {"status": "ok", "service": "spleen-api", "storage": "sqlite-local"}

@router.post("/experiments", status_code=201)
def save_experiment(payload: ExperimentCreate):
    try:
        return create_experiment(payload)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc

@router.get("/experiments")
def experiments(limit: int = 50):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 200")
    return {"items": list_experiments(limit)}

@router.get("/experiments/{experiment_id}")
def experiment(experiment_id: str):
    record = get_experiment(experiment_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return record

@router.delete("/experiments/{experiment_id}", status_code=204)
def remove_experiment(experiment_id: str):
    if not delete_experiment(experiment_id):
        raise HTTPException(status_code=404, detail="Experiment not found")
    return None
