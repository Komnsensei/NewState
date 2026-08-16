"""
Light-clock / phase-tick calculus helpers (QIH papers).

Derivative structure ~ rates (Singularity)
Integral structure  ~ accumulated ticks (Horizon history)
"""
from __future__ import annotations

import numpy as np


def phase_ticks(total_phase: float, cycle: float = 2.0 * np.pi) -> float:
    """Accumulated ticks from integrated phase."""
    if cycle <= 0:
        raise ValueError("cycle must be positive")
    return float(total_phase) / float(cycle)


def integrate_phase(phase_rate: float, dt: float) -> float:
    """Simple integral of phase rate over ordinary time."""
    return float(phase_rate) * float(dt)


def hawking_update_hint(omega_h: float, external_dt: float) -> float:
    """
    Diagnostic: expected update ticks if channel frequency is omega_h.
    Not a physical black-hole temperature model in this codebase.
    """
    return float(omega_h) * float(external_dt)
