import numpy as np
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice
from qih_consciousness.bio_readout.coherence import CoherenceFunctional

class ExperienceIntegrator:
    """
    Acts as an Integrator (CNS Emulator), performing an Inverse Fourier Transform (F^-1)
    on mapped frequency data (from microtubule states) to reconstruct the
    spectral pattern of experience.
    """
    def __init__(self, mt_lattice: DigitalMicrotubuleLattice, coherence_functional: CoherenceFunctional):
        self.mt_lattice = mt_lattice
        self.coherence_functional = coherence_functional
        self.last_rendered_experience = None

    def render_experience(self, min_coherence_threshold=0.8):
        current_coherence = self.coherence_functional.calculate_coherence()

        if current_coherence < min_coherence_threshold:
            self.last_rendered_experience = None
            return None

        mt_states = self.mt_lattice.get_states()
        flattened_states = mt_states.flatten()
        rendered_signal_complex = np.fft.ifft(flattened_states)
        rendered_experience = np.abs(rendered_signal_complex)

        self.last_rendered_experience = rendered_experience
        return rendered_experience

    def get_last_rendered_experience(self):
        return self.last_rendered_experience

    def __str__(self):
        if self.last_rendered_experience is not None:
            return f"Experience Integrator: Last rendered experience has {len(self.last_rendered_experience)} data points."
        return "Experience Integrator: No experience rendered (coherence too low or not yet rendered)."


if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity
    from qih_consciousness.core.horizon import HorizonRegister
    from qih_consciousness.core.operators import HawkingProjectionOperator
    from qih_consciousness.bio_readout.coupling import CouplingMap

    singularity_engine = Singularity(dimensionality=2, num_seeds=10, seed=10)
    raw_data = singularity_engine.get_phase_data()

    horizon_reg = HorizonRegister(num_qubits=20, seed=20)

    hawking_op = HawkingProjectionOperator(horizon_reg)
    hawking_op.project(raw_data)

    mt_lattice = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=30)

    coupling_map = CouplingMap(horizon_reg, mt_lattice)
    _ = coupling_map.couple()

    coherence_calculator = CoherenceFunctional(mt_lattice)
    current_coherence = coherence_calculator.calculate_coherence()
    print(f"Current C_MT for rendering: {current_coherence:.4f}")

    integrator = ExperienceIntegrator(mt_lattice, coherence_calculator)
    experience = integrator.render_experience(min_coherence_threshold=0.5)

    if experience is not None:
        print(f"\nRendered Experience (first 5 values):\n{experience[:5]}")
    else:
        print("\nFailed to render experience.")

    print("\n--- Simulating High Coherence for Rendering ---")
    mt_lattice_high_coherence = DigitalMicrotubuleLattice(num_dimers=10, dimensionality=2, seed=40)
    uniform_state = 1 + 0.5j
    mt_lattice_high_coherence.dimer_states = np.full((10, 2), uniform_state, dtype=complex)

    coherence_high_calc = CoherenceFunctional(mt_lattice_high_coherence)
    high_coherence_value = coherence_high_calc.calculate_coherence()
    print(f"Simulated High C_MT: {high_coherence_value:.4f}")

    integrator_high_coherence = ExperienceIntegrator(mt_lattice_high_coherence, coherence_high_calc)
    high_experience = integrator_high_coherence.render_experience(min_coherence_threshold=0.5)

    if high_experience is not None:
        print(f"\nRendered Experience (High Coherence, first 5 values):\n{high_experience[:5]}")
    else:
        print("\nFailed to render high coherence experience.")
