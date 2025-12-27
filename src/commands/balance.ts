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
import { getBalance, getPayouts, getPendingPayouts, formatCurrency, formatDate } from '../stripe';
import { checkRolePermission } from '../utils/permissions';

export async function handleBalance(interaction: ChatInputCommandInteraction) {
  // Check if user has required role
  if (!(await checkRolePermission(interaction))) {
    return;
  }

  await interaction.deferReply();

  try {
    const balance = await getBalance();
    const payouts = await getPayouts(10);
    const pendingPayouts = await getPendingPayouts();
    
    // Calculate in-transit payouts (pending payouts that are scheduled)
    const inTransitTotal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    const container = new ContainerBuilder();

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent('# 💰 Stripe Balance')
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

    // Balance information
    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`## Available Funds\n\n**Available to Pay Out:** ${formatCurrency(balance.available)}\n**Available Soon (Estimated):** ${formatCurrency(balance.pending)}\n**In Transit Payouts:** ${formatCurrency(inTransitTotal)}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`### Total Balance\n\n${formatCurrency(balance.total)}`)
    );

    if (payouts.length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Large)
      );

      const payoutList = payouts
        .slice(0, 5)
        .map(
          (p) =>
            `- ${formatCurrency(p.amount)} - ${p.status === 'paid' ? 'Paid' : p.status} - ${formatDate(p.arrivalDate)}`
        )
        .join('\n');

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`## Recent Payouts\n\n${payoutList}`)
      );
    }

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Error\n\nFailed to fetch Stripe balance. Please check the configuration.')
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
  }
}
