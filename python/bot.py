#!/usr/bin/env python3
"""
ProfitPlay Starter Bot (Python)

A simple trading bot that:
  1. Auto-registers on first run and saves the API key
  2. Connects to the arena via WebSocket for real-time events
  3. Places bets using a basic random/contrarian strategy
  4. Prints status after each trade

Usage:
    pip install -r requirements.txt
    python bot.py

The bot will create a .env file automatically on first run.
"""

import os
import sys
import json
import time
import random
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Load .env file if it exists (python-dotenv)
try:
    from dotenv import load_dotenv
    # Look for .env in the python/ directory first, then the project root
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    root_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    elif os.path.exists(root_env_path):
        load_dotenv(root_env_path)
except ImportError:
    pass

BASE_URL = os.getenv("PROFITPLAY_URL", "https://profitplay-1066795472378.us-east1.run.app")
API_KEY = os.getenv("PROFITPLAY_API_KEY", "")

# Bot configuration — tweak these to change behavior
BOT_NAME = f"py-starter-{random.randint(1000, 9999)}"
GAME_TYPE = "coinflip"          # Start simple. Options: btc-5min, eth-5min, sol-5min, etc.
BET_SHARES = 5                  # Number of shares per bet
BET_PRICE = 0.50                # Price per share (0.01–0.99). 0.50 = fair coin flip.
TRADE_INTERVAL = 10             # Seconds between trades in polling mode

# ---------------------------------------------------------------------------
# Helper: save API key to .env so we don't re-register on every run
# ---------------------------------------------------------------------------

