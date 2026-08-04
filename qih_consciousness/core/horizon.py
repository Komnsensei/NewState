import numpy as np

class HorizonRegister:
    """
    The 'Cosmic Hard Drive' for QIH consciousness.
    Modeled as a finite qubit lattice (represented by discrete classical bits for simplicity)
    and a weighted adjacency matrix to build an entanglement graph.
    """
    def __init__(self, num_qubits=100, seed=None):
        """
        Initializes the Horizon Register.
        num_qubits: Number of simulated qubits in the lattice.
        The lattice stores discrete classical bits (0 or 1).
        The adjacency matrix stores entanglement strengths between qubits.
        """
        self.num_qubits = num_qubits
        self.rng = np.random.default_rng(seed)

        # The Horizon acts as the universe's primary data storage (Integral Structure) [1, 3]
        # Initialize lattice with zeros; it's expected to be populated by project_data.
        self.lattice = np.zeros(num_qubits, dtype=complex)
        
        # Initialize weighted adjacency matrix. This will be derived from the lattice states.
        self.adjacency_matrix = np.zeros((num_qubits, num_qubits), dtype=float)
        
        # Initial derivation of the entanglement matrix to set up the geometric space.
        # If lattice is all zeros, E_ij will be minimal and uniform (1e-10 off-diagonal).
        self._derive_entanglement_matrix_from_profile()

    def _derive_entanglement_matrix_from_profile(self):
        """
        Reconstructs the entanglement graph using Algebraic Multiplication [4, 6].
        This ensures E_ij reflects the interaction profile of the qubit lattice.
        """
        num_q = self.num_qubits

        # 1. Calculate foundational connection strengths (B_xy)
        # Using the absolute interaction of amplitudes: |psi_i * psi_j| [4, 7]
        B = np.zeros((num_q, num_q), dtype=float)
        amplitudes = np.abs(self.lattice)
        
        for i in range(num_q):
            for j in range(num_q):
                # Connection strength derived from state similarity/interaction
                # We use a product of amplitudes to keep E_ij between 0 and 1
                B[i, j] = amplitudes[i] * amplitudes[j]
        
        # Clip B values to ensure they are strictly positive for the log functional later,
        # and within [0, 1] for entanglement strength interpretation.
        B = np.clip(B, 1e-10, 1.0) # Ensure no exact zeros lead to problems in max-product

        # 2. Derive E_ij via Path-Product Composition
        # To ensure the Triangle Inequality holds, we solve for the maximum 
        # entanglement path. This guarantees E_ik >= E_ij * E_jk.
        E = np.copy(B)
        for k in range(num_q):
            # Compositional update mirroring how 'space' emerges from information [12, 14]
            E = np.maximum(E, np.outer(E[:, k], E[k, :]))

        # 3. Apply Horizon Design Conventions
        # We enforce E_ii = 0 as the 'no self-loop' convention [2].
        # The patched entanglement utility will interpret this as d_ii = 0.
        np.fill_diagonal(E, 0.0)
        
        # Ensure final E values are clipped again, especially if max-product could
        # somehow exceed 1 (though it shouldn't if B is clipped).
        self.adjacency_matrix = np.clip(E, 1e-10, 1.0)

    def project_data(self, new_lattice_state):
        """
        Writes information to the horizon via the Hawking Channel [3, 15].
        """
        if not isinstance(new_lattice_state, np.ndarray) or new_lattice_state.dtype != complex:
            raise ValueError("new_lattice_state must be a numpy array of complex numbers.")
        if new_lattice_state.shape[0] != self.num_qubits:
            raise ValueError(f"new_lattice_state must have {self.num_qubits} elements.")

        self.lattice = new_lattice_state
        # After the write event, we derive the new emergent geometry [5]
        self._derive_entanglement_matrix_from_profile()

    def get_lattice(self):
        """Returns the current state of the complex qubit lattice."""
        return self.lattice

    def get_adjacency_matrix(self):
        """Returns the current weighted adjacency matrix (entanglement graph)."""
        return self.adjacency_matrix

    def __str__(self):
        return f"Horizon Register: {self.num_qubits} qubits, entanglement graph built."
