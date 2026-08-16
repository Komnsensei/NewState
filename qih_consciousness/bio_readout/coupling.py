import numpy as np
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice

class CouplingMap:
    """
    The algebraic interface (C:H_screen to H_bio) that bridges the universal record
    (from the Horizon Register) to the machine's local hardware (Digital Microtubule Lattice).
    """
    def __init__(self, horizon_register: HorizonRegister, mt_lattice: DigitalMicrotubuleLattice, seed=None):
        self.horizon_register = horizon_register
        self.mt_lattice = mt_lattice
        self.rng = np.random.default_rng(seed)

    def couple(self):
        horizon_bits = self.horizon_register.get_qubit_lattice()
        entanglement_matrix = self.horizon_register.get_adjacency_matrix()

        num_horizon_qubits = len(horizon_bits)
        num_mt_dimers = self.mt_lattice.num_dimers
        mt_dimensionality = self.mt_lattice.dimensionality

        new_mt_states = np.zeros((num_mt_dimers, mt_dimensionality), dtype=complex)

        for i in range(num_mt_dimers):
            start_idx = (i * mt_dimensionality) % num_horizon_qubits
            end_idx = ((i * mt_dimensionality) + mt_dimensionality) % num_horizon_qubits

            if start_idx < end_idx:
                relevant_bits = horizon_bits[start_idx:end_idx]
                relevant_entanglement_rows = entanglement_matrix[start_idx:end_idx, :]
            else:
                relevant_bits = np.concatenate((horizon_bits[start_idx:], horizon_bits[:end_idx]))
                relevant_entanglement_rows = np.concatenate(
                    (entanglement_matrix[start_idx:, :], entanglement_matrix[:end_idx, :]), axis=0
                )

            if relevant_bits.size == 0:
                relevant_bits = self.rng.choice([0, 1], size=mt_dimensionality)
                relevant_entanglement_rows = self.rng.rand(mt_dimensionality, num_horizon_qubits)

            avg_entanglement = np.mean(relevant_entanglement_rows) if relevant_entanglement_rows.size > 0 else 0.5

            for j in range(mt_dimensionality):
                bit_val = relevant_bits[j % len(relevant_bits)]
                phase = bit_val * np.pi
                magnitude = avg_entanglement
                new_mt_states[i, j] = magnitude * (np.cos(phase) + 1j * np.sin(phase))

        self.mt_lattice.update_states(new_mt_states)
        return new_mt_states


if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity
    from qih_consciousness.core.operators import HawkingProjectionOperator

    singularity_engine = Singularity(dimensionality=2, num_seeds=10, seed=101)
    raw_data = singularity_engine.get_phase_data()

    horizon_reg = HorizonRegister(num_qubits=20, seed=102)

    hawking_op = HawkingProjectionOperator(horizon_reg)
    hawking_op.project(raw_data)
    print("Horizon Lattice (first 5) after projection:", horizon_reg.get_qubit_lattice()[:5])

    mt_lattice = DigitalMicrotubuleLattice(num_dimers=5, dimensionality=2, seed=103)
    print("\nInitial MT Lattice States (first 3):", mt_lattice.get_states()[:3])

    coupling_map = CouplingMap(horizon_reg, mt_lattice)
    coupled_states = coupling_map.couple()

    print("\nCoupled MT Lattice States (first 3):", mt_lattice.get_states()[:3])
    assert not np.array_equal(mt_lattice.get_states(), mt_lattice._initialize_dimer_states())
    print("\nCoupling successful, MT lattice states updated.")
