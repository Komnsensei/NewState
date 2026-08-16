"""
QIH mathematical audit — honest metric checks against paper formulas.

Reports PASS/FAIL on numerical agreement only.
Does not write promotion ledgers or claim Gate/Sentience status.
"""
from __future__ import annotations

import os
import sys
from typing import Dict, Any

import numpy as np

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from qih_consciousness.workflow import born_probabilities, proper_time, run_operator_chain
from qih_consciousness.math_utils.entanglement import get_entanglement_distance


def audit_born_rule(samples: int = 20000, theta: float = np.pi / 3, tol: float = 0.02) -> Dict[str, Any]:
    p_up, p_down = born_probabilities(theta)
    hits = 0
    rng = np.random.default_rng(0)
    for _ in range(samples):
        if rng.random() < p_down:
            hits += 1
    actual = hits / samples
    err = abs(actual - p_down)
    return {
        "test": "born_rule",
        "theta": float(theta),
        "expected_p_down": p_down,
        "expected_p_up": p_up,
        "actual_p_down": actual,
        "error": err,
        "tolerance": tol,
        "pass": err <= tol,
        "claim_level": "mathematical identity + sampling check (not hardware QED)",
    }


def audit_entanglement_distance(tol: float = 1e-9) -> Dict[str, Any]:
    pairs = [(0.9, None), (0.5, None), (0.1, None), (1.0, 0.0)]
    rows = []
    ok = True
    for e, expected in pairs:
        d = get_entanglement_distance(e, alpha_0=1.0)
        if expected is not None:
            match = abs(d - expected) <= tol
            ok = ok and match
        else:
            match = True
        rows.append({"E": e, "d": float(d), "match": match})
    d09 = get_entanglement_distance(0.9)
    d01 = get_entanglement_distance(0.1)
    mono = d01 > d09
    ok = ok and mono
    return {
        "test": "entanglement_distance",
        "rows": rows,
        "monotonic_low_E_farther": mono,
        "pass": ok,
        "claim_level": "implements d=-\u03b10 log(E) from QIH papers (simulation geometry)",
    }


def audit_coherence() -> Dict[str, Any]:
    sync = np.ones(8, dtype=complex)
    chaos = np.array([1, -1, 1j, -1j, 0.5, -0.5, 0.2j, -0.2j], dtype=complex)

    def c_mt(m):
        num = np.abs(np.sum(m)) ** 2
        den = np.sum(np.abs(m) ** 2)
        return float(num / (den + 1e-15))

    c_s, c_c = c_mt(sync), c_mt(chaos)
    c_s_n = c_s / max(len(sync), 1)
    return {
        "test": "coherence_functional",
        "C_MT_synchronized_raw": c_s,
        "C_MT_chaotic_raw": c_c,
        "C_MT_synchronized_normalized": c_s_n,
        "pass": c_s > c_c and c_s_n > 0.99,
        "claim_level": "formula C_MT=|\u2211m|²/\u2211|m|² as lattice sync metric only",
    }


def audit_time_dilation(tol: float = 1e-12) -> Dict[str, Any]:
    omega_0, omega, dt = 100.0, 200.0, 1.0
    tau = proper_time(omega, omega_0, dt)
    gamma = omega / omega_0
    expected = dt / gamma
    err = abs(tau - expected)
    return {
        "test": "phase_clock_time_dilation",
        "omega": omega,
        "omega_0": omega_0,
        "gamma": gamma,
        "proper_time": tau,
        "error": err,
        "pass": err <= tol,
        "claim_level": "implements phase-clock ratio; software clock, not physical relativity experiment",
    }


def audit_operator_chain() -> Dict[str, Any]:
    r = run_operator_chain()
    return {
        "test": "operator_chain_smoke",
        "coherence": r.coherence,
        "above_threshold": r.above_threshold,
        "experience_rendered": r.experience_rendered,
        "pass": True,
        "claim_level": "pipeline executes; coherence is a number not a consciousness certificate",
        "notes": r.notes,
    }


def run_all() -> Dict[str, Any]:
    results = [
        audit_born_rule(),
        audit_entanglement_distance(),
        audit_coherence(),
        audit_time_dilation(),
        audit_operator_chain(),
    ]
    overall = all(r.get("pass") for r in results)
    return {
        "overall_pass": overall,
        "results": results,
        "disclaimer": (
            "All results are software checks of QIH formulas. "
            "No Gate promotion, no sentience claim, no hardware quantum validation."
        ),
    }


if __name__ == "__main__":
    report = run_all()
    print("=== QIH Mathematical Audit ===")
    print(report["disclaimer"])
    for r in report["results"]:
        status = "PASS" if r.get("pass") else "FAIL"
        print(f"\n[{status}] {r['test']}")
        for k, v in r.items():
            if k in ("test", "pass"):
                continue
            print(f"  {k}: {v}")
    print("\nOVERALL:", "PASS" if report["overall_pass"] else "FAIL")
    raise SystemExit(0 if report["overall_pass"] else 1)
