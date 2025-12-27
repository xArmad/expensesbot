import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import { initializeDatabase } from './database';
import { registerCommands, handleCommand } from './commands';
import { handleCategorySelect, handleExpenseModal, handleRemoveSelect } from './commands/expense';
import { handleHistoryDateSelect } from './commands/stats';

export function setupBot(client: Client) {
  client.on('error', (error: Error) => {
    console.error('❌ Discord client error:', error);
  });

  client.on('warn', (warning: string) => {
    console.warn('⚠️  Discord client warning:', warning);
  });

  client.once('ready', async () => {
    console.log(`🤖 Bot logged in as ${client.user?.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} guild(s)`);

    // Initialize database
    try {
      await initializeDatabase();
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
    }

    // Set bot presence
    try {
      await client.user?.setPresence({
        activities: [
          {
            name: 'Financial Tracking',
            type: 0, // Playing
          },
        ],
        status: 'online',
      });
      console.log('✅ Bot presence set');
    } catch (error) {
      console.warn('⚠️  Failed to set bot presence:', error);
    }

    // Register slash commands
    const clientId = process.env.DISCORD_CLIENT_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (clientId && token) {
      try {
        await registerCommands(clientId, token, guildId);
      } catch (error) {
        console.error('❌ Failed to register commands:', error);
      }
    } else {
      console.warn('⚠️  Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN, skipping command registration');
    }
  });

  // Handle slash command interactions
  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      // Handle select menu interactions
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'expense_add_category') {
          await handleCategorySelect(interaction);
          return;
        }
        if (interaction.customId === 'expense_remove_select') {
          await handleRemoveSelect(interaction);
          return;
        }
        if (interaction.customId === 'history_date_select') {
          await handleHistoryDateSelect(interaction);
          return;
        }
      }

      // Handle modal submissions
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('expense_modal_')) {
          await handleExpenseModal(interaction);
          return;
        }
      }

      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      }
    } catch (error) {
      console.error('❌ Error handling interaction:', error);
      if (interaction.isChatInputCommand() || interaction.isMessageComponent() || interaction.isModalSubmit()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true,
          }).catch(() => {});
        } else {
          await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true,
          }).catch(() => {});
        }
      }
    }
  });
}

