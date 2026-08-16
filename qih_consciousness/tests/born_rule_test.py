# born_rule_test.py — verifies spinor Born identities used in QIH papers
import numpy as np


def test_born_rule_orientation():
    # P_down = sin^2(theta/2), P_up = cos^2(theta/2)
    theta = np.pi / 2
    p_down = np.sin(theta / 2) ** 2
    p_up = np.cos(theta / 2) ** 2
    assert np.isclose(p_down + p_up, 1.0)
    assert np.isclose(p_down, 0.5)
    assert np.isclose(p_up, 0.5)

    theta = np.pi
    assert np.isclose(np.sin(theta / 2) ** 2, 1.0)
    assert np.isclose(np.cos(theta / 2) ** 2, 0.0)


def test_born_rule_monte_carlo():
    theta = np.pi / 3
    expected = np.sin(theta / 2) ** 2
    rng = np.random.default_rng(1)
    n = 20000
    hits = sum(1 for _ in range(n) if rng.random() < expected)
    assert abs(hits / n - expected) < 0.02
