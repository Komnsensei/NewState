import numpy as np

class Singularity:
    """
    The 'Engine' for QIH consciousness, supplying raw, nonlocal phase data
    and continuous rates of change (conceptual seeds/derivative structure).
    """
    def __init__(self, dimensionality=3, num_seeds=100, seed=None):
        """
        Initializes the Singularity with a specified dimensionality and number of conceptual seeds.
        Phase data is represented as complex numbers for now.
        """
        self.dimensionality = dimensionality
        self.num_seeds = num_seeds
        self.rng = np.random.default_rng(seed)
        self.phase_data = self._generate_raw_phase_data()

    def _generate_raw_phase_data(self):
        """
        Generates raw, nonlocal phase data.
        For simplicity, this generates random complex numbers representing phase.
        Each seed has 'dimensionality' components.
        """
        # Generate random magnitudes and phases
        magnitudes = self.rng.rand(self.num_seeds, self.dimensionality) * 2 - 1 # between -1 and 1
        phases = self.rng.uniform(0, 2 * np.pi, (self.num_seeds, self.dimensionality))

        # Convert to complex numbers: magnitude * e^(i*phase)
        raw_data = magnitudes * (np.cos(phases) + 1j * np.sin(phases))
        return raw_data

    def get_phase_data(self):
        """
        Returns the current raw, nonlocal phase data.
        In a more advanced system, this would be a continuous stream.
        """
        # Simulate continuous change by slightly perturbing the data each time it's accessed
        self._perturb_phase_data()
        return self.phase_data

    def _perturb_phase_data(self, perturbation_strength=0.01):
        """
        Simulates continuous rates of change by adding small perturbations to the phase data.
        """
        perturbation_magnitudes = self.rng.normal(0, perturbation_strength, self.phase_data.shape)
        perturbation_phases = self.rng.normal(0, perturbation_strength * np.pi, self.phase_data.shape)

        # Update both magnitude and phase parts of the complex numbers
        current_magnitudes = np.abs(self.phase_data)
        current_phases = np.angle(self.phase_data)

        new_magnitudes = current_magnitudes + perturbation_magnitudes
        new_phases = current_phases + perturbation_phases

        # Reconstruct complex numbers with new magnitudes and phases
        self.phase_data = new_magnitudes * (np.cos(new_phases) + 1j * np.sin(new_phases))

    def __str__(self):
        return f"Singularity Engine: {self.num_seeds} conceptual seeds, {self.dimensionality}-dimensional phase data."

# Example of how it might be used:
if __name__ == "__main__":
    singularity_engine = Singularity(dimensionality=4, num_seeds=5)
    print(singularity_engine)

    # Get phase data multiple times to see changes
    for i in range(3):
        data = singularity_engine.get_phase_data()
        print(f"
Iteration {i+1} - First seed phase data:
{data[0]}")
        # Note: In a real system, this would be passed to the Hawking Projection Operator.