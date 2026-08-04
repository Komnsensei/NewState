import numpy as np
from qih_consciousness.math_utils.entanglement import EntanglementDistance

class HolographicTrigonometry:
    """
    Implements Holographic Trigonometry to solve for internal angles
    within the emergent geometry, given entanglement-derived distances.
    Assumes a Euclidean-like geometry for angle calculations (e.g., using cosine rule).
    """
    def __init__(self, distance_calculator: EntanglementDistance = None):
        """
        Initializes the HolographicTrigonometry with an optional distance calculator.
        """
        self.distance_calculator = distance_calculator or EntanglementDistance()

    def calculate_angle_from_distances(self, d_ab, d_bc, d_ac):
        """
        Calculates the angle at node B in a triangle formed by nodes A, B, C,
        given the side lengths d_ab (c), d_bc (a), and d_ac (b).
        Using the Law of Cosines: b^2 = a^2 + c^2 - 2ac * cos(B)
        So, cos(B) = (a^2 + c^2 - b^2) / (2ac)
        
        Args:
            d_ab (float): Distance between node A and B. (Side 'c')
            d_bc (float): Distance between node B and C. (Side 'a')
            d_ac (float): Distance between node A and C. (Side 'b')

        Returns:
            float: The angle at node B in radians. Returns NaN if sides are invalid
                   (e.g., violate triangle inequality or negative lengths).
        """
        # Rename for clarity with cosine rule notation
        a = d_bc
        c = d_ab
        b = d_ac

        # Check for non-physical distances (should be handled by EntanglementDistance clipping)
        if a <= 0 or c <= 0:
            return np.nan # Cannot form a triangle with zero or negative side lengths

        # Calculate cosine of the angle
        # Robustness: ensure argument for arccos is within [-1, 1] due to floating point inaccuracies
        try:
            cos_B_numerator = a**2 + c**2 - b**2
            cos_B_denominator = 2 * a * c
            
            # Avoid division by zero if a or c is effectively zero
            if np.isclose(cos_B_denominator, 0):
                return np.nan

            cos_B = cos_B_numerator / cos_B_denominator
            
            # Clip cos_B to ensure it's within valid range for np.arccos
            cos_B = np.clip(cos_B, -1.0, 1.0)
            
            angle_B_rad = np.arccos(cos_B)
            return angle_B_rad
        except Exception:
            return np.nan # For any other numerical issues

    def get_angles_from_distance_matrix(self, distance_matrix):
        """
        Analyzes a distance matrix and returns a list of all possible angles
        (in radians) for all unique triangles formed by the nodes.
        
        Args:
            distance_matrix (np.ndarray): A symmetric N x N distance matrix.
        
        Returns:
            list: A list of calculated angles (in radians).
        """
        num_nodes = distance_matrix.shape[0]
        angles = []

        if num_nodes < 3:
            return angles # Cannot form a triangle with less than 3 nodes

        for i in range(num_nodes):
            for j in range(i + 1, num_nodes):
                for k in range(j + 1, num_nodes):
                    # Nodes are i, j, k
                    # Sides: d_ij, d_jk, d_ki
                    d_ij = distance_matrix[i, j]
                    d_jk = distance_matrix[j, k]
                    d_ki = distance_matrix[k, i]

                    # Calculate angles at each vertex (e.g., angle at i, angle at j, angle at k)
                    angle_at_i = self.calculate_angle_from_distances(d_ki, d_ij, d_jk) # d_ki (c), d_ij (a), d_jk (b)
                    angle_at_j = self.calculate_angle_from_distances(d_ij, d_jk, d_ki) # d_ij (c), d_jk (a), d_ki (b)
                    angle_at_k = self.calculate_angle_from_distances(d_jk, d_ki, d_ij) # d_jk (c), d_ki (a), d_ij (b)

                    if not np.isnan(angle_at_i): angles.append(angle_at_i)
                    if not np.isnan(angle_at_j): angles.append(angle_at_j)
                    if not np.isnan(angle_at_k): angles.append(angle_at_k)
        
        return angles

# Example usage
if __name__ == "__main__":
    trigonometry_calculator = HolographicTrigonometry()

    # Test case 1: A right-angled triangle (3-4-5) - assuming these are distances directly
    d_ab, d_bc, d_ac = 3, 4, 5
    angle_b = trigonometry_calculator.calculate_angle_from_distances(d_ab, d_bc, d_ac)
    print(f"Angle at B for 3-4-5 triangle: {np.degrees(angle_b):.2f}° (expected 90°)")
    assert np.isclose(np.degrees(angle_b), 90.0)

    # Test case 2: Equilateral triangle (sides all equal)
    d_x, d_y, d_z = 1, 1, 1
    angle_eq = trigonometry_calculator.calculate_angle_from_distances(d_x, d_y, d_z)
    print(f"Angle for equilateral triangle: {np.degrees(angle_eq):.2f}° (expected 60°)")
    assert np.isclose(np.degrees(angle_eq), 60.0)

    # Test case 3: From an adjacency/distance matrix (requires EntanglementDistance)
    ent_dist_calc = EntanglementDistance(alpha_0=1.0)
    adj_matrix = np.array([
        [0.0, 0.8, 0.1, 0.5],
        [0.8, 0.0, 0.7, 0.2],
        [0.1, 0.7, 0.0, 0.9],
        [0.5, 0.2, 0.9, 0.0]
    ])
    distance_matrix_from_entanglement = ent_dist_calc.calculate_distances_from_matrix(adj_matrix)
    print("\
Distance Matrix from Entanglement:\
", distance_matrix_from_entanglement.round(4))

    htrig = HolographicTrigonometry(ent_dist_calc)
    all_angles = htrig.get_angles_from_distance_matrix(distance_matrix_from_entanglement)
    print(f"\
Calculated angles from distance matrix (first 5 in degrees):\
{[np.degrees(a) for a in all_angles[:5]]}")

    # Check for invalid triangle (e.g., a+b < c)
    d_fail_ab, d_fail_bc, d_fail_ac = 1, 1, 5 # 1+1 < 5 is false
    angle_fail = trigonometry_calculator.calculate_angle_from_distances(d_fail_ab, d_fail_bc, d_fail_ac)
    print(f"\
Angle for invalid triangle (1,1,5): {angle_fail} (expected NaN)")
    assert np.isnan(angle_fail)
