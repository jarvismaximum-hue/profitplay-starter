#!/usr/bin/env node
/**
 * ProfitPlay Starter Bot (Node.js)
 *
 * A simple trading bot that:
 *   1. Auto-registers on first run and saves the API key
 *   2. Connects to the arena via WebSocket for real-time events
 *   3. Places bets using a basic random/contrarian strategy
 *   4. Prints status after each trade
 *
 * Usage:
 *     npm install
 *     node bot.js          # polling mode
 *     node bot.js --ws     # websocket mode
 */

const fs = require("fs");
const path = require("path");

// Load .env from the project root
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PROFITPLAY_URL || "https://profitplay-1066795472378.us-east1.run.app";
let API_KEY = process.env.PROFITPLAY_API_KEY || "";

const BOT_NAME = `node-starter-${Math.floor(1000 + Math.random() * 9000)}`;
const GAME_TYPE = "coinflip";      // Start simple. Options: btc-5min, eth-5min, etc.
const BET_SHARES = 5;              // Shares per bet
const TRADE_INTERVAL = 10_000;     // Milliseconds between trades in polling mode

// ---------------------------------------------------------------------------
// Helper: save API key to .env
// ---------------------------------------------------------------------------

function saveApiKey(apiKey) {
  const envPath = path.join(__dirname, "..", ".env");
  let lines = [];

  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf-8").split("\n");
  }

  // Replace or append the API key
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("PROFITPLAY_API_KEY")) {
      lines[i] = `PROFITPLAY_API_KEY=${apiKey}`;
      found = true;
      break;
    }
  }
  if (!found) lines.push(`PROFITPLAY_API_KEY=${apiKey}`);

  // Ensure URL is present
  if (!lines.some((l) => l.startsWith("PROFITPLAY_URL"))) {
    lines.push(`PROFITPLAY_URL=${BASE_URL}`);
  }

  fs.writeFileSync(envPath, lines.join("\n") + "\n");
  console.log(`[*] API key saved to ${envPath}`);
}

// ---------------------------------------------------------------------------
// Step 1: Register (or reuse existing key)
// ---------------------------------------------------------------------------

async function registerAgent() {
  if (API_KEY) {
    console.log(`[*] Using existing API key: ${API_KEY.slice(0, 12)}...`);
    return API_KEY;
  }

  console.log(`[*] Registering new agent: ${BOT_NAME}`);
  const resp = await fetch(`${BASE_URL}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: BOT_NAME }),
  });

  if (!resp.ok) {
    throw new Error(`Registration failed: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  API_KEY = data.api_key;

  console.log("[+] Registered successfully!");
  console.log(`    Agent ID : ${data.agent_id || "N/A"}`);
  console.log(`    Name     : ${data.name || BOT_NAME}`);
  console.log(`    Wallet   : ${data.wallet_address || "N/A"}`);
  console.log(`    API Key  : ${API_KEY.slice(0, 12)}...`);

  saveApiKey(API_KEY);
  return API_KEY;
}

// ---------------------------------------------------------------------------
// Step 2: API helpers
// ---------------------------------------------------------------------------

function authHeaders() {
  return {
    Authorization: `ApiKey ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function getStatus() {
  const resp = await fetch(`${BASE_URL}/api/agent/status`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Status fetch failed: ${resp.status}`);
  return resp.json();
}

async function getArena() {
  const resp = await fetch(`${BASE_URL}/api/arena`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`Arena fetch failed: ${resp.status}`);
  return resp.json();
}

/**
 * Place a bet on the given game.
 *
 * @param {string} gameType - e.g. "coinflip", "btc-5min"
 * @param {"UP"|"DOWN"} side - direction to bet
 * @param {number} price - 0.01 to 0.99
 * @param {number} shares - number of shares
 */
async function placeBet(gameType, side, price, shares) {
  const resp = await fetch(`${BASE_URL}/api/games/${gameType}/bet`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ side, price, shares }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Bet failed: ${resp.status} — ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Step 3: Strategy
// ---------------------------------------------------------------------------

/** Pick UP or DOWN randomly. Replace with your own logic! */
function pickSide() {
  return Math.random() > 0.5 ? "UP" : "DOWN";
}

/** Pick a price near 0.50 with slight randomization. */
function pickPrice() {
  return Math.round((0.40 + Math.random() * 0.20) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Step 4: Polling loop
// ---------------------------------------------------------------------------

async function runPollingLoop() {
  console.log(`\n[*] Starting polling loop on '${GAME_TYPE}' every ${TRADE_INTERVAL / 1000}s`);
  console.log("    Press Ctrl+C to stop\n");

  let tradeCount = 0;

  while (true) {
    try {
      const side = pickSide();
      const price = pickPrice();

      console.log(`[>] Betting ${BET_SHARES} shares on ${side} at $${price.toFixed(2)} in ${GAME_TYPE}...`);
      const result = await placeBet(GAME_TYPE, side, price, BET_SHARES);
      tradeCount++;
      console.log(`[+] Trade #${tradeCount} placed:`, JSON.stringify(result, null, 2));

      // Show status every 3rd trade
      if (tradeCount % 3 === 0) {
        const status = await getStatus();
        console.log("\n[i] Agent Status:", JSON.stringify(status, null, 2), "\n");
      }
    } catch (err) {
      console.log(`[!] Error: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, TRADE_INTERVAL));
  }
}

// ---------------------------------------------------------------------------
// Step 5 (optional): WebSocket mode
// ---------------------------------------------------------------------------

async function runWebSocketMode() {
  let io;
  try {
    io = require("socket.io-client");
  } catch {
    console.log("[!] socket.io-client not installed. Run: npm install");
    console.log("[*] Falling back to polling mode...\n");
    return runPollingLoop();
  }

  console.log(`[*] Connecting to WebSocket at ${BASE_URL} ...`);
  const socket = io(BASE_URL, { transports: ["websocket"] });

  socket.on("connect", () => {
    console.log("[+] WebSocket connected!");
  });

  socket.on("disconnect", () => {
    console.log("[-] WebSocket disconnected");
  });

  // When a new market round opens, place a bet
  socket.on("marketOpen", async (data) => {
    console.log(`\n[>] Market opened:`, JSON.stringify(data, null, 2));
    const game = data.gameType || GAME_TYPE;
    const side = pickSide();
    const price = pickPrice();
    try {
      const result = await placeBet(game, side, price, BET_SHARES);
      console.log(`[+] Bet placed: ${side} at $${price.toFixed(2)} —`, JSON.stringify(result, null, 2));
    } catch (err) {
      console.log(`[!] Failed to place bet: ${err.message}`);
    }
  });

  // Market settled — check results
  socket.on("marketSettled", (data) => {
    console.log(`\n[i] Market settled:`, JSON.stringify(data, null, 2));
  });

  // Candle data (uncomment to use for strategy)
  socket.on("candle", (data) => {
    // console.log("[~] Candle:", data);
  });

  // Chat messages
  socket.on("chat", (data) => {
    console.log(`[chat]`, data);
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("  ProfitPlay Starter Bot (Node.js)");
  console.log("=".repeat(60));
  console.log();

  await registerAgent();

  // Show initial status
  try {
    const status = await getStatus();
    console.log("\n[i] Current status:", JSON.stringify(status, null, 2), "\n");
  } catch (err) {
    console.log(`[!] Could not fetch status: ${err.message}\n`);
  }

  // Choose mode
  if (process.argv.includes("--ws")) {
    await runWebSocketMode();
  } else {
    await runPollingLoop();
  }
}

main().catch((err) => {
  console.error("[!] Fatal error:", err);
  process.exit(1);
});
