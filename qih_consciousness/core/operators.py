"""
Hawking Projection Operator (P_HR) — read-write channel.

Implements discrete write onto HorizonRegister.
Primary path uses Born-rule spinor sampling:
  P_down = sin^2(theta/2), P_up = cos^2(theta/2)
where theta is derived from the bulk amplitude orientation.
"""
from __future__ import annotations

import numpy as np
from qih_consciousness.core.horizon import HorizonRegister


class HawkingProjectionOperator:
    def __init__(self, horizon_register: HorizonRegister, threshold: float = 0.0, seed=None):
        self.horizon_register = horizon_register
        self.threshold = threshold
        self.rng = np.random.default_rng(seed)

    @staticmethod
    def born_probs_from_complex(z: complex) -> tuple:
        mag = abs(z)
        if mag < 1e-15:
            return 0.5, 0.5
        theta = float(np.abs(np.angle(z))) % (2 * np.pi)
        if theta > np.pi:
            theta = 2 * np.pi - theta
        p_up = float(np.cos(theta / 2) ** 2)
        p_down = float(np.sin(theta / 2) ** 2)
        return p_up, p_down

    def project(self, raw_phase_data, mode: str = "born") -> np.ndarray:
        arr = np.asarray(raw_phase_data)
        flat = arr.flatten()
        n = self.horizon_register.num_qubits

        if mode == "threshold":
            bits = (np.real(flat) > self.threshold).astype(int)
        else:
            angles = np.abs(np.angle(flat)) % (2 * np.pi)
            angles = np.where(angles > np.pi, 2 * np.pi - angles, angles)
            mags = np.abs(flat)
            p_down = np.sin(angles / 2) ** 2
            p_down = np.where(mags < 1e-15, 0.5, p_down)
            bits = (self.rng.random(len(flat)) < p_down).astype(int)

        if len(bits) < n:
            bits = np.concatenate([bits, np.zeros(n - len(bits), dtype=int)])
        elif len(bits) > n:
            bits = bits[:n]

        self.horizon_register.project_data(bits.astype(complex))
        return bits
