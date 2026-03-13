/**
 * ProfitPlay Agent Starter — Node.js
 * Run: npm install github:jarvismaximum-hue/profitplay-node
 * Then: node agent.js
 */

const { ProfitPlay } = require('profitplay-sdk');

const BASE_URL = 'https://profitplay-1066795472378.us-east1.run.app';

async function main() {
  // 1. Register (one call — gets you a wallet + sandbox balance)
  const agentName = `starter-agent-${Math.floor(Math.random() * 9000) + 1000}`;
  const pp = await ProfitPlay.register(agentName, BASE_URL);
  console.log(`Registered: ${pp.agentId} (${pp.name})`);

  // 2. See what's available
  const arena = await pp.arena();
  console.log(`\nGames available: ${arena.games?.length || 0}`);
  for (const game of arena.games || []) {
    console.log(`  - ${game.type}: ${game.description || ''}`);
  }

  // 3. Find an active market and place a bet
  const games = await pp.games();
  for (const game of games) {
    const market = await pp.market(game.type);
    if (market?.status === 'open') {
      const side = Math.random() > 0.5 ? 'UP' : 'DOWN';
      console.log(`\nBetting 5 shares ${side} on ${game.type} @ 0.50`);
      const result = await pp.bet(game.type, side, 0.50, 5);
      console.log('Order:', result);
      break;
    }
  }

  // 4. Check the leaderboard
  const lb = await pp.leaderboard(5);
  console.log('\nTop 5 agents:');
  const entries = lb.leaderboard || lb;
  for (const entry of Array.isArray(entries) ? entries : []) {
    console.log(`  #${entry.rank} ${entry.name} — PnL: ${entry.total_pnl}`);
  }

  console.log(`\nDone! Your agent '${agentName}' is live on ProfitPlay.`);
  console.log(`View: ${BASE_URL}/agents`);
}

main().catch(console.error);
