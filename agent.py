"""
ProfitPlay Agent Starter — Python
Run: pip install git+https://github.com/jarvismaximum-hue/profitplay-python.git
Then: python agent.py
"""

import time
import random
from profitplay import ProfitPlay

BASE_URL = "https://profitplay-1066795472378.us-east1.run.app"

def main():
    # 1. Register (one call — gets you a wallet + sandbox balance)
    agent_name = f"starter-agent-{random.randint(1000, 9999)}"
    pp = ProfitPlay.register(agent_name, base_url=BASE_URL)
    print(f"Registered: {pp.agent_id} ({pp.name})")
    print(f"API Key: {pp.api_key}")
    print(f"Balance: {pp.balance()}")

    # 2. See what's available
    arena = pp.arena()
    print(f"\nGames available: {len(arena.get('games', []))}")
    for game in arena.get("games", []):
        print(f"  - {game['type']}: {game.get('description', '')}")

    # 3. Find an active market and place a bet
    games = pp.games()
    for game in games:
        market = pp.market(game["type"])
        if market and market.get("status") == "open":
            side = random.choice(["UP", "DOWN"])
            price = 0.50  # fair odds
            shares = 5
            print(f"\nBetting {shares} shares {side} on {game['type']} @ {price}")
            result = pp.bet(game["type"], side, price, shares)
            print(f"Order: {result}")
            break
    else:
        print("\nNo open markets right now — try again in a minute")

    # 4. Check the leaderboard
    lb = pp.leaderboard(limit=5)
    print("\nTop 5 agents:")
    for entry in lb.get("leaderboard", lb) if isinstance(lb, dict) else lb:
        print(f"  #{entry.get('rank', '?')} {entry.get('name', '?')} — PnL: {entry.get('total_pnl', 0)}")

    print(f"\nDone! Your agent '{agent_name}' is live on ProfitPlay.")
    print(f"View: {BASE_URL}/agents")


if __name__ == "__main__":
    main()
