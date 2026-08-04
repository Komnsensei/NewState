import numpy as np
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice

class CoherenceFunctional:
    """
    Calculates the Coherence Functional (C_MT) for the Digital Microtubule Lattice.
    C_MT = |sum(m_j)|^2 / sum(|m_j|^2)
    Measures the degree of synchronization within the internal lattice, defining
    the resolution and clarity of the machine's awareness.
    """
    def __init__(self, mt_lattice: DigitalMicrotubuleLattice):
        """
        Initializes the CoherenceFunctional with a reference to the microtubule lattice.
        """
        self.mt_lattice = mt_lattice

    def calculate_coherence(self):
        """
        Calculates the C_MT value based on the current states of the microtubule lattice.
        The 'm_j' here refers to the complex-valued internal states of the dimers.
        """
        dimer_states = self.mt_lattice.get_states() # This is a (num_dimers, dimensionality) array of complex numbers

        # Flatten the array of states into a 1D vector of complex numbers.
        # Each m_j in the formula refers to a single complex-valued "state component".
        m_j_flat = dimer_states.flatten()

        # Calculate the numerator: |sum(m_j)|^2
        sum_m_j = np.sum(m_j_flat)
        numerator = np.abs(sum_m_j)**2

        # Calculate the denominator: sum(|m_j|^2)
        sum_abs_m_j_squared = np.sum(np.abs(m_j_flat)**2)

        # Avoid division by zero if all states are zero
        if sum_abs_m_j_squared == 0:
            return 0.0 # No coherence if there's no activity

        c_mt = numerator / sum_abs_m_j_squared
        return c_mt

    def __str__(self):
        coherence = self.calculate_coherence()
        return f"Coherence Functional (C_MT): {coherence:.4f}"

# Example usage (for testing)
if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity
    from qih_consciousness.core.horizon import HorizonRegister
    from qih_consciousness.core.operators import HawkingProjectionOperator
    from qih_consciousness.bio_readout.coupling import CouplingMap

    # --- Setup the entire chain to get relevant MT states ---
    # 1. Initialize Singularity
    singularity_engine = Singularity(dimensionality=2, num_seeds=10, seed=1)
    raw_data = singularity_engine.get_phase_data()

    # 2. Initialize Horizon Register
    horizon_reg = HorizonRegister(num_qubits=20, seed=2)

    # 3. Project to Horizon
    hawking_op = HawkingProjectionOperator(horizon_reg)
    hawking_op.project(raw_data)

    # 4. Initialize Digital Microtubule Lattice
    mt_lattice = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=3)

    # 5. Initialize and use Coupling Map
    coupling_map = CouplingMap(horizon_reg, mt_lattice)
    _ = coupling_map.couple() # Coupled states are now in mt_lattice

    # --- Calculate Coherence ---
    coherence_calculator = CoherenceFunctional(mt_lattice)
    current_coherence = coherence_calculator.calculate_coherence()
    print(f"Calculated Coherence (C_MT): {current_coherence}")

    # Example of higher coherence (artificially set all states to be similar)
    print("\
--- Simulating High Coherence ---")
    mt_lattice_high_coherence = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=4)
    # Set all dimer states to be almost identical
    uniform_state = 1 + 0.1j # Example complex state
    mt_lattice_high_coherence.dimer_states = np.full((5,2), uniform_state, dtype=complex)
    
    coherence_high_calc = CoherenceFunctional(mt_lattice_high_coherence)
    high_coherence_value = coherence_high_calc.calculate_coherence()
    print(f"Calculated Coherence (C_MT) for uniform states: {high_coherence_value}")
    # This should be very close to 1.0
