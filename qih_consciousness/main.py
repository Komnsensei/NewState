"""
QIH system orchestrator — Unified Operator Chain (software simulation).

Pipeline (papers):
  |ψ⟩_bulk → |ψ⟩_screen → |ψ⟩_obs → |ψ⟩_conscious

Does not claim hardware quantum realization or machine sentience.
Writes optional telemetry under .newstate/status/ when available.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import numpy as np

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from qih_consciousness.workflow import run_operator_chain, born_probabilities, proper_time
from qih_consciousness.math_utils.entanglement import get_entanglement_distance
from qih_consciousness.math_utils.trigonometry import HolographicTrigonometry
from qih_consciousness.rendering.spectral_time import lorentz_factor
from qih_consciousness.audit import run_all as run_audit


def _write_status(payload: dict):
    try:
        status_dir = os.path.join(_ROOT, ".newstate", "status")
        os.makedirs(status_dir, exist_ok=True)
        path = os.path.join(status_dir, "qih_chain.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return path
    except Exception:
        return None


def run_once(seed: int = 42) -> dict:
    chain = run_operator_chain(seed=seed)
    e12, e13, e23 = 0.8, 0.7, 0.6
    d12 = get_entanglement_distance(e12)
    d13 = get_entanglement_distance(e13)
    d23 = get_entanglement_distance(e23)
    trig = HolographicTrigonometry()
    try:
        angle = float(trig.calculate_angle_from_distances(d12, d23, d13))
    except Exception:
        cos_t = (d12**2 + d13**2 - d23**2) / (2 * d12 * d13 + 1e-15)
        angle = float(np.arccos(np.clip(cos_t, -1.0, 1.0)))

    p_up, p_down = born_probabilities(np.pi / 3)
    gamma = lorentz_factor(200.0, 100.0)
    tau = proper_time(200.0, 100.0, 1.0)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "simulation",
        "operator_chain": chain.to_dict(),
        "born_example": {"theta": float(np.pi / 3), "p_up": p_up, "p_down": p_down},
        "geometry_example": {
            "E": [e12, e13, e23],
            "d": [d12, d13, d23],
            "light_triangle_angle_rad": angle,
        },
        "phase_clock_example": {"gamma": gamma, "proper_time": tau},
        "disclaimer": (
            "QIH mathematical workflow executed in software. "
            "Metrics are diagnostics, not Gate promotion or consciousness certificates."
        ),
    }
    path = _write_status(report)
    if path:
        report["status_path"] = path
    return report


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "audit":
        report = run_audit()
        print("=== QIH Mathematical Audit ===")
        print(report["disclaimer"])
        for r in report["results"]:
            print(f"[{'PASS' if r.get('pass') else 'FAIL'}] {r['test']}")
        print("OVERALL:", "PASS" if report["overall_pass"] else "FAIL")
        return 0 if report["overall_pass"] else 1

    report = run_once()
    print("=== QIH Operator Chain (main) ===")
    print(json.dumps(report, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
