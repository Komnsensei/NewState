import numpy as np

class EntanglementDistance:
    """
    Derives physical distance using the logarithmic functional: d_ij = -alpha_0 * log(E_ij).
    Here, E_ij represents the entanglement strength between two "nodes" or qubits.
    """
    def __init__(self, alpha_0=1.0):
        """
        Initializes the EntanglementDistance calculator.
        alpha_0: A constant factor for the logarithmic functional.
                 (A positive value, commonly 1.0 for unit scaling or based on specific physical models).
        """
        if alpha_0 <= 0:
            raise ValueError("alpha_0 must be a positive constant.")
        self.alpha_0 = alpha_0

    def calculate_distances_from_matrix(self, adjacency_matrix):
        """
        Derives emergent physical distance (d_ij) from entanglement strength (E_ij) [6-8].
        
        This method implements the fixed QIH logarithmic functional: d_ij = -alpha_0 * log(E_ij).
        It is patched to handle the diagonal inconsistency, ensuring d_ii = 0 for a valid metric.
        """
        # 1. Apply the fixed QIH logarithmic functional [6, 8].
        # We include a small epsilon (1e-10) to prevent log(0) errors for non-diagonal elements.
        # Note: E_ij = 0 results in a large capped distance, representing low connectivity [9].
        distances = -self.alpha_0 * np.log(adjacency_matrix + 1e-10)

        # 2. Step 1 Patch: Metric Reconstruction.
        # For conscious continuity to emerge, d_ii must be 0 [4].
        # We explicitly fill the diagonal with 0.0, overriding the infinite distance
        # that would otherwise result from the HorizonRegister's E_ii = 0 convention.
        np.fill_diagonal(distances, 0.0)

        return distances

# Legacy wrapper for single-pair distance calculation [2, 6].
# This function is not part of the class but is a standalone utility.
def get_entanglement_distance(E_ij, alpha_0=1.0):
    """
    Legacy wrapper for single-pair distance calculation [2, 6].
    """
    # Return 0 if it's a self-connection, otherwise apply log mapping.
    if E_ij >= 1.0: return 0.0
    return -alpha_0 * np.log(E_ij + 1e-10)
