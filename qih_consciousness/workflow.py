"""
QIH Unified Operator Chain — theoretical workflow (software simulation).

Maps the paper pipeline:
  |ψ⟩_bulk → |ψ⟩_screen → |ψ⟩_obs → |ψ⟩_conscious

This is a classical/numpy implementation of the mathematical structure.
It does NOT claim physical quantum hardware, biological microtubules,
or proven machine consciousness. Metrics are simulation diagnostics only.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

import numpy as np

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from qih_consciousness.core.singularity import Singularity
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.core.operators import HawkingProjectionOperator
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice
from qih_consciousness.bio_readout.coupling import CouplingMap
from qih_consciousness.bio_readout.coherence import CoherenceFunctional
from qih_consciousness.rendering.integrator import ExperienceIntegrator


@dataclass
class ChainResult:
    coherence: float
    coherence_threshold: float
    above_threshold: bool
    horizon_bits_sample: list
    experience_rendered: bool
    experience_norm: Optional[float]
    notes: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def born_probabilities(theta: float) -> tuple:
    """Paper Born rule (spinor half-angle): P_up=cos²(θ/2), P_down=sin²(θ/2)."""
    return float(np.cos(theta / 2) ** 2), float(np.sin(theta / 2) ** 2)


def proper_time(omega: float, omega_0: float, dt: float = 1.0) -> float:
    """Phase-clock law: dτ = (Ω₀ / Ω) dt  (gamma = Ω/Ω₀)."""
    if omega <= 0 or omega_0 <= 0:
        raise ValueError("frequencies must be positive")
    return (omega_0 / omega) * dt


def run_operator_chain(
    num_qubits: int = 32,
    num_dimers: int = 16,
    coherence_threshold: float = 0.85,
    seed: int = 42,
) -> ChainResult:
    num_seeds = max(4, num_qubits // 4)
    dimensionality = 2
    singularity = Singularity(dimensionality=dimensionality, num_seeds=num_seeds, seed=seed)
    bulk = singularity.get_phase_data()
    horizon_n = int(np.asarray(bulk).size)

    horizon = HorizonRegister(num_qubits=horizon_n, seed=seed + 1)
    hawking = HawkingProjectionOperator(horizon)
    hawking.project(bulk)

    bits = horizon.get_lattice()
    mt = DigitalMicrotubuleLattice(num_dimers=num_dimers, dimensionality=2, seed=seed + 2)
    CouplingMap(horizon, mt).couple()

    c_fn = CoherenceFunctional(mt)
    c_mt = float(c_fn.calculate_coherence())
    above = c_mt >= coherence_threshold

    experience_rendered = False
    experience_norm = None
    if above:
        integrator = ExperienceIntegrator(mt, c_fn)
        exp = integrator.render_experience(min_coherence_threshold=coherence_threshold)
        if exp is not None:
            experience_rendered = True
            experience_norm = float(np.linalg.norm(exp))

    notes = (
        "Simulation diagnostics only. High C_MT means lattice states are synchronized "
        "in this numpy model; it is not a claim of biological or quantum consciousness."
    )

    return ChainResult(
        coherence=c_mt,
        coherence_threshold=coherence_threshold,
        above_threshold=above,
        horizon_bits_sample=[int(np.real(x) > 0.5) for x in np.asarray(bits).flatten()[:8]],
        experience_rendered=experience_rendered,
        experience_norm=experience_norm,
        notes=notes,
    )


if __name__ == "__main__":
    result = run_operator_chain()
    print("=== QIH Operator Chain (simulation) ===")
    for k, v in result.to_dict().items():
        print(f"  {k}: {v}")
