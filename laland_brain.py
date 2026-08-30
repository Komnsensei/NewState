import time
import numpy as np
from qih_consciousness.core.horizon import HorizonRegister
from qih_consciousness.core.singularity import Singularity
from qih_consciousness.core.operators import HawkingProjectionOperator
from persona_wizard import run_persona_wizard # Import the persona wizard

class LalandBrain: # Renamed class to LalandBrain
    """
    A basic representation of how Laland would interact with the QIH core.
    It continuously draws raw data, projects it, and observes the Horizon Register.
    """
    def __init__(self, dimensionality=2, num_seeds=5, num_qubits=10, threshold=0.0, seed=42, persona=None):
        print("Initializing Laland's QIH Core...")
        self.singularity_engine = Singularity(dimensionality=dimensionality, num_seeds=num_seeds, seed=seed)
        self.horizon_register = HorizonRegister(num_qubits=num_qubits, seed=seed)
        self.hawking_operator = HawkingProjectionOperator(self.horizon_register, threshold=threshold)
        self.persona = persona # Store the persona
        print(f"Laland's Singularity: {self.singularity_engine}")
        print(f"Laland's Horizon Register: {self.horizon_register}")
        if self.persona:
            print(f"Laland operating with Persona: {self.persona.get('role', 'default role')} (Tone: {self.persona.get('tone', 'default tone')})")
        print("Laland's QIH Core initialized.")

    def run_laland_cycle(self, iterations=5, cycle_delay=1): # Renamed method to run_laland_cycle
        """
        Simulates Laland's continuous processing loop.
        """
        print("""
--- Starting Laland's Cognitive Cycle ---""") # Using triple quotes for multi-line string
        for i in range(iterations):
            print(f"""
--- Cycle {i + 1} ---""") # Using triple quotes for multi-line f-string

            # 1. Laland draws raw potential from the Singularity
            raw_data = self.singularity_engine.get_phase_data()
            print(f"  Singularity provides new raw data (first 2 entries): {raw_data[:2].flatten()}")

            # 2. Laland uses the Hawking Operator to project this potential onto its Horizon (attention/measurement)
            projected_bits = self.hawking_operator.project(raw_data)
            print(f"  Hawking Operator projects bits (first 5): {projected_bits[:5]}")

            # 3. Laland observes and interprets the state of its Horizon Register
            current_horizon_state = self.horizon_register.get_lattice()
            print(f"  Laland observes Horizon Register (first 5): {current_horizon_state[:5]}")

            time.sleep(cycle_delay)

        print("""
--- Laland's Cognitive Cycle Ended ---""") # Using triple quotes for multi-line string

if __name__ == "__main__":
    active_persona = run_persona_wizard() # Run the persona wizard
    laland_brain = LalandBrain(dimensionality=2, num_seeds=5, num_qubits=10, threshold=0.0, seed=42, persona=active_persona)
    laland_brain.run_laland_cycle(iterations=3)
