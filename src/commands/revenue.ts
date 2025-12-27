import {
  ChatInputCommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { getBalance, getPayouts, getPendingPayouts, formatCurrency } from '../stripe';
import { getTotalExpenses } from '../database';
import { checkRolePermission } from '../utils/permissions';

export async function handleRevenue(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  await interaction.deferReply();

  try {
    // Fetch all Stripe data
    const balance = await getBalance();
    const payouts = await getPayouts(100);
    const pendingPayouts = await getPendingPayouts();

    // Calculate total revenue - EVERYTHING added up
    // Available balance + pending balance + paid payouts + pending payouts
    const paidPayouts = payouts.filter((p) => p.status === 'paid');
    const totalPaidPayouts = paidPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalPendingPayouts = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    
    // Total revenue = available + pending + all paid payouts + all pending payouts
    const totalRevenue = (balance.available + balance.pending + totalPaidPayouts + totalPendingPayouts) / 100;

    // Fetch total expenses
    const totalExpenses = await getTotalExpenses();

    // Calculate true total (revenue - expenses)
    const trueTotal = totalRevenue - totalExpenses;

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 💰 Revenue Summary')
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

    // Total Revenue
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## 📈 Total Revenue\n\n${formatCurrency((balance.available + balance.pending + totalPaidPayouts + totalPendingPayouts))}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    // Total Expenses
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## 💸 Total Expenses\n\n-$${totalExpenses.toFixed(2)}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Large)
    );

    // True Total
    const profitColor = trueTotal >= 0 ? '✅' : '❌';
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## ${profitColor} True Total (Profit/Loss)\n\n**$${trueTotal.toFixed(2)}**`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Large)
    );

    // Breakdown
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## 📊 Breakdown\n\n**Available:** ${formatCurrency(balance.available)}\n**Pending:** ${formatCurrency(balance.pending)}\n**Paid Payouts:** ${formatCurrency(totalPaidPayouts)}\n**Pending Payouts:** ${formatCurrency(totalPendingPayouts)}`)
    );

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to fetch revenue data. Please check the configuration.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}
