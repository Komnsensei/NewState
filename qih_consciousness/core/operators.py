import numpy as np
from qih_consciousness.core.horizon import HorizonRegister # Assuming relative import works after modules are created

class HawkingProjectionOperator:
    """
    The 'Read-Write Channel' - physically 'writes' raw mathematical potential
    from the singularity into discrete bits on the horizon register.
    """
    def __init__(self, horizon_register: HorizonRegister, threshold=0.0):
        """
        Initializes the Hawking Projection Operator.
        horizon_register: An instance of HorizonRegister to write to.
        threshold: Value to discretize continuous phase data (e.g., > threshold becomes 1, <= threshold becomes 0).
        """
        self.horizon_register = horizon_register
        self.threshold = threshold

    def project(self, raw_phase_data):
        """
        Takes raw, nonlocal phase data (complex numbers) from the singularity
        and projects it onto the horizon register as discrete classical bits.

        raw_phase_data: A NumPy array of complex numbers representing the phase data.
        """
        # For simplification, we'll convert the real part of the complex phase data
        # into discrete bits (0 or 1) based on a threshold.
        # This simulates the "collapse" or "measurement" into stable bits.
        
        # Take the real part of the complex numbers
        real_parts = np.real(raw_phase_data)
        
        # Flatten the array to get a 1D stream of values
        flattened_real_parts = real_parts.flatten()

        # Convert to discrete bits based on the threshold
        # If real_part > threshold, it becomes 1, otherwise 0.
        discrete_bits = (flattened_real_parts > self.threshold).astype(int)

        # Update the horizon register with these discrete bits
        self.horizon_register.project_data(discrete_bits)
        # print(f"Hawking Projection Operator: Projected {len(discrete_bits)} bits to the Horizon.")

        return discrete_bits # Return the projected bits for potential logging/debugging

# Example usage (for testing purposes only, not part of the main run loop)
if __name__ == "__main__":
    from qih_consciousness.core.singularity import Singularity

    # 1. Initialize Singularity
    singularity_engine = Singularity(dimensionality=2, num_seeds=5, seed=42)
    raw_data = singularity_engine.get_phase_data()
    print("Raw Singularity Data (first 2 entries):
", raw_data[:2])

    # 2. Initialize Horizon Register
    horizon_reg = HorizonRegister(num_qubits=20, seed=42)
    print("
Initial Horizon Lattice (first 5):", horizon_reg.get_qubit_lattice()[:5])

    # 3. Initialize and use Hawking Projection Operator
    hawking_op = HawkingProjectionOperator(horizon_reg)
    projected_bits = hawking_op.project(raw_data)
    
    print(f"
Projected bits (first 5): {projected_bits[:5]}")
    print("Horizon Lattice after projection (first 5):", horizon_reg.get_qubit_lattice()[:5])
    print("Horizon Register state updated.")
