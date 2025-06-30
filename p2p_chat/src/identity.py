import secrets
import string
import json
from pathlib import Path
import os

CONFIG_DIR_NAME = ".p2p_chat_app_data"
CONFIG_FILE_NAME = "user_config.json"

def generate_user_id(length=24):
    """Generates a cryptographically secure random alphanumeric ID."""
    alphabet = string.ascii_letters + string.digits
    user_id = ''.join(secrets.choice(alphabet) for i in range(length))
    return user_id

def get_config_path():
    """Returns the path to the configuration file, creating directory if needed."""
    config_dir = Path.home() / CONFIG_DIR_NAME
    if not config_dir.exists():
        os.makedirs(config_dir)
    return config_dir / CONFIG_FILE_NAME

def save_user_profile(display_name, user_id):
    """Saves the user's display name and ID to a local config file."""
    config_path = get_config_path()
    profile_data = {
        "display_name": display_name,
        "user_id": user_id
    }
    with open(config_path, 'w') as f:
        json.dump(profile_data, f, indent=4)
    print(f"Profile saved to {config_path}")

def load_user_profile():
    """Loads the user's display name and ID from the local config file.

    Returns a tuple (display_name, user_id) or (None, None) if not found.
    """
    config_path = get_config_path()
    if not config_path.exists():
        return None, None

    try:
        with open(config_path, 'r') as f:
            profile_data = json.load(f)
            return profile_data.get("display_name"), profile_data.get("user_id")
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading profile: {e}")
        return None, None

def get_or_create_user_profile():
    """
    Loads user profile if it exists. If not, prompts the user to create one.
    Returns (display_name, user_id).
    """
    display_name, user_id = load_user_profile()

    if display_name and user_id:
        print(f"Welcome back, {display_name} (ID: {user_id})!")
        return display_name, user_id
    else:
        print("Setting up your profile...")
        while True:
            display_name_input = input("Enter your desired display name: ").strip()
            if display_name_input:
                break
            print("Display name cannot be empty.")

        user_id = generate_user_id()
        save_user_profile(display_name_input, user_id)
        print(f"Profile created! Your User ID is: {user_id}")
        print("Please save this ID securely. It's how others will find you.")
        return display_name_input, user_id

if __name__ == '__main__':
    # Example usage:
    # This part will run when the script is executed directly.
    # In the actual app, get_or_create_user_profile() would be called at startup.

    print("Attempting to load or create user profile...")
    current_display_name, current_user_id = get_or_create_user_profile()

    if current_display_name and current_user_id:
        print(f"\nUser Profile:")
        print(f"  Display Name: {current_display_name}")
        print(f"  User ID: {current_user_id}")

        # Test saving a new profile (simulating a change or initial setup)
        # Note: In a real app, you wouldn't typically re-run setup like this unless necessary.
        # For testing, let's try to load again to ensure it persists.
        print("\nReloading profile to verify...")
        reloaded_display_name, reloaded_user_id = load_user_profile()
        if reloaded_display_name and reloaded_user_id:
            print(f"  Reloaded Display Name: {reloaded_display_name}")
            print(f"  Reloaded User ID: {reloaded_user_id}")
            assert current_display_name == reloaded_display_name
            assert current_user_id == reloaded_user_id
            print("Profile reloaded successfully and matches.")
        else:
            print("Failed to reload profile.")
    else:
        print("Could not load or create a user profile.")

    # Demonstrate ID generation separately
    print(f"\nGenerated a sample new ID: {generate_user_id()}")
