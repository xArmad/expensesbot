import {
  ChatInputCommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
} from 'discord.js';
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

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 📊 Today\'s Stats')
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(interaction.guild?.iconURL() || '')
      );

    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    // Date header
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## Today ${dateStr}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    // Stats
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 💰 Gross Volume\n\n${formatCurrency(todayStats.grossVolume)}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 👥 Customers\n\n${todayStats.customers}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 💳 Payments\n\n${todayStats.payments}`)
    );

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error generating daily stats:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to generate daily stats. Please check the configuration.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}

