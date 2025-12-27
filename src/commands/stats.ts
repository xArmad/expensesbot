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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  Interaction,
} from 'discord.js';
import { getStatsForDate, formatCurrency } from '../stripe';
import { checkRolePermission } from '../utils/permissions';

export const statsCommand = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View stats for a specific date');

export async function handleStats(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  // Generate date options for the last 25 days (Discord limit is 25 options)
  const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
  const now = new Date();
  const dates: { date: Date; label: string; value: string }[] = [];

  for (let i = 0; i < 25; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const localTime = new Date(date.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dayName = days[localTime.getUTCDay()];
    const month = months[localTime.getUTCMonth()];
    const day = localTime.getUTCDate();
    const year = localTime.getUTCFullYear();
    
    let label: string;
    if (i === 0) {
      label = `Today - ${dayName} ${month} ${day}`;
    } else if (i === 1) {
      label = `Yesterday - ${dayName} ${month} ${day}`;
    } else {
      label = `${dayName} ${month} ${day}, ${year}`;
    }
    
    // Store the local date string (YYYY-MM-DD) for the selected date
    // We need to use the local date, not UTC date
    const localDateStr = `${localTime.getUTCFullYear()}-${String(localTime.getUTCMonth() + 1).padStart(2, '0')}-${String(localTime.getUTCDate()).padStart(2, '0')}`;
    
    dates.push({ date, label, value: localDateStr });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('stats_date_select')
    .setPlaceholder('Select a date to view stats')
    .setMaxValues(1);

  dates.forEach(({ label, value }) => {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(value)
    );
  });

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '📅 **Select a date to view stats:**',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleStatsDateSelect(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'stats_date_select') return;

  await interaction.deferUpdate();

  try {
    const selectedDateStr = interaction.values[0]; // Format: YYYY-MM-DD (local date)
    const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
    
    // Parse the local date string and convert to UTC date for the function
    // The date string represents a local date, so we need to create it at local midnight
    // then convert to UTC for the query
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    // Create date at local midnight, then subtract offset to get UTC equivalent
    const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const selectedDate = new Date(localMidnight.getTime() - (timezoneOffsetHours * 60 * 60 * 1000));
    
    // Get stats for the selected date
    const stats = await getStatsForDate(selectedDate);
    
    // Format the date for display
    const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
    const localTime = new Date(selectedDate.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateStr = `${days[localTime.getUTCDay()]} ${months[localTime.getUTCMonth()]} ${localTime.getUTCDate()}, ${localTime.getUTCFullYear()}`;

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 📊 Daily Stats')
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
        .setContent(`## ${dateStr}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    // Stats
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 💰 Gross Volume\n\n${formatCurrency(stats.grossVolume)}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 👥 Customers\n\n${stats.customers}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### 💳 Payments\n\n${stats.payments}`)
    );

    await interaction.editReply({
      content: null, // Remove content when using components v2
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error fetching stats for date:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to fetch stats for the selected date. Please try again.')
    );
    await interaction.editReply({
      content: null, // Remove content when using components v2
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}

