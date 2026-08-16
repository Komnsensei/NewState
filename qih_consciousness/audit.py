"""QIH mathematical audit — operational formula checks (no promotion claims)."""
from __future__ import annotations

import os
import sys
from typing import Any, Dict

import numpy as np

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from qih_consciousness.workflow import born_probabilities, proper_time, run_operator_chain
from qih_consciousness.math_utils.entanglement import get_entanglement_distance
from qih_consciousness.core.operators import HawkingProjectionOperator
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.bio_readout.collapse import evaluate_collapse, frequency_splitting_window


def audit_born_rule(samples: int = 20000, theta: float = np.pi / 3, tol: float = 0.02) -> Dict[str, Any]:
    p_up, p_down = born_probabilities(theta)
    rng = np.random.default_rng(0)
    hits = sum(1 for _ in range(samples) if rng.random() < p_down)
    actual = hits / samples
    err = abs(actual - p_down)
    return {"test": "born_rule", "expected_p_down": p_down, "actual_p_down": actual, "error": err, "pass": err <= tol}


def audit_born_projection(samples: int = 2000, tol: float = 0.05) -> Dict[str, Any]:
    theta = np.pi / 3
    expected = np.sin(theta / 2) ** 2
    z = np.exp(1j * theta) * np.ones(samples)
    horizon = HorizonRegister(num_qubits=samples, seed=1)
    op = HawkingProjectionOperator(horizon, seed=2)
    bits = op.project(z, mode="born")
    actual = float(np.mean(bits))
    err = abs(actual - expected)
    return {
        "test": "born_projection_operator",
        "expected_mean_bit": float(expected),
        "actual_mean_bit": actual,
        "error": err,
        "pass": err <= tol,
    }


def audit_entanglement_distance() -> Dict[str, Any]:
    rows = [{"E": e, "d": float(get_entanglement_distance(e))} for e in (1.0, 0.9, 0.5, 0.1)]
    ok = get_entanglement_distance(0.1) > get_entanglement_distance(0.9)
    ok = ok and abs(get_entanglement_distance(1.0)) <= 1e-9
    return {"test": "entanglement_distance", "rows": rows, "pass": ok}


def audit_coherence() -> Dict[str, Any]:
    sync = np.ones(8, dtype=complex)
    chaos = np.array([1, -1, 1j, -1j, 0.5, -0.5, 0.2j, -0.2j], dtype=complex)

    def c_mt(m):
        return float(np.abs(np.sum(m)) ** 2 / (np.sum(np.abs(m) ** 2) + 1e-15))

    c_s, c_c = c_mt(sync), c_mt(chaos)
    return {"test": "coherence_functional", "C_MT_sync_raw": c_s, "C_MT_chaos_raw": c_c, "pass": c_s > c_c}


def audit_collapse() -> Dict[str, Any]:
    d1 = evaluate_collapse(0.9, omega=2.0, threshold=0.85)
    d2 = evaluate_collapse(0.1, omega=2.0, threshold=0.85)
    dt = frequency_splitting_window(2.0)
    return {
        "test": "collapse_criterion",
        "delta_t_c": dt,
        "high_should_collapse": d1.should_collapse,
        "low_should_not": not d2.should_collapse,
        "pass": d1.should_collapse and (not d2.should_collapse) and abs(dt - 0.5) < 1e-12,
    }


def audit_time_dilation() -> Dict[str, Any]:
    tau = proper_time(200.0, 100.0, 1.0)
    return {"test": "phase_clock_time_dilation", "proper_time": tau, "pass": abs(tau - 0.5) < 1e-12}


def audit_operator_chain() -> Dict[str, Any]:
    r = run_operator_chain(seed=7)
    return {
        "test": "operator_chain_full",
        "stages": r.stages,
        "coherence": r.coherence,
        "collapse": r.collapse,
        "experience_rendered": r.experience_rendered,
        "pass": "bulk" in r.stages and "screen" in r.stages and "obs" in r.stages and r.experience_rendered,
    }


def run_all() -> Dict[str, Any]:
    results = [
        audit_born_rule(),
        audit_born_projection(),
        audit_entanglement_distance(),
        audit_coherence(),
        audit_collapse(),
        audit_time_dilation(),
        audit_operator_chain(),
    ]
    overall = all(r.get("pass") for r in results)
    return {
        "overall_pass": overall,
        "results": results,
        "disclaimer": (
            "Software checks of QIH formulas and operator chain. "
            "No Gate promotion, no sentience claim, no hardware quantum validation."
        ),
    }


if __name__ == "__main__":
    report = run_all()
    print("=== QIH Operational Audit ===")
    print(report["disclaimer"])
    for r in report["results"]:
        print(f"[{'PASS' if r.get('pass') else 'FAIL'}] {r['test']}")
        for k, v in r.items():
            if k not in ("test", "pass"):
                print(f"  {k}: {v}")
    print("OVERALL:", "PASS" if report["overall_pass"] else "FAIL")
    raise SystemExit(0 if report["overall_pass"] else 1)
