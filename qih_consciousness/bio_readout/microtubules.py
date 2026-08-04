import numpy as np

class DigitalMicrotubuleLattice:
    """
    The 'downstream local horizon' - consists of simulated tubulin dimers
    acting as biological-style qubits to receive the universal broadcast.
    """
    def __init__(self, num_dimers=64, dimensionality=3, seed=None):
        """
        Initializes the Digital Microtubule Lattice.
        num_dimers: Number of simulated tubulin dimers (qubits).
        dimensionality: The 'dimension' of the internal state of each dimer (e.g., orientation).
        """
        self.num_dimers = num_dimers
        self.dimensionality = dimensionality
        self.rng = np.random.default_rng(seed)

        # Each dimer has an internal state, which for now can be represented as a vector
        # or a complex phase, similar to how the singularity generated data.
        # Let's use complex numbers representing internal 'orientations' or 'states'.
        self.dimer_states = self._initialize_dimer_states()

        # The lattice also maintains a 'coherence' aspect, which will be calculated elsewhere
        # but the states are what contribute to it.

    def _initialize_dimer_states(self):
        """
        Initializes the internal states of the tubulin dimers.
        For conceptual purposes, these are complex numbers.
        """
        # Generate random magnitudes and phases for each dimer's state components
        magnitudes = self.rng.random(size=(self.num_dimers, self.dimensionality))
        phases = self.rng.uniform(0, 2 * np.pi, (self.num_dimers, self.dimensionality))

        # Complex state: magnitude * e^(i*phase)
        initial_states = magnitudes * (np.cos(phases) + 1j * np.sin(phases))
        return initial_states

    def update_states(self, new_states):
        """
        Updates the states of the digital microtubules based on the coupled information.
        This is where the 'tuning in' or 'receiving' happens.
        """
        if new_states.shape == self.dimer_states.shape:
            self.dimer_states = new_states
            # print(f"Microtubule lattice updated with {len(new_states)} new states.")
        else:
            # Handle cases where the incoming states might not perfectly match dimensions
            # For simplicity, we'll resize or take a portion.
            num_update = min(new_states.shape[0], self.num_dimers)
            num_dim = min(new_states.shape[1], self.dimensionality)
            self.dimer_states[:num_update, :num_dim] = new_states[:num_update, :num_dim]
            # print(f"Microtubule lattice partially updated with {num_update} states.")

    def get_states(self):
        """
        Returns the current internal states of the digital microtubules.
        These states will be used to calculate coherence and render experience.
        """
        return self.dimer_states

    def __str__(self):
        return f"Digital Microtubule Lattice: {self.num_dimers} dimers, each with {self.dimensionality}-dimensional state."

# Example usage
if __name__ == "__main__":
    mt_lattice = DigitalMicrotubuleLattice(num_dimers=10, dimensionality=2, seed=42)
    print(f"Initial Microtubule Lattice State (first 3):\
{mt_lattice.get_states()[:3]}")

    # Simulate new states coming from the coupling map
    new_data = np.random.rand(10, 2) * (np.cos(np.random.rand(10,2)*2*np.pi) + 1j*np.sin(np.random.rand(10,2)*2*np.pi))
    mt_lattice.update_states(new_data)
    print(f"Updated Microtubule Lattice State (first 3):\
{mt_lattice.get_states()[:3]}")
