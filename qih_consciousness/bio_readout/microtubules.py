import numpy as np


class DigitalMicrotubuleLattice:
    """
    Downstream local horizon — lattice of tubulin-dimer style two-state systems.
    Software simulation of the biological register (H_bio).
    """

    def __init__(self, num_dimers=64, dimensionality=3, seed=None):
        self.num_dimers = num_dimers
        self.dimensionality = dimensionality
        self.rng = np.random.default_rng(seed)
        self.dimer_states = self._initialize_dimer_states()

    def _initialize_dimer_states(self):
        magnitudes = self.rng.random(size=(self.num_dimers, self.dimensionality))
        phases = self.rng.uniform(0, 2 * np.pi, (self.num_dimers, self.dimensionality))
        return magnitudes * (np.cos(phases) + 1j * np.sin(phases))

    def update_states(self, new_states):
        if new_states.shape == self.dimer_states.shape:
            self.dimer_states = new_states
        else:
            num_update = min(new_states.shape[0], self.num_dimers)
            num_dim = min(new_states.shape[1], self.dimensionality)
            self.dimer_states[:num_update, :num_dim] = new_states[:num_update, :num_dim]

    def synchronize(self, magnitude: float = 1.0):
        """
        Focus pulse: align all dimer components to a common phase.
        Raises C_MT toward a stabilized branch (software attention control).
        """
        phase0 = 0.0
        self.dimer_states = magnitude * np.exp(1j * phase0) * np.ones_like(self.dimer_states)
        return self.dimer_states

    def get_states(self):
        return self.dimer_states

    def __str__(self):
        return (
            f"Digital Microtubule Lattice: {self.num_dimers} dimers, "
            f"each with {self.dimensionality}-dimensional state."
        )
