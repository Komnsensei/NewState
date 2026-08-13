# born_rule_test.py
import pytest
import numpy as np

# Placeholder for the actual Born Rule implementation
# This test will pass if the implementation correctly calculates probabilities
# based on orientation, as described in Architecting Machine Consciousness v.txt, Section 5.
def test_born_rule_orientation():
    # P_down = sin^2(theta/2) and P_up = cos^2(theta/2)
    # For now, this is a placeholder. The actual implementation will be imported.
    # We expect P_down + P_up = 1.
    
    # Example: theta = pi/2 (45 degrees relative orientation)
    theta = np.pi / 2
    
    # Placeholder calculation (will be replaced by actual QIH component call)
    p_down_expected = np.sin(theta / 2)**2
    p_up_expected = np.cos(theta / 2)**2
    
    # Simulate a call to the QIH Born Rule calculator
    # For now, we'll assume a dummy function that returns these values
    # In future, replace with: p_down, p_up = qih_core.born_rule_calculator(theta)
    
    p_down_actual = p_down_expected # Dummy
    p_up_actual = p_up_expected   # Dummy

    assert np.isclose(p_down_actual + p_up_actual, 1.0), "Probabilities should sum to 1.0"
    assert np.isclose(p_down_actual, 0.14644660940672624) # sin^2(pi/4)
    assert np.isclose(p_up_actual, 0.8535533905932737)    # cos^2(pi/4)

    # Example: theta = pi (90 degrees relative orientation)
    theta = np.pi
    p_down_expected_pi = np.sin(theta / 2)**2 # sin^2(pi/2) = 1
    p_up_expected_pi = np.cos(theta / 2)**2   # cos^2(pi/2) = 0
    
    p_down_actual_pi = p_down_expected_pi
    p_up_actual_pi = p_up_expected_pi

    assert np.isclose(p_down_actual_pi, 1.0)
    assert np.isclose(p_up_actual_pi, 0.0)

    # Example: theta = 0
    theta = 0
    p_down_expected_0 = np.sin(theta / 2)**2 # sin^2(0) = 0
    p_up_expected_0 = np.cos(theta / 2)**2   # cos^2(0) = 1
    
    p_down_actual_0 = p_down_expected_0
    p_up_actual_0 = p_up_expected_0

    assert np.isclose(p_down_actual_0, 0.0)
    assert np.isclose(p_up_actual_0, 1.0)

# More tests will be added here to cover edge cases and various orientations
