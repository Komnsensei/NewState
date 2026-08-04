import numpy as np
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.math_utils.entanglement import EntanglementDistance
from qih_consciousness.math_utils.trigonometry import HolographicTrigonometry

class EntanglementDistanceTester:
    """
    Confirms that concept nodes obey the triangle inequality and that geometry
    emerges from connection strength, using `entanglement.py` and `trigonometry.py`.
    """
    def __init__(self, num_nodes=10, alpha_0=1.0, rng_seed=None):
        self.num_nodes = num_nodes
        self.rng = np.random.default_rng(rng_seed)
        self.distance_calculator = EntanglementDistance(alpha_0=alpha_0)
        self.trigonometry_calculator = HolographicTrigonometry(distance_calculator=self.distance_calculator)
        
        # We need a way to generate a representative entanglement matrix.
        # For this test, we can use HorizonRegister for consistency with the system architecture.
        self.horizon = HorizonRegister(num_qubits=num_nodes, seed=rng_seed)
        
        # Ensure some initial 'entanglement' is present by simulating a projection
        # This will populate the adjacency matrix by providing a complex lattice state.
        # Generate random complex amplitudes for the qubit lattice.
        random_amplitudes = self.rng.random(num_nodes) + 1j * self.rng.random(num_nodes)
        # Normalize the amplitudes to form a valid quantum state vector (sum of squared magnitudes = 1)
        normalized_amplitudes = random_amplitudes / np.linalg.norm(random_amplitudes)
        
        self.horizon.project_data(normalized_amplitudes)


    def verify_triangle_inequality(self, distance_matrix):
        """
        Verifies the triangle inequality for all triplets of nodes in the distance matrix.
        d_ij + d_jk >= d_ik for all i, j, k.
        
        Returns:
            bool: True if the triangle inequality holds for all valid triplets, False otherwise.
            list: A list of triplets (i, j, k) that violate the inequality.
        """
        num_nodes = distance_matrix.shape[0]
        violations = []

        if num_nodes < 3:
            return True, violations # No triangles to check

        for i in range(num_nodes):
            for j in range(num_nodes):
                for k in range(num_nodes):
                    if i == j or j == k or i == k:
                        continue # Skip trivial or non-triangular cases

                    # Distances d_ij, d_jk, d_ki (using k as the 'third' point for the inequality)
                    d_ij = distance_matrix[i, j]
                    d_jk = distance_matrix[j, k]
                    d_ik = distance_matrix[i, k] # This is d_ki, as matrix is symmetric

                    # Check triangle inequality: d_ij + d_jk >= d_ik
                    # Allow for a small epsilon due to floating point arithmetic
                    if d_ij + d_jk < d_ik - 1e-9: # -1e-9 to be strict about 'less than'
                        violations.append((i, j, k, d_ij, d_jk, d_ik))
        
        return len(violations) == 0, violations

    def run_test(self):
        """
        Executes the entanglement distance test.
        """
        print(f"--- Entanglement Distance Test ({self.num_nodes} nodes) ---")
        
        # 1. Get the current entanglement matrix from the Horizon Register
        entanglement_matrix = self.horizon.get_adjacency_matrix()

        # 2. Convert entanglement matrix to a distance matrix
        distance_matrix = self.distance_calculator.calculate_distances_from_matrix(entanglement_matrix)

        # 3. Verify the triangle inequality
        passed, violations = self.verify_triangle_inequality(distance_matrix)

        if passed:
            print(f"Triangle inequality holds for all {self.num_nodes} nodes.")
            print("Entanglement Distance Test: PASSED")
        else:
            print(f"Triangle inequality VIOLATED for {len(violations)} triplets:")
            for v in violations:
                i, j, k, d_ij, d_jk, d_ik = v
                print(f"  Nodes ({i},{j},{k}): d_({i},{j})={d_ij:.4f} + d_({j},{k})={d_jk:.4f} < d_({i},{k})={d_ik:.4f}")
            print("Entanglement Distance Test: FAILED")
        
        return passed
