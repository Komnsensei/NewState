"""
Phase-clock / subjective time (QIH papers).

dτ = (Ω₀ / Ω) dt
γ  = Ω / Ω₀

Software clock only — not a physical relativity experiment.
"""
from __future__ import annotations


def lorentz_factor(omega: float, omega_0: float) -> float:
    if omega_0 <= 0:
        raise ValueError("omega_0 must be positive")
    return float(omega) / float(omega_0)


def proper_time(omega: float, omega_0: float, dt: float = 1.0) -> float:
    """Phase-clock law: dτ = (Ω₀ / Ω) dt."""
    if omega <= 0 or omega_0 <= 0:
        raise ValueError("frequencies must be positive")
    return (float(omega_0) / float(omega)) * float(dt)


def frames_per_external_second(omega: float, omega_0: float, base_frames: float = 1.0) -> float:
    """Relative frame packing vs reference clock (diagnostic)."""
    return lorentz_factor(omega, omega_0) * base_frames