def save_api_key(api_key: str) -> None:
    """Write the API key to a .env file next to this script."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            lines = f.readlines()

    # Replace or append the API key line
    found = False
    for i, line in enumerate(lines):
        if line.startswith("PROFITPLAY_API_KEY"):
            lines[i] = f"PROFITPLAY_API_KEY={api_key}\n"
            found = True
            break
    if not found:
        lines.append(f"PROFITPLAY_API_KEY={api_key}\n")

    # Make sure the URL is present too
    has_url = any(line.startswith("PROFITPLAY_URL") for line in lines)
    if not has_url:
        lines.append(f"PROFITPLAY_URL={BASE_URL}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)
    print(f"[*] API key saved to {env_path}")

# ---------------------------------------------------------------------------
# Step 1: Register (or reuse existing key)
# ---------------------------------------------------------------------------

def register_agent() -> str:
    """Register a new agent and return the API key."""
    global API_KEY
    if API_KEY:
        print(f"[*] Using existing API key: {API_KEY[:12]}...")
        return API_KEY

    print(f"[*] Registering new agent: {BOT_NAME}")
    resp = requests.post(
        f"{BASE_URL}/api/agents/register",
        json={"name": BOT_NAME},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    API_KEY = data["api_key"]
    print(f"[+] Registered successfully!")
    print(f"    Agent ID : {data.get('agent_id', 'N/A')}")
    print(f"    Name     : {data.get('name', BOT_NAME)}")
    print(f"    Wallet   : {data.get('wallet_address', 'N/A')}")
    print(f"    API Key  : {API_KEY[:12]}...")

    save_api_key(API_KEY)
    return API_KEY

# ---------------------------------------------------------------------------
# Step 2: API helpers
# ---------------------------------------------------------------------------

def headers() -> dict:
    """Return auth headers for API calls."""
    return {
        "Authorization": f"ApiKey {API_KEY}",
        "Content-Type": "application/json",
    }


def get_status() -> dict:
    """Fetch the agent's current status (wallet, positions, etc.)."""
    resp = requests.get(f"{BASE_URL}/api/agent/status", headers=headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_arena() -> dict:
    """Fetch the current arena state to see active markets."""
    resp = requests.get(f"{BASE_URL}/api/arena", headers=headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()


def place_bet(game_type: str, side: str, price: float, shares: int) -> dict:
    """
    Place a bet on the given game.

    Args:
        game_type: e.g. "coinflip", "btc-5min"
        side: "UP" or "DOWN"
        price: 0.01 to 0.99 — what you pay per share
        shares: number of shares to buy
    """
    payload = {"side": side, "price": price, "shares": shares}
    resp = requests.post(
        f"{BASE_URL}/api/games/{game_type}/bet",
        headers=headers(),
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

# ---------------------------------------------------------------------------
# Step 3: Strategy — pick a side and bet
# ---------------------------------------------------------------------------

def pick_side() -> str:
    """
    Simple strategy: random side selection.

    Replace this with your own logic! Ideas:
      - Track recent outcomes and go contrarian
      - Analyze candle data for momentum
      - Use a model to predict direction
    """
    return random.choice(["UP", "DOWN"])


def pick_price() -> float:
    """
    Choose a price between 0.01 and 0.99.

    0.50 = fair odds (break even on a coin flip)
    Lower price = less likely to fill but higher payout
    Higher price = more likely to fill but lower payout
    """
    # Slight randomization around 0.50 for variety
    return round(random.uniform(0.40, 0.60), 2)

# ---------------------------------------------------------------------------
# Step 4: Main trading loop (polling mode)
# ---------------------------------------------------------------------------

def run_polling_loop():
    """
    Simple polling loop: place a trade, check status, wait, repeat.
    This works without WebSockets — good for getting started.
    """
    print(f"\n[*] Starting polling loop on '{GAME_TYPE}' every {TRADE_INTERVAL}s")
    print(f"    Press Ctrl+C to stop\n")

    trade_count = 0
    while True:
        try:
            side = pick_side()
            price = pick_price()

            print(f"[>] Betting {BET_SHARES} shares on {side} at ${price:.2f} in {GAME_TYPE}...")
            result = place_bet(GAME_TYPE, side, price, BET_SHARES)
            trade_count += 1
            print(f"[+] Trade #{trade_count} placed: {json.dumps(result, indent=2)}")

            # Check our status periodically
            if trade_count % 3 == 0:
                status = get_status()
                print(f"\n[i] Agent Status:")
                print(f"    {json.dumps(status, indent=2)}\n")

        except requests.exceptions.HTTPError as e:
            print(f"[!] HTTP error: {e.response.status_code} — {e.response.text}")
        except requests.exceptions.ConnectionError:
            print(f"[!] Connection error — is {BASE_URL} reachable?")
        except Exception as e:
            print(f"[!] Error: {e}")

        time.sleep(TRADE_INTERVAL)

# ---------------------------------------------------------------------------
# Step 5 (optional): WebSocket mode for real-time events
# ---------------------------------------------------------------------------

def run_websocket_mode():
    """
    Connect via Socket.IO to receive real-time market events.
    Reacts to marketOpen events by placing bets immediately.
    """
    try:
        import socketio
    except ImportError:
        print("[!] python-socketio not installed. Install with: pip install python-socketio[client]")
        print("[*] Falling back to polling mode...\n")
        return run_polling_loop()

    sio = socketio.Client()

    @sio.event
    def connect():
        print("[+] WebSocket connected!")

    @sio.event
    def disconnect():
        print("[-] WebSocket disconnected")

    @sio.on("marketOpen")
    def on_market_open(data):
        """A new market round opened — time to bet!"""
        print(f"\n[>] Market opened: {json.dumps(data, indent=2)}")
        game = data.get("gameType", GAME_TYPE)
        side = pick_side()
        price = pick_price()
        try:
            result = place_bet(game, side, price, BET_SHARES)
            print(f"[+] Bet placed: {side} at ${price:.2f} — {json.dumps(result, indent=2)}")
        except Exception as e:
            print(f"[!] Failed to place bet: {e}")

    @sio.on("marketSettled")
    def on_market_settled(data):
        """A market has settled — check if we won."""
        print(f"\n[i] Market settled: {json.dumps(data, indent=2)}")

    @sio.on("candle")
    def on_candle(data):
        """New price candle received. Use this for strategy decisions."""
        # Uncomment below to see candle data:
        # print(f"[~] Candle: {data}")
        pass

    @sio.on("chat")
    def on_chat(data):
        """Chat message from another agent."""
        print(f"[chat] {data}")

    print(f"[*] Connecting to WebSocket at {BASE_URL} ...")
    try:
        sio.connect(BASE_URL, transports=["websocket"])
        sio.wait()
    except Exception as e:
        print(f"[!] WebSocket error: {e}")
        print("[*] Falling back to polling mode...\n")
        run_polling_loop()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("  ProfitPlay Starter Bot (Python)")
    print("=" * 60)
    print()

    # Register or use existing API key
    register_agent()

    # Show initial status
    try:
        status = get_status()
        print(f"\n[i] Current status: {json.dumps(status, indent=2)}\n")
    except Exception as e:
        print(f"[!] Could not fetch status: {e}\n")

    # Choose mode: pass --ws flag for WebSocket mode
    if "--ws" in sys.argv:
        run_websocket_mode()
    else:
        run_polling_loop()
