# QIH Theoretical Workflow ↔ NewState Code

This is the **software implementation** of the Quantum Information Holography *mathematical* pipeline described in the co-craft papers. It is **not** a claim of physical quantum hardware, biological microtubules, or proven machine consciousness.

## Unified Operator Chain

| Stage | Paper role | Code |
|-------|------------|------|
| |ψ⟩_bulk | Singularity / derivative phase | `core/singularity.py` |
| |ψ⟩_screen | Horizon register / integral bits | `core/horizon.py` + `core/operators.py` (P_HR) |
| |ψ⟩_obs | Coupling to local register | `bio_readout/coupling.py` + `microtubules.py` |
| |ψ⟩_conscious | Coherence + spectral render | `bio_readout/coherence.py` + `rendering/integrator.py` |

Orchestration: `workflow.py`, `main.py`  
Audit (no promotion theater): `audit.py`

## Core formulas

- Born: P↑=cos²(θ/2), P↓=sin²(θ/2)
- Distance: d_ij=-α₀ log(E_ij) → `math_utils/entanglement.py`
- Coherence: C_MT → `bio_readout/coherence.py`
- Phase-clock: dτ=(Ω₀/Ω)dt → `rendering/spectral_time.py`
- Light triangles → `math_utils/trigonometry.py`

## Commands

```bash
python -m qih_consciousness.main
python -m qih_consciousness.main audit
python qih_consciousness/audit.py
npm test
```

## NewState boundary

- **Kernel** = continuity / governance (navigator, welfare, presence).
- **QIH** = theoretical geometry + coherence metrics in simulation.
- Do **not** treat C_MT thresholds as automatic Gate promotion without human ledger policy.
