import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { expenseCommand } from './expense';
import { dailyCommand } from './daily';
import { handleBalance } from './balance';
import { handleExpense } from './expense';
import { handleRevenue } from './revenue';
import { handleDaily } from './daily';

export const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View Stripe balance and recent payouts'),
  new SlashCommandBuilder()
    .setName('revenue')
    .setDescription('View total revenue, expenses, and true total'),
  expenseCommand,
  dailyCommand,
];

export async function registerCommands(clientId: string, token: string, guildId?: string) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Registering slash commands...');

    const commandData = commands.map((cmd) => cmd.toJSON());

    if (guildId) {
      try {
        // Register commands for specific guild (faster, appears immediately)
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commandData,
        });
        console.log(`✅ Successfully registered ${commandData.length} guild commands`);
        
        // Clear global commands to prevent duplicates
        try {
          await rest.put(Routes.applicationCommands(clientId), {
            body: [],
          });
          console.log('✅ Cleared global commands to prevent duplicates');
        } catch (clearError) {
          console.warn('⚠️  Could not clear global commands (this is okay if none exist):', clearError);
        }
        
        return;
      } catch (guildError: any) {
        // If guild registration fails, log error but don't fall back to global
        console.error('❌ Failed to register guild commands:', guildError);
        throw guildError;
      }
    }
    
    // Only register globally if no guild ID is provided
    await rest.put(Routes.applicationCommands(clientId), {
      body: commandData,
    });
    console.log(`✅ Successfully registered ${commandData.length} global commands`);
    console.log('ℹ️  Note: Global commands may take up to 1 hour to appear in Discord');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    throw error;
  }
}

export async function handleCommand(interaction: any) {
  const commandName = interaction.commandName;

  if (commandName === 'balance') {
    await handleBalance(interaction);
  } else if (commandName === 'expense') {
    await handleExpense(interaction);
  } else if (commandName === 'revenue') {
    await handleRevenue(interaction);
  } else if (commandName === 'daily') {
    await handleDaily(interaction);
  }
}

