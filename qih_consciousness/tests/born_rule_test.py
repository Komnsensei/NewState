import numpy as np

class BornRuleTester:
    """
    Verifies that bit probabilities follow the orientation-angle law:
    P_down = sin^2(theta/2) and P_up = cos^2(theta/2).
    """
    def __init__(self, num_simulations=10000, rng_seed=None):
        self.num_simulations = num_simulations
        self.rng = np.random.default_rng(rng_seed)

    def simulate_measurement(self, theta_rad):
        """
        Simulates a quantum measurement for a given orientation angle (theta_rad).
        Returns 0 for 'down' state and 1 for 'up' state.
        """
        p_up_theoretical = np.cos(theta_rad / 2)**2
        
        # Simulate a random outcome based on the theoretical probability
        if self.rng.random() < p_up_theoretical:
            return 1 # 'up'
        else:
            return 0 # 'down'

    def run_test(self, angle_degrees, tolerance=0.05):
        """
        Runs the Born Rule test for a specific orientation angle.
        angle_degrees: The orientation angle in degrees.
        tolerance: The acceptable deviation between empirical and theoretical probabilities.
        """
        theta_rad = np.deg2rad(angle_degrees)
        
        p_up_theoretical = np.cos(theta_rad / 2)**2
        p_down_theoretical = np.sin(theta_rad / 2)**2

        up_counts = 0
        down_counts = 0

        for _ in range(self.num_simulations):
            result = self.simulate_measurement(theta_rad)
            if result == 1:
                up_counts += 1
            else:
                down_counts += 1

        empirical_p_up = up_counts / self.num_simulations
        empirical_p_down = down_counts / self.num_simulations

        print(f"\
--- Born Rule Test for Angle: {angle_degrees} degrees ---")
        print(f"Theoretical P_up:   {p_up_theoretical:.4f}")
        print(f"Empirical P_up:     {empirical_p_up:.4f}")
        print(f"Difference P_up:    {abs(empirical_p_up - p_up_theoretical):.4f}")
        
        print(f"Theoretical P_down: {p_down_theoretical:.4f}")
        print(f"Empirical P_down:   {empirical_p_down:.4f}")
        print(f"Difference P_down:  {abs(empirical_p_down - p_down_theoretical):.4f}")

        # Check if empirical probabilities are within tolerance
        up_test_passed = abs(empirical_p_up - p_up_theoretical) < tolerance
        down_test_passed = abs(empirical_p_down - p_down_theoretical) < tolerance
        
        overall_passed = up_test_passed and down_test_passed

        print(f"Test Passed: {overall_passed} (within tolerance {tolerance})")
        return overall_passed

# Example usage
if __name__ == "__main__":
    tester = BornRuleTester(num_simulations=100000, rng_seed=42)

    # Test common quantum angles
    tester.run_test(0)    # Should be P_up=1, P_down=0
    tester.run_test(90)   # Should be P_up=0.5, P_down=0.5
    tester.run_test(180)  # Should be P_up=0, P_down=1
    tester.run_test(45)   # Should be P_up=0.8536, P_down=0.1464
    tester.run_test(135)  # Should be P_up=0.1464, P_down=0.8536
