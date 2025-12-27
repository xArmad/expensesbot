import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getTodayStats, formatCurrency } from '../stripe';
import { checkRolePermission } from '../utils/permissions';

export const dailyCommand = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Show today\'s stats (gross volume, customers, and payments)');

export async function handleDaily(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  await interaction.deferReply();

  try {
    // Get today's stats from Stripe
    const todayStats = await getTodayStats();
    
    // Format today's date in local timezone (matching the data range)
    const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
    const now = new Date();
    const localTime = new Date(now.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateStr = `${days[localTime.getUTCDay()]} ${months[localTime.getUTCMonth()]} ${localTime.getUTCDate()}`;
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Today\'s Stats')
      .setDescription(`**Today ${dateStr}**`)
      .setColor(0x5865F2)
      .addFields(
        {
          name: '💰 Gross Volume',
          value: formatCurrency(todayStats.grossVolume),
          inline: true,
        },
        {
          name: '👥 Customers',
          value: todayStats.customers.toString(),
          inline: true,
        },
        {
          name: '💳 Payments',
          value: todayStats.payments.toString(),
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error generating daily stats:', error);
    await interaction.editReply({
      content: '❌ Failed to generate daily stats. Please check the configuration.',
    });
  }
}

