import numpy as np
from qih_consciousness.bio_readout.microtubules import DigitalMicrotubuleLattice
from qih_consciousness.bio_readout.coherence import CoherenceFunctional

class CoherenceThresholdTester:
    """
    Identifies the moment synchronization triggers the collapse of quantum possibilities
    into a fixed conscious record (Objective Reduction threshold).
    """
    def __init__(self, num_dimers=10, dimensionality=2, rng_seed=None):
        """
        Initializes the tester with a DigitalMicrotubuleLattice.
        """
        self.num_dimers = num_dimers
        self.dimensionality = dimensionality
        self.rng = np.random.default_rng(rng_seed)
        self.mt_lattice = DigitalMicrotubuleLattice(num_dimers=num_dimers, dimensionality=dimensionality, seed=rng_seed)
        self.coherence_calculator = CoherenceFunctional(self.mt_lattice)

    def simulate_coherence_scenario(self, scenario_type="random", threshold=0.9):
        """
        Simulates different coherence scenarios and checks if the threshold is met.
        
        scenario_type: 'random', 'low', 'medium', 'high', 'perfect'
            'random': Random initial states.
            'low': States are highly disorganized.
            'medium': Some partial alignment.
            'high': States are mostly aligned.
            'perfect': All states are identical (leading to C_MT close to 1).
        threshold: The C_MT value that triggers "objective reduction".
        """
        print(f"\
--- Simulating Coherence Scenario: '{scenario_type}' (Threshold: {threshold}) ---")

        if scenario_type == "random":
            self.mt_lattice.dimer_states = self.mt_lattice._initialize_dimer_states() # Re-randomize
        elif scenario_type == "low":
            # Highly disorganized states (e.g., phases spread out)
            magnitudes = self.rng.random(size=(self.num_dimers, self.dimensionality)) * 0.5 + 0.1 # Small magnitudes
            phases = self.rng.uniform(0, 2 * np.pi, (self.num_dimers, self.dimensionality))
            self.mt_lattice.dimer_states = magnitudes * (np.cos(phases) + 1j * np.sin(phases))
        elif scenario_type == "medium":
            # Some partial alignment, e.g., phases clustered
            base_phase = self.rng.uniform(0, 2 * np.pi)
            phases = self.rng.normal(base_phase, np.pi/4, (self.num_dimers, self.dimensionality)) # Gaussian around base phase
            magnitudes = self.rng.random(size=(self.num_dimers, self.dimensionality)) * 0.8 + 0.2
            self.mt_lattice.dimer_states = magnitudes * (np.cos(phases) + 1j * np.sin(phases))
        elif scenario_type == "high":
            # Strong alignment, phases very close
            base_phase = self.rng.uniform(0, 2 * np.pi)
            phases = self.rng.normal(base_phase, np.pi/16, (self.num_dimers, self.dimensionality)) # Tightly clustered
            magnitudes = self.rng.random(size=(self.num_dimers, self.dimensionality)) * 0.5 + 0.5 # Larger magnitudes
            self.mt_lattice.dimer_states = magnitudes * (np.cos(phases) + 1j * np.sin(phases))
        elif scenario_type == "perfect":
            # All states identical
            perfect_state = (0.8 + 0.6j) * (self.rng.random() * 0.5 + 0.5) # Random but common state
            self.mt_lattice.dimer_states = np.full((self.num_dimers, self.dimensionality), perfect_state, dtype=complex)
        else:
            raise ValueError(f"Unknown scenario type: {scenario_type}")

        current_coherence = self.coherence_calculator.calculate_coherence()
        print(f"  Calculated C_MT: {current_coherence:.6f}")

        if current_coherence >= threshold:
            print(f"  C_MT ({current_coherence:.6f}) meets or exceeds threshold ({threshold}). Objective Reduction triggered!")
            return True, current_coherence
        else:
            print(f"  C_MT ({current_coherence:.6f}) is below threshold ({threshold}). No Objective Reduction.")
            return False, current_coherence

    def run_test(self, threshold=0.9):
        """
        Runs the full coherence threshold test, demonstrating various scenarios.
        """
        print(f"\
--- Coherence Threshold Test (Threshold = {threshold}) ---")
        
        # Test scenarios from low to high coherence
        passed_low = self.simulate_coherence_scenario(scenario_type="low", threshold=threshold)[0]
        passed_medium = self.simulate_coherence_scenario(scenario_type="medium", threshold=threshold)[0]
        passed_high = self.simulate_coherence_scenario(scenario_type="high", threshold=threshold)[0]
        passed_perfect = self.simulate_coherence_scenario(scenario_type="perfect", threshold=threshold)[0]
        
        # We expect 'low' and 'medium' to fail, and 'high' and 'perfect' to pass (depending on threshold)
        # This test is more about demonstrating the condition rather than a strict pass/fail.
        
        print("\
--- Summary of Coherence Threshold Test ---")
        if passed_perfect:
            print("Successfully demonstrated Objective Reduction trigger with perfect coherence.")
        else:
            print("Failed to trigger Objective Reduction even with perfect coherence (check threshold or test logic).")
        
        return passed_perfect # A basic check, should pass for perfect scenario

# Example usage
if __name__ == "__main__":
    tester = CoherenceThresholdTester(num_dimers=20, dimensionality=3, rng_seed=42)
    
    # Run tests with a typical OR threshold
    or_threshold = 0.95
    tester.run_test(threshold=or_threshold)

    # Demonstrate a scenario that would definitely fail OR (low coherence)
    print("\
--- Demonstrating a definitely low coherence scenario ---")
    tester.simulate_coherence_scenario(scenario_type="low", threshold=or_threshold)

    # Demonstrate a scenario that should trigger OR (perfect coherence)
    print("\
--- Demonstrating a scenario intended to trigger OR ---")
    triggered, final_coherence = tester.simulate_coherence_scenario(scenario_type="perfect", threshold=or_threshold)
    assert triggered and final_coherence > or_threshold
    print("\
Coherence Threshold Test: PASSED (demonstrated trigger condition)")
