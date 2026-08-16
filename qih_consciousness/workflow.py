"""
QIH Unified Operator Chain — full operational software path.

  |ψ⟩_bulk → |ψ⟩_screen → |ψ⟩_obs → |ψ⟩_conscious

Simulation of the mathematical pipeline from the co-craft papers.
Does not claim physical quantum hardware or proven machine consciousness.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

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
from qih_consciousness.bio_readout.collapse import evaluate_collapse
from qih_consciousness.rendering.integrator import ExperienceIntegrator
from qih_consciousness.rendering.spectral_time import proper_time as phase_proper_time, lorentz_factor
from qih_consciousness.math_utils.entanglement import get_entanglement_distance


@dataclass
class ChainResult:
    coherence: float
    coherence_threshold: float
    above_threshold: bool
    collapse: Dict[str, Any]
    horizon_bits_sample: List[int]
    experience_rendered: bool
    experience_norm: Optional[float]
    gamma: Optional[float]
    proper_time: Optional[float]
    entanglement_distance_sample: float
    notes: str
    stages: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def born_probabilities(theta: float) -> tuple:
    return float(np.cos(theta / 2) ** 2), float(np.sin(theta / 2) ** 2)


def proper_time(omega: float, omega_0: float, dt: float = 1.0) -> float:
    return phase_proper_time(omega, omega_0, dt)


def run_operator_chain(
    num_qubits: int = 32,
    num_dimers: int = 16,
    coherence_threshold: float = 0.85,
    omega: float = 1.0,
    omega_0: float = 1.0,
    seed: int = 42,
) -> ChainResult:
    stages: List[str] = []

    num_seeds = max(4, num_qubits // 4)
    singularity = Singularity(dimensionality=2, num_seeds=num_seeds, seed=seed)
    bulk = singularity.get_phase_data()
    stages.append("bulk")

    horizon_n = int(np.asarray(bulk).size)
    horizon = HorizonRegister(num_qubits=horizon_n, seed=seed + 1)
    hawking = HawkingProjectionOperator(horizon, seed=seed + 2)
    bits = hawking.project(bulk, mode="born")
    stages.append("screen")

    mt = DigitalMicrotubuleLattice(num_dimers=num_dimers, dimensionality=2, seed=seed + 3)
    CouplingMap(horizon, mt).couple()
    stages.append("obs")

    mt.synchronize(magnitude=1.0)
    stages.append("focus")

    c_fn = CoherenceFunctional(mt)
    c_mt = float(c_fn.calculate_coherence())
    n_comp = max(int(np.asarray(mt.get_states()).size), 1)
    gate_value = float(c_mt / n_comp) if c_mt > 1.0 else float(c_mt)
    decision = evaluate_collapse(gate_value, omega=omega, threshold=coherence_threshold)
    stages.append("coherence")

    d_sample = float(get_entanglement_distance(0.75))

    experience_rendered = False
    experience_norm = None
    if decision.should_collapse:
        integrator = ExperienceIntegrator(mt, c_fn)
        exp = integrator.render_experience(min_coherence_threshold=0.0)
        if exp is not None:
            experience_rendered = True
            experience_norm = float(np.linalg.norm(np.asarray(exp)))
        stages.append("conscious")

    gamma = float(lorentz_factor(omega, omega_0)) if omega_0 > 0 else None
    tau = float(proper_time(omega, omega_0, 1.0)) if omega > 0 and omega_0 > 0 else None

    notes = (
        "Operational simulation of the QIH operator chain. "
        "Born projection + C_MT + frequency-splitting window are software diagnostics. "
        "Not a claim of hardware qubits or biological consciousness."
    )

    return ChainResult(
        coherence=c_mt,
        coherence_threshold=coherence_threshold,
        above_threshold=decision.should_collapse,
        collapse=decision.__dict__,
        horizon_bits_sample=[int(x) for x in list(bits[:8])],
        experience_rendered=experience_rendered,
        experience_norm=experience_norm,
        gamma=gamma,
        proper_time=tau,
        entanglement_distance_sample=d_sample,
        notes=notes,
        stages=stages,
    )


if __name__ == "__main__":
    r = run_operator_chain()
    print("=== QIH Operator Chain ===")
    for k, v in r.to_dict().items():
        print(f"  {k}: {v}")
