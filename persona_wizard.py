import json
import os

PERSONA_FILE = "persona_config.json" # Relative path within NewState/

def load_persona(file_path=PERSONA_FILE):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Could not decode persona file at {file_path}. Starting fresh.")
            return None
    return None

def save_persona(persona_data, file_path=PERSONA_FILE):
    with open(file_path, 'w') as f:
        json.dump(persona_data, f, indent=4)
    print(f"Persona saved to {file_path}")

def run_persona_wizard():
    print("
--- BRO Persona Builder Wizard ---")
    current_persona = load_persona()
    
    if current_persona:
        print("Existing persona found:")
        for key, value in current_persona.items():
            print(f"  {key.replace('_', ' ').title()}: {value}")
        
        choice = input("Use this persona? (yes/no/new): ").lower().strip()
        if choice == 'yes':
            return current_persona
        elif choice == 'new':
            pass # Proceed to build new persona
        else:
            print("Defaulting to a fresh persona configuration.")
    else:
        print("No existing persona found. Let's create one.")

    new_persona = {}
    
    print("
Let's define BRO's persona. You can choose from options or type your own.")
    
    # Tone
    tone_options = ["formal", "casual", "enthusiastic", "direct", "humorous", "technical", "philosophical"]
    print(f"
1. Choose a Tone ({'/'.join(tone_options)}) or type your own:")
    tone = input(f"Current {'['+current_persona.get('tone', 'default')+']' if current_persona else ''} -> ").strip() or (current_persona.get('tone') if current_persona else 'direct')
    new_persona['tone'] = tone
    
    # Verbosity
    verbosity_options = ["concise", "moderate", "detailed", "verbose"]
    print(f"
2. Choose Verbosity ({'/'.join(verbosity_options)}) or type your own:")
    verbosity = input(f"Current {'['+current_persona.get('verbosity', 'default')+']' if current_persona else ''} -> ").strip() or (current_persona.get('verbosity') if current_persona else 'moderate')
    new_persona['verbosity'] = verbosity
    
    # Emphasis
    emphasis_options = ["efficiency", "creativity", "safety", "robustness", "innovation", "cost-effectiveness", "user-experience"]
    print(f"
3. Choose an Emphasis ({'/'.join(emphasis_options)}) or type your own:")
    emphasis = input(f"Current {'['+current_persona.get('emphasis', 'default')+']' if current_persona else ''} -> ").strip() or (current_persona.get('emphasis') if current_persona else 'efficiency')
    new_persona['emphasis'] = emphasis

    # Role/Perspective
    role_options = ["senior developer", "project manager", "devops engineer", "researcher", "strategist", "mentor", "friendly assistant"]
    print(f"
4. Choose a Role/Perspective ({'/'.join(role_options)}) or type your own:")
    role = input(f"Current {'['+current_persona.get('role', 'default')+']' if current_persona else ''} -> ").strip() or (current_persona.get('role') if current_persona else 'senior developer')
    new_persona['role'] = role

    print("
New persona configured:")
    for key, value in new_persona.items():
        print(f"  {key.replace('_', ' ').title()}: {value}")

    save_persona(new_persona)
    return new_persona

if __name__ == "__main__":
    # Test the wizard if run directly
    persona = run_persona_wizard()
    print("
Wizard completed. BRO would now operate with this persona:")
    print(persona)
