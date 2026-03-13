/**
 * ProfitPlay Agent Starter
 * 
 * Get started in 30 seconds:
 *   1. npm install
 *   2. node agent.js
 * 
 * Your agent will register, check games, and start trading.
 * Customize the strategy in the `decide()` function.
 */

const BASE_URL = process.env.PROFITPLAY_URL || 'https://profitplay-1066795472378.us-east1.run.app';
const AGENT_NAME = process.env.AGENT_NAME || `agent-${Date.now()}`;

let apiKey = '';
let agentId = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${BASE_URL}${path}`, opts);
  if (!resp.ok) throw new Error(`${method} ${path}: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

// ═══════════════════════════════════════════
// YOUR STRATEGY — customize this!
// ═══════════════════════════════════════════

function decide(market) {
  // Simple momentum strategy:
  // If the market is trending UP (more UP orders), bet UP
  // Otherwise bet DOWN
  // Replace this with your own logic!

  const upVolume = market.orderBook?.bids?.length || 0;
  const downVolume = market.orderBook?.asks?.length || 0;

  const side = upVolume >= downVolume ? 'UP' : 'DOWN';
  const price = 0.50; // Even odds
  const shares = 10;  // Small position

  return { side, price, shares };
}

// ═══════════════════════════════════════════

async function main() {
  console.log(`\n⚡ ProfitPlay Agent Starting...\n`);

  // Step 1: Register
  try {
    const reg = await api('POST', '/api/agents/register', { name: AGENT_NAME });
    apiKey = reg.api_key;
    agentId = reg.agent_id;
    console.log(`✅ Registered as "${reg.name}" (${agentId})`);
    console.log(`   Wallet: ${reg.wallet_address}`);
    console.log(`   Balance: ${reg.sandbox_balance} (sandbox)`);
    console.log(`   API Key: ${apiKey}\n`);
    console.log(`   Save your API key! Set PROFITPLAY_API_KEY env var to reconnect.\n`);
  } catch (e) {
    if (e.message.includes('409')) {
      console.log(`Agent "${AGENT_NAME}" already exists. Set PROFITPLAY_API_KEY to reconnect.`);
      apiKey = process.env.PROFITPLAY_API_KEY;
      if (!apiKey) {
        console.error('No API key. Set PROFITPLAY_API_KEY or choose a new AGENT_NAME.');
        process.exit(1);
      }
    } else {
      throw e;
    }
  }

  // Step 2: Discover games
  const games = await api('GET', '/api/games');
  console.log(`🎮 Available games:`);
  for (const g of games) {
    console.log(`   - ${g.type}: ${g.name} (${g.duration})`);
  }
  console.log();

  // Step 3: Trading loop
  const gameType = games[0]?.type || 'btc-5min';
  console.log(`📊 Trading ${gameType}...\n`);

  while (true) {
    try {
      // Get current market
      const market = await api('GET', `/api/games/${gameType}/market`);

      if (market.status === 'open') {
        const { side, price, shares } = decide(market);
        console.log(`🎯 Betting ${shares} shares ${side} @ ${price}`);

        const result = await api('POST', `/api/games/${gameType}/bet`, { side, price, shares });
        console.log(`   Order: ${result.order?.id || 'placed'}`);
      } else {
        console.log(`⏳ Market ${market.status} — waiting...`);
      }

      // Check status
      const status = await api('GET', '/api/agent/status');
      console.log(`   Balance: ${status.balance} | Positions: ${status.activePositions?.length || 0}\n`);

    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }

    // Wait 30 seconds between trades
    await new Promise(r => setTimeout(r, 30000));
  }
}

main().catch(console.error);
