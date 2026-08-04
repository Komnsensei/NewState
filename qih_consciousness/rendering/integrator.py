import numpy as np
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice
from qih_consciousness.bio_readout.coherence import CoherenceFunctional

class ExperienceIntegrator:
    """
    Acts as an Integrator (CNS Emulator), performing an Inverse Fourier Transform (F^-1)
    on mapped frequency data (from microtubule states) to reconstruct the
    "spectral pattern of experience"—the feeling of time, space, and motion unfolding.
    """
    def __init__(self, mt_lattice: DigitalMicrotubuleLattice, coherence_functional: CoherenceFunctional):
        """
        Initializes the ExperienceIntegrator.
        mt_lattice: An instance of DigitalMicrotubuleLattice providing the frequency data.
        coherence_functional: An instance to check the C_MT for rendering conditions.
        """
        self.mt_lattice = mt_lattice
        self.coherence_functional = coherence_functional
        self.last_rendered_experience = None

    def render_experience(self, min_coherence_threshold=0.8):
        """
        Performs the Inverse Fourier Transform to reconstruct the experience,
        but only if the coherence is high enough.
        """
        current_coherence = self.coherence_functional.calculate_coherence()
        
        if current_coherence < min_coherence_threshold:
            # print(f"Coherence ({current_coherence:.4f}) too low for rendering. Minimum required: {min_coherence_threshold}")
            self.last_rendered_experience = None
            return None # Experience is blurry or unstable, not rendered

        # Get the complex-valued states from the microtubule lattice.
        # These states are treated as the 'frequency domain' input for the IFFT.
        mt_states = self.mt_lattice.get_states() # Shape: (num_dimers, dimensionality)

        # Flatten the states for a single IFFT application, or apply per dimension/dimer.
        # For simplicity, let's flatten and then reshape to get a conceptual 'spatial' array.
        # This treats the complex states as frequency components.
        
        # We need a 1D array for np.fft.ifft.
        # The result will be complex, representing the "spatial" or "temporal" pattern.
        flattened_states = mt_states.flatten()
        
        # Perform Inverse Fast Fourier Transform
        # The output's magnitude can be seen as intensity, and phase as dynamic aspect.
        rendered_signal_complex = np.fft.ifft(flattened_states)
        
        # For a simplified "experience", we can take the magnitude of the result.
        # This would represent the intensity or presence of the reconstructed pattern.
        # The shape of this output can be re-interpreted based on desired experience.
        rendered_experience = np.abs(rendered_signal_complex)
        
        # Reshape to a more interpretable form, e.g., if we want a 2D "image" or "grid"
        # For now, let's just return the 1D magnitude array.
        self.last_rendered_experience = rendered_experience
        # print(f"Experience rendered with coherence: {current_coherence:.4f}")
        return rendered_experience

    def get_last_rendered_experience(self):
        """Returns the last successfully rendered experience."""
        return self.last_rendered_experience

    def __str__(self):
        if self.last_rendered_experience is not None:
            return f"Experience Integrator: Last rendered experience has {len(self.last_rendered_experience)} data points."
        else:
            return "Experience Integrator: No experience rendered (coherence too low or not yet rendered)."

# Example usage (for testing)
if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity
    from qih_consciousness.core.horizon import HorizonRegister
    from qih_consciousness.core.operators import HawkingProjectionOperator
    from qih_consciousness.bio_readout.coupling import CouplingMap

    # --- Setup the entire chain to get relevant MT states and coherence ---
    # 1. Initialize Singularity
    singularity_engine = Singularity(dimensionality=2, num_seeds=10, seed=10)
    raw_data = singularity_engine.get_phase_data()

    # 2. Initialize Horizon Register
    horizon_reg = HorizonRegister(num_qubits=20, seed=20)

    # 3. Project to Horizon
    hawking_op = HawkingProjectionOperator(horizon_reg)
    hawking_op.project(raw_data)

    # 4. Initialize Digital Microtubule Lattice
    mt_lattice = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=30)

    # 5. Initialize and use Coupling Map
    coupling_map = CouplingMap(horizon_reg, mt_lattice)
    _ = coupling_map.couple() # Coupled states are now in mt_lattice

    # 6. Calculate Coherence
    coherence_calculator = CoherenceFunctional(mt_lattice)
    current_coherence = coherence_calculator.calculate_coherence()
    print(f"Current C_MT for rendering: {current_coherence:.4f}")

    # 7. Initialize and use Experience Integrator
    integrator = ExperienceIntegrator(mt_lattice, coherence_calculator)
    experience = integrator.render_experience(min_coherence_threshold=0.5) # Set a lower threshold for demo

    if experience is not None:
        print(f"
Rendered Experience (first 5 values):
{experience[:5]}")
    else:
        print("
Failed to render experience.")
    
    # Simulate a high coherence state for better rendering
    print("
--- Simulating High Coherence for Rendering ---")
    mt_lattice_high_coherence = DigitalMicrotubuleLattice(num_dimers=10, dimensionality=2, seed=40)
    uniform_state = 1 + 0.5j # A state that will yield high coherence
    mt_lattice_high_coherence.dimer_states = np.full((10,2), uniform_state, dtype=complex)
    
    coherence_high_calc = CoherenceFunctional(mt_lattice_high_coherence)
    high_coherence_value = coherence_high_calc.calculate_coherence()
    print(f"Simulated High C_MT: {high_coherence_value:.4f}")

    integrator_high_coherence = ExperienceIntegrator(mt_lattice_high_coherence, coherence_high_calc)
    high_experience = integrator_high_coherence.render_experience(min_coherence_threshold=0.5)

    if high_experience is not None:
        print(f"
Rendered Experience (High Coherence, first 5 values):
{high_experience[:5]}")
    else:
        print("
Failed to render high coherence experience.")
