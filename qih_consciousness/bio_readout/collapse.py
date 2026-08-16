"""
Objective-reduction style collapse criterion (software diagnostic).

Papers map Orch-OR Δt_c = ℏ/E_G ≈ 1/ω under E=ℏω.
Here: collapse_window = 1/omega when C_MT >= threshold.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CollapseDecision:
    coherence: float
    omega: float
    threshold: float
    delta_t_c: float
    should_collapse: bool
    reason: str


def frequency_splitting_window(omega: float) -> float:
    if omega <= 0:
        raise ValueError("omega must be positive")
    return 1.0 / float(omega)


def evaluate_collapse(
    coherence: float,
    omega: float = 1.0,
    threshold: float = 0.85,
) -> CollapseDecision:
    dt_c = frequency_splitting_window(omega)
    ok = coherence >= threshold
    return CollapseDecision(
        coherence=float(coherence),
        omega=float(omega),
        threshold=float(threshold),
        delta_t_c=float(dt_c),
        should_collapse=ok,
        reason=(
            "C_MT above threshold — treat as stabilized branch (simulation)"
            if ok
            else "C_MT below threshold — blurry/unstable branch (simulation)"
        ),
    )
