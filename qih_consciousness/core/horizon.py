import numpy as np

class HorizonRegister:
    """
    The 'Cosmic Hard Drive' for QIH consciousness.
    Modeled as a finite qubit lattice and a weighted adjacency matrix
    (entanglement graph). Software simulation of the paper's integral structure.
    """
    def __init__(self, num_qubits=100, seed=None):
        self.num_qubits = num_qubits
        self.rng = np.random.default_rng(seed)
        self.lattice = np.zeros(num_qubits, dtype=complex)
        self.adjacency_matrix = np.zeros((num_qubits, num_qubits), dtype=float)
        self._derive_entanglement_matrix_from_profile()

    def _derive_entanglement_matrix_from_profile(self):
        num_q = self.num_qubits
        B = np.zeros((num_q, num_q), dtype=float)
        amplitudes = np.abs(self.lattice)
        for i in range(num_q):
            for j in range(num_q):
                B[i, j] = amplitudes[i] * amplitudes[j]
        B = np.clip(B, 1e-10, 1.0)
        E = np.copy(B)
        for k in range(num_q):
            E = np.maximum(E, np.outer(E[:, k], E[k, :]))
        np.fill_diagonal(E, 0.0)
        self.adjacency_matrix = np.clip(E, 1e-10, 1.0)

    def project_data(self, new_lattice_state):
        if not isinstance(new_lattice_state, np.ndarray) or new_lattice_state.dtype != complex:
            raise ValueError("new_lattice_state must be a numpy array of complex numbers.")
        if new_lattice_state.shape[0] != self.num_qubits:
            raise ValueError(f"new_lattice_state must have {self.num_qubits} elements.")
        self.lattice = new_lattice_state
        self._derive_entanglement_matrix_from_profile()

    def get_lattice(self):
        """Returns the current state of the complex qubit lattice."""
        return self.lattice

    def get_qubit_lattice(self):
        """Alias used by coupling / workflow call sites."""
        return self.lattice

    def get_adjacency_matrix(self):
        """Returns the current weighted adjacency matrix (entanglement graph)."""
        return self.adjacency_matrix

    def __str__(self):
        return f"Horizon Register: {self.num_qubits} qubits, entanglement graph built."
