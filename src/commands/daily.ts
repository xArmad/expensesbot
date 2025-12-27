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
    
    // Format today's date
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateStr = `${days[today.getDay()]} ${months[today.getMonth()]} ${today.getDate()}`;
    
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

