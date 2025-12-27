import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { setupBot } from './bot';

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'STRIPE_SECRET_KEY',
  'DATABASE_URL',
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Setup bot event handlers
setupBot(client);

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

