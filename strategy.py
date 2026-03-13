"""
Example strategy framework for ProfitPlay agents.
Demonstrates momentum and mean-reversion approaches.
"""

import time
import random
from profitplay import ProfitPlay

BASE_URL = "https://profitplay-1066795472378.us-east1.run.app"


def momentum_strategy(history: list) -> str:
    """Bet with the trend — if last 3 markets resolved UP, bet UP."""
    if len(history) < 3:
        return random.choice(["UP", "DOWN"])
    recent = [m.get("resolution") for m in history[:3]]
    up_count = sum(1 for r in recent if r == "UP")
    return "UP" if up_count >= 2 else "DOWN"


def mean_reversion_strategy(history: list) -> str:
    """Bet against the streak — if 3+ UPs in a row, bet DOWN."""
    if len(history) < 3:
        return random.choice(["UP", "DOWN"])
    streak = history[0].get("resolution", "UP")
    streak_len = 0
    for m in history:
        if m.get("resolution") == streak:
            streak_len += 1
        else:
            break
    if streak_len >= 3:
        return "DOWN" if streak == "UP" else "UP"
    return random.choice(["UP", "DOWN"])


def run_agent(strategy_fn, game_type="btc-5min", rounds=10):
    """Run a trading agent with the given strategy."""
    agent_name = f"strat-{strategy_fn.__name__}-{random.randint(100, 999)}"
    pp = ProfitPlay.register(agent_name, base_url=BASE_URL)
    print(f"Agent: {pp.name} | Strategy: {strategy_fn.__name__}")
    print(f"Starting balance: {pp.balance()}")

    wins = 0
    losses = 0

    for round_num in range(1, rounds + 1):
        market = pp.market(game_type)
        if not market or market.get("status") != "open":
            print(f"Round {round_num}: No open market, waiting...")
            time.sleep(30)
            continue

        history = pp.history(game_type, limit=10)
        side = strategy_fn(history)
        price = 0.55 if side == "UP" else 0.45  # slight edge pricing

        print(f"Round {round_num}: Betting {side} @ {price}")
        try:
            pp.bet(game_type, side, price, shares=5)
        except Exception as e:
            print(f"  Bet failed: {e}")
            continue

        # Wait for market to settle
        time.sleep(market.get("timeLeftMs", 300000) / 1000 + 5)

        # Check result
        new_history = pp.history(game_type, limit=1)
        if new_history:
            result = new_history[0].get("resolution")
            if result == side:
                wins += 1
                print(f"  WIN! Market resolved {result}")
            else:
                losses += 1
                print(f"  LOSS. Market resolved {result}")

    balance = pp.balance()
    print(f"\nResults: {wins}W / {losses}L | Balance: {balance}")
    return {"wins": wins, "losses": losses, "balance": balance}


if __name__ == "__main__":
    # Pick your strategy
    run_agent(momentum_strategy, game_type="btc-5min", rounds=5)
