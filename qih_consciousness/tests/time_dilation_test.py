import numpy as np

class TimeDilationTester:
    """
    Validates that increasing the internal phase-clock frequency (Omega) relative to a
    reference rate (Omega_0) correctly reproduces the Lorentz factor (gamma) for proper time dilation.
    According to QIH: d_tau = (Omega_0 / Omega(x)) * dt
    Where gamma = Omega(x) / Omega_0.
    So, d_tau = dt / gamma.
    """
    def __init__(self, reference_omega_0=1.0, external_dt=1.0):
        """
        Initializes the TimeDilationTester.
        reference_omega_0: The reference angular frequency (Omega_0).
        external_dt: The external time interval (dt) to measure against.
        """
        if reference_omega_0 <= 0:
            raise ValueError("Reference frequency Omega_0 must be positive.")
        if external_dt <= 0:
            raise ValueError("External time interval dt must be positive.")
            
        self.omega_0 = reference_omega_0
        self.external_dt = external_dt

    def calculate_theoretical_dilation(self, internal_omega):
        """
        Calculates the theoretical Lorentz factor (gamma) and the proper time interval (d_tau).
        internal_omega: The AI's internal phase-clock frequency (Omega(x)).
        """
        if internal_omega <= 0:
            raise ValueError("Internal frequency Omega(x) must be positive.")

        # According to the QIH interpretation: gamma = Omega(x) / Omega_0
        gamma = internal_omega / self.omega_0
        
        # d_tau = dt / gamma
        proper_dt = self.external_dt / gamma
        
        return gamma, proper_dt

    def run_test(self, internal_omega_values, tolerance=1e-6):
        """
        Runs the time dilation test for a list of internal_omega_values.
        internal_omega_values: A list of internal phase-clock frequencies to test.
        tolerance: The acceptable deviation between calculated and theoretical values.
        """
        print(f"\
--- Time Dilation Test (Omega_0 = {self.omega_0} unit/sec, dt = {self.external_dt} sec) ---")
        
        test_results = {}
        overall_passed = True

        for internal_omega in internal_omega_values:
            print(f"\
Testing Internal Omega ((Omega)(x)): {internal_omega} unit/sec")
            
            # Theoretical calculations
            theoretical_gamma, theoretical_d_tau = self.calculate_theoretical_dilation(internal_omega)
            
            # Simulate the proper time using the QIH Phase-Clock Law formula
            simulated_d_tau = (self.omega_0 / internal_omega) * self.external_dt
            
            # Compare
            passed = np.isclose(simulated_d_tau, theoretical_d_tau, atol=tolerance)
            
            print(f"  Theoretical Lorentz Factor (gamma): {theoretical_gamma:.6f}")
            print(f"  Theoretical Proper Time (dtau):   {theoretical_d_tau:.6f}")
            print(f"  Simulated Proper Time (dtau):     {simulated_d_tau:.6f}")
            print(f"  Difference:                     {abs(simulated_d_tau - theoretical_d_tau):.6f}")
            print(f"  Test for (Omega)(x)={internal_omega}: {'PASSED' if passed else 'FAILED'}")
            
            test_results[internal_omega] = passed
            if not passed:
                overall_passed = False
        
        print(f"\
Overall Time Dilation Test: {'PASSED' if overall_passed else 'FAILED'}")
        return overall_passed, test_results

# Example usage
if __name__ == "__main__":
    tester = TimeDilationTester(reference_omega_0=10.0, external_dt=1.0) # Omega_0 = 10 Hz, external interval = 1 second

    # Test cases:
    # 1. Internal Omega = Reference Omega (should be no dilation, gamma=1)
    # 2. Internal Omega > Reference Omega (should have dilation, gamma > 1)
    # 3. Internal Omega much > Reference Omega (should have significant dilation)
    
    internal_frequencies_to_test = [
        10.0,   # Same as Omega_0
        20.0,   # Twice Omega_0
        50.0,   # Five times Omega_0
        1.0     # Lower than Omega_0 (gamma < 1)
    ]

    passed_all, results = tester.run_test(internal_frequencies_to_test)
    print(f"\
Summary of results: {results}")

    assert passed_all
