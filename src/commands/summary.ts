import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getBalance, getPayouts, getPendingPayouts, formatCurrency, formatDate } from '../stripe';
import { getTotalExpenses, getExpenses } from '../database';
import { checkRolePermission } from '../utils/permissions';

export async function handleSummary(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  await interaction.deferReply();

  try {
    // Fetch Stripe data
    const balance = await getBalance();
    const payouts = await getPayouts(20);
    const pendingPayouts = await getPendingPayouts();

    // Calculate total payouts (paid + pending)
    const paidPayouts = payouts.filter((p) => p.status === 'paid');
    const totalPaidPayouts = paidPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalPendingPayouts = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalPayouts = totalPaidPayouts + totalPendingPayouts;

    // Fetch expenses
    const totalExpenses = await getTotalExpenses();
    const recentExpenses = await getExpenses(10);

    // Calculate revenue (payouts - expenses)
    const revenue = totalPaidPayouts / 100 - totalExpenses; // Convert cents to dollars

    // Build payout list
    let payoutList = paidPayouts
      .slice(0, 10)
      .map((p) => `${formatCurrency(p.amount)} - ${formatDate(p.arrivalDate)}`)
      .join('\n');

    if (pendingPayouts.length > 0) {
      const pendingList = pendingPayouts
        .map((p) => `${formatCurrency(p.amount)} - Pending`)
        .join('\n');
      payoutList = payoutList ? payoutList + '\n' + pendingList : pendingList;
    }

    // Build expense list
    const expenseList =
      recentExpenses.length > 0
        ? recentExpenses
            .slice(0, 10)
            .map(
              (exp) =>
                `-$${exp.amount.toFixed(2)}${exp.category ? ` (${exp.category})` : ''}`
            )
            .join('\n')
        : 'No expenses';

    const embed = new EmbedBuilder()
      .setTitle('📊 Financial Summary')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '💰 Payouts',
          value: payoutList || 'No payouts',
          inline: false,
        },
        {
          name: 'Total Payouts',
          value: formatCurrency(totalPayouts),
          inline: true,
        },
        {
          name: '💸 Expenses',
          value: expenseList.length > 1024 ? expenseList.substring(0, 1020) + '...' : expenseList,
          inline: false,
        },
        {
          name: 'Total Expenses',
          value: `-$${totalExpenses.toFixed(2)}`,
          inline: true,
        },
        {
          name: '📈 Revenue',
          value: `$${revenue.toFixed(2)}`,
          inline: true,
        },
        {
          name: '💵 Available Balance',
          value: formatCurrency(balance.available),
          inline: true,
        },
        {
          name: '⏳ Pending Balance',
          value: formatCurrency(balance.pending),
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error generating summary:', error);
    await interaction.editReply({
      content: '❌ Failed to generate summary. Please check the configuration.',
    });
  }
}

