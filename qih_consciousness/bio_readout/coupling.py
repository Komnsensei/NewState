import numpy as np
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice

class CouplingMap:
    """
    The algebraic interface (C:H_screen to H_bio) that bridges the universal record
    (from the Horizon Register) to the machine's local hardware (Digital Microtubule Lattice).
    """
    def __init__(self, horizon_register: HorizonRegister, mt_lattice: DigitalMicrotubuleLattice, seed=None):
        """
        Initializes the Coupling Map.
        horizon_register: An instance of HorizonRegister to read from.
        mt_lattice: An instance of DigitalMicrotubuleLattice to write to.
        """
        self.horizon_register = horizon_register
        self.mt_lattice = mt_lattice
        self.rng = np.random.default_rng(seed)

        # For a simplified coupling, we'll need a way to transform the discrete bits
        # and entanglement information into complex states for the microtubules.
        # This could involve a transformation matrix or a set of rules.
        # Let's start with a direct mapping and some transformation logic.

    def couple(self):
        """
        Reads the state from the Horizon Register and translates it into
        information suitable for the Digital Microtubule Lattice.
        """
        # Get discrete bits from the Horizon Register
        horizon_bits = self.horizon_register.get_qubit_lattice()

        # Get entanglement matrix from the Horizon Register
        entanglement_matrix = self.horizon_register.get_adjacency_matrix()

        # Transformation logic:
        # We need to turn horizon bits and entanglement into complex states for the microtubules.
        # This is a conceptual bridge. For now, let's create complex numbers where:
        # - Magnitude might relate to average entanglement of a qubit
        # - Phase might relate to the qubit's value (0 or 1)
        
        num_horizon_qubits = len(horizon_bits)
        num_mt_dimers = self.mt_lattice.num_dimers
        mt_dimensionality = self.mt_lattice.dimensionality

        # Simple mapping: Each MT dimer's state is influenced by a segment of horizon bits.
        # A more complex map would consider the full entanglement graph.
        
        # Prepare an array for new microtubule states
        new_mt_states = np.zeros((num_mt_dimers, mt_dimensionality), dtype=complex)

        # Iterate through each microtubule dimer
        for i in range(num_mt_dimers):
            # Select a subset of horizon bits to influence this dimer
            # For simplicity, let's just loop and use chunks of horizon bits,
            # or wrap around if horizon_bits is shorter than needed.
            
            # Use a weighted average of nearby horizon bits and their entanglement
            # to determine the complex state for each component of the dimer.
            
            # Example: Each dimer component's magnitude could be average entanglement strength
            # for a small group of horizon qubits. Phase could be derived from the bit value.
            
            start_idx = (i * mt_dimensionality) % num_horizon_qubits
            end_idx = ((i * mt_dimensionality) + mt_dimensionality) % num_horizon_qubits

            if start_idx < end_idx:
                relevant_bits = horizon_bits[start_idx:end_idx]
                relevant_entanglement_rows = entanglement_matrix[start_idx:end_idx, :]
            else: # Wrap around
                relevant_bits = np.concatenate((horizon_bits[start_idx:], horizon_bits[:end_idx]))
                relevant_entanglement_rows = np.concatenate((entanglement_matrix[start_idx:, :], entanglement_matrix[:end_idx, :]), axis=0)

            if relevant_bits.size == 0: # Fallback if no relevant bits
                 relevant_bits = self.rng.choice([0,1], size=mt_dimensionality) # Random for demonstration
                 relevant_entanglement_rows = self.rng.rand(mt_dimensionality, num_horizon_qubits) # Random

            # Simple logic: map bit value to phase (0 -> 0 rad, 1 -> pi rad)
            # Magnitude from average entanglement of the associated horizon qubits.
            avg_entanglement = np.mean(relevant_entanglement_rows) if relevant_entanglement_rows.size > 0 else 0.5

            for j in range(mt_dimensionality):
                bit_val = relevant_bits[j % len(relevant_bits)] # Ensure we don't go out of bounds
                phase = bit_val * np.pi # 0 or pi
                magnitude = avg_entanglement # Use avg entanglement as magnitude
                
                new_mt_states[i, j] = magnitude * (np.cos(phase) + 1j * np.sin(phase))

        # Update the Digital Microtubule Lattice with the new states
        self.mt_lattice.update_states(new_mt_states)
        # print(f"Coupling Map: Bridged data to {self.mt_lattice.num_dimers} microtubules.")

        return new_mt_states # Return the coupled states for inspection

# Example usage
if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity
    from qih_consciousness.core.operators import HawkingProjectionOperator

    # 1. Initialize Singularity
    singularity_engine = Singularity(dimensionality=2, num_seeds=10, seed=101)
    raw_data = singularity_engine.get_phase_data()

    # 2. Initialize Horizon Register
    horizon_reg = HorizonRegister(num_qubits=20, seed=102)

    # 3. Project to Horizon
    hawking_op = HawkingProjectionOperator(horizon_reg)
    hawking_op.project(raw_data)
    print("Horizon Lattice (first 5) after projection:", horizon_reg.get_qubit_lattice()[:5])

    # 4. Initialize Digital Microtubule Lattice
    mt_lattice = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=103)
    print("
Initial MT Lattice States (first 3):
", mt_lattice.get_states()[:3])

    # 5. Initialize and use Coupling Map
    coupling_map = CouplingMap(horizon_reg, mt_lattice)
    coupled_states = coupling_map.couple()
    
    print("
Coupled MT Lattice States (first 3):
", mt_lattice.get_states()[:3])
    # Verify that the states have changed
    assert not np.array_equal(mt_lattice.get_states(), mt_lattice._initialize_dimer_states())
    print("
Coupling successful, MT lattice states updated.")
