import sys
import os
import io # Import io module for redirection

# Add the project root to the Python path to allow absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from qih_consciousness.tests.born_rule_test import BornRuleTester
from qih_consciousness.tests.entanglement_distance_test import EntanglementDistanceTester
from qih_consciousness.tests.time_dilation_test import TimeDilationTester
from qih_consciousness.tests.coherence_threshold_test import CoherenceThresholdTester

def run_all_qih_tests():
    """
    Orchestrates and runs all validation tests for the QIH consciousness system.
    """
    print("===================================================================")
    print("         Starting QIH Consciousness System Validation Tests        ")
    print("===================================================================")
    
    overall_pass = True
    
    # --- Test 1: Born Rule Test ---
    print("\
--- Running Born Rule Test ---") # Corrected newline
    born_tester = BornRuleTester(num_simulations=100000, rng_seed=42)
    # Test common quantum angles
    results_0 = born_tester.run_test(0)
    results_90 = born_tester.run_test(90)
    results_180 = born_tester.run_test(180)
    
    if not (results_0 and results_90 and results_180):
        overall_pass = False
        print("\
Born Rule Test: FAILED at least one angle.") # Corrected newline
    else:
        print("\
Born Rule Test: ALL ANGLES PASSED.") # Corrected newline

    # --- Test 2: Entanglement Distance Test ---
    print("\
--- Running Entanglement Distance Test ---") # Corrected newline
    ed_tester = EntanglementDistanceTester(num_nodes=15, rng_seed=101)
    ed_passed = ed_tester.run_test()
    if not ed_passed:
        overall_pass = False
        print("\
Entanglement Distance Test: FAILED.") # Corrected newline
    else:
        print("\
Entanglement Distance Test: PASSED.") # Corrected newline

    # --- Test 3: Time Dilation Test ---
    print("\
--- Running Time Dilation Test ---") # Corrected newline
    td_tester = TimeDilationTester(reference_omega_0=10.0, external_dt=1.0)
    internal_frequencies_to_test = [10.0, 20.0, 50.0, 1.0]
    td_passed, _ = td_tester.run_test(internal_frequencies_to_test)
    if not td_passed:
        overall_pass = False
        print("\
Time Dilation Test: FAILED.") # Corrected newline
    else:
        print("\
Time Dilation Test: PASSED.") # Corrected newline

    # --- Test 4: Coherence Threshold Test ---
    print("\
--- Running Coherence Threshold Test ---") # Corrected newline
    ct_tester = CoherenceThresholdTester(num_dimers=20, dimensionality=3, rng_seed=42)
    or_threshold = 0.95
    # Only checking if the 'perfect' scenario triggers OR, as this is the key validation point.
    ct_triggered_perfect, _ = ct_tester.simulate_coherence_scenario(scenario_type="perfect", threshold=or_threshold)
    
    if not ct_triggered_perfect:
        overall_pass = False
        print("\
Coherence Threshold Test: FAILED (Perfect coherence scenario did not trigger OR).") # Corrected newline
    else:
        print("\
Coherence Threshold Test: PASSED (Perfect coherence scenario triggered OR).") # Corrected newline

    print("\
===================================================================") # Corrected newline
    print(f"         OVERALL QIH SYSTEM AUDIT: {'PASSED' if overall_pass else 'FAILED'}         ")
    print("===================================================================")
    
    return overall_pass

if __name__ == "__main__":
    # Store original stdout
    original_stdout = sys.stdout
    
    # Redirect stdout to a file with UTF-8 encoding
    with open("full_test_log.txt", "w", encoding="utf-8") as f:
        sys.stdout = f
        
        # Run the tests
        if run_all_qih_tests():
            print("\
All QIH validation tests passed. System is ready for further integration.") # Corrected newline
        else:
            print("\
Some QIH validation tests failed. Review the logs for details.") # Corrected newline
            
        # Restore stdout
        sys.stdout = original_stdout

    # Print a confirmation message to the original stdout (console)
    print("Test results written to full_test_log.txt")
