import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
} from 'discord.js';

const REQUIRED_ROLE_ID = process.env.DISCORD_REQUIRED_ROLE_ID || '1446621063088701471';

export async function hasRequiredRole(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) {
    return false;
  }

  const member = interaction.member as GuildMember;
  if (!member) {
    return false;
  }

  // Check if user has the required role
  return member.roles.cache.has(REQUIRED_ROLE_ID);
}

export async function checkRolePermission(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const hasRole = await hasRequiredRole(interaction);
  
  if (!hasRole) {
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# ❌ Permission Denied\n\nYou do not have permission to use this bot. You need the required role to access these commands.')
    );
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [errorContainer],
    });
    return false;
  }
  
  return true;
}

